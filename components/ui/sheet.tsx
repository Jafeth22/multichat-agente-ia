"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Panel deslizante desde abajo, para mobile (F16: filtros del inbox en un
 * sheet en pantallas chicas). Generico, sin logica de negocio.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:hidden">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-xl border-t border-border bg-card p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
