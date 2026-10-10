"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface ParsedOption {
  value: string;
  label: ReactNode;
  disabled: boolean;
}

/** Lee los <option> hijos (incluso dentro de fragmentos y arrays) como lista de opciones. */
function parseOptions(children: ReactNode): ParsedOption[] {
  const result: ParsedOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;
    if (el.type === Fragment) {
      result.push(...parseOptions(el.props.children));
      return;
    }
    if (el.type === "option") {
      const label = el.props.children;
      result.push({
        value: el.props.value !== undefined ? String(el.props.value) : String(label ?? ""),
        label,
        disabled: !!el.props.disabled,
      });
    }
  });
  return result;
}

/**
 * Dropdown del sistema (reemplaza al <select> nativo, cuyo menu desplegable
 * usa el estilo del navegador / sistema operativo y no la paleta del
 * sistema). Se usa igual que un <select>: hijos <option>, pero onChange
 * recibe directamente el valor elegido. Mismo look que DateField.
 *
 * El menu se dibuja en un portal con posicion fija para que no lo corte
 * ningun contenedor con overflow (modales, paneles laterales).
 */
export function SelectField({
  value,
  onChange,
  children,
  label,
  placeholder = "Elegir...",
  size = "md",
  disabled = false,
  className,
  title,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  label?: string;
  placeholder?: string;
  /** "sm" para filtros compactos, "md" para formularios. */
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const options = parseOptions(children);
  const selected = options.find((o) => o.value === value);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; maxHeight: number; up: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const measure = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 180 && above > below;
    const maxHeight = Math.max(120, Math.min(280, up ? above : below));
    setRect({
      top: up ? r.top - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      maxHeight,
      up,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    }
    function onScrollOrResize(e: Event) {
      // Scroll dentro del propio menu no lo cierra.
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      close();
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, rect]);

  function openMenu() {
    if (disabled) return;
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(opt: ParsedOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
    buttonRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      let i = activeIndex;
      for (let n = 0; n < options.length; n++) {
        i = (i + dir + options.length) % options.length;
        if (!options[i].disabled) break;
      }
      setActiveIndex(i);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt) choose(opt);
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <div className={cn("relative", className)}>
      {label && <label className="mb-1 block text-xs text-muted-foreground">{label}</label>}
      <Tooltip content={open ? null : title} className="flex w-full">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? close() : openMenu())}
          onKeyDown={onKeyDown}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background text-left focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              "shrink-0 text-muted-foreground transition-transform",
              size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
              open && "rotate-180"
            )}
          />
        </button>
      </Tooltip>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{
              position: "fixed",
              left: rect.left,
              minWidth: rect.width,
              maxHeight: rect.maxHeight,
              ...(rect.up ? { bottom: window.innerHeight - rect.top } : { top: rect.top }),
            }}
            className="z-[100] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg"
          >
            {options.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Sin opciones</p>
            )}
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={`${opt.value}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  data-active={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(opt)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40",
                    size === "md" && "text-sm",
                    i === activeIndex && "bg-accent",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:opacity-90"
                  )}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
