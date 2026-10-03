"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

const TICK_MS = 100;

interface UndoToastProps {
  id: string | number;
  message: string;
  duration: number;
  onUndo: () => unknown;
}

function UndoToast({ id, message, duration, onUndo }: UndoToastProps) {
  const [remaining, setRemaining] = useState(duration);
  const pausedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      setRemaining((prev) => Math.max(prev - TICK_MS, 0));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining <= 0) toast.dismiss(id);
  }, [remaining, id]);

  return (
    <div
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      className="relative w-89 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg"
    >
      <div className="flex items-center gap-3 py-3 pl-4 pr-2">
        <p className="min-w-0 flex-1 text-sm">{message}</p>
        <button
          onClick={async () => {
            toast.dismiss(id);
            const result = await onUndo();
            const error = (result as { error?: string } | undefined)?.error;
            if (error) toast.error(`No se pudo deshacer: ${error}`);
            else toast.success("Restaurado");
          }}
          className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Deshacer
        </button>
        <span className="w-4 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
          {Math.ceil(remaining / 1000)}
        </span>
        <button
          onClick={() => toast.dismiss(id)}
          aria-label="Cerrar aviso"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full origin-left bg-primary transition-transform ease-linear"
          style={{
            transform: `scaleX(${remaining / duration})`,
            transitionDuration: `${TICK_MS}ms`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Aviso de "eliminado" con boton Deshacer, X para cerrarlo y una barrita
 * con segundos que muestra cuanto falta para que desaparezca. Se pausa
 * si pasas el mouse por encima.
 */
export function toastUndo(
  message: string,
  onUndo: () => unknown,
  duration = 5000
) {
  return toast.custom(
    (id) => (
      <UndoToast id={id} message={message} duration={duration} onUndo={onUndo} />
    ),
    { duration: Infinity }
  );
}
