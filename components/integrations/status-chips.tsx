import { AlertCircle, Check, Pause, QrCode, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import type { StatusPart, StatusTone } from "@/lib/integration-status";

/** Colores por estado (ver lib/integration-status.ts). Fondos translucidos: se leen en claro y oscuro. */
export const TONE_CHIP_CLASSES: Record<StatusTone, string> = {
  ok: "bg-green-500/15 text-green-600",
  paused: "bg-amber-500/15 text-amber-600",
  info: "bg-sky-500/15 text-sky-600",
  bad: "bg-red-500/15 text-red-600",
  idle: "bg-muted text-muted-foreground",
};

export const TONE_DOT_CLASSES: Record<StatusTone, string> = {
  ok: "bg-green-500",
  paused: "bg-amber-500",
  info: "bg-sky-500",
  bad: "bg-red-500",
  idle: "bg-muted-foreground/40",
};

const TONE_ICONS: Partial<Record<StatusTone, LucideIcon>> = {
  ok: Check,
  paused: Pause,
  info: QrCode,
  bad: AlertCircle,
};

export function StatusChip({ part }: { part: StatusPart }) {
  const Icon = TONE_ICONS[part.tone];
  const chip = (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONE_CHIP_CLASSES[part.tone]
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {part.text}
    </span>
  );
  return part.detail ? <Tooltip content={part.detail}>{chip}</Tooltip> : chip;
}

export function StatusChips({ parts, className }: { parts: StatusPart[]; className?: string }) {
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {parts.map((p) => (
        <StatusChip key={`${p.tone}-${p.text}`} part={p} />
      ))}
    </span>
  );
}

export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        TONE_DOT_CLASSES[tone],
        (tone === "bad" || tone === "info") && "animate-pulse",
        className
      )}
    />
  );
}

const LEGEND: { tone: StatusTone; label: string }[] = [
  { tone: "ok", label: "Activo" },
  { tone: "paused", label: "Pausado" },
  { tone: "info", label: "Esperando QR" },
  { tone: "bad", label: "Desconectado" },
  { tone: "idle", label: "Sin configurar" },
];

export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-0.5 text-[11px] text-muted-foreground" aria-label="Qué significa cada color">
      {LEGEND.map((l) => (
        <span key={l.tone} className="inline-flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", TONE_DOT_CLASSES[l.tone])} />
          {l.label}
        </span>
      ))}
    </div>
  );
}
