"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Loader2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

export interface ActionsMenuItem {
  label: string;
  icon?: ReactNode;
  /** Si tiene href, la opcion navega; si no, ejecuta onClick. */
  href?: string;
  onClick?: () => void;
  /** Estilo rojo, para acciones de borrado. */
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * Menu de acciones de tres puntitos para filas de listas. El panel se dibuja
 * en un portal con posicion fija (igual que SelectField) para que no lo
 * corte el overflow de la tabla. Se cierra con clic afuera, Escape o scroll.
 */
export function ActionsMenu({
  items,
  loading = false,
  title = "Acciones",
}: {
  items: ActionsMenuItem[];
  /** Muestra un spinner en lugar de los tres puntitos (accion en curso). */
  loading?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  /** Calcula donde abrir el panel (arriba si no entra abajo) y lo abre. */
  function toggle() {
    if (open) {
      close();
      return;
    }
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const estimatedHeight = items.length * 34 + 12;
    const up = window.innerHeight - r.bottom < estimatedHeight + 8 && r.top > estimatedHeight;
    setPos({
      top: up ? r.top - 4 : r.bottom + 4,
      right: window.innerWidth - r.right,
      up,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, close]);

  const itemClass = (item: ActionsMenuItem) =>
    cn(
      "flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
      item.destructive ? "text-destructive hover:bg-destructive/10" : "hover:bg-accent"
    );

  return (
    <>
      <Tooltip content={open ? null : title}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={title}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={loading}
          onClick={toggle}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
        </button>
      </Tooltip>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{
              position: "fixed",
              right: pos.right,
              ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
            className="z-[100] min-w-40 rounded-xl border border-border bg-card p-1 shadow-lg"
          >
            {items.map((item, i) => {
              const content = (
                <>
                  {item.icon}
                  {item.label}
                </>
              );
              const separated = item.destructive && i > 0;
              return (
                <div key={item.label} className={separated ? "mt-1 border-t border-border pt-1" : undefined}>
                  {item.href ? (
                    <Link role="menuitem" href={item.href} onClick={close} className={itemClass(item)}>
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => {
                        close();
                        item.onClick?.();
                      }}
                      className={itemClass(item)}
                    >
                      {content}
                    </button>
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
