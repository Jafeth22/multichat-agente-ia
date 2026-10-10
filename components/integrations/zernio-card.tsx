"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveZernioApiKey, disconnectZernio } from "@/lib/actions/integrations";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PlatformIcon } from "@/components/platform-icon";
import { Tooltip } from "@/components/ui/tooltip";
import { ApiKeyForm, SavedKeyRow } from "@/components/integrations/api-key-fields";
import { ChannelRow } from "@/components/integrations/channel-row";
import { CHANNEL_PROVIDERS } from "@/lib/channel-providers";
import { PLATFORM_LABELS, type Platform } from "@/lib/platforms";
import type { ChannelsState } from "@/components/integrations/use-channels";

const ZERNIO_PLATFORMS = CHANNEL_PROVIDERS.find((p) => p.id === "zernio")!.platforms;
const EXTRA_COST_PLATFORMS: Platform[] = ["facebook", "twitter"];

/** Contenido del bloque Zernio: API key, cuentas conectadas y botones para sumar redes. */
export function ZernioCard({
  isActive,
  keyHint,
  state,
}: {
  isActive: boolean;
  keyHint: string | null;
  state: ChannelsState;
}) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [editing, setEditing] = useState(!isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleSave(apiKey: string) {
    setSaving(true);
    setError(null);
    const result = await saveZernioApiKey(apiKey);
    setSaving(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setActive(true);
    setEditing(false);
    toast.success(
      `Zernio conectado: ${result.accountCount} ${result.accountCount === 1 ? "cuenta encontrada" : "cuentas encontradas"}`
    );
    // Trae de nuevo los canales desde el server component (las cuentas recien sincronizadas).
    router.refresh();
  }

  async function handleDisconnect() {
    setConfirmDisconnect(false);
    setDisconnecting(true);
    const result = await disconnectZernio();
    setDisconnecting(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setActive(false);
    setEditing(true);
    toast.success("Zernio desconectado");
  }

  const channels = state.zernioChannels;
  const syncing = state.syncing === "zernio";

  return (
    <>
      {active && !editing ? (
        <SavedKeyRow
          hint={keyHint}
          savedLabel="Probada y guardada"
          onChange={() => setEditing(true)}
          onDisconnect={() => setConfirmDisconnect(true)}
          disconnecting={disconnecting}
        />
      ) : (
        <ApiKeyForm
          label="API key de Zernio"
          placeholder="Pegá tu API key acá"
          saving={saving}
          error={error}
          onInput={() => setError(null)}
          onSubmit={handleSave}
          onCancel={active ? () => setEditing(false) : undefined}
          help={
            <>
              La conseguís en el{" "}
              <a
                href="https://zernio.com/dashboard/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
              >
                panel de Zernio
                <ExternalLink className="h-3 w-3" />
              </a>
              . Al pegarla la probamos sola.
            </>
          }
        />
      )}

      {channels.length > 0 ? (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {channels.map((c) => (
            <ChannelRow key={c.id} channel={c} state={state} />
          ))}
        </div>
      ) : (
        active && (
          <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center">
            <p className="text-sm font-medium">Todavía no hay cuentas</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Sumá tu primera red con los botones de abajo.</p>
          </div>
        )
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Sumar:</span>
          {ZERNIO_PLATFORMS.map((p) => {
            const tip = !active
              ? "Primero conectá tu API key"
              : EXTRA_COST_PLATFORMS.includes(p)
                ? "Cuesta $6/mes extra en Zernio"
                : null;
            return (
              <Tooltip key={p} content={tip}>
                <button
                  type="button"
                  disabled={!active || state.connecting !== null}
                  onClick={() => state.connect("zernio", p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-xs font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-45"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                    {state.connecting === p ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlatformIcon platform={p} className="h-3.5 w-3.5" size={14} />
                    )}
                  </span>
                  {PLATFORM_LABELS[p]}
                </button>
              </Tooltip>
            );
          })}
        </div>
        {active && (
          <Tooltip content="Buscar cuentas nuevas o cambios en Zernio">
            <button
              type="button"
              onClick={() => state.sync("zernio")}
              disabled={state.syncing !== null}
              aria-label="Sincronizar Zernio"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </button>
          </Tooltip>
        )}
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title="¿Desconectar Zernio?"
        message="Se borra la API key guardada. Las cuentas y conversaciones ya sincronizadas no se borran, pero no vas a poder recibir ni mandar mensajes hasta que la reconectes."
        confirmLabel="Desconectar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </>
  );
}
