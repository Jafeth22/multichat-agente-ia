"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { DateField } from "@/components/ui/date-time-field";
import { SelectField } from "@/components/ui/select-field";
import type { Database } from "@/lib/types/database";
import type { WorkspaceMemberOption } from "@/lib/members";

type Tag = Database["public"]["Tables"]["tags"]["Row"];

export interface InboxFiltersState {
  tagIds: string[];
  assignment: string;
  channel: string;
  datePreset: string;
  desde: string;
  hasta: string;
}

const DATE_PRESETS = [
  { value: "", label: "Fecha: todas" },
  { value: "today", label: "Hoy" },
  { value: "7d", label: "Ultimos 7 dias" },
  { value: "30d", label: "Ultimos 30 dias" },
  { value: "custom", label: "Rango personalizado" },
];

export function InboxFilters({
  tags,
  members,
  filters,
}: {
  tags: Tag[];
  members: WorkspaceMemberOption[];
  filters: InboxFiltersState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [showMobileSheet, setShowMobileSheet] = useState(false);

  function pushFilters(next: Partial<InboxFiltersState>) {
    const merged = { ...filters, ...next };
    const qs = new URLSearchParams();
    if (merged.tagIds.length > 0) qs.set("tags", merged.tagIds.join(","));
    if (merged.assignment) qs.set("assignment", merged.assignment);
    if (merged.channel) qs.set("canal", merged.channel);
    if (merged.datePreset) qs.set("fecha", merged.datePreset);
    if (merged.datePreset === "custom") {
      if (merged.desde) qs.set("desde", merged.desde);
      if (merged.hasta) qs.set("hasta", merged.hasta);
    }
    router.push(qs.toString() ? `${pathname}?${qs}` : pathname);
  }

  function toggleTag(tagId: string) {
    const next = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId];
    pushFilters({ tagIds: next });
  }

  function clearFilters() {
    pushFilters({ tagIds: [], assignment: "", channel: "", datePreset: "", desde: "", hasta: "" });
  }

  const activeFilterCount =
    filters.tagIds.length +
    (filters.assignment ? 1 : 0) +
    (filters.channel ? 1 : 0) +
    (filters.datePreset ? 1 : 0);

  const content = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SelectField
          size="sm"
          value={filters.assignment}
          onChange={(v) => pushFilters({ assignment: v })}
        >
          <option value="">Asignacion: todas</option>
          <option value="unassigned">Sin asignar</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </SelectField>

        <SelectField size="sm" value={filters.channel} onChange={(v) => pushFilters({ channel: v })}>
          <option value="">Canal: todos</option>
          <option value="instagram">Instagram</option>
          <option value="whatsapp">WhatsApp</option>
        </SelectField>

        <SelectField
          size="sm"
          value={filters.datePreset}
          onChange={(v) => pushFilters({ datePreset: v })}
        >
          {DATE_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </SelectField>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Limpiar filtros ({activeFilterCount})
          </button>
        )}
      </div>

      {filters.datePreset === "custom" && (
        <div className="flex items-center gap-2">
          <div className="w-36">
            <DateField value={filters.desde} onChange={(v) => pushFilters({ desde: v })} placeholder="Desde" />
          </div>
          <span className="text-xs text-muted-foreground">a</span>
          <div className="w-36">
            <DateField value={filters.hasta} onChange={(v) => pushFilters({ hasta: v })} placeholder="Hasta" />
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                filters.tagIds.includes(tag.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
              style={
                tag.color && !filters.tagIds.includes(tag.id)
                  ? { backgroundColor: `${tag.color}20`, color: tag.color }
                  : undefined
              }
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="border-b border-border px-3 py-2">
      {/* Desktop: filtros inline */}
      <div className="hidden sm:block">{content}</div>

      {/* Mobile: boton que abre un sheet */}
      <button
        onClick={() => setShowMobileSheet(true)}
        className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-xs font-medium sm:hidden"
      >
        <span className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
        </span>
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </button>
      <Sheet open={showMobileSheet} onClose={() => setShowMobileSheet(false)} title="Filtros de la bandeja">
        {content}
      </Sheet>
    </div>
  );
}
