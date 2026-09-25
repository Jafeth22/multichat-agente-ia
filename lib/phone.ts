/**
 * Normalizacion de telefono a formato internacional (+XX...), pedida
 * por F9 y por la deteccion cross-canal (F12): dos numeros solo
 * "matchean" si estan en el mismo formato.
 *
 * Usa libphonenumber-js en vez de un regex a mano: la logica de
 * numeracion varia por pais (largo, prefijos de operador, etc.) y un
 * regex casero termina rechazando o aceptando mal casos reales.
 */

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export interface NormalizePhoneResult {
  normalized: string | null;
  valid: boolean;
}

/**
 * Normaliza a E.164 (+549...). Si el numero no trae "+" y no hay
 * defaultCountry, no hay forma de saber el codigo de pais: se devuelve
 * invalido en vez de adivinar.
 */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry?: CountryCode | null
): NormalizePhoneResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { normalized: null, valid: false };

  const parsed = parsePhoneNumberFromString(
    trimmed,
    trimmed.startsWith("+") ? undefined : defaultCountry ?? undefined
  );

  if (!parsed || !parsed.isValid()) {
    return { normalized: null, valid: false };
  }

  return { normalized: parsed.number, valid: true };
}

/**
 * Baileys (Evolution API) manda el telefono como el numero de un JID de
 * WhatsApp (ej: "5491123456789" en "5491123456789@s.whatsapp.net"):
 * siempre son digitos E.164 completos, solo les falta el "+". A
 * diferencia de normalizePhone, esto no necesita defaultCountry.
 */
export function normalizeWhatsAppJidPhone(rawDigits: string | null | undefined): NormalizePhoneResult {
  const digits = (rawDigits ?? "").trim();
  if (!digits) return { normalized: null, valid: false };
  return normalizePhone(digits.startsWith("+") ? digits : `+${digits}`);
}
