"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { StatusChip } from "@/components/integrations/status-chips";

/**
 * Key ya guardada: se muestra oculta (••••a3F9) con "Cambiar" y
 * "Desconectar", en vez de un campo vacio siempre a la vista.
 */
export function SavedKeyRow({
  hint,
  savedLabel = "Guardada",
  onChange,
  onDisconnect,
  disconnecting = false,
}: {
  /** Ultimos 4 caracteres; las keys guardadas antes de este cambio no lo tienen. */
  hint: string | null;
  savedLabel?: string;
  onChange: () => void;
  onDisconnect: () => void;
  disconnecting?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/60 px-3 py-2.5">
      <span className="w-16 text-xs text-muted-foreground">API key</span>
      <code className="font-mono text-xs tracking-wider">••••••••{hint ?? ""}</code>
      <StatusChip part={{ tone: "ok", text: savedLabel }} />
      <span className="flex-1" />
      <button
        type="button"
        onClick={onChange}
        className="rounded px-1 text-xs font-medium text-primary hover:underline underline-offset-2"
      >
        Cambiar
      </button>
      <button
        type="button"
        onClick={onDisconnect}
        disabled={disconnecting}
        className="rounded px-1 text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        {disconnecting ? "Desconectando..." : "Desconectar"}
      </button>
    </div>
  );
}

/**
 * Campo para pegar una API key. Al pegarla en el campo vacio se guarda
 * sola (un clic menos); Enter tambien guarda.
 */
export function ApiKeyForm({
  label,
  placeholder,
  help,
  error,
  saving,
  savingLabel = "Probando...",
  submitLabel = "Conectar",
  onSubmit,
  onCancel,
  onInput,
  children,
}: {
  label?: string;
  placeholder: string;
  help?: ReactNode;
  error?: string | null;
  saving: boolean;
  savingLabel?: string;
  submitLabel?: string;
  onSubmit: (apiKey: string) => void;
  onCancel?: () => void;
  /** Para limpiar el error cuando el usuario vuelve a escribir. */
  onInput?: () => void;
  /** Campos extra entre la key y los botones (ej: modelo de IA). */
  children?: ReactNode;
}) {
  const [value, setValue] = useState("");

  function submit(key: string) {
    if (!key.trim() || saving) return;
    onSubmit(key.trim());
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className="space-y-2"
    >
      {label && <label className="block text-xs font-medium">{label}</label>}
      <PasswordInput
        value={value}
        data-step-focus
        autoComplete="off"
        disabled={saving}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          onInput?.();
        }}
        onPaste={(e) => {
          if (value) return;
          const pasted = e.clipboardData.getData("text").trim();
          if (!pasted) return;
          e.preventDefault();
          setValue(pasted);
          submit(pasted);
        }}
        className="font-mono placeholder:font-sans disabled:opacity-50"
      />
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        help && <p className="text-xs text-muted-foreground">{help}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!value.trim() || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? savingLabel : submitLabel}
        </button>
        {onCancel && !saving && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
