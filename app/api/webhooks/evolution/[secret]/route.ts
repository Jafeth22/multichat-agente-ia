import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertContactForSender } from "@/lib/inbox-sync";
import { messagePreview } from "@/lib/message-preview";
import { sendEmail } from "@/lib/email/send-email";
import { normalizeWhatsAppJidPhone } from "@/lib/phone";

/**
 * POST /api/webhooks/evolution/[secret]
 *
 * Recibe los eventos de Evolution API (WhatsApp/Baileys). La app se
 * despliega en Vercel y Evolution API en Railway, en hosts distintos, asi
 * que no hay red privada compartida: el secreto en la URL (uno por canal,
 * generado al crear la instancia, guardado en channels.webhook_secret) es
 * lo que evita que alguien mas mande eventos falsos a este endpoint.
 *
 * Nota: los nombres exactos de los campos del payload dependen de la
 * version de Evolution API desplegada. Esto sigue el formato mas comun
 * (v2), pero conviene verificarlo contra logs reales al conectar la
 * primera instancia y ajustar si hace falta.
 */

interface EvolutionWebhookPayload {
  event?: string;
  instance?: string;
  data?: any;
}

function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> }
) {
  const { secret } = await params;

  let payload: EvolutionWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const instanceName = payload.instance;
  const event = (payload.event ?? "").toLowerCase().replace(/_/g, ".");

  if (!instanceName) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const supabase = await createServiceClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("evolution_instance_name", instanceName)
    .eq("platform", "whatsapp")
    .eq("is_active", true)
    .single();

  if (!channel) {
    return NextResponse.json({ ok: true, skipped: true, reason: "unknown_instance" });
  }

  if (!channel.webhook_secret || !secretsMatch(channel.webhook_secret, secret)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  try {
    if (event === "qrcode.updated") {
      await handleQrCodeUpdated(supabase, channel, payload.data);
    } else if (event === "connection.update") {
      await handleConnectionUpdate(supabase, channel, payload.data);
    } else if (event === "messages.upsert") {
      await handleMessagesUpsert(supabase, channel, payload.data);
    }
  } catch (err) {
    console.error("Evolution webhook processing error:", err);
  }

  return NextResponse.json({ ok: true });
}

async function handleQrCodeUpdated(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  channel: { id: string },
  data: any
) {
  const base64 = data?.qrcode?.base64 ?? data?.base64 ?? null;
  await supabase
    .from("channels")
    .update({ qr_code: base64, connection_status: "connecting" })
    .eq("id", channel.id);
}

async function handleConnectionUpdate(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  channel: {
    id: string;
    workspace_id: string;
    display_name: string | null;
    disconnected_notified_at: string | null;
  },
  data: any
) {
  const state: string | undefined = data?.state ?? data?.connection;

  if (state === "open") {
    await supabase
      .from("channels")
      .update({
        connection_status: "connected",
        qr_code: null,
        last_connected_at: new Date().toISOString(),
        disconnected_at: null,
        disconnected_notified_at: null,
      })
      .eq("id", channel.id);
    return;
  }

  if (state === "close") {
    await supabase
      .from("channels")
      .update({
        connection_status: "disconnected",
        disconnected_at: new Date().toISOString(),
      })
      .eq("id", channel.id);

    // Evita mandar la misma notificacion mas de una vez por corte.
    if (!channel.disconnected_notified_at) {
      await supabase.from("admin_notifications").insert({
        workspace_id: channel.workspace_id,
        type: "channel_disconnected",
        title: "WhatsApp se desconecto",
        message: `El canal "${channel.display_name ?? "WhatsApp"}" se desconecto. Reconectalo desde Integraciones escaneando el QR de nuevo.`,
        channel_id: channel.id,
      });

      await supabase
        .from("channels")
        .update({ disconnected_notified_at: new Date().toISOString() })
        .eq("id", channel.id);

      // Aviso por email a Owner/Admin (F7), ademas de la campanita in-app.
      // Best-effort: sendEmail nunca lanza, ya registra el error si falla.
      await notifyAdminsByEmail(supabase, channel);
    }
    return;
  }

  // state === "connecting" u otro: solo reflejar el estado.
  if (state) {
    await supabase
      .from("channels")
      .update({ connection_status: "connecting" })
      .eq("id", channel.id);
  }
}

async function notifyAdminsByEmail(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  channel: { id: string; workspace_id: string; display_name: string | null }
) {
  const { data: admins } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", channel.workspace_id)
    .in("role", ["owner", "admin"]);

  for (const admin of admins ?? []) {
    const { data } = await supabase.auth.admin.getUserById(admin.user_id);
    const email = data.user?.email;
    if (!email) continue;

    await sendEmail({
      supabase,
      workspaceId: channel.workspace_id,
      to: email,
      subject: "WhatsApp se desconecto",
      html: `<p>El canal "${channel.display_name ?? "WhatsApp"}" se desconecto.</p><p>Reconectalo desde <strong>Integraciones</strong> escaneando el QR de nuevo.</p>`,
      template: "whatsapp_disconnected",
    });
  }
}

function extractMessageText(message: any): string | null {
  return (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    null
  );
}

function hasMedia(message: any): boolean {
  return !!(
    message?.imageMessage ||
    message?.videoMessage ||
    message?.audioMessage ||
    message?.documentMessage ||
    message?.stickerMessage
  );
}

async function handleMessagesUpsert(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  channel: { id: string; workspace_id: string },
  data: any
) {
  // Evolution manda un mensaje por evento, o a veces { messages: [...] }.
  const rawMessages = Array.isArray(data?.messages) ? data.messages : [data];

  for (const raw of rawMessages) {
    if (!raw?.key?.remoteJid) continue;

    const remoteJid: string = raw.key.remoteJid;
    if (remoteJid.endsWith("@g.us")) continue; // grupos: fuera de alcance

    const phone = remoteJid.split("@")[0];
    const fromMe = !!raw.key.fromMe;
    const platformMessageId: string | null = raw.key.id ?? null;

    const text = extractMessageText(raw.message);
    const mediaOnly = !text && hasMedia(raw.message);
    const finalText = text ?? (mediaOnly ? "[Adjunto]" : null);
    if (!finalText) continue; // evento sin contenido reconocible (reacciones, recibos, etc.)

    const senderName = fromMe ? "WhatsApp" : raw.pushName || phone;

    // Deteccion cross-canal (F12): el JID de Baileys ya trae el numero en
    // formato E.164 sin el "+". Un telefono invalido (grupos raros, IDs que
    // no son numero de verdad) simplemente no participa del match ni se
    // guarda en los campos de telefono del contacto nuevo.
    const normalizedPhone = normalizeWhatsAppJidPhone(phone);
    const phoneFields = normalizedPhone.valid
      ? { phone: normalizedPhone.normalized!, whatsapp_phone: normalizedPhone.normalized! }
      : undefined;

    const contact = await upsertContactForSender({
      supabase,
      channel: { id: channel.id, workspace_id: channel.workspace_id },
      senderId: phone,
      senderName,
      senderPicture: null,
      interactionAt: new Date().toISOString(),
      matchIdentity: normalizedPhone.valid ? { phone: normalizedPhone.normalized } : undefined,
      contactFields: phoneFields,
    });

    if (!contact) {
      console.error("Failed to upsert contact for WhatsApp message");
      continue;
    }

    const preview = messagePreview(finalText);

    const { data: conversation } = await supabase
      .from("conversations")
      .upsert(
        {
          workspace_id: channel.workspace_id,
          channel_id: channel.id,
          contact_id: contact.contactId,
          platform: "whatsapp" as const,
          status: "open",
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
          unread_count: fromMe ? 0 : 1,
        },
        { onConflict: "channel_id,contact_id" }
      )
      .select("id")
      .single();

    if (!conversation) {
      console.error("Failed to upsert conversation for WhatsApp message");
      continue;
    }

    if (!fromMe && contact.existed) {
      await supabase
        .rpc("increment_unread", { conv_id: conversation.id, preview })
        .then(() => {});
    }

    if (platformMessageId) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversation.id)
        .eq("platform_message_id", platformMessageId)
        .maybeSingle();
      if (existing) continue;
    }

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: fromMe ? "outbound" : "inbound",
      text: finalText,
      platform_message_id: platformMessageId,
      status: "sent",
    });
  }
}
