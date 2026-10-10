"use client";

import { AlertCircle, Check, Loader2, RefreshCw, X } from "lucide-react";
import type { ChannelsState } from "@/components/integrations/use-channels";

/** Modal con el QR para vincular un numero de WhatsApp (Evolution API). */
export function WhatsappQrModal({ state }: { state: ChannelsState }) {
  const channel = state.whatsappModalChannel;
  if (!channel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="wa-qr-title" className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 id="wa-qr-title" className="text-sm font-semibold">
            Conectar WhatsApp
          </h3>
          <button
            type="button"
            onClick={state.closeWhatsappModal}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state.whatsappError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-600">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{state.whatsappError}</span>
          </div>
        )}

        {channel.connection_status === "connected" ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15 text-green-600">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Número conectado</p>
            <p className="text-center text-xs text-muted-foreground">
              Ya podés recibir y responder mensajes de WhatsApp desde la bandeja.
            </p>
            <button
              type="button"
              onClick={state.closeWhatsappModal}
              className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Listo
            </button>
          </div>
        ) : channel.qr_code ? (
          <div className="mt-4 flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={channel.qr_code.startsWith("data:") ? channel.qr_code : `data:image/png;base64,${channel.qr_code}`}
              alt="Código QR de WhatsApp"
              className="h-56 w-56 rounded-lg border border-border bg-white"
            />
            <ol className="list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
              <li>Abrí WhatsApp en tu celular</li>
              <li>
                Andá a <span className="font-medium text-foreground">Dispositivos vinculados → Vincular un dispositivo</span>
              </li>
              <li>Escaneá este código. La pantalla se actualiza sola.</li>
            </ol>
            <button
              type="button"
              onClick={() => state.reconnectWhatsapp(channel)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3 w-3" />
              Generar un QR nuevo
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Generando código QR...</p>
          </div>
        )}
      </div>
    </div>
  );
}
