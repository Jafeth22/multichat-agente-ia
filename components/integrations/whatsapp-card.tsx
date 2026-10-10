"use client";

import { Loader2, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { ChannelRow } from "@/components/integrations/channel-row";
import type { ChannelsState } from "@/components/integrations/use-channels";

/** Contenido del bloque WhatsApp: numeros conectados por QR (Evolution API). */
export function WhatsappCard({ state }: { state: ChannelsState }) {
  const channels = state.whatsappChannels;
  const syncing = state.syncing === "evolution";

  return (
    <>
      {channels.length > 0 ? (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {channels.map((c) => (
            <ChannelRow key={c.id} channel={c} state={state} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center">
          <p className="text-sm font-medium">Ningún número conectado</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Agregá un número y escaneá el QR desde WhatsApp en tu celular.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          data-step-focus
          onClick={() => state.connect("evolution", "whatsapp")}
          disabled={state.connecting !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          {state.connecting === "whatsapp" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Agregar número
        </button>
        {channels.length > 0 && (
          <Tooltip content="Actualizar el estado de los números">
            <button
              type="button"
              onClick={() => state.sync("evolution")}
              disabled={state.syncing !== null}
              aria-label="Sincronizar WhatsApp"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </button>
          </Tooltip>
        )}
      </div>
    </>
  );
}
