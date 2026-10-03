/**
 * Deteccion y marcado de "no contactar" (F18). Las frases se configuran
 * por workspace (workspaces.optout_phrases, ver 00037) y el matching es
 * simple: substring, case-insensitive, sin NLP (asi lo pide el
 * documento de requerimientos). Distinto de global_keywords, que es un
 * feature aparte (dispara flows por match exacto).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit";

/**
 * Busca si `text` contiene alguna de las frases de opt-out configuradas
 * en el workspace. Devuelve la frase que hizo match (para dejarla en
 * do_not_contact_reason), o null si no matchea ninguna.
 */
export async function detectOptOutPhrase(
  supabase: SupabaseClient,
  workspaceId: string,
  text: string | null | undefined
): Promise<string | null> {
  if (!text?.trim()) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("optout_phrases")
    .eq("id", workspaceId)
    .single();

  const phrases = ((workspace?.optout_phrases as string[] | null) ?? []).filter(Boolean);
  if (phrases.length === 0) return null;

  const normalizedText = text.toLowerCase();
  for (const phrase of phrases) {
    if (normalizedText.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

/**
 * Marca al contacto como "no contactar": setea las 3 columnas (ya
 * existentes desde 00029), pausa sus sequence_enrollments activos
 * (status='paused_optout', un cron que solo procesa status='active' los
 * deja afuera sin tocar lib/sequence-processor.ts) y deja el evento en
 * audit_log. performedBy=null indica deteccion automatica del sistema.
 */
export async function markContactOptOut({
  supabase,
  workspaceId,
  contactId,
  reason,
  performedBy,
}: {
  supabase: SupabaseClient;
  workspaceId: string;
  contactId: string;
  reason: string;
  performedBy: string | null;
}): Promise<void> {
  await supabase
    .from("contacts")
    .update({
      do_not_contact: true,
      do_not_contact_reason: reason,
      do_not_contact_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  await supabase
    .from("sequence_enrollments")
    .update({ status: "paused_optout" })
    .eq("contact_id", contactId)
    .eq("status", "active");

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId,
    entityType: "contact",
    entityId: contactId,
    action: "opted_out",
    performedBy,
    metadata: { reason },
  });
}

/**
 * Reversion manual (solo Owner/Admin, validado por el caller): limpia el
 * flag. A proposito NO reanuda las sequence_enrollments pausadas: un
 * falso positivo de deteccion no implica que las secuencias deban
 * retomar solas, es una decision de negocio aparte.
 */
export async function revertContactOptOut({
  supabase,
  workspaceId,
  contactId,
  performedBy,
}: {
  supabase: SupabaseClient;
  workspaceId: string;
  contactId: string;
  performedBy: string;
}): Promise<void> {
  await supabase
    .from("contacts")
    .update({
      do_not_contact: false,
      do_not_contact_reason: null,
      do_not_contact_at: null,
    })
    .eq("id", contactId);

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId,
    entityType: "contact",
    entityId: contactId,
    action: "opted_out_reverted",
    performedBy,
  });
}
