"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, RefreshCw, User } from "lucide-react";
import { ConversationList } from "@/components/inbox/conversation-list";
import { MessageThread } from "@/components/inbox/message-thread";
import { ContactPanel } from "@/components/inbox/contact-panel";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"] & {
  contacts: Database["public"]["Tables"]["contacts"]["Row"] | null;
};
type Message = Database["public"]["Tables"]["messages"]["Row"];

const SYNC_MESSAGES = [
  "Buscando conversaciones nuevas...",
  "Revisando los canales conectados...",
  "Esto puede tardar unos segundos...",
  "Ya casi termina...",
];

export function InboxView({
  conversations,
  workspaceId,
  initialConversationId,
}: {
  conversations: Conversation[];
  workspaceId: string;
  initialConversationId?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Conversation | null>(
    initialConversationId ? conversations.find((c) => c.id === initialConversationId) ?? null : null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showContactPanel, setShowContactPanel] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState(SYNC_MESSAGES[0]);

  // Imports conversations that already exist in Zernio (e.g. from before the
  // webhook was registered), then refreshes the server-rendered list. Puede
  // tardar bastante (recorre cada canal, varias paginas), asi que el mensaje
  // va rotando para que no parezca que se trabo.
  async function handleSyncConversations() {
    setSyncing(true);
    setSyncError(null);
    setSyncMessage(SYNC_MESSAGES[0]);

    let step = 0;
    const rotateMessages = setInterval(() => {
      step = (step + 1) % SYNC_MESSAGES.length;
      setSyncMessage(SYNC_MESSAGES[step]);
    }, 2500);

    try {
      const res = await fetch("/api/v1/channels/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSyncError(data.error || "No se pudo sincronizar");
        return;
      }
      router.refresh();
    } catch {
      setSyncError("No se pudo sincronizar. Revisa tu conexion.");
    } finally {
      clearInterval(rotateMessages);
      setSyncing(false);
    }
  }

  // Keep selected conversation in sync when conversation list updates
  const handleSelect = useCallback((c: Conversation) => {
    setSelected(c);
  }, []);

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      setLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/v1/messages?conversationId=${selected!.id}`
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data ?? []);
        } else {
          console.error("Failed to load messages:", res.status);
          setMessages([]);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }

      // Mark as read
      if (selected!.unread_count > 0) {
        const supabase = createClient();
        await supabase
          .from("conversations")
          .update({ unread_count: 0 })
          .eq("id", selected!.id);
      }
    }

    loadMessages();
  }, [selected?.id]);

  return (
    <div className="flex h-full">
      {/* Left panel: Conversation list */}
      <div className="w-80 flex-shrink-0">
        <ConversationList
          conversations={conversations}
          workspaceId={workspaceId}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
        />
      </div>

      {/* Center panel: Message thread */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Toggle contact panel button */}
        {selected && !showContactPanel && (
          <div className="flex shrink-0 justify-end border-b border-border px-2 py-1">
            <button
              onClick={() => setShowContactPanel(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Show contact info"
            >
              <User className="h-3.5 w-3.5" />
              Contact info
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          {conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                Todavia no hay conversaciones
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                Si ya tenes conversaciones en Zernio, sincronizalas para traerlas a la bandeja.
              </p>
              <button
                onClick={handleSyncConversations}
                disabled={syncing}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                {syncing ? syncMessage : "Sincronizar conversaciones"}
              </button>
              {syncError && (
                <p className="mt-2 text-xs text-destructive">{syncError}</p>
              )}
            </div>
          ) : loadingMessages && selected ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : (
            <MessageThread
              conversation={selected}
              messages={messages}
            />
          )}
        </div>
      </div>

      {/* Right panel: Contact info */}
      {showContactPanel && selected?.contact_id && (
        <ContactPanel
          contactId={selected.contact_id}
          workspaceId={workspaceId}
          onClose={() => setShowContactPanel(false)}
        />
      )}
    </div>
  );
}
