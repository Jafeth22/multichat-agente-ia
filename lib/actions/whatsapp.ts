"use server";

import { randomUUID, randomBytes } from "node:crypto";
import { getWorkspace } from "@/lib/workspace";
import * as evolution from "@/lib/evolution-client";

/**
 * Evolution API corre en Railway pero la app se despliega en Vercel, asi
 * que ya no comparten una red privada: el webhook de Evolution llega por
 * internet publica. Para que no cualquiera pueda mandarle eventos falsos
 * a este endpoint, la URL lleva un secreto por canal (igual patron que
 * webhook_secret ya usa para Zernio) que se valida en la ruta.
 */
function webhookUrl(secret: string): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  return `${appUrl}/api/webhooks/evolution/${secret}`;
}

async function requireAdmin() {
  const ctx = await getWorkspace();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new Error("Solo Owner o Admin pueden gestionar canales");
  }
  return ctx;
}

/**
 * Crea una instancia nueva de WhatsApp (F6): la crea en Evolution API,
 * configura su webhook interno y guarda un canal 'whatsapp' con el QR
 * inicial para mostrar en el modal de conexion.
 */
export async function createWhatsappInstance() {
  const { workspace, supabase } = await requireAdmin();

  const instanceName = `ws-${workspace.id}-${randomUUID().slice(0, 8)}`;
  const webhookSecret = randomBytes(24).toString("hex");

  try {
    const created = await evolution.createInstance(instanceName);
    await evolution.setWebhook(instanceName, webhookUrl(webhookSecret));

    const { data: channel, error } = await supabase
      .from("channels")
      .insert({
        workspace_id: workspace.id,
        platform: "whatsapp",
        late_account_id: instanceName,
        evolution_instance_name: instanceName,
        webhook_secret: webhookSecret,
        display_name: "WhatsApp",
        connection_status: "connecting",
        qr_code: created.qrcode?.base64 ?? null,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) return { error: error.message };

    return { ok: true, channel };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo crear la instancia de WhatsApp",
    };
  }
}

/** Pide un QR nuevo: instancia recien creada sin escanear, o para reconectar. */
export async function refreshWhatsappQr(channelId: string) {
  const { workspace, supabase } = await requireAdmin();

  const { data: channel } = await supabase
    .from("channels")
    .select("id, evolution_instance_name")
    .eq("id", channelId)
    .eq("workspace_id", workspace.id)
    .eq("platform", "whatsapp")
    .single();

  if (!channel?.evolution_instance_name) {
    return { error: "Canal de WhatsApp no encontrado" };
  }

  try {
    const qr = await evolution.getQrCode(channel.evolution_instance_name);

    await supabase
      .from("channels")
      .update({
        qr_code: qr.base64 ?? null,
        connection_status: "connecting",
      })
      .eq("id", channelId);

    return { ok: true, qrCode: qr.base64 ?? null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo generar el QR",
    };
  }
}

/** Desconecta manualmente (logout), la instancia queda lista para reconectar. */
export async function disconnectWhatsappInstance(channelId: string) {
  const { workspace, supabase } = await requireAdmin();

  const { data: channel } = await supabase
    .from("channels")
    .select("id, evolution_instance_name")
    .eq("id", channelId)
    .eq("workspace_id", workspace.id)
    .eq("platform", "whatsapp")
    .single();

  if (!channel?.evolution_instance_name) {
    return { error: "Canal de WhatsApp no encontrado" };
  }

  try {
    await evolution.logoutInstance(channel.evolution_instance_name);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo desconectar la instancia",
    };
  }

  await supabase
    .from("channels")
    .update({
      connection_status: "disconnected",
      qr_code: null,
      disconnected_at: new Date().toISOString(),
    })
    .eq("id", channelId);

  return { ok: true };
}
