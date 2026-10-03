"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { findContactMatch } from "@/lib/cross-channel";
import { logAuditEvent } from "@/lib/audit";
import type { ValidatedCsvRow, CsvRowError } from "@/lib/csv-import";
import type { Json } from "@/lib/types/database";

export interface CsvImportOptions {
  setterId?: string | null;
  vendedorId?: string | null;
  tagIds?: string[];
}

export interface CsvImportBatchResult {
  imported: number;
  updated: number;
  errors: number;
  errorDetails: CsvRowError[];
}

/**
 * Procesa un lote de filas ya validadas en el cliente (F19). Se llama en
 * chunks (~500 filas) desde el wizard para no acercarse a limites de
 * duracion de una Server Action con hasta 10.000 filas de una sola vez.
 * Revalida cada fila server-side (nunca confia solo en la validacion de
 * cliente) antes de tocar la base.
 */
export async function importContactsBatch(
  rows: ValidatedCsvRow[],
  options: CsvImportOptions
): Promise<CsvImportBatchResult> {
  const { workspace } = await getWorkspace();
  const service = await createServiceClient();

  let imported = 0;
  let updated = 0;
  const errorDetails: CsvRowError[] = [];

  for (const row of rows) {
    if (!row.email && !row.phone) {
      errorDetails.push({ rowNumber: row.rowNumber, reason: "Falta email y telefono" });
      continue;
    }

    try {
      const match = await findContactMatch(service, workspace.id, {
        phone: row.phone,
        email: row.email,
      });

      if (match) {
        // No pisa con vacio: solo se actualizan los campos que vinieron
        // con valor en el CSV.
        const patch: Record<string, string> = {};
        if (row.display_name) patch.display_name = row.display_name;
        if (row.email) patch.email = row.email;
        if (row.secondary_email) patch.secondary_email = row.secondary_email;
        if (row.phone) patch.phone = row.phone;
        if (row.instagram_username) patch.instagram_username = row.instagram_username;
        if (row.country) patch.country = row.country;

        if (Object.keys(patch).length > 0) {
          await service.from("contacts").update(patch).eq("id", match.contactId);
        }

        await applyTags(service, match.contactId, options.tagIds);
        updated++;
      } else {
        const contactId = randomUUID();
        const { error } = await service.from("contacts").insert({
          id: contactId,
          workspace_id: workspace.id,
          display_name: row.display_name || row.email || row.phone || "Sin nombre",
          email: row.email,
          secondary_email: row.secondary_email,
          phone: row.phone,
          instagram_username: row.instagram_username,
          country: row.country,
          setter_id: options.setterId || null,
          vendedor_id: options.vendedorId || null,
        });

        if (error) {
          errorDetails.push({ rowNumber: row.rowNumber, reason: error.message });
          continue;
        }

        await applyTags(service, contactId, options.tagIds);
        imported++;
      }
    } catch (err) {
      errorDetails.push({
        rowNumber: row.rowNumber,
        reason: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  return { imported, updated, errors: errorDetails.length, errorDetails };
}

async function applyTags(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  contactId: string,
  tagIds: string[] | undefined
) {
  if (!tagIds || tagIds.length === 0) return;
  await service
    .from("contact_tags")
    .upsert(
      tagIds.map((tagId) => ({ contact_id: contactId, tag_id: tagId })),
      { onConflict: "contact_id,tag_id", ignoreDuplicates: true }
    );
}

/**
 * Registra el resumen final en csv_imports + audit_log, una sola vez
 * despues de que el wizard termino de mandar todos los chunks.
 */
export async function recordCsvImport(summary: {
  fileName: string;
  totalRows: number;
  imported: number;
  updated: number;
  errors: number;
  errorDetails: CsvRowError[];
}) {
  const { workspace, user, supabase } = await getWorkspace();

  const { error } = await supabase.from("csv_imports").insert({
    workspace_id: workspace.id,
    file_name: summary.fileName,
    total_rows: summary.totalRows,
    imported: summary.imported,
    updated: summary.updated,
    errors: summary.errors,
    error_details: summary.errorDetails as unknown as Json,
    imported_by: user.id,
  });

  if (error) return { error: error.message };

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "csv_import",
    entityId: null,
    action: "csv_import",
    performedBy: user.id,
    metadata: {
      file_name: summary.fileName,
      total_rows: summary.totalRows,
      imported: summary.imported,
      updated: summary.updated,
      errors: summary.errors,
    },
  });

  revalidatePath("/dashboard/contacts");
  return { ok: true };
}
