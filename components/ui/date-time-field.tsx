"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateKey(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Lunes = 0 ... Domingo = 6, para armar la grilla del calendario. */
function mondayFirstDay(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, onOutside]);
}

/**
 * Selector de fecha con calendario propio (dropdown), en vez del input
 * nativo del navegador: no todos los navegadores muestran un icono de
 * calendario visible, y el estilo nativo no sigue la paleta del sistema.
 */
export function DateField({
  value,
  onChange,
  label,
  placeholder = "Elegir fecha",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDateKey(value);
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = mondayFirstDay(firstOfMonth);
  const today = toDateKey(new Date());

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function selectDay(day: number) {
    onChange(toDateKey(new Date(year, month, day)));
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="mb-1 block text-xs text-muted-foreground">{label}</label>}
      <button
        type="button"
        onClick={() => {
          setViewDate(selected ?? new Date());
          setOpen((o) => !o);
        }}
        className="flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn(!selected && "text-muted-foreground")}>
          {selected
            ? selected.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
            : placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
            {WEEKDAY_LABELS.map((wd) => (
              <span key={wd}>{wd}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <span key={`blank-${i}`} />;
              const key = toDateKey(new Date(year, month, day));
              const isSelected = key === value;
              const isToday = key === today;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "rounded-md py-1 text-xs hover:bg-accent",
                    isSelected && "bg-primary text-primary-foreground hover:opacity-90",
                    !isSelected && isToday && "font-semibold text-primary"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Quitar fecha
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Todos los horarios del dia cada 30 minutos: "00:00", "00:30", ... "23:30". */
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 === 0 ? "00" : "30"}`);

/**
 * Selector de hora: se puede tipear a mano (HH:mm) o elegir de una lista
 * de horarios, en vez del widget nativo del navegador (inconsistente
 * entre navegadores y no sigue la paleta del sistema).
 */
export function TimeField({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const activeEl = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    activeEl?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="mb-1 block text-xs text-muted-foreground">{label}</label>}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          placeholder="HH:mm"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={5}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-lg border border-input bg-background p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          title="Elegir hora"
        >
          <Clock className="h-4 w-4" />
        </button>
      </div>

      {open && !disabled && (
        <div
          ref={listRef}
          className="absolute right-0 z-20 mt-1 max-h-48 w-24 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          {TIME_SLOTS.map((slot) => {
            const isActive = slot === value;
            return (
              <button
                key={slot}
                type="button"
                data-active={isActive}
                onClick={() => {
                  onChange(slot);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-accent",
                  isActive && "bg-primary text-primary-foreground hover:opacity-90"
                )}
              >
                {slot}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
