"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function createContactNote(contactId: string, content: string) {
  const { workspace, user, supabase } = await getWorkspace();

  const trimmed = content.trim();
  if (!trimmed) return { error: "La nota no puede estar vacia" };

  // Id generado aca y sin .select() despues del insert: el RETURNING de un
  // insert vuelve a evaluar la policy de SELECT sobre la fila nueva, y esa
  // combinacion particular fallo con contacts (ver lib/actions/contacts.ts)
  // aunque la policy de INSERT en si era correcta. Se evita el mismo riesgo
  // aca armando el objeto de la nota con los valores que ya conocemos.
  const noteId = randomUUID();
  const createdAt = new Date().toISOString();

  const { error } = await supabase.from("contact_notes").insert({
    id: noteId,
    contact_id: contactId,
    workspace_id: workspace.id,
    content: trimmed,
    created_by: user.id,
    created_at: createdAt,
    updated_at: createdAt,
  });

  if (error) return { error: error.message };

  const note = {
    id: noteId,
    contact_id: contactId,
    workspace_id: workspace.id,
    content: trimmed,
    created_by: user.id,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
  };

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "contact_note",
    entityId: noteId,
    action: "note_created",
    performedBy: user.id,
    metadata: { contact_id: contactId },
  });

  revalidatePath(`/dashboard/contacts/${contactId}`);
  return { ok: true, note };
}

export async function updateContactNote(noteId: string, content: string) {
  const { workspace, user, role, supabase } = await getWorkspace();

  const trimmed = content.trim();
  if (!trimmed) return { error: "La nota no puede estar vacia" };

  const { data: note } = await supabase
    .from("contact_notes")
    .select("id, contact_id, created_by")
    .eq("id", noteId)
    .single();

  if (!note) return { error: "Nota no encontrada" };
  if (note.created_by !== user.id && !isOwnerOrAdmin(role)) {
    return { error: "Solo el autor, Admin u Owner pueden editar esta nota" };
  }

  const { error } = await supabase
    .from("contact_notes")
    .update({ content: trimmed })
    .eq("id", noteId);

  if (error) return { error: error.message };

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "contact_note",
    entityId: noteId,
    action: "note_updated",
    performedBy: user.id,
    metadata: { contact_id: note.contact_id },
  });

  revalidatePath(`/dashboard/contacts/${note.contact_id}`);
  return { ok: true };
}

export async function deleteContactNote(noteId: string) {
  const { workspace, user, role, supabase } = await getWorkspace();

  const { data: note } = await supabase
    .from("contact_notes")
    .select("id, contact_id, created_by")
    .eq("id", noteId)
    .single();

  if (!note) return { error: "Nota no encontrada" };
  if (note.created_by !== user.id && !isOwnerOrAdmin(role)) {
    return { error: "Solo el autor, Admin u Owner pueden borrar esta nota" };
  }

  const { error } = await supabase
    .from("contact_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", noteId);

  if (error) return { error: error.message };

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "contact_note",
    entityId: noteId,
    action: "note_deleted",
    performedBy: user.id,
    metadata: { contact_id: note.contact_id },
  });

  revalidatePath(`/dashboard/contacts/${note.contact_id}`);
  return { ok: true };
}
