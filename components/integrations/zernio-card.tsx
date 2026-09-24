"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ExternalLink, Loader2, Check } from "lucide-react";
import { saveZernioApiKey, disconnectZernio } from "@/lib/actions/integrations";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge, type IntegrationStatus } from "@/components/integrations/status-badge";

export function ZernioCard({ isActive }: { isActive: boolean }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [active, setActive] = useState(isActive);

  const status: IntegrationStatus = saving ? "saving" : active ? "connected" : "not_configured";

  async function handleSave() {
    if (!apiKey.trim() || saving) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const result = await saveZernioApiKey(apiKey.trim());
    setSaving(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setActive(true);
    setApiKey("");
    setSuccessMessage(`Conectado (${result.accountCount} ${result.accountCount === 1 ? "cuenta encontrada" : "cuentas encontradas"})`);
    setTimeout(() => setSuccessMessage(null), 5000);
    // Trae de nuevo la lista de canales del server component: las cuentas
    // recien sincronizadas no aparecian solas en la grilla de abajo.
    router.refresh();
  }

  async function handleDisconnect() {
    setConfirmDisconnect(false);
    setDisconnecting(true);
    const result = await disconnectZernio();
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
          <p className="text-sm font-medium">Instagram (Zernio)</p>
          <p className="text-xs text-muted-foreground">
            Tambien habilita Facebook y Twitter con la misma key (nota abajo)
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Conseguí tu API key en el{" "}
        <a
          href="https://zernio.com/dashboard/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
        >
          panel de Zernio
          <ExternalLink className="h-3 w-3" />
        </a>
        .
      </p>

      <div className="mt-3 relative">
        <input
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setError(null);
          }}
          disabled={saving}
          placeholder={active ? "Ingresa una key nueva para reemplazar la actual" : "Tu API key de Zernio"}
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

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? "Probando y guardando..." : active ? "Reconectar" : "Conectar"}
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

        {successMessage && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3.5 w-3.5" />
            {successMessage}
          </span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title="Desconectar Zernio?"
        message="Se borra la API key guardada. Las cuentas y conversaciones ya sincronizadas no se borran, pero no vas a poder recibir ni mandar mensajes hasta que la reconectes."
        confirmLabel="Desconectar"
        destructive
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}
