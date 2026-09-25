"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Users,
  Mail,
  Phone,
  Calendar,
  Plus,
  Trash2,
  Loader2,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { softDeleteContact } from "@/lib/actions/contacts";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContactFormModal } from "@/components/contacts/contact-form-modal";
import type { Database, LeadTemperature } from "@/lib/types/database";
import type { WorkspaceMemberOption } from "@/lib/members";

type Tag = Database["public"]["Tables"]["tags"]["Row"];
type ContactWithTags = Database["public"]["Tables"]["contacts"]["Row"] & {
  contact_tags: { tag_id: string; tags: Tag | null }[];
};

const TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  cold: "Frio",
  warm: "Tibio",
  hot: "Caliente",
};

const TEMPERATURE_STYLES: Record<LeadTemperature, string> = {
  cold: "bg-blue-100 text-blue-700",
  warm: "bg-amber-100 text-amber-700",
  hot: "bg-red-100 text-red-700",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString("es-AR", { month: "short", day: "numeric" });
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  member: "Miembro",
};

function memberInfo(
  members: WorkspaceMemberOption[],
  userId: string | null
): { name: string; role: string | null } {
  if (!userId) return { name: "Sin asignar", role: null };
  const member = members.find((m) => m.userId === userId);
  return { name: member?.name ?? "Desconocido", role: member?.role ?? null };
}

export function ContactsView({
  contacts,
  totalCount,
  page,
  pageSize,
  tags,
  members,
  workspaceId,
  role,
  hasAnyContacts,
  filters,
}: {
  contacts: ContactWithTags[];
  totalCount: number;
  page: number;
  pageSize: number;
  tags: Tag[];
  members: WorkspaceMemberOption[];
  workspaceId: string;
  role: string | null;
  hasAnyContacts: boolean;
  filters: {
    search: string;
    tagId: string;
    setterId: string;
    vendedorId: string;
    temperature: string;
    platform: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const canManage = isOwnerOrAdmin(role);

  const [search, setSearch] = useState(filters.search);
  const [showNewContact, setShowNewContact] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushFilters(next: Partial<typeof filters> & { page?: number }) {
    const merged = { ...filters, page: 1, ...next };
    const qs = new URLSearchParams();
    if (merged.search) qs.set("search", merged.search);
    if (merged.tagId) qs.set("tag", merged.tagId);
    if (merged.setterId) qs.set("setter", merged.setterId);
    if (merged.vendedorId) qs.set("vendedor", merged.vendedorId);
    if (merged.temperature) qs.set("temperatura", merged.temperature);
    if (merged.platform) qs.set("canal", merged.platform);
    if (merged.page && merged.page > 1) qs.set("page", String(merged.page));
    router.push(qs.toString() ? `${pathname}?${qs}` : pathname);
  }

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => pushFilters({ search: value }), 350);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    const result = await softDeleteContact(confirmDelete.id);
    setDeletingId(null);
    setConfirmDelete(null);
    if (!result.error) router.refresh();
  }

  const activeFilterCount = [
    filters.tagId,
    filters.setterId,
    filters.vendedorId,
    filters.temperature,
    filters.platform,
  ].filter(Boolean).length;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contactos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalCount} contacto{totalCount !== 1 ? "s" : ""} en el workspace
            </p>
          </div>
          <button
            onClick={() => setShowNewContact(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nuevo contacto
          </button>
        </div>

        {/* Busqueda y filtros */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, telefono o usuario..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <select
            value={filters.setterId}
            onChange={(e) => pushFilters({ setterId: e.target.value })}
            className="rounded-lg border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Setter: todos</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={filters.vendedorId}
            onChange={(e) => pushFilters({ vendedorId: e.target.value })}
            className="rounded-lg border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Vendedor: todos</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={filters.temperature}
            onChange={(e) => pushFilters({ temperature: e.target.value })}
            className="rounded-lg border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Temperatura: todas</option>
            <option value="cold">Frio</option>
            <option value="warm">Tibio</option>
            <option value="hot">Caliente</option>
          </select>

          <select
            value={filters.platform}
            onChange={(e) => pushFilters({ platform: e.target.value })}
            className="rounded-lg border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Canal: todos</option>
            <option value="instagram">Instagram</option>
            <option value="whatsapp">WhatsApp</option>
          </select>

          {activeFilterCount > 0 && (
            <button
              onClick={() =>
                pushFilters({ tagId: "", setterId: "", vendedorId: "", temperature: "", platform: "" })
              }
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Limpiar filtros ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => pushFilters({ tagId: "" })}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                filters.tagId === ""
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              Todas
            </button>
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => pushFilters({ tagId: tag.id === filters.tagId ? "" : tag.id })}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.tagId === tag.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
                style={
                  tag.color && filters.tagId !== tag.id
                    ? { backgroundColor: `${tag.color}20`, color: tag.color }
                    : undefined
                }
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              {hasAnyContacts ? "No hay contactos con estos filtros" : "Todavia no hay contactos"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {hasAnyContacts
                ? "Proba con otra busqueda o limpia los filtros"
                : "Importa contactos o conecta un canal para empezar a recibir mensajes"}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-8 py-3 text-xs font-medium uppercase text-muted-foreground">Nombre</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Contacto</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Tags</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Setter</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Vendedor</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Temperatura</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Ultimo contacto</th>
                {canManage && (
                  <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => {
                const contactTags = contact.contact_tags.map((ct) => ct.tags).filter(Boolean) as Tag[];
                return (
                  <tr key={contact.id} className="border-b border-border transition-colors hover:bg-accent/50">
                    <td className="px-8 py-3">
                      <Link
                        href={`/dashboard/contacts/${contact.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {contact.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={contact.avatar_url}
                              alt={contact.display_name || "Contacto"}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            contact.display_name?.[0]?.toUpperCase() ?? "?"
                          )}
                        </div>
                        <span className="flex items-center gap-1.5 text-sm font-medium hover:underline">
                          {contact.display_name ?? "Sin nombre"}
                          {contact.do_not_contact && (
                            <span
                              title="No contactar"
                              className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
                            >
                              <Ban className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {contact.email && (
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3" /> {contact.email}
                          </span>
                        )}
                        {contact.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" /> {contact.phone}
                          </span>
                        )}
                        {!contact.email && !contact.phone && (
                          <span className="text-muted-foreground/50">Sin datos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {contactTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {contactTags.slice(0, 2).map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] font-medium"
                              style={
                                tag.color
                                  ? { backgroundColor: `${tag.color}20`, borderColor: `${tag.color}40`, color: tag.color }
                                  : undefined
                              }
                            >
                              {tag.name}
                            </span>
                          ))}
                          {contactTags.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{contactTags.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Sin tags</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(() => {
                        const setter = memberInfo(members, contact.setter_id);
                        return (
                          <>
                            <p className="text-muted-foreground">{setter.name}</p>
                            {setter.role && (
                              <p className="text-[10px] text-muted-foreground/60">
                                {ROLE_LABELS[setter.role] ?? setter.role}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(() => {
                        const vendedor = memberInfo(members, contact.vendedor_id);
                        return (
                          <>
                            <p className="text-muted-foreground">{vendedor.name}</p>
                            {vendedor.role && (
                              <p className="text-[10px] text-muted-foreground/60">
                                {ROLE_LABELS[vendedor.role] ?? vendedor.role}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {contact.lead_temperature ? (
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                            TEMPERATURE_STYLES[contact.lead_temperature]
                          )}
                        >
                          {TEMPERATURE_LABELS[contact.lead_temperature]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(contact.last_interaction_at)}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            setConfirmDelete({ id: contact.id, name: contact.display_name ?? "este contacto" })
                          }
                          disabled={deletingId === contact.id}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          title="Eliminar contacto"
                        >
                          {deletingId === contact.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginacion */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-8 py-3">
          <p className="text-xs text-muted-foreground">
            Pagina {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => pushFilters({ page: page - 1 })}
              disabled={page <= 1}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => pushFilters({ page: page + 1 })}
              disabled={page >= totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {showNewContact && <ContactFormModal onClose={() => setShowNewContact(false)} />}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar contacto"
        message={`Seguro que queres eliminar a "${confirmDelete?.name}"? Se puede recuperar desde la base de datos durante 30 dias.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
