"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { saveResendConfig, disconnectResend, sendResendTestEmail } from "@/lib/actions/integrations";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { SavedKeyRow } from "@/components/integrations/api-key-fields";

/** Contenido del bloque Email: remitente y API key de Resend, con email de prueba. */
export function ResendCard({
  isActive,
  fromEmail: initialFromEmail,
  keyHint,
}: {
  isActive: boolean;
  fromEmail: string | null;
  keyHint: string | null;
}) {
  const [active, setActive] = useState(isActive);
  const [editing, setEditing] = useState(!isActive);
  const [savedFrom, setSavedFrom] = useState(initialFromEmail ?? "");
  const [fromEmail, setFromEmail] = useState(initialFromEmail ?? "");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const canSave = !!fromEmail.trim() && (active || !!apiKey.trim()) && !saving;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const result = await saveResendConfig(apiKey.trim(), fromEmail.trim());
    setSaving(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setActive(true);
    setEditing(false);
    setSavedFrom(fromEmail.trim());
    setApiKey("");
    toast.success("Email configurado. Probalo con \"Enviar email de prueba\".");
  }

  async function handleTest() {
    setTesting(true);
    const result = await sendResendTestEmail();
    setTesting(false);
    if ("error" in result) {
      toast.error(`No se pudo mandar el email de prueba: ${result.error}`);
      return;
    }
    toast.success(`Listo: te mandamos un email de prueba a ${result.to}`);
  }

  async function handleDisconnect() {
    setConfirmDisconnect(false);
    setDisconnecting(true);
    const result = await disconnectResend();
    setDisconnecting(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setActive(false);
    setEditing(true);
    toast.success("Email desconectado");
  }

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50";

  return (
    <>
      {active && !editing ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/60 px-3 py-2.5">
            <span className="w-16 text-xs text-muted-foreground">Envía desde</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{savedFrom}</span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded px-1 text-xs font-medium text-primary hover:underline underline-offset-2"
            >
              Cambiar
            </button>
          </div>
          <SavedKeyRow
            hint={keyHint}
            onChange={() => setEditing(true)}
            onDisconnect={() => setConfirmDisconnect(true)}
            disconnecting={disconnecting}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {testing ? "Enviando..." : "Enviar email de prueba"}
            </button>
            <span className="text-xs text-muted-foreground">Se usa para invitaciones del equipo y avisos.</span>
          </div>
        </>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="resend-from" className="block text-xs font-medium">
                Email remitente
              </label>
              <input
                id="resend-from"
                type="email"
                data-step-focus
                value={fromEmail}
                disabled={saving}
                onChange={(e) => {
                  setFromEmail(e.target.value);
                  setError(null);
                }}
                placeholder="notificaciones@tudominio.com"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">Tiene que ser de un dominio verificado en Resend.</p>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium">API key de Resend</label>
              <PasswordInput
                value={apiKey}
                autoComplete="off"
                disabled={saving}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError(null);
                }}
                placeholder={active ? "Dejala vacía para mantener la actual" : "re_..."}
                className="font-mono placeholder:font-sans disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                La conseguís en{" "}
                <a
                  href="https://resend.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
                >
                  resend.com
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Guardando..." : "Guardar"}
            </button>
            {active && !saving && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setFromEmail(savedFrom);
                  setApiKey("");
                  setError(null);
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        title="¿Desconectar el email?"
        message="Se borra la API key guardada. Las invitaciones de equipo y los avisos de desconexión van a dejar de mandarse por email hasta que la reconectes."
        confirmLabel="Desconectar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </>
  );
}
