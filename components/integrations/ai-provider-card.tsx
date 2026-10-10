"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, PowerOff, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saveAiProviderKey,
  disconnectAiProvider,
  updateAiProviderModel,
  setDefaultAiProvider,
} from "@/lib/actions/integrations";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { SelectField } from "@/components/ui/select-field";
import { Tooltip } from "@/components/ui/tooltip";
import { ApiKeyForm } from "@/components/integrations/api-key-fields";
import { StatusDot } from "@/components/integrations/status-chips";
import { AI_PROVIDER_DEFAULT_MODELS, AI_PROVIDER_LABELS, type AiProvider } from "@/lib/ai-providers";

/** Tarjeta de un proveedor de IA (BYOK) dentro de la grilla de 3. */
export function AiProviderCard({
  provider,
  isActive,
  defaultModel,
  keyHint,
  isDefault,
}: {
  provider: AiProvider;
  isActive: boolean;
  defaultModel: string | null;
  keyHint: string | null;
  isDefault: boolean;
}) {
  const models = AI_PROVIDER_DEFAULT_MODELS[provider];
  const label = AI_PROVIDER_LABELS[provider];
  const [active, setActive] = useState(isActive);
  const [editing, setEditing] = useState(false);
  const [model, setModel] = useState(defaultModel && models.includes(defaultModel) ? defaultModel : models[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleSave(apiKey: string) {
    setSaving(true);
    setError(null);
    const result = await saveAiProviderKey(provider, apiKey, model);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setActive(true);
    setEditing(false);
    toast.success(`${label} conectado`);
  }

  async function handleModelChange(next: string) {
    const previous = model;
    setModel(next);
    if (!active || editing) return;
    const result = await updateAiProviderModel(provider, next);
    if ("error" in result) {
      setModel(previous);
      toast.error(result.error);
      return;
    }
    toast.success(`Modelo actualizado: ${next}`);
  }

  async function handleSetDefault() {
    const result = await setDefaultAiProvider(provider);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${label} queda como predeterminado`);
  }

  async function handleDisconnect() {
    setConfirmDisconnect(false);
    setDisconnecting(true);
    const result = await disconnectAiProvider(provider);
    setDisconnecting(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setActive(false);
    toast.success(`${label} desconectado`);
  }

  const modelSelect = (
    <SelectField value={model} onChange={handleModelChange} disabled={saving} size="sm" className="w-full">
      {models.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </SelectField>
  );

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border bg-background p-3",
        active && isDefault ? "border-primary ring-1 ring-primary" : "border-border"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
          {label.charAt(0)}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</p>
        {active && (
          <Tooltip content={keyHint ? `Conectado (key ••••${keyHint})` : "Conectado"}>
            <StatusDot tone="ok" />
          </Tooltip>
        )}
      </div>

      {editing || (!active && error) ? (
        <ApiKeyForm
          placeholder="Pegá tu API key"
          saving={saving}
          savingLabel="Guardando..."
          error={error}
          onInput={() => setError(null)}
          onSubmit={handleSave}
          onCancel={() => {
            setEditing(false);
            setError(null);
          }}
        >
          {modelSelect}
        </ApiKeyForm>
      ) : active ? (
        <>
          {modelSelect}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleSetDefault}
              disabled={isDefault}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] disabled:cursor-default",
                isDefault ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Star className={cn("h-3.5 w-3.5", isDefault && "fill-current")} />
              {isDefault ? "Predeterminado" : "Usar por defecto"}
            </button>
            <ActionsMenu
              loading={disconnecting}
              title={`Más acciones de ${label}`}
              items={[
                {
                  label: "Cambiar API key",
                  icon: <KeyRound className="h-3.5 w-3.5" />,
                  onClick: () => setEditing(true),
                },
                {
                  label: "Desconectar",
                  icon: <PowerOff className="h-3.5 w-3.5" />,
                  destructive: true,
                  onClick: () => setConfirmDisconnect(true),
                },
              ]}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Modelos: {models.slice(0, 2).join(", ")}...</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Conectar
          </button>
        </>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        title={`¿Desconectar ${label}?`}
        message="Se borra la API key guardada."
        confirmLabel="Desconectar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}
