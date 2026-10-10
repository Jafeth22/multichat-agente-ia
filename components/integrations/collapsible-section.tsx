"use client";

import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bloque plegable de /settings/integrations. Controlado desde afuera (la
 * pantalla decide que se abre solo y recuerda lo que abriste). Los chips
 * de estado se ven aunque el bloque este cerrado.
 *
 * El contenido queda siempre montado (asi no se pierde lo que estabas
 * escribiendo al cerrarlo) e `inert` mientras esta cerrado.
 */
export function CollapsibleSection({
  id,
  icon: Icon,
  title,
  description,
  chips,
  open,
  onToggle,
  variant = "section",
  highlighted = false,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  chips?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** "sub" para los bloques de proveedor dentro de otro bloque. */
  variant?: "section" | "sub";
  /** Resalta el borde un momento (al llegar desde el resumen). */
  highlighted?: boolean;
  children: ReactNode;
}) {
  const Heading = variant === "section" ? "h2" : "h3";
  const bodyId = `integracion-${id}-contenido`;

  return (
    <section
      id={`integracion-${id}`}
      className={cn(
        "scroll-mt-6 rounded-xl border border-border transition-shadow duration-300",
        variant === "section" ? "bg-card shadow-sm" : "bg-background",
        highlighted && "ring-4 ring-primary/20"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl text-left",
          variant === "section" ? "px-4 py-3.5 sm:px-5" : "px-3.5 py-3"
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
            variant === "section" ? "h-9 w-9" : "h-8 w-8"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <Heading className="text-sm font-semibold">{title}</Heading>
          <span className="block text-xs text-muted-foreground">{description}</span>
          {chips && <span className="mt-1.5 flex sm:hidden">{chips}</span>}
        </span>
        {chips && <span className="hidden justify-end sm:flex">{chips}</span>}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        id={bodyId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "space-y-4 border-t border-border",
              variant === "section" ? "p-4 sm:p-5" : "p-3.5"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
