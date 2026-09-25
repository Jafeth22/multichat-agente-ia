import { getWorkspace } from "@/lib/workspace";
import { listWorkspaceMembers } from "@/lib/members";
import { isSupportedPlatform } from "@/lib/platforms";
import type { LeadTemperature } from "@/lib/types/database";
import { ContactsView } from "./contacts-view";

const PAGE_SIZE = 25;
const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";
const LEAD_TEMPERATURES: LeadTemperature[] = ["cold", "warm", "hot"];

function isLeadTemperature(value: string): value is LeadTemperature {
  return (LEAD_TEMPERATURES as string[]).includes(value);
}

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { workspace, role, supabase } = await getWorkspace();

  const search = param(params.search);
  const tagId = param(params.tag);
  const setterId = param(params.setter);
  const vendedorId = param(params.vendedor);
  const temperature = param(params.temperatura);
  const platform = param(params.canal);
  const page = Math.max(1, parseInt(param(params.page) || "1", 10) || 1);

  // Los filtros por tag y por canal viven en tablas relacionadas
  // (contact_tags, contact_channels): se resuelven primero a una lista de
  // ids y se intersecan, en vez de intentar un .or() a traves de joins.
  let contactIdsFilter: string[] | null = null;

  if (tagId) {
    const { data } = await supabase
      .from("contact_tags")
      .select("contact_id")
      .eq("tag_id", tagId);
    contactIdsFilter = (data ?? []).map((r) => r.contact_id);
  }

  if (isSupportedPlatform(platform)) {
    const { data } = await supabase
      .from("contact_channels")
      .select("contact_id, channels!inner(platform)")
      .eq("channels.platform", platform);
    const ids = new Set((data ?? []).map((r) => r.contact_id));
    contactIdsFilter = contactIdsFilter
      ? contactIdsFilter.filter((id) => ids.has(id))
      : Array.from(ids);
  }

  let query = supabase
    .from("contacts")
    .select("*, contact_tags(tag_id, tags(*))", { count: "exact" })
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (search) {
    const q = search.replace(/[%,]/g, "");
    query = query.or(
      `display_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,instagram_username.ilike.%${q}%`
    );
  }
  if (setterId) query = query.eq("setter_id", setterId);
  if (vendedorId) query = query.eq("vendedor_id", vendedorId);
  if (isLeadTemperature(temperature)) query = query.eq("lead_temperature", temperature);
  if (contactIdsFilter) {
    query = query.in("id", contactIdsFilter.length ? contactIdsFilter : [NO_MATCH_ID]);
  }

  const [{ data: contacts, count }, { data: tags }, members] = await Promise.all([
    query,
    supabase.from("tags").select("*").eq("workspace_id", workspace.id).order("name"),
    listWorkspaceMembers(workspace.id),
  ]);

  const hasAnyContacts = count !== null && (count > 0 || search || tagId || setterId || vendedorId || temperature || platform);

  return (
    <ContactsView
      contacts={contacts ?? []}
      totalCount={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      tags={tags ?? []}
      members={members}
      workspaceId={workspace.id}
      role={role}
      hasAnyContacts={!!hasAnyContacts}
      filters={{ search, tagId, setterId, vendedorId, temperature, platform }}
    />
  );
}
