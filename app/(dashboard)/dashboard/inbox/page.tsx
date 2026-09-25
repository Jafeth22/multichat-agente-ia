import { getWorkspace } from "@/lib/workspace";
import { InboxView } from "./inbox-view";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const { conversation } = await searchParams;
  const { workspace, supabase } = await getWorkspace();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*, contacts(*)")
    .eq("workspace_id", workspace.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  return (
    <InboxView
      conversations={conversations ?? []}
      workspaceId={workspace.id}
      initialConversationId={conversation ?? null}
    />
  );
}
