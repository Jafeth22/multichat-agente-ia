"use client";

import { MessageSquareText, Loader2 } from "lucide-react";
import type { Database } from "@/lib/types/database";

type ResponseTemplate = Database["public"]["Tables"]["response_templates"]["Row"];

export function TemplatePicker({
  templates,
  loading,
  highlight,
  onSelect,
  onClose,
}: {
  templates: ResponseTemplate[];
  loading: boolean;
  highlight: number;
  onSelect: (template: ResponseTemplate) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm rounded-lg border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">Templates</span>
        <button
          onClick={onClose}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Esc para cerrar
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto p-1">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Cargando templates...
          </div>
        ) : templates.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground/70">
            No hay templates que coincidan
          </p>
        ) : (
          templates.map((template, i) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className={`flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-xs ${
                i === highlight ? "bg-accent" : "hover:bg-accent/60"
              }`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <MessageSquareText className="h-3 w-3 text-muted-foreground" />
                {template.name}
                {template.shortcut && (
                  <span className="text-muted-foreground/70">/{template.shortcut}</span>
                )}
              </span>
              <span className="truncate text-muted-foreground/80">{template.content}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
