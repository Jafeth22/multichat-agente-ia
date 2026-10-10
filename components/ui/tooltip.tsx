"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const OPEN_DELAY_MS = 250;
const GAP_PX = 6;
const EDGE_PX = 8;

/**
 * Tooltip del sistema (reemplaza al atributo `title` nativo, que usa el
 * estilo del navegador y tarda en aparecer). Mismo look que los menus
 * (ActionsMenu, SelectField): fondo de tarjeta, borde y sombra.
 *
 * Envuelve al elemento que lo dispara. Aparece con hover o con foco de
 * teclado y se dibuja en un portal con posicion fija para que no lo corte
 * ningun overflow. Para botones deshabilitados, ponerles
 * `disabled:pointer-events-none` asi el hover llega al envoltorio.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  /** Clases del envoltorio (por defecto inline-flex). */
  className?: string;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<{ x: number; y: number; side: "top" | "bottom" } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function show() {
    clearTimer();
    timer.current = setTimeout(() => {
      const r = wrapperRef.current?.getBoundingClientRect();
      if (!r) return;
      // Si no entra arriba, va abajo (y al reves).
      const resolved = side === "top" && r.top < 48 ? "bottom" : side === "bottom" && window.innerHeight - r.bottom < 48 ? "top" : side;
      setAnchor({
        x: r.left + r.width / 2,
        y: resolved === "top" ? r.top - GAP_PX : r.bottom + GAP_PX,
        side: resolved,
      });
    }, OPEN_DELAY_MS);
  }

  function hide() {
    clearTimer();
    setAnchor(null);
  }

  // Centrado sobre el elemento pero sin salirse de la pantalla por los costados.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const w = tip.offsetWidth;
    const left = Math.min(Math.max(anchor.x - w / 2, EDGE_PX), window.innerWidth - w - EDGE_PX);
    tip.style.left = `${left}px`;
    tip.style.visibility = "visible";
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor]);

  useEffect(() => clearTimer, []);

  if (content === null || content === undefined || content === "") return <>{children}</>;

  return (
    <span
      ref={wrapperRef}
      className={cn("inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={hide}
      aria-describedby={anchor ? id : undefined}
    >
      {children}
      {anchor &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              top: anchor.y,
              left: anchor.x,
              visibility: "hidden",
              transform: anchor.side === "top" ? "translateY(-100%)" : undefined,
            }}
            className="pointer-events-none z-[110] max-w-xs rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs leading-snug text-card-foreground shadow-lg"
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  );
}
