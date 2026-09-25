import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspace } from "@/lib/workspace";
import { listWorkspaceMembers } from "@/lib/members";
import { isOwnerOrAdmin } from "@/lib/permissions";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Ban,
  Target,
} from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { platformLabel } from "@/lib/platforms";
import { ContactAssignment } from "@/components/contacts/contact-assignment";
import { ContactNotes } from "@/components/contacts/contact-notes";
import { ContactTagsEditor } from "@/components/contacts/contact-tags-editor";
import { ContactCustomFieldsEditor } from "@/components/contacts/contact-custom-fields-editor";
import { ContactHeaderActions } from "@/components/contacts/contact-header-actions";
import type { Attribution } from "@/lib/attribution";
import type { Database } from "@/lib/types/database";

type Tag = Database["public"]["Tables"]["tags"]["Row"];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  return new Date(dateStr).toLocaleDateString("es-AR", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TEMPERATURE_LABELS: Record<string, string> = { cold: "Frio", warm: "Tibio", hot: "Caliente" };

const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: "Contacto creado",
  updated: "Datos editados",
  deleted: "Contacto eliminado",
  restored: "Contacto restaurado",
  assigned: "Asignacion cambiada",
  linked: "Canal vinculado",
  link_suggested: "Vinculacion sugerida",
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const { workspace, role, user, supabase } = await getWorkspace();

  const [contactRes, channelsRes, conversationsRes, customFieldDefsRes, customFieldValuesRes, notesRes, tagsRes, auditRes] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("*, contact_tags(tag_id, tags(*))")
        .eq("id", contactId)
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("contact_channels")
        .select("*, channels(platform, username, display_name)")
        .eq("contact_id", contactId),
      supabase
        .from("conversations")
        .select("id, platform, status, last_message_at, last_message_preview")
        .eq("contact_id", contactId)
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .order("last_message_at", { ascending: false }),
      supabase.from("custom_field_definitions").select("id, name, type").eq("workspace_id", workspace.id),
      supabase.from("contact_custom_fields").select("field_id, value").eq("contact_id", contactId),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contactId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("tags").select("*").eq("workspace_id", workspace.id).order("name"),
      supabase
        .from("audit_log")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("entity_type", "contact")
        .eq("entity_id", contactId)
        .order("performed_at", { ascending: false })
        .limit(20),
    ]);

  if (!contactRes.data) notFound();

  const contact = contactRes.data;
  const channels = channelsRes.data ?? [];
  const conversations = conversationsRes.data ?? [];
  // F14: "Conversaciones agrupadas por canal". El orden de los grupos sigue
  // el mensaje mas reciente de cada canal (ya vienen ordenadas desc).
  const conversationsByPlatform = conversations.reduce<Record<string, typeof conversations>>(
    (groups, conv) => {
      (groups[conv.platform] ??= []).push(conv);
      return groups;
    },
    {}
  );
  const customFieldDefs = customFieldDefsRes.data ?? [];
  const customFieldValues = Object.fromEntries(
    (customFieldValuesRes.data ?? []).map((v) => [v.field_id, v.value])
  );
  const notes = notesRes.data ?? [];
  const allTags = tagsRes.data ?? [];
  const auditEvents = auditRes.data ?? [];
  const currentTags = contact.contact_tags
    .map((ct: { tags: unknown }) => ct.tags)
    .filter(Boolean) as Tag[];

  const members = await listWorkspaceMembers(workspace.id);
  const authorNames = Object.fromEntries(members.map((m) => [m.userId, m.name]));

  const attribution = (contact.attribution ?? {}) as Attribution;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <Link
          href="/dashboard/contacts"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a contactos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold">
              {contact.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contact.avatar_url}
                  alt={contact.display_name || "Contacto"}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                contact.display_name?.[0]?.toUpperCase() ?? "?"
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{contact.display_name ?? "Sin nombre"}</h1>
                {contact.do_not_contact && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                    <Ban className="h-3 w-3" />
                    No contactar
                  </span>
                )}
                {contact.lead_temperature && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                    {TEMPERATURE_LABELS[contact.lead_temperature]}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {contact.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {contact.email}
                  </span>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {contact.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Ultima actividad: {formatDate(contact.last_interaction_at)}
                </span>
              </div>
            </div>
          </div>

          <ContactHeaderActions contact={contact} role={role} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sidebar: asignacion, seguimiento, redes */}
          <div className="space-y-6 lg:col-span-1">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
                Asignacion
              </h2>
              <ContactAssignment
                contactId={contact.id}
                members={members}
                setterId={contact.setter_id}
                vendedorId={contact.vendedor_id}
                canManage={isOwnerOrAdmin(role)}
              />
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
                Seguimiento
              </h2>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Proximo seguimiento: </span>
                  {contact.next_followup_date ? formatDate(contact.next_followup_date) : "Sin definir"}
                </p>
                <p>
                  <span className="text-muted-foreground">Pais: </span>
                  {contact.country ?? "Sin definir"}
                </p>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Redes</h2>
              <div className="space-y-1 text-sm text-muted-foreground">
                {contact.instagram_username && <p>Instagram: @{contact.instagram_username}</p>}
                {contact.whatsapp_phone && <p>WhatsApp: {contact.whatsapp_phone}</p>}
                {contact.tiktok_username && <p>TikTok: @{contact.tiktok_username}</p>}
                {contact.twitter_username && <p>X/Twitter: @{contact.twitter_username}</p>}
                {contact.facebook_id && <p>Facebook: {contact.facebook_id}</p>}
                {contact.linkedin_profile_url && <p>LinkedIn: {contact.linkedin_profile_url}</p>}
                {!contact.instagram_username &&
                  !contact.whatsapp_phone &&
                  !contact.tiktok_username &&
                  !contact.twitter_username &&
                  !contact.facebook_id &&
                  !contact.linkedin_profile_url && <p className="text-muted-foreground/70">Sin redes cargadas</p>}
              </div>
            </section>

            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                Atribucion
              </h2>
              {attribution.first_click || attribution.last_click ? (
                <div className="space-y-3 text-xs">
                  {attribution.first_click && (
                    <div>
                      <p className="font-medium text-muted-foreground">Primer click</p>
                      <p className="text-muted-foreground/80">
                        {attribution.first_click.utm_source ?? "-"} / {attribution.first_click.utm_campaign ?? "-"}
                      </p>
                    </div>
                  )}
                  {attribution.last_click && (
                    <div>
                      <p className="font-medium text-muted-foreground">Ultimo click</p>
                      <p className="text-muted-foreground/80">
                        {attribution.last_click.utm_source ?? "-"} / {attribution.last_click.utm_campaign ?? "-"}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70">Sin datos de atribucion</p>
              )}
            </section>
          </div>

          {/* Main: conversaciones, notas, tags, custom fields, historial */}
          <div className="space-y-6 lg:col-span-2">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
                Conversaciones
              </h2>
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground/60">Sin conversaciones</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(conversationsByPlatform).map(([platform, convs]) => (
                    <div key={platform}>
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <PlatformIcon platform={platform} className="h-3.5 w-3.5" size={14} />
                        {platformLabel(platform)}
                      </div>
                      <div className="space-y-2">
                        {convs.map((conv) => (
                          <Link
                            key={conv.id}
                            href={`/dashboard/inbox?conversation=${conv.id}`}
                            className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium capitalize text-muted-foreground">
                                  {conv.status}
                                </p>
                                <p className="text-[10px] text-muted-foreground/60">
                                  {formatDate(conv.last_message_at)}
                                </p>
                              </div>
                              <p className="mt-0.5 truncate text-sm">
                                {conv.last_message_preview || "Sin mensajes"}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Tags</h2>
              <ContactTagsEditor contactId={contact.id} allTags={allTags} currentTags={currentTags} />
            </section>

            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Notas
              </h2>
              <ContactNotes
                contactId={contact.id}
                notes={notes}
                currentUserId={user.id}
                role={role}
                authorNames={authorNames}
              />
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
                Custom Fields
              </h2>
              <ContactCustomFieldsEditor
                contactId={contact.id}
                definitions={customFieldDefs}
                values={customFieldValues}
              />
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
                Historial de cambios
              </h2>
              {auditEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground/60">Sin actividad registrada</p>
              ) : (
                <div className="space-y-1.5">
                  {auditEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between text-xs">
                      <span>
                        {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                        {event.performed_by && ` · ${authorNames[event.performed_by] ?? "Desconocido"}`}
                      </span>
                      <span className="text-muted-foreground/70">{formatDate(event.performed_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {channels.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
                  Canales conectados
                </h2>
                <div className="space-y-2">
                  {channels.map((cc) => {
                    const ch = cc.channels as { platform?: string; display_name?: string; username?: string } | null;
                    return (
                      <div key={cc.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                        <PlatformIcon platform={ch?.platform ?? ""} className="h-4 w-4" size={16} />
                        <div>
                          <p className="text-sm font-medium">{ch?.display_name ?? ch?.username ?? "Desconocido"}</p>
                          <p className="text-xs text-muted-foreground">
                            {ch?.platform} · {cc.platform_username ? `@${cc.platform_username}` : cc.platform_sender_id}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
