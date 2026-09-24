import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import { readChannelSecret } from "@/lib/vault";
import { messagePreview } from "@/lib/message-preview";

/**
 * GET /api/v1/messages?conversationId=...
 *
 * Instagram (Zernio): trae los mensajes en vivo desde la API de Zernio
 * (fuente de verdad). WhatsApp (Evolution API) no tiene un endpoint asi
 * de confiable, asi que esos mensajes se guardan localmente por el
 * webhook y se leen directo de la tabla `messages`.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  const { data: conversationMeta } = await supabase
    .from("conversations")
    .select("channels(platform)")
    .eq("id", conversationId)
    .single();

  const channelMeta = conversationMeta?.channels as { platform: string } | null;

  if (channelMeta?.platform === "whatsapp") {
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(messages ?? []);
  }

  // Look up the Zernio conversation ID and workspace API key
  const { data: conversation } = await supabase
    .from("conversations")
    .select("late_conversation_id, workspace_id, channels(late_account_id)")
    .eq("id", conversationId)
    .single();

  if (!conversation?.late_conversation_id) {
    return NextResponse.json({ error: "Conversation not found or missing Zernio ID" }, { status: 404 });
  }

  const apiKey = await readChannelSecret(supabase, "zernio_api_key", conversation.workspace_id);
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 400 });
  }

  const channel = conversation.channels as { late_account_id: string } | null;
  if (!channel?.late_account_id) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Fetch messages from Zernio API
  try {
    const zernio = createZernioClient(apiKey);
    const res = await zernio.messages.getInboxConversationMessages({
      path: { conversationId: conversation.late_conversation_id },
      query: { accountId: channel.late_account_id },
    });

    // The Zernio endpoint returns { success, messages: [...] } — NOT { data }.
    const zernioMessages =
      (res.data as { messages?: unknown[] })?.messages ??
      (res.data as { data?: unknown[] })?.data ??
      [];

    // Map Zernio messages to the shape the inbox UI expects.
    // storyReply/isStoryMention: Instagram-only fields Zernio sends inline on
    // message.received (no separate "story reply" event) — see lib/zernio-webhook.ts.
    const messages = zernioMessages.map((m: any) => ({
      id: m.id,
      conversation_id: conversationId,
      direction: m.direction === "outbound" ? "outbound" : "inbound",
      text: m.text ?? m.message ?? null,
      attachments: m.attachments?.length ? m.attachments : null,
      quick_reply_payload: null,
      postback_payload: null,
      callback_data: null,
      platform_message_id: m.platformMessageId ?? null,
      sent_by_flow_id: null,
      sent_by_node_id: null,
      sent_by_user_id: null,
      status: "sent",
      created_at: m.sentAt ?? m.createdAt ?? new Date().toISOString(),
      story_reply: m.storyReply ? { storyId: m.storyReply.storyId, storyUrl: m.storyReply.storyUrl ?? null } : null,
      is_story_mention: m.isStoryMention ?? false,
    }));

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Failed to fetch messages from Zernio API:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/messages
 *
 * Instagram (Zernio): envia via la API de Zernio, que guarda el mensaje
 * (no hay insert local). WhatsApp (Evolution API): envia via Evolution y
 * ademas inserta el mensaje en la tabla local `messages`.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { conversationId, text } = body;

  if (!conversationId || !text) {
    return NextResponse.json(
      { error: "conversationId and text required" },
      { status: 400 }
    );
  }

  // Get conversation with channel info
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*, channels(*)")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const channelInfo = conversation.channels as {
    platform: string;
    evolution_instance_name: string | null;
  } | null;

  if (channelInfo?.platform === "whatsapp") {
    return sendWhatsappMessage(supabase, user.id, conversation, channelInfo, text);
  }

  if (!conversation.late_conversation_id) {
    return NextResponse.json(
      { error: "No Zernio conversation ID linked to this conversation" },
      { status: 400 }
    );
  }

  const channel = conversation.channels as { late_account_id: string } | null;
  if (!channel?.late_account_id) {
    return NextResponse.json({ error: "Channel not found or missing Zernio account ID" }, { status: 404 });
  }

  const apiKey = await readChannelSecret(supabase, "zernio_api_key", conversation.workspace_id);
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 400 });
  }

  // Send via Zernio SDK — Zernio stores the message, no local insert needed
  try {
    const zernio = createZernioClient(apiKey);
    const res = await zernio.messages.sendInboxMessage({
      path: { conversationId: conversation.late_conversation_id },
      body: { accountId: channel.late_account_id, message: text },
    });

    const messageId = (res.data as any)?.data?.messageId ?? null;

    // Update conversation's last message info (ZernFlow-specific metadata)
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: messagePreview(text),
      })
      .eq("id", conversationId);

    // Return a message-shaped response for the UI's optimistic update
    return NextResponse.json(
      {
        id: messageId ?? `sent-${Date.now()}`,
        conversation_id: conversationId,
        direction: "outbound",
        text,
        attachments: null,
        quick_reply_payload: null,
        postback_payload: null,
        callback_data: null,
        platform_message_id: messageId,
        sent_by_flow_id: null,
        sent_by_node_id: null,
        sent_by_user_id: user.id,
        status: "sent",
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to send message via Zernio API:", error);
    return NextResponse.json(
      { error: `Failed to send message: ${error}` },
      { status: 500 }
    );
  }
}

async function sendWhatsappMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  conversation: { id: string; channel_id: string; contact_id: string | null },
  channelInfo: { evolution_instance_name: string | null },
  text: string
) {
  if (!channelInfo.evolution_instance_name) {
    return NextResponse.json({ error: "Instancia de WhatsApp no configurada" }, { status: 400 });
  }

  if (!conversation.contact_id) {
    return NextResponse.json({ error: "Conversacion sin contacto" }, { status: 400 });
  }

  const { data: contactChannel } = await supabase
    .from("contact_channels")
    .select("platform_sender_id")
    .eq("channel_id", conversation.channel_id)
    .eq("contact_id", conversation.contact_id)
    .single();

  const phone = contactChannel?.platform_sender_id;
  if (!phone) {
    return NextResponse.json({ error: "No se encontro el numero de telefono del contacto" }, { status: 400 });
  }

  try {
    const evolution = await import("@/lib/evolution-client");
    const res = await evolution.sendTextMessage(channelInfo.evolution_instance_name, phone, text);
    const messageId = res.key?.id ?? null;

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        direction: "outbound",
        text,
        platform_message_id: messageId,
        sent_by_user_id: userId,
        status: "sent",
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: messagePreview(text),
      })
      .eq("id", conversation.id);

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Failed to send WhatsApp message via Evolution API:", error);
    return NextResponse.json(
      { error: `Failed to send message: ${error instanceof Error ? error.message : error}` },
      { status: 500 }
    );
  }
}
