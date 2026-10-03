import { getWorkspace } from "@/lib/workspace";
import { listWorkspaceMembers } from "@/lib/members";
import { InboxView } from "./inbox-view";
import type { InboxFiltersState } from "@/components/inbox/inbox-filters";
import type { Platform } from "@/lib/types/database";

interface InboxSearchParams {
  conversation?: string;
  tags?: string;
  assignment?: string;
  canal?: string;
  fecha?: string;
  desde?: string;
  hasta?: string;
}

/**
 * Resuelve el preset de fecha (F16) a un rango real. "custom" usa
 * desde/hasta tal cual vienen de la URL (input type=date, YYYY-MM-DD).
 */
function dateRangeFor(
  preset: string,
  desde: string,
  hasta: string
): { gte?: string; lte?: string } {
  const now = new Date();
  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { gte: start.toISOString() };
  }
  if (preset === "7d") {
    return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() };
  }
  if (preset === "30d") {
    return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() };
  }
  if (preset === "custom") {
    return {
      gte: desde ? new Date(`${desde}T00:00:00`).toISOString() : undefined,
      lte: hasta ? new Date(`${hasta}T23:59:59`).toISOString() : undefined,
    };
  }
  return {};
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<InboxSearchParams>;
}) {
  const sp = await searchParams;
  const { workspace, supabase } = await getWorkspace();

  const filters: InboxFiltersState = {
    tagIds: sp.tags ? sp.tags.split(",").filter(Boolean) : [],
    assignment: sp.assignment ?? "",
    channel: sp.canal ?? "",
    datePreset: sp.fecha ?? "",
    desde: sp.desde ?? "",
    hasta: sp.hasta ?? "",
  };

  // Tags cuelgan de contacts, no de conversations: se resuelve a una lista
  // de contact_id antes de filtrar (match de al menos uno de los tags
  // seleccionados, AND con el resto de las categorias).
  let contactIdsFilter: string[] | null = null;
  if (filters.tagIds.length > 0) {
    const { data: matches } = await supabase
      .from("contact_tags")
      .select("contact_id")
      .in("tag_id", filters.tagIds);
    contactIdsFilter = Array.from(new Set((matches ?? []).map((m) => m.contact_id)));
  }

  let conversations: Awaited<ReturnType<typeof fetchConversations>> = [];
  if (!contactIdsFilter || contactIdsFilter.length > 0) {
    conversations = await fetchConversations();
  }

  async function fetchConversations() {
    let query = supabase
      .from("conversations")
      .select("*, contacts(*)")
      .eq("workspace_id", workspace.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50);

    if (filters.channel) query = query.eq("platform", filters.channel as Platform);
    if (filters.assignment === "unassigned") query = query.is("assigned_to", null);
    else if (filters.assignment) query = query.eq("assigned_to", filters.assignment);
    if (contactIdsFilter) query = query.in("contact_id", contactIdsFilter);

    const { gte, lte } = dateRangeFor(filters.datePreset, filters.desde, filters.hasta);
    if (gte) query = query.gte("last_message_at", gte);
    if (lte) query = query.lte("last_message_at", lte);

    const { data } = await query;
    return data ?? [];
  }

  const [{ data: tags }, members] = await Promise.all([
    supabase.from("tags").select("*").eq("workspace_id", workspace.id).order("name"),
    listWorkspaceMembers(workspace.id),
  ]);

  return (
    <InboxView
      conversations={conversations}
      workspaceId={workspace.id}
      initialConversationId={sp.conversation ?? null}
      tags={tags ?? []}
      members={members}
      filters={filters}
    />
  );
}
