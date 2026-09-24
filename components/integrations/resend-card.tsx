"use client";

import { useState } from "react";
import { Eye, EyeOff, ExternalLink, Loader2 } from "lucide-react";
import { saveResendConfig, disconnectResend } from "@/lib/actions/integrations";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge, type IntegrationStatus } from "@/components/integrations/status-badge";

export function ResendCard({
  isActive,
  fromEmail: initialFromEmail,
}: {
  isActive: boolean;
  fromEmail: string | null;
}) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [fromEmail, setFromEmail] = useState(initialFromEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [active, setActive] = useState(isActive);

  const status: IntegrationStatus = saving ? "saving" : active ? "connected" : "not_configured";

  async function handleSave() {
    if (!apiKey.trim() || !fromEmail.trim() || saving) return;
    setSaving(true);
    setError(null);

    const result = await saveResendConfig(apiKey.trim(), fromEmail.trim());
    setSaving(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setActive(true);
    setApiKey("");
  }

  async function handleDisconnect() {
    setConfirmDisconnect(false);
    setDisconnecting(true);
    const result = await disconnectResend();
    setDisconnecting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setActive(false);
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Resend</p>
          <p className="text-xs text-muted-foreground">Email transaccional: invitaciones de equipo y avisos</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Conseguí tu API key y verificá tu dominio en{" "}
        <a
          href="https://resend.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
        >
          resend.com
          <ExternalLink className="h-3 w-3" />
        </a>
        . El remitente tiene que ser de un dominio ya verificado ahi.
      </p>

      <div className="mt-3 space-y-2">
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setError(null);
            }}
            disabled={saving}
            placeholder={active ? "Ingresa una key nueva para reemplazar la actual" : "re_..."}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm font-mono placeholder:text-muted-foreground placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <input
          type="email"
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
          disabled={saving}
          placeholder="notificaciones@tudominio.com"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || !fromEmail.trim() || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? "Guardando..." : active ? "Actualizar" : "Conectar"}
        </button>

        {active && (
          <button
            onClick={() => setConfirmDisconnect(true)}
            disabled={disconnecting}
            className="text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            {disconnecting ? "Desconectando..." : "Desconectar"}
          </button>
        )}

        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title="Desconectar Resend?"
        message="Se borra la API key guardada. Las invitaciones de equipo y los avisos de desconexion van a dejar de mandarse por email hasta que la reconectes."
        confirmLabel="Desconectar"
        destructive
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}
