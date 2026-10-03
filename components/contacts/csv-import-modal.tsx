"use client";

import { useState } from "react";
import { Upload, Loader2, X, Download, CheckCircle2 } from "lucide-react";
import {
  parseCsvFile,
  suggestColumnMapping,
  validateRow,
  MAX_CSV_SIZE_BYTES,
  MAX_CSV_ROWS,
  MAPPABLE_FIELD_LABELS,
  type ColumnMapping,
  type MappableField,
  type ValidatedCsvRow,
  type CsvRowError,
} from "@/lib/csv-import";
import { importContactsBatch, recordCsvImport } from "@/lib/actions/csv-import";
import type { Database } from "@/lib/types/database";
import type { WorkspaceMemberOption } from "@/lib/members";
import { SelectField } from "@/components/ui/select-field";

type Tag = Database["public"]["Tables"]["tags"]["Row"];

const CHUNK_SIZE = 500;
const MAPPABLE_FIELDS: MappableField[] = [
  "display_name",
  "email",
  "phone",
  "secondary_email",
  "instagram_username",
  "country",
];

type Step = 1 | 2 | 3 | 4;

export function CsvImportModal({
  tags,
  members,
  onClose,
}: {
  tags: Tag[];
  members: WorkspaceMemberOption[];
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  const [setterId, setSetterId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{
    imported: number;
    updated: number;
    errors: number;
    errorDetails: CsvRowError[];
  } | null>(null);

  async function handleFileSelect(file: File) {
    setUploadError(null);
    if (file.size > MAX_CSV_SIZE_BYTES) {
      setUploadError("El archivo pesa mas de 10MB");
      return;
    }
    try {
      const parsed = await parseCsvFile(file);
      if (parsed.rows.length === 0) {
        setUploadError("El archivo no tiene filas para importar");
        return;
      }
      if (parsed.rows.length > MAX_CSV_ROWS) {
        setUploadError(`El archivo tiene ${parsed.rows.length} filas, el maximo es ${MAX_CSV_ROWS}`);
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setMapping(suggestColumnMapping(parsed.headers));
      setStep(2);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No se pudo leer el archivo CSV");
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }

  async function handleImport() {
    setStep(4);
    setImporting(true);
    setProgress({ processed: 0, total: rawRows.length });

    const validated: ValidatedCsvRow[] = [];
    const clientErrors: CsvRowError[] = [];
    rawRows.forEach((row, i) => {
      const result = validateRow(row, mapping, i + 2); // +2: fila 1 es el header
      if (result.row) validated.push(result.row);
      else clientErrors.push(result.error);
    });

    let imported = 0;
    let updated = 0;
    const errorDetails: CsvRowError[] = [...clientErrors];

    for (let i = 0; i < validated.length; i += CHUNK_SIZE) {
      const chunk = validated.slice(i, i + CHUNK_SIZE);
      const result = await importContactsBatch(chunk, {
        setterId: setterId || null,
        vendedorId: vendedorId || null,
        tagIds: selectedTagIds,
      });
      imported += result.imported;
      updated += result.updated;
      errorDetails.push(...result.errorDetails);
      setProgress({ processed: Math.min(i + chunk.length, validated.length), total: rawRows.length });
    }

    const finalSummary = { imported, updated, errors: errorDetails.length, errorDetails };
    await recordCsvImport({
      fileName,
      totalRows: rawRows.length,
      ...finalSummary,
    });

    setSummary(finalSummary);
    setImporting(false);
  }

  function downloadErrors() {
    if (!summary || summary.errorDetails.length === 0) return;
    const lines = ["fila,motivo", ...summary.errorDetails.map((e) => `${e.rowNumber},"${e.reason.replace(/"/g, '""')}"`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "errores-importacion.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={importing ? undefined : onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border border-border bg-card p-6 shadow-lg sm:max-h-[85vh]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Importar contactos por CSV — Paso {step} de 4
          </h3>
          {!importing && (
            <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-10 text-center hover:bg-accent/50">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Arrastra tu archivo CSV o hace click para elegirlo</span>
                <span className="text-xs text-muted-foreground">Maximo 10MB y 10.000 filas</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </label>
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Preview ({rawRows.length} filas en total)
                </h4>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        {headers.map((h) => (
                          <th key={h} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {headers.map((h) => (
                            <td key={h} className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Mapeo de columnas
                </h4>
                <div className="space-y-2">
                  {MAPPABLE_FIELDS.map((field) => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="w-40 shrink-0 text-xs text-muted-foreground">
                        {MAPPABLE_FIELD_LABELS[field]}
                        {field === "display_name" && <span className="text-muted-foreground/60"> (opcional)</span>}
                      </span>
                      <SelectField size="sm"
                        value={mapping[field] ?? ""}
                        onChange={(v) =>
                          setMapping((prev) => ({ ...prev, [field]: v || undefined }))
                        }
                        className="flex-1"
                      >
                        <option value="">-- No mapear --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground/70">
                  Cada fila necesita al menos email o telefono validos.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Opcional: se aplica a todos los contactos que se creen en esta importacion (no pisa la
                asignacion de los contactos que ya existen).
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Setter</label>
                <SelectField
                  value={setterId}
                  onChange={(v) => setSetterId(v)}
                  className="mt-1 w-full"
                >
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vendedor</label>
                <SelectField
                  value={vendedorId}
                  onChange={(v) => setVendedorId(v)}
                  className="mt-1 w-full"
                >
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              {tags.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tags</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          selectedTagIds.includes(tag.id)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {!summary ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Importando {progress.processed} de {progress.total}...
                  </p>
                  <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress.total ? (progress.processed / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                  <p className="text-sm font-medium">Importacion terminada</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold">{summary.imported}</p>
                      <p className="text-xs text-muted-foreground">Nuevos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{summary.updated}</p>
                      <p className="text-xs text-muted-foreground">Actualizados</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{summary.errors}</p>
                      <p className="text-xs text-muted-foreground">Errores</p>
                    </div>
                  </div>
                  {summary.errors > 0 && (
                    <button
                      onClick={downloadErrors}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar errores
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-between gap-2">
          {step > 1 && step < 4 && (
            <button
              onClick={() => setStep((step - 1) as Step)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Volver
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {step < 4 && (
              <button
                onClick={onClose}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={!mapping.email && !mapping.phone}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Siguiente
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleImport}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Importar
              </button>
            )}
            {step === 4 && summary && (
              <button
                onClick={onClose}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
