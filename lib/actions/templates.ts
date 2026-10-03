"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { logAuditEvent, diffFields } from "@/lib/audit";

export interface TemplateFormInput {
  name: string;
  content: string;
  shortcut?: string | null;
}

function normalizeShortcut(shortcut: string | null | undefined): string | null {
  const trimmed = (shortcut ?? "").trim();
  return trimmed ? trimmed.replace(/^\//, "") : null;
}

export async function createTemplate(input: TemplateFormInput) {
  const { workspace, user, role, supabase } = await getWorkspace();

  if (!isOwnerOrAdmin(role)) {
    return { error: "Solo Owner o Admin pueden crear templates" };
  }

  const name = input.name.trim();
  const content = input.content.trim();
  if (!name) return { error: "El nombre es obligatorio" };
  if (!content) return { error: "El contenido es obligatorio" };

  const templateId = randomUUID();

  const { error } = await supabase.from("response_templates").insert({
    id: templateId,
    workspace_id: workspace.id,
    name,
    content,
    shortcut: normalizeShortcut(input.shortcut),
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un template con ese shortcut en este workspace" };
    }
    console.error("[createTemplate] db error:", error);
    return { error: error.message };
  }

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "response_template",
    entityId: templateId,
    action: "template_created",
    performedBy: user.id,
    metadata: { name },
  });

  revalidatePath("/dashboard/settings/templates");
  return { ok: true, templateId };
}

export async function updateTemplate(templateId: string, input: TemplateFormInput) {
  const { workspace, user, role, supabase } = await getWorkspace();

  if (!isOwnerOrAdmin(role)) {
    return { error: "Solo Owner o Admin pueden editar templates" };
  }

  const { data: before } = await supabase
    .from("response_templates")
    .select("name, content, shortcut")
    .eq("id", templateId)
    .single();

  if (!before) return { error: "Template no encontrado" };

  const name = input.name.trim();
  const content = input.content.trim();
  if (!name) return { error: "El nombre es obligatorio" };
  if (!content) return { error: "El contenido es obligatorio" };
  const shortcut = normalizeShortcut(input.shortcut);

  const { error } = await supabase
    .from("response_templates")
    .update({ name, content, shortcut })
    .eq("id", templateId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un template con ese shortcut en este workspace" };
    }
    console.error("[updateTemplate] db error:", error);
    return { error: error.message };
  }

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "response_template",
    entityId: templateId,
    action: "template_updated",
    performedBy: user.id,
    changes: diffFields(before, { name, content, shortcut }, ["name", "content", "shortcut"]),
  });

  revalidatePath("/dashboard/settings/templates");
  return { ok: true };
}

export async function softDeleteTemplate(templateId: string) {
  const { workspace, user, role } = await getWorkspace();

  if (!isOwnerOrAdmin(role)) {
    return { error: "Solo Owner o Admin pueden eliminar templates" };
  }

  // Se usa el cliente de servicio porque con RLS el UPDATE falla: la fila
  // resultante (deleted_at lleno) ya no pasa la policy de SELECT. El permiso
  // se valida arriba (Owner/Admin) y el filtro por workspace_id evita tocar
  // templates de otro workspace.
  const service = await createServiceClient();
  const { error } = await service
    .from("response_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[softDeleteTemplate] db error:", error);
    return { error: "No se pudo eliminar el template. Probá de nuevo." };
  }

  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "response_template",
    entityId: templateId,
    action: "template_deleted",
    performedBy: user.id,
  });

  revalidatePath("/dashboard/settings/templates");
  return { ok: true };
}
