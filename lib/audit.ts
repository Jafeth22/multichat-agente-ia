/**
 * Helper unico para escribir en audit_log (F20). La tabla solo acepta
 * inserts del service role (00030_audit_log.sql), asi que esto siempre
 * necesita el cliente de service role, no el de la sesion del usuario.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "restored"
  | "assigned"
  | "linked"
  | "link_suggested"
  | "note_created"
  | "note_updated"
  | "note_deleted";

export interface AuditFieldChange {
  old: unknown;
  new: unknown;
}

export interface LogAuditEventInput {
  supabase: SupabaseClient;
  workspaceId: string;
  entityType: string;
  entityId: string | null;
  action: AuditAction | (string & {});
  performedBy: string | null;
  changes?: Record<string, AuditFieldChange>;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent({
  supabase,
  workspaceId,
  entityType,
  entityId,
  action,
  performedBy,
  changes,
  metadata,
}: LogAuditEventInput): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    workspace_id: workspaceId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    performed_by: performedBy,
    changes: changes ?? null,
    metadata: metadata ?? null,
  });

  // El audit log nunca debe tumbar la operacion principal (crear un
  // contacto, vincular un canal, etc): si falla, se registra el error
  // y se sigue.
  if (error) {
    console.error("[audit] failed to log event:", entityType, action, error);
  }
}

/**
 * Arma el objeto `changes` de audit_log comparando solo los campos que
 * cambiaron entre dos versiones de una entidad.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: Partial<T>,
  after: Partial<T>,
  fields: (keyof T)[]
): Record<string, AuditFieldChange> {
  const changes: Record<string, AuditFieldChange> = {};
  for (const field of fields) {
    const oldValue = before[field] ?? null;
    const newValue = after[field] ?? null;
    if (oldValue !== newValue) {
      changes[field as string] = { old: oldValue, new: newValue };
    }
  }
  return changes;
}
