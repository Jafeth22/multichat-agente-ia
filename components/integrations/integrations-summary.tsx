"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot, StatusLegend } from "@/components/integrations/status-chips";
import type { StatusPart } from "@/lib/integration-status";

export interface SummaryTile {
  id: string;
  name: string;
  icon: ReactNode;
  parts: StatusPart[];
}

/** Tarjetas con el estado de cada integracion. Al tocarla te lleva a su bloque. */
export function IntegrationsSummary({
  tiles,
  onSelect,
}: {
  tiles: SummaryTile[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left transition-all hover:-translate-y-px hover:border-foreground/20"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {t.icon}
              </span>
              <span className="truncate">{t.name}</span>
            </span>
            <span className="flex flex-wrap gap-x-3 gap-y-0.5">
              {t.parts.map((p) => (
                <span key={`${p.tone}-${p.text}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <StatusDot tone={p.tone} />
                  {p.text}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
      <StatusLegend />
    </div>
  );
}

export interface SetupStep {
  id: string;
  label: string;
  minutes: number;
  done: boolean;
}

/** Guia de primeros pasos con progreso. Se oculta cuando todo esta listo. */
export function SetupSteps({ steps, onGo }: { steps: SetupStep[]; onGo: (id: string) => void }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Primeros pasos</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {done} de {steps.length} listos
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums",
                s.done ? "border-green-500 bg-green-500 text-white" : "border-border text-muted-foreground"
              )}
            >
              {s.done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={cn("min-w-0 flex-1 text-sm", s.done && "text-muted-foreground line-through")}>
              {s.label}
              {!s.done && <span className="ml-1.5 text-[11px] text-muted-foreground">{s.minutes} min</span>}
            </span>
            {!s.done && (
              <button
                type="button"
                onClick={() => onGo(s.id)}
                className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Hacer ahora
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
