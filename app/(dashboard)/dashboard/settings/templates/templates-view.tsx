"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { createTemplate, updateTemplate, softDeleteTemplate } from "@/lib/actions/templates";
import { interpolateTemplate } from "@/lib/templates";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Database } from "@/lib/types/database";
import { Tooltip } from "@/components/ui/tooltip";

type Template = Database["public"]["Tables"]["response_templates"]["Row"];

const PREVIEW_CONTEXT = {
  contact: { display_name: "Juan Perez", email: "juan@ejemplo.com", phone: "+5491122334455" },
};

const INSERTABLE_VARIABLES = [
  { token: "{{contact.display_name}}", label: "Nombre" },
  { token: "{{contact.email}}", label: "Email" },
  { token: "{{contact.phone}}", label: "Telefono" },
  { token: "{{workspace.name}}", label: "Workspace" },
];

export function TemplatesView({
  templates,
  workspaceName,
  canManage,
  authorNames,
}: {
  templates: Template[];
  workspaceName: string;
  canManage: boolean;
  authorNames: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    const result = await softDeleteTemplate(confirmDelete.id);
    setDeletingId(null);
    setConfirmDelete(null);
    if (!result.error) router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Templates de respuesta</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Se usan en la bandeja escribiendo &quot;/&quot; en el campo de respuesta.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setEditing("new")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Nuevo template
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <MessageSquareText className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              Todavia no hay templates
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {canManage
                ? "Crea el primero para usarlo desde la bandeja con \"/\""
                : "Pedile a un Admin que cree templates para usar en la bandeja"}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-8 py-3 text-xs font-medium uppercase text-muted-foreground">Nombre</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Shortcut</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Preview</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Creado por</th>
                {canManage && (
                  <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-border transition-colors hover:bg-accent/50">
                  <td className="px-8 py-3 text-sm font-medium">{template.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {template.shortcut ? `/${template.shortcut}` : "-"}
                  </td>
                  <td className="max-w-sm truncate px-4 py-3 text-xs text-muted-foreground">
                    {interpolateTemplate(template.content, {
                      contact: PREVIEW_CONTEXT.contact,
                      workspace: { name: workspaceName },
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {template.created_by ? authorNames[template.created_by] ?? "Desconocido" : "-"}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditing(template)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                        >
                          <Pencil className="h-3 w-3" />
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(template)}
                          disabled={deletingId === template.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {deletingId === template.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Eliminar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <TemplateFormModal
          template={editing === "new" ? null : editing}
          workspaceName={workspaceName}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar template"
        message={`Seguro que queres eliminar "${confirmDelete?.name}"? Deja de aparecer en el selector de la bandeja.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function TemplateFormModal({
  template,
  workspaceName,
  onClose,
}: {
  template: Template | null;
  workspaceName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [content, setContent] = useState(template?.content ?? "");
  const [shortcut, setShortcut] = useState(template?.shortcut ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const preview = interpolateTemplate(content, {
    contact: { display_name: "Juan Perez", email: "juan@ejemplo.com", phone: "+5491122334455" },
    workspace: { name: workspaceName },
  });

  /**
   * Inserta la variable en la posicion del cursor (o reemplaza la
   * seleccion), en vez de solo pegarla al final: mas facil para el
   * usuario que escribir la variable a mano.
   */
  function insertVariable(token: string) {
    const el = contentRef.current;
    if (!el) {
      setContent((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    const cursor = start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const input = { name, content, shortcut: shortcut || null };
    const result: { error?: string } = template
      ? await updateTemplate(template.id, input)
      : await createTemplate(input);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lg">
        <h3 className="text-sm font-semibold">{template ? "Editar template" : "Nuevo template"}</h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Shortcut (opcional, sin la &quot;/&quot;)
              </label>
              <input
                type="text"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="ej: bienvenida"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Contenido</label>
              <textarea
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="Hola {{contact.display_name}}, gracias por escribirnos a {{workspace.name}}..."
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                Clic en una variable para agregarla donde esta el cursor:
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {INSERTABLE_VARIABLES.map((v) => (
                  <Tooltip key={v.token} content={`Insertar ${v.label}`}>
                    <button
                      type="button"
                      onClick={() => insertVariable(v.token)}
                      className="rounded-full border border-dashed border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      {v.token}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Preview en vivo</label>
            <div className="mt-1 h-full min-h-[180px] whitespace-pre-wrap rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm">
              {preview || <span className="text-muted-foreground/60">El preview aparece aca</span>}
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !content.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
