import { cn } from "@/lib/utils";

export type IntegrationStatus = "not_configured" | "connected" | "error" | "saving";

const LABELS: Record<IntegrationStatus, string> = {
  not_configured: "No configurado",
  connected: "Conectado",
  error: "Error",
  saving: "Guardando...",
};

const DOT_CLASSES: Record<IntegrationStatus, string> = {
  not_configured: "bg-muted-foreground",
  connected: "bg-green-500",
  error: "bg-red-500",
  saving: "bg-yellow-500",
};

const TEXT_CLASSES: Record<IntegrationStatus, string> = {
  not_configured: "bg-muted text-muted-foreground",
  connected: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  saving: "bg-yellow-100 text-yellow-700",
};

export function StatusBadge({ status }: { status: IntegrationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        TEXT_CLASSES[status]
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[status])} />
      {LABELS[status]}
    </span>
  );
}
