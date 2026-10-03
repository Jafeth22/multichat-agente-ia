"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Bot, User, MessageSquare, CheckCircle, Clock, RotateCcw, Loader2, Circle, Ban, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/platform-icon";
import { interpolateTemplate } from "@/lib/templates";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TemplatePicker } from "@/components/inbox/template-picker";
import { MessageAttachments } from "@/components/inbox/message-attachments";
import { softDeleteConversation, restoreConversation } from "@/lib/actions/conversations";
import type { Database, ConversationStatus } from "@/lib/types/database";

type ResponseTemplate = Database["public"]["Tables"]["response_templates"]["Row"];

// story_reply/is_story_mention: Instagram-only, no llegan de la tabla
// messages local (Zernio es la fuente de verdad) sino del endpoint
// /api/v1/messages, que las agrega al leer de la API de Zernio.
type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  story_reply?: { storyId: string; storyUrl: string | null } | null;
  is_story_mention?: boolean;
};
type Conversation = Database["public"]["Tables"]["conversations"]["Row"] & {
  contacts: Database["public"]["Tables"]["contacts"]["Row"] | null;
};

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function shouldShowDateSeparator(
  current: Message,
  previous: Message | undefined
): boolean {
  if (!previous) return true;
  const currentDate = new Date(current.created_at).toDateString();
  const previousDate = new Date(previous.created_at).toDateString();
  return currentDate !== previousDate;
}

function MessageBubble({ message }: { message: Message }) {
  const isInbound = message.direction === "inbound";
  const isBot = message.sent_by_flow_id !== null;

  return (
    <div
      className={cn(
        "flex gap-2",
        isInbound ? "justify-start" : "justify-end"
      )}
    >
      {isInbound && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}

      <div className="max-w-[70%]">
        {message.story_reply && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Circle className="h-3 w-3" />
            <span>Respondio a tu historia</span>
            {message.story_reply.storyUrl && (
              <a
                href={message.story_reply.storyUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                ver
              </a>
            )}
          </div>
        )}
        {message.is_story_mention && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Circle className="h-3 w-3" />
            <span>Te menciono en su historia</span>
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2 text-sm",
            isInbound
              ? "rounded-tl-md bg-muted text-foreground"
              : "rounded-tr-md bg-primary text-primary-foreground"
          )}
        >
          {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
          <MessageAttachments attachments={message.attachments} />
        </div>
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground",
            isInbound ? "justify-start" : "justify-end"
          )}
        >
          {isBot && (
            <Bot className="h-3 w-3" />
          )}
          <span>{formatMessageTime(message.created_at)}</span>
          {!isInbound && message.status !== "sent" && (
            <span className="capitalize">
              {message.status === "delivered"
                ? "Delivered"
                : message.status === "failed"
                ? "Failed"
                : ""}
            </span>
          )}
        </div>
      </div>

      {!isInbound && !isBot && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      {!isInbound && isBot && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
    </div>
  );
}

export function MessageThread({
  conversation,
  messages: initialMessages,
  onDeleted,
}: {
  conversation: Conversation | null;
  messages: Message[];
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Selector de templates con "/" (F17): se cargan una sola vez por
  // conversacion, la primera vez que el usuario escribe "/".
  const [templates, setTemplates] = useState<ResponseTemplate[] | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateHighlight, setTemplateHighlight] = useState(0);

  // Advertencia de "no contactar" (F18): no bloquea el envio, solo pide
  // confirmar.
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);

  // Eliminar conversacion (Bloque 4): confirmar y despues undo de 5s.
  const [confirmDeleteConversation, setConfirmDeleteConversation] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);

  async function handleDeleteConversation() {
    if (!conversation) return;
    const conversationId = conversation.id;
    const contactName = conversation.contacts?.display_name ?? "esta conversacion";
    setDeletingConversation(true);
    const result = await softDeleteConversation(conversationId);
    setDeletingConversation(false);
    setConfirmDeleteConversation(false);
    if (result.error) return;
    onDeleted?.();
    router.refresh();
    toast(`Conversacion con "${contactName}" eliminada`, {
      duration: 5000,
      action: {
        label: "Deshacer",
        onClick: async () => {
          await restoreConversation(conversationId);
          router.refresh();
        },
      },
    });
  }

  const updateConversationStatus = useCallback(async (status: ConversationStatus) => {
    if (!conversation || statusUpdating) return;
    setStatusUpdating(status);
    try {
      const { error } = await createClient()
        .from("conversations")
        .update({ status })
        .eq("id", conversation.id);
      if (error) throw error;
      router.refresh();
    } catch {
      alert(`Failed to update conversation status`);
    } finally {
      setStatusUpdating(null);
    }
  }, [conversation, statusUpdating, router]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for conversation updates (last_message_at changes when a new message arrives)
  // and re-fetch messages from Zernio API.
  useEffect(() => {
    if (!conversation) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversation.id}`,
        },
        async () => {
          try {
            const res = await fetch(
              `/api/v1/messages?conversationId=${conversation.id}`
            );
            if (res.ok) {
              const freshMessages = await res.json();
              setMessages((prev) => {
                const optimistic = prev.filter((m) => m.id.startsWith("optimistic-"));
                return [...freshMessages, ...optimistic];
              });
            }
          } catch (err) {
            console.error("Failed to refresh messages:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  const loadTemplates = useCallback(async () => {
    if (!conversation) return;
    const supabase = createClient();
    const [{ data: tpls }, { data: ws }] = await Promise.all([
      supabase
        .from("response_templates")
        .select("*")
        .eq("workspace_id", conversation.workspace_id)
        .is("deleted_at", null)
        .order("name"),
      supabase.from("workspaces").select("name").eq("id", conversation.workspace_id).single(),
    ]);
    setTemplates(tpls ?? []);
    setWorkspaceName(ws?.name ?? "");
  }, [conversation]);

  const filteredTemplates = (templates ?? []).filter((t) => {
    if (!templateQuery) return true;
    const q = templateQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.shortcut ?? "").toLowerCase().includes(q);
  });

  function handleInputChange(value: string) {
    setInput(value);
    autoResize();
    // Solo dispara si "/" es lo unico escrito hasta ahora (sin espacios):
    // el selector reemplaza el mensaje entero, no inserta texto inline.
    const match = /^\/(\S*)$/.exec(value);
    if (match) {
      setTemplateQuery(match[1]);
      setTemplateHighlight(0);
      setShowTemplatePicker(true);
      if (templates === null) loadTemplates();
    } else {
      setShowTemplatePicker(false);
    }
  }

  function selectTemplate(template: ResponseTemplate) {
    const interpolated = interpolateTemplate(template.content, {
      contact: {
        display_name: conversation?.contacts?.display_name ?? null,
        email: conversation?.contacts?.email ?? null,
        phone: conversation?.contacts?.phone ?? null,
      },
      workspace: { name: workspaceName },
    });
    setInput(interpolated);
    setShowTemplatePicker(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autoResize();
    });
  }

  function handleSend() {
    if (!input.trim() || !conversation || sending) return;
    if (conversation.contacts?.do_not_contact) {
      setShowOptOutConfirm(true);
      return;
    }
    sendMessage();
  }

  async function sendMessage() {
    if (!input.trim() || !conversation || sending) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update: add a temporary message immediately
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: conversation.id,
      direction: "outbound",
      text,
      attachments: null,
      quick_reply_payload: null,
      postback_payload: null,
      callback_data: null,
      platform_message_id: null,
      sent_by_flow_id: null,
      sent_by_node_id: null,
      sent_by_user_id: null,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch("/api/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id, text }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Send failed (${res.status})`);
      }

      const confirmedMessage: Message = await res.json();

      // Replace optimistic message with confirmed one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? confirmedMessage : m))
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId ? { ...m, status: "failed" as const } : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="mt-4 text-sm font-medium text-muted-foreground">
          Select a conversation
        </h3>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Choose a conversation from the list to view messages
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            {conversation.contacts?.avatar_url ? (
              <img
                src={conversation.contacts.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {conversation.contacts?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-background">
              <PlatformIcon
                platform={conversation.platform}
                className="h-2.5 w-2.5"
                size={10}
              />
            </div>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {conversation.contacts?.display_name ?? "Unknown"}
              {conversation.contacts?.do_not_contact && (
                <span
                  title="No contactar"
                  className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
                >
                  <Ban className="h-2.5 w-2.5" />
                  No contactar
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
              conversation.status === "open"
                ? "bg-green-100 text-green-700"
                : conversation.status === "snoozed"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-muted text-muted-foreground"
            )}
          >
            {conversation.status}
          </span>
          {conversation.is_automation_paused && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
              Bot paused
            </span>
          )}
          <div className="flex items-center gap-1">
            {conversation.status !== "closed" && (
              <button
                onClick={() => updateConversationStatus("closed")}
                disabled={!!statusUpdating}
                title="Close conversation"
                aria-label="Close conversation"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "closed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              </button>
            )}
            {conversation.status !== "snoozed" && (
              <button
                onClick={() => updateConversationStatus("snoozed")}
                disabled={!!statusUpdating}
                title="Snooze conversation"
                aria-label="Snooze conversation"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "snoozed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              </button>
            )}
            {conversation.status !== "open" && (
              <button
                onClick={() => updateConversationStatus("open")}
                disabled={!!statusUpdating}
                title="Reopen conversation"
                aria-label="Reopen conversation"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "open" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              onClick={() => setConfirmDeleteConversation(true)}
              disabled={deletingConversation}
              title="Eliminar conversacion"
              aria-label="Eliminar conversacion"
              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
            >
              {deletingConversation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((message, i) => (
            <div key={message.id}>
              {shouldShowDateSeparator(message, messages[i - 1]) && (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateSeparator(message.created_at)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <MessageBubble message={message} />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border p-4">
        <div className="relative mx-auto flex max-w-2xl items-end gap-2">
          {showTemplatePicker && (
            <TemplatePicker
              templates={filteredTemplates}
              loading={templates === null}
              highlight={templateHighlight}
              onSelect={selectTemplate}
              onClose={() => setShowTemplatePicker(false)}
            />
          )}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (showTemplatePicker && filteredTemplates.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setTemplateHighlight((i) => (i + 1) % filteredTemplates.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setTemplateHighlight((i) => (i - 1 + filteredTemplates.length) % filteredTemplates.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    selectTemplate(filteredTemplates[templateHighlight]);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setShowTemplatePicker(false);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder='Escribi un mensaje... ("/" para usar un template)'
              rows={1}
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ maxHeight: 150 }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              input.trim() && !sending
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showOptOutConfirm}
        title='Contacto marcado como "no contactar"'
        message="Este contacto pidio no ser contactado. Queres enviar el mensaje igual?"
        confirmLabel="Enviar igual"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => {
          setShowOptOutConfirm(false);
          sendMessage();
        }}
        onCancel={() => setShowOptOutConfirm(false)}
      />

      <ConfirmDialog
        open={confirmDeleteConversation}
        title="Eliminar conversacion"
        message="Seguro que queres eliminar esta conversacion? Podes deshacerlo desde el aviso que aparece despues, por unos segundos."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDeleteConversation}
        onCancel={() => setConfirmDeleteConversation(false)}
      />
    </div>
  );
}
