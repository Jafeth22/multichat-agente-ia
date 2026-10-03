/**
 * Parseo y validacion de CSV en el cliente (F19). El Server Action
 * (lib/actions/csv-import.ts) revalida cada fila de nuevo antes de tocar
 * la base: esto solo existe para dar feedback rapido en el wizard.
 */

import Papa from "papaparse";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_ROWS = 10_000;

export type MappableField =
  | "display_name"
  | "email"
  | "secondary_email"
  | "phone"
  | "instagram_username"
  | "country";

export const MAPPABLE_FIELD_LABELS: Record<MappableField, string> = {
  display_name: "Nombre",
  email: "Email",
  secondary_email: "Email secundario",
  phone: "Telefono",
  instagram_username: "Usuario de Instagram",
  country: "Pais (codigo, ej: AR)",
};

export type ColumnMapping = Partial<Record<MappableField, string>>;

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0 && result.data.length === 0) {
          reject(new Error(result.errors[0].message));
          return;
        }
        resolve({
          headers: result.meta.fields ?? [],
          rows: result.data,
        });
      },
      error: (err) => reject(err),
    });
  });
}

const FIELD_NAME_HINTS: Record<MappableField, string[]> = {
  display_name: ["nombre", "name", "display_name", "displayname", "full name"],
  email: ["email", "correo", "mail", "e-mail"],
  secondary_email: ["email secundario", "secondary_email", "email 2"],
  phone: ["telefono", "teléfono", "phone", "celular", "whatsapp"],
  instagram_username: ["instagram", "usuario instagram", "instagram_username", "ig"],
  country: ["pais", "país", "country"],
};

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    for (const [field, hints] of Object.entries(FIELD_NAME_HINTS) as [MappableField, string[]][]) {
      if (mapping[field]) continue;
      if (hints.some((hint) => normalized === hint || normalized.includes(hint))) {
        mapping[field] = header;
      }
    }
  }
  return mapping;
}

export interface ValidatedCsvRow {
  rowNumber: number;
  display_name: string | null;
  email: string | null;
  secondary_email: string | null;
  phone: string | null;
  instagram_username: string | null;
  country: string | null;
}

export interface CsvRowError {
  rowNumber: number;
  reason: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cell(row: Record<string, string>, mapping: ColumnMapping, field: MappableField): string {
  const column = mapping[field];
  if (!column) return "";
  return (row[column] ?? "").trim();
}

/**
 * Valida y normaliza una fila. No pisa nada de la base todavia (eso lo
 * hace el Server Action) — solo determina si la fila es importable y
 * arma los valores normalizados.
 */
export function validateRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  rowNumber: number
): { row: ValidatedCsvRow; error: null } | { row: null; error: CsvRowError } {
  const rawEmail = cell(row, mapping, "email");
  const rawPhone = cell(row, mapping, "phone");
  const rawCountry = cell(row, mapping, "country");

  let email: string | null = null;
  if (rawEmail) {
    if (!EMAIL_PATTERN.test(rawEmail)) {
      return { row: null, error: { rowNumber, reason: `Email invalido: "${rawEmail}"` } };
    }
    email = rawEmail.toLowerCase();
  }

  let phone: string | null = null;
  if (rawPhone) {
    const country = /^[A-Z]{2}$/.test(rawCountry.toUpperCase()) ? (rawCountry.toUpperCase() as CountryCode) : undefined;
    const parsed = parsePhoneNumberFromString(rawPhone, rawPhone.startsWith("+") ? undefined : country);
    if (!parsed || !parsed.isValid()) {
      return { row: null, error: { rowNumber, reason: `Telefono invalido: "${rawPhone}"` } };
    }
    phone = parsed.number;
  }

  if (!email && !phone) {
    return { row: null, error: { rowNumber, reason: "Falta email y telefono (se necesita al menos uno)" } };
  }

  return {
    row: {
      rowNumber,
      display_name: cell(row, mapping, "display_name") || null,
      email,
      secondary_email: cell(row, mapping, "secondary_email") || null,
      phone,
      instagram_username: cell(row, mapping, "instagram_username") || null,
      country: rawCountry || null,
    },
    error: null,
  };
}
