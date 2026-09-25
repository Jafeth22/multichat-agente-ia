/**
 * Deteccion cross-canal (F12): busca si un remitente que escribe por un
 * canal nuevo ya es un contacto conocido de otro canal.
 *
 * Orden de prioridad del identificador (13. Decisiones transversales):
 * telefono > email > username. Solo se usa para el match automatico en
 * el momento del webhook (un remitente nuevo en `contact_channels`); no
 * fusiona dos contactos que ya existen cada uno por su lado con datos
 * propios (eso queda para una accion manual explicita, ver
 * lib/actions/contacts.ts:linkContactChannel).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CrossChannelMatchField = "phone" | "email" | "instagram_username";

export interface CrossChannelIdentity {
  phone?: string | null;
  email?: string | null;
  instagramUsername?: string | null;
}

export interface CrossChannelMatch {
  contactId: string;
  matchField: CrossChannelMatchField;
}

const FIELD_ORDER: { key: keyof CrossChannelIdentity; column: CrossChannelMatchField }[] = [
  { key: "phone", column: "phone" },
  { key: "email", column: "email" },
  { key: "instagramUsername", column: "instagram_username" },
];

export async function findContactMatch(
  supabase: SupabaseClient,
  workspaceId: string,
  identity: CrossChannelIdentity
): Promise<CrossChannelMatch | null> {
  for (const { key, column } of FIELD_ORDER) {
    const value = identity[key];
    if (!value) continue;

    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq(column, value)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    const contactId = (data as { id: string } | null)?.id;
    if (contactId) return { contactId, matchField: column };
  }

  return null;
}
