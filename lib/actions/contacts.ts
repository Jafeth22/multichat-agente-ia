"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { findContactMatch } from "@/lib/cross-channel";
import { logAuditEvent, diffFields } from "@/lib/audit";
import type { CountryCode } from "libphonenumber-js";
import type { Database, LeadTemperature } from "@/lib/types/database";

type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

/**
 * Traduce errores tipicos de Postgres/Supabase a un mensaje que se
 * entienda, en vez de mostrar el texto crudo de la base. 42501 es el
 * codigo de "row-level security policy violation".
 */
function friendlyDbError(error: { code?: string; message: string } | null): string {
  if (!error) return "No se pudo guardar el contacto";
  if (error.code === "42501") {
    return "No tenes permiso para hacer esta accion sobre este contacto (revisa tu rol o a que contactos tenes acceso)";
  }
  return error.message;
}

export interface ContactFormInput {
  display_name: string;
  email?: string | null;
  secondary_email?: string | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  country?: string | null;
  instagram_username?: string | null;
  tiktok_username?: string | null;
  youtube_channel_id?: string | null;
  linkedin_profile_url?: string | null;
  twitter_username?: string | null;
  facebook_id?: string | null;
  lead_temperature?: LeadTemperature | null;
  next_followup_date?: string | null;
}

const EDITABLE_FIELDS: (keyof ContactFormInput)[] = [
  "display_name",
  "email",
  "secondary_email",
  "phone",
  "whatsapp_phone",
  "country",
  "instagram_username",
  "tiktok_username",
  "youtube_channel_id",
  "linkedin_profile_url",
  "twitter_username",
  "facebook_id",
  "lead_temperature",
  "next_followup_date",
];

function isCountryCode(value: string | null | undefined): value is CountryCode {
  return !!value && /^[A-Z]{2}$/.test(value);
}

/**
 * Normaliza los dos campos de telefono del formulario. Devuelve un error de
 * validacion legible si el usuario cargo algo que no es un telefono valido
 * (no intenta adivinar en silencio).
 */
function normalizeContactPhones(
  input: ContactFormInput
): { phone: string | null; whatsapp_phone: string | null } | { error: string } {
  const country = isCountryCode(input.country) ? input.country : undefined;
  let phone: string | null = null;
  let whatsapp_phone: string | null = null;

  if (input.phone) {
    const result = normalizePhone(input.phone, country);
    if (!result.valid) {
      return { error: `El telefono "${input.phone}" no es valido. Usa formato internacional (+54...)` };
    }
    phone = result.normalized;
  }

  if (input.whatsapp_phone) {
    const result = normalizePhone(input.whatsapp_phone, country);
    if (!result.valid) {
      return { error: `El WhatsApp "${input.whatsapp_phone}" no es valido. Usa formato internacional (+54...)` };
    }
    whatsapp_phone = result.normalized;
  }

  return { phone, whatsapp_phone };
}

/**
 * Busca si ya existe OTRO contacto del workspace con el mismo telefono,
 * whatsapp, email o instagram (F9: "no hace merge automatico, solo
 * deteccion y alerta"). Corre con el service role para detectar el
 * duplicado en todo el workspace, no solo lo que el usuario que llama
 * puede ver por el scope de leads; si el que llama no tiene permiso para
 * ver ese contacto puntual, no se revela cual es.
 */
interface DuplicateResult {
  error: string;
  existingContactId?: string;
}

async function findDuplicate(
  workspaceId: string,
  fields: { phone?: string | null; email?: string | null; instagram_username?: string | null },
  excludeContactId: string | null,
  caller: { userId: string; role: string | null }
): Promise<DuplicateResult | null> {
  const service = await createServiceClient();

  const match = await findContactMatch(service, workspaceId, {
    phone: fields.phone,
    email: fields.email,
    instagramUsername: fields.instagram_username,
  });

  if (!match || match.contactId === excludeContactId) return null;

  const { data: existing } = await service
    .from("contacts")
    .select("id, display_name, setter_id, vendedor_id")
    .eq("id", match.contactId)
    .single();

  if (!existing) return null;

  const canSee =
    isOwnerOrAdmin(caller.role) ||
    existing.setter_id === caller.userId ||
    existing.vendedor_id === caller.userId;

  const fieldLabel = match.matchField === "phone" ? "telefono" : match.matchField === "email" ? "email" : "Instagram";

  if (canSee) {
    return {
      error: `Ya existe un contacto con ese ${fieldLabel}: "${existing.display_name ?? "Sin nombre"}".`,
      existingContactId: existing.id,
    };
  }

  return {
    error: `Ya existe otro contacto con ese ${fieldLabel} en el workspace, pero no tenes acceso a verlo. Pedile a un Admin que lo revise.`,
  };
}

export async function createContact(input: ContactFormInput) {
  const { workspace, user, role, supabase } = await getWorkspace();

  if (!input.display_name?.trim()) {
    return { error: "El nombre es obligatorio" };
  }

  const phones = normalizeContactPhones(input);
  if ("error" in phones) return phones;

  const duplicate = await findDuplicate(
    workspace.id,
    { phone: phones.phone, email: input.email, instagram_username: input.instagram_username },
    null,
    { userId: user.id, role }
  );
  if (duplicate) return duplicate;

  // Un Member que crea un contacto sin asignar queda, por el scope de leads,
  // sin poder verlo el mismo (can_see_contact exige ser setter/vendedor, o
  // que el workspace muestre los no asignados a todos); se lo asigna como
  // setter automatico (es su lead). Owner/Admin ven todo igual, se deja sin
  // asignar.
  const willAssignSetter = isOwnerOrAdmin(role) ? null : user.id;

  // El id se genera aca (no se deja el default de la tabla) y el insert no
  // pide RETURNING (sin .select()): asi no hace falta que Postgres nos
  // devuelva la fila recien creada, que es exactamente lo que disparaba
  // "new row violates row-level security policy" incluso para el Owner
  // (RLS evalua el SELECT de vuelta sobre la fila nueva cuando se pide
  // RETURNING, y algo en esa evaluacion fallaba en esta base puntual pese a
  // que la policy de INSERT en si misma es correcta). Ya sabiendo el id de
  // antemano no necesitamos ese RETURNING para nada.
  const contactId = randomUUID();

  const { error } = await supabase.from("contacts").insert({
    id: contactId,
    workspace_id: workspace.id,
    display_name: input.display_name.trim(),
    email: input.email || null,
    secondary_email: input.secondary_email || null,
    phone: phones.phone,
    whatsapp_phone: phones.whatsapp_phone,
    country: input.country || null,
    instagram_username: input.instagram_username || null,
    tiktok_username: input.tiktok_username || null,
    youtube_channel_id: input.youtube_channel_id || null,
    linkedin_profile_url: input.linkedin_profile_url || null,
    twitter_username: input.twitter_username || null,
    facebook_id: input.facebook_id || null,
    lead_temperature: input.lead_temperature || null,
    next_followup_date: input.next_followup_date || null,
    setter_id: willAssignSetter,
  });

  if (error) {
    console.error("[createContact] insert failed:", error);
    return { error: friendlyDbError(error) };
  }

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "contact",
    entityId: contactId,
    action: "created",
    performedBy: user.id,
    metadata: { via: "manual" },
  });

  revalidatePath("/dashboard/contacts");
  return { ok: true, contactId };
}

export async function updateContact(contactId: string, input: Partial<ContactFormInput>) {
  const { workspace, user, role, supabase } = await getWorkspace();

  const { data: before } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .single();

  if (!before) return { error: "Contacto no encontrado" };

  const phones = normalizeContactPhones({
    phone: input.phone,
    whatsapp_phone: input.whatsapp_phone,
    country: input.country ?? before.country,
  } as ContactFormInput);
  if ("error" in phones) return phones;

  const patch: ContactUpdate = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in input)) continue;
    if (field === "phone") patch.phone = phones.phone;
    else if (field === "whatsapp_phone") patch.whatsapp_phone = phones.whatsapp_phone;
    else (patch as Record<string, unknown>)[field] = input[field] || null;
  }

  const nextPhone = "phone" in input ? phones.phone : before.phone;
  const nextEmail = "email" in input ? input.email || null : before.email;
  const nextInstagram =
    "instagram_username" in input ? input.instagram_username || null : before.instagram_username;

  const touchesIdentity = "phone" in input || "email" in input || "instagram_username" in input;
  if (touchesIdentity) {
    const duplicate = await findDuplicate(
      workspace.id,
      { phone: nextPhone, email: nextEmail, instagram_username: nextInstagram },
      contactId,
      { userId: user.id, role }
    );
    if (duplicate) return duplicate;
  }

  const { error } = await supabase.from("contacts").update(patch).eq("id", contactId);
  if (error) {
    console.error("[contacts action] db error:", error);
    return { error: friendlyDbError(error) };
  }

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "contact",
    entityId: contactId,
    action: "updated",
    performedBy: user.id,
    changes: diffFields(before, patch as Record<string, unknown>, Object.keys(patch)),
  });

  revalidatePath(`/dashboard/contacts/${contactId}`);
  revalidatePath("/dashboard/contacts");
  return { ok: true };
}

export async function assignContact(
  contactId: string,
  assignment: { setterId?: string | null; vendedorId?: string | null }
) {
  const { workspace, user, role, supabase } = await getWorkspace();

  if (!isOwnerOrAdmin(role)) {
    return { error: "Solo Owner o Admin pueden asignar setter/vendedor" };
  }

  const { data: before } = await supabase
    .from("contacts")
    .select("setter_id, vendedor_id")
    .eq("id", contactId)
    .single();

  if (!before) return { error: "Contacto no encontrado" };

  const patch: ContactUpdate = {};
  if ("setterId" in assignment) patch.setter_id = assignment.setterId ?? null;
  if ("vendedorId" in assignment) patch.vendedor_id = assignment.vendedorId ?? null;

  const { error } = await supabase.from("contacts").update(patch).eq("id", contactId);
  if (error) {
    console.error("[contacts action] db error:", error);
    return { error: friendlyDbError(error) };
  }

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "contact",
    entityId: contactId,
    action: "assigned",
    performedBy: user.id,
    changes: diffFields(
      { setter_id: before.setter_id, vendedor_id: before.vendedor_id },
      { setter_id: patch.setter_id ?? before.setter_id, vendedor_id: patch.vendedor_id ?? before.vendedor_id },
      ["setter_id", "vendedor_id"]
    ),
  });

  revalidatePath(`/dashboard/contacts/${contactId}`);
  revalidatePath("/dashboard/contacts");
  return { ok: true };
}

export async function softDeleteContact(contactId: string) {
  const { workspace, user, role, supabase } = await getWorkspace();

  if (!isOwnerOrAdmin(role)) {
    return { error: "Solo Owner o Admin pueden eliminar contactos" };
  }

  const { error } = await supabase
    .from("contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", contactId);

  if (error) {
    console.error("[contacts action] db error:", error);
    return { error: friendlyDbError(error) };
  }

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "contact",
    entityId: contactId,
    action: "deleted",
    performedBy: user.id,
  });

  revalidatePath("/dashboard/contacts");
  return { ok: true };
}

/**
 * Vinculacion manual de dos contactos que ya existian por separado (F12:
 * "sugerencia manual" cuando el match automatico no alcanza). Mueve los
 * canales, notas y conversaciones del contacto origen al destino y deja
 * el origen soft-deleted. Solo Owner/Admin: mover datos entre contactos
 * ya formados es la operacion mas riesgosa de todo el CRM.
 */
export async function linkContactChannel(targetContactId: string, sourceContactId: string) {
  const { workspace, user, role, supabase } = await getWorkspace();

  if (!isOwnerOrAdmin(role)) {
    return { error: "Solo Owner o Admin pueden vincular contactos manualmente" };
  }
  if (targetContactId === sourceContactId) {
    return { error: "No se puede vincular un contacto consigo mismo" };
  }

  const [{ data: target }, { data: source }] = await Promise.all([
    supabase.from("contacts").select("id, workspace_id").eq("id", targetContactId).single(),
    supabase.from("contacts").select("id, workspace_id").eq("id", sourceContactId).single(),
  ]);

  if (!target || !source) return { error: "Contacto no encontrado" };
  if (target.workspace_id !== workspace.id || source.workspace_id !== workspace.id) {
    return { error: "Los contactos no pertenecen a este workspace" };
  }

  await supabase
    .from("contact_channels")
    .update({ contact_id: targetContactId })
    .eq("contact_id", sourceContactId);

  await supabase
    .from("contact_notes")
    .update({ contact_id: targetContactId })
    .eq("contact_id", sourceContactId);

  // Las conversaciones son unique(channel_id, contact_id): una conversacion
  // del origen que "chocaria" con una que el destino ya tiene en el mismo
  // canal se deja como esta (queda huerfana bajo el contacto borrado, mas
  // adelante la purga de 30 dias se encarga) en vez de perder mensajes.
  const { data: sourceConversations } = await supabase
    .from("conversations")
    .select("id, channel_id")
    .eq("contact_id", sourceContactId);

  const { data: targetConversations } = await supabase
    .from("conversations")
    .select("channel_id")
    .eq("contact_id", targetContactId);

  const targetChannelIds = new Set((targetConversations ?? []).map((c) => c.channel_id));

  for (const conv of sourceConversations ?? []) {
    if (targetChannelIds.has(conv.channel_id)) continue;
    await supabase.from("conversations").update({ contact_id: targetContactId }).eq("id", conv.id);
  }

  await supabase
    .from("contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", sourceContactId);

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "contact",
    entityId: targetContactId,
    action: "linked",
    performedBy: user.id,
    metadata: { via: "manual", merged_from: sourceContactId },
  });
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "contact",
    entityId: sourceContactId,
    action: "deleted",
    performedBy: user.id,
    metadata: { reason: "merged_into", merged_into: targetContactId },
  });

  revalidatePath(`/dashboard/contacts/${targetContactId}`);
  revalidatePath("/dashboard/contacts");
  return { ok: true };
}

/**
 * Busca contactos por nombre, email, telefono o username, para el
 * buscador de "Vincular con otro contacto" en la ficha.
 */
export async function searchContactsForLinking(query: string, excludeContactId: string) {
  const { workspace, role, supabase } = await getWorkspace();

  if (!isOwnerOrAdmin(role)) {
    return { error: "Solo Owner o Admin pueden buscar contactos para vincular" };
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) return { ok: true, contacts: [] };

  const { data, error } = await supabase
    .from("contacts")
    .select("id, display_name, email, phone, instagram_username")
    .eq("workspace_id", workspace.id)
    .neq("id", excludeContactId)
    .or(
      `display_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,instagram_username.ilike.%${trimmed}%`
    )
    .limit(10);

  if (error) {
    console.error("[contacts action] db error:", error);
    return { error: friendlyDbError(error) };
  }
  return { ok: true, contacts: data ?? [] };
}
