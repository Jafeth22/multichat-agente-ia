"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { saveAiProviderKey, disconnectAiProvider } from "@/lib/actions/integrations";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge, type IntegrationStatus } from "@/components/integrations/status-badge";
import {
  AI_PROVIDER_DEFAULT_MODELS,
  AI_PROVIDER_LABELS,
  type AiProvider,
} from "@/lib/ai-providers";

export function AiProviderCard({
  provider,
  isActive,
  defaultModel: initialDefaultModel,
}: {
  provider: AiProvider;
  isActive: boolean;
  defaultModel: string | null;
}) {
  const models = AI_PROVIDER_DEFAULT_MODELS[provider];
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(initialDefaultModel ?? models[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [active, setActive] = useState(isActive);

  const status: IntegrationStatus = saving ? "saving" : active ? "connected" : "not_configured";

  async function handleSave() {
    if (!apiKey.trim() || saving) return;
    setSaving(true);
    setError(null);

    const result = await saveAiProviderKey(provider, apiKey.trim(), model);
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
    const result = await disconnectAiProvider(provider);
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
        <p className="text-sm font-medium">{AI_PROVIDER_LABELS[provider]}</p>
        <StatusBadge status={status} />
      </div>

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
            placeholder={active ? "Ingresa una key nueva para reemplazar la actual" : "API key"}
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

        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={saving}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || saving}
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
        title={`Desconectar ${AI_PROVIDER_LABELS[provider]}?`}
        message="Se borra la API key guardada."
        confirmLabel="Desconectar"
        destructive
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}
