"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  Check,
  Copy,
  Plug,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Loader2,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PlatformIcon } from "@/components/platform-icon";
import { formatDateDMY } from "@/components/ui/date-time-field";
import type { Database } from "@/lib/types/database";
import {
  PLATFORM_LABELS,
  platformLabel,
  type Platform,
} from "@/lib/platforms";
import {
  CHANNEL_PROVIDERS,
  channelProvider,
  type ChannelProvider,
  type ChannelProviderInfo,
} from "@/lib/channel-providers";
import type { ChannelSyncResult } from "@/lib/channel-sync/types";
import {
  createWhatsappInstance,
  refreshWhatsappQr,
  disconnectWhatsappInstance,
  checkWhatsappConnectionState,
} from "@/lib/actions/whatsapp";

type Channel = Database["public"]["Tables"]["channels"]["Row"];

/** Donde se muestra un aviso: en la seccion de un proveedor o arriba de todo. */
type MessageSlot = ChannelProvider | "all";

function getDmLink(platform: Platform, username: string | null): { url: string | null; label: string } {
  const handle = username || "";
  switch (platform) {
    case "instagram":
      return handle ? { url: `https://ig.me/m/${handle}`, label: `ig.me/m/${handle}` } : { url: null, label: "" };
    case "facebook":
      return handle ? { url: `https://m.me/${handle}`, label: `m.me/${handle}` } : { url: null, label: "" };
    case "telegram":
      return handle ? { url: `https://t.me/${handle}`, label: `t.me/${handle}` } : { url: null, label: "" };
    case "twitter":
      return handle ? { url: `https://x.com/${handle}`, label: `x.com/${handle}` } : { url: null, label: "" };
    case "reddit":
      return handle ? { url: `https://reddit.com/message/compose/?to=${handle}`, label: `reddit.com/.../to=${handle}` } : { url: null, label: "" };
    case "whatsapp": {
      // Zernio stores WhatsApp numbers display-formatted ("+34 902 80 82 90");
      // wa.me rejects anything but digits.
      const digits = handle.replace(/\D/g, "");
      return digits ? { url: `https://wa.me/${digits}`, label: `wa.me/${digits}` } : { url: null, label: "" };
    }
    default:
      return { url: null, label: "" };
  }
}

/** Texto corto para el resultado del sync de un proveedor. */
function describeSyncResult(result: ChannelSyncResult): string {
  if (result.error) return `No se pudo sincronizar: ${result.error}`;
  if (result.skipped) return result.skipped;
  if (result.failed.length > 0) return `Algunos canales fallaron: ${result.failed.join("; ")}`;

  const parts = [];
  if (result.created > 0) parts.push(`${result.created} nuevos`);
  if (result.updated > 0) parts.push(`${result.updated} actualizados`);
  if (result.deactivated > 0) parts.push(`${result.deactivated} desactivados`);
  if (result.conversationsImported > 0) parts.push(`${result.conversationsImported} conversaciones importadas`);
  return parts.length > 0 ? parts.join(", ") : "Todo al dia";
}

export function ChannelsView({
  channels: initialChannels,
  providerExtras,
}: {
  channels: Channel[];
  workspaceId: string;
  /** Contenido extra al principio de la seccion de un proveedor (ej: la API key de Zernio). */
  providerExtras?: Partial<Record<ChannelProvider, ReactNode>>;
}) {
  const [channels, setChannels] = useState(initialChannels);

  // Cuando se conecta Zernio desde la card de su seccion (ZernioCard), el
  // padre pide un router.refresh() que vuelve a traer los canales desde
  // el server component. Sin este efecto, este estado local quedaba
  // pegado en la lista (vacia) del primer render.
  useEffect(() => {
    setChannels(initialChannels);
  }, [initialChannels]);

  const [syncing, setSyncing] = useState<MessageSlot | null>(null);
  const [messages, setMessages] = useState<Partial<Record<MessageSlot, string>>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pickerProvider, setPickerProvider] = useState<ChannelProvider | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [whatsappModalChannel, setWhatsappModalChannel] = useState<Channel | null>(null);
  const [whatsappActionError, setWhatsappActionError] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  function flash(slot: MessageSlot, text: string, ms = 4000) {
    setMessages((prev) => ({ ...prev, [slot]: text }));
    setTimeout(() => {
      setMessages((prev) => (prev[slot] === text ? { ...prev, [slot]: undefined } : prev));
    }, ms);
  }

  // Mientras el modal de QR esta abierto, cada 3s le pregunta directo a
  // Evolution API si ya se conecto (ademas de que el webhook interno
  // puede actualizar el canal solo). El chequeo directo es el que hace
  // que esto funcione tambien en desarrollo local, donde Evolution API
  // (en Railway) no le puede avisar a tu localhost.
  useEffect(() => {
    if (!whatsappModalChannel || whatsappModalChannel.connection_status === "connected") {
      return;
    }
    const channelId = whatsappModalChannel.id;
    const interval = setInterval(async () => {
      const result = await checkWhatsappConnectionState(channelId);
      if ("error" in result) {
        console.error("[whatsapp] checkWhatsappConnectionState:", result.error);
        setWhatsappActionError(result.error);
        return;
      }
      const data = result.channel;
      setChannels((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      setWhatsappModalChannel((prev) => (prev?.id === data.id ? data : prev));
    }, 3000);
    return () => clearInterval(interval);
  }, [whatsappModalChannel]);

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerProvider(null);
      }
    }
    if (pickerProvider) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [pickerProvider]);

  async function handleConnect(provider: ChannelProvider, platform: Platform) {
    setPickerProvider(null);

    if (provider === "evolution") {
      setConnecting(platform);
      const result = await createWhatsappInstance();
      setConnecting(null);
      if (result.error || !result.channel) {
        flash(provider, result.error || "No se pudo crear la instancia de WhatsApp");
        return;
      }
      setChannels((prev) => [result.channel as Channel, ...prev]);
      setWhatsappModalChannel(result.channel as Channel);
      return;
    }

    setConnecting(platform);
    try {
      const res = await fetch("/api/v1/channels/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        flash(provider, data.error || "No se pudo conectar");
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      flash(provider, "No se pudo iniciar la conexion");
    } finally {
      setConnecting(null);
    }
  }

  async function handleReconnectWhatsapp(channel: Channel) {
    setWhatsappActionError(null);
    setWhatsappModalChannel(channel);
    const result = await refreshWhatsappQr(channel.id);
    if (result.error) {
      setWhatsappActionError(result.error);
      return;
    }
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channel.id
          ? { ...c, qr_code: result.qrCode ?? null, connection_status: "connecting" }
          : c
      )
    );
    setWhatsappModalChannel((prev) =>
      prev ? { ...prev, qr_code: result.qrCode ?? null, connection_status: "connecting" } : prev
    );
  }

  async function handleDisconnectWhatsapp(channel: Channel) {
    setDisconnectingId(channel.id);
    const result = await disconnectWhatsappInstance(channel.id);
    if (result.error) {
      flash("evolution", result.error);
    } else {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channel.id
            ? { ...c, connection_status: "disconnected", qr_code: null }
            : c
        )
      );
    }
    setDisconnectingId(null);
  }

  /** Sin proveedor sincroniza todos; cada uno muestra su resultado en su seccion. */
  async function handleSync(provider?: ChannelProvider) {
    const slot: MessageSlot = provider ?? "all";
    setSyncing(slot);
    setMessages((prev) => ({ ...prev, [slot]: undefined }));

    try {
      const url = provider
        ? `/api/v1/channels/sync?provider=${provider}`
        : "/api/v1/channels/sync";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();

      if (!res.ok || data.error) {
        flash(slot, data.error || "No se pudo sincronizar", 10000);
        return;
      }

      setChannels(data.channels ?? []);
      const results = (data.results ?? {}) as Partial<Record<ChannelProvider, ChannelSyncResult>>;
      for (const [id, result] of Object.entries(results) as [ChannelProvider, ChannelSyncResult][]) {
        const failed = !!result.error || result.failed.length > 0;
        flash(id, describeSyncResult(result), failed ? 10000 : 4000);
      }
      if (!provider) flash("all", "Sincronizacion terminada");
    } catch {
      flash(slot, "No se pudo sincronizar. Revisa tu conexion.");
    } finally {
      setSyncing(null);
    }
  }

  async function handleToggleActive(channel: Channel) {
    setTogglingId(channel.id);
    const supabase = createClient();

    const { error } = await supabase
      .from("channels")
      .update({ is_active: !channel.is_active })
      .eq("id", channel.id);

    if (!error) {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channel.id ? { ...c, is_active: !c.is_active } : c
        )
      );
    }
    setTogglingId(null);
  }

  async function handleDelete() {
    if (!channelToDelete) return;
    const id = channelToDelete.id;
    const slot = channelProvider(channelToDelete);
    setChannelToDelete(null);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/v1/channels/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok || data.error) {
        flash(slot, data.error || "No se pudo eliminar el canal");
        return;
      }

      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch {
      flash(slot, "No se pudo eliminar el canal. Revisa tu conexion.");
    } finally {
      setDeletingId(null);
      setChannelToDelete(null);
    }
  }

  function renderConnectButton(provider: ChannelProviderInfo) {
    const buttonClass =
      "inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50";

    // Una sola plataforma (ej: WhatsApp): boton directo, sin menu.
    if (provider.platforms.length === 1) {
      const platform = provider.platforms[0];
      return (
        <button
          onClick={() => handleConnect(provider.id, platform)}
          disabled={connecting === platform}
          className={buttonClass}
        >
          {connecting === platform ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Conectar {PLATFORM_LABELS[platform]}
        </button>
      );
    }

    return (
      <div className="relative" ref={pickerProvider === provider.id ? pickerRef : undefined}>
        <button
          onClick={() => setPickerProvider(pickerProvider === provider.id ? null : provider.id)}
          className={buttonClass}
        >
          <Plus className="h-3.5 w-3.5" />
          Conectar canal
        </button>
        {pickerProvider === provider.id && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
            {provider.platforms.map((p) => (
              <button
                key={p}
                onClick={() => handleConnect(provider.id, p)}
                disabled={connecting === p}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {connecting === p ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlatformIcon platform={p} className="h-4 w-4" size={16} />
                )}
                {PLATFORM_LABELS[p]}
                {(p === "facebook" || p === "twitter") && (
                  <span className="ml-auto text-[10px] text-muted-foreground">$6/mes extra</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderChannelCard(channel: Channel) {
    const label = platformLabel(channel.platform);
    return (
      <div
        key={channel.id}
        className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar with platform badge */}
            <div className="relative">
              {channel.profile_picture ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={channel.profile_picture}
                    alt={channel.display_name ?? channel.username ?? label}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-background">
                    <PlatformIcon
                      platform={channel.platform}
                      className="h-3 w-3"
                      size={12}
                    />
                  </div>
                </>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <PlatformIcon
                    platform={channel.platform}
                    className="h-5 w-5"
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium">
                {channel.display_name ??
                  channel.username ??
                  label}
              </p>
              {channel.username && (
                <p className="text-xs text-muted-foreground">
                  @{channel.username}
                </p>
              )}
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleToggleActive(channel)}
              disabled={togglingId === channel.id}
              className={cn(
                "rounded-lg p-2 transition-colors",
                channel.is_active
                  ? "text-green-600 hover:bg-green-100"
                  : "text-muted-foreground hover:bg-muted"
              )}
              title={
                channel.is_active
                  ? "Canal activo. Click para desactivarlo."
                  : "Canal inactivo. Click para activarlo."
              }
            >
              {channel.is_active ? (
                <Power className="h-4 w-4" />
              ) : (
                <PowerOff className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setChannelToDelete(channel)}
              disabled={deletingId === channel.id}
              className="rounded-lg p-2 text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors"
              title="Eliminar canal"
            >
              {deletingId === channel.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              channel.is_active
                ? "bg-green-100 text-green-700"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                channel.is_active
                  ? "bg-green-500"
                  : "bg-muted-foreground"
              )}
            />
            {channel.is_active ? "Activo" : "Inactivo"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Conectado el {formatDateDMY(new Date(channel.created_at))}
          </span>
        </div>

        {channel.platform === "whatsapp" && channel.evolution_instance_name && (
          <div className="mt-3 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                channel.connection_status === "connected"
                  ? "bg-green-100 text-green-700"
                  : channel.connection_status === "connecting"
                  ? "bg-yellow-100 text-yellow-700"
                  : channel.connection_status === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {channel.connection_status === "connected"
                ? "Conectado"
                : channel.connection_status === "connecting"
                ? "Esperando QR"
                : channel.connection_status === "error"
                ? "Error"
                : "Desconectado"}
            </span>
            {channel.connection_status === "connected" ? (
              <button
                onClick={() => handleDisconnectWhatsapp(channel)}
                disabled={disconnectingId === channel.id}
                className="text-[11px] font-medium text-muted-foreground hover:text-destructive"
              >
                {disconnectingId === channel.id ? "Desconectando..." : "Desconectar"}
              </button>
            ) : (
              <button
                onClick={() => handleReconnectWhatsapp(channel)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                {channel.connection_status === "connecting" ? "Ver QR" : "Reconectar"}
              </button>
            )}
          </div>
        )}

        {(() => {
          const dm = getDmLink(channel.platform as Platform, channel.username);
          if (!dm.url) return null;
          return (
            <div className="mt-3 flex items-center gap-1.5">
              <a
                href={dm.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1 text-[11px] font-mono text-primary hover:underline"
                title={dm.url}
              >
                {dm.label}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(dm.url!);
                  setCopiedId(channel.id);
                  setTimeout(() => setCopiedId(null), 2000);
                }}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                  copiedId === channel.id
                    ? "border-green-200 bg-green-50 text-green-600"
                    : "border-border bg-card text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
                )}
                title={copiedId === channel.id ? "Copiado" : "Copiar link de mensaje directo"}
              >
                {copiedId === channel.id ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sync general */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Cada proveedor se sincroniza por separado
        </p>
        <div className="flex items-center gap-3">
          {messages.all && (
            <span className="text-xs text-muted-foreground">{messages.all}</span>
          )}
          <button
            onClick={() => handleSync()}
            disabled={syncing !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", syncing === "all" && "animate-spin")} />
            {syncing === "all" ? "Sincronizando..." : "Sincronizar todo"}
          </button>
        </div>
      </div>

      {CHANNEL_PROVIDERS.map((provider) => {
        const providerChannels = channels.filter((c) => channelProvider(c) === provider.id);
        const isSyncing = syncing === provider.id || syncing === "all";
        return (
          <section key={provider.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{provider.title}</h3>
                <p className="text-xs text-muted-foreground">{provider.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync(provider.id)}
                  disabled={syncing !== null}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                  {isSyncing ? "Sincronizando..." : "Sincronizar"}
                </button>
                {renderConnectButton(provider)}
              </div>
            </div>

            {messages[provider.id] && (
              <p className="mt-2 text-xs text-muted-foreground">{messages[provider.id]}</p>
            )}

            {providerExtras?.[provider.id] && (
              <div className="mt-4">{providerExtras[provider.id]}</div>
            )}

            <div className="pt-4">
              {providerChannels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Plug className="h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    Todavia no hay canales de {provider.title}
                  </p>
                  <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground/70">
                    Conecta una cuenta para empezar a recibir mensajes en la bandeja.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {providerChannels.map(renderChannelCard)}
                </div>
              )}
            </div>
          </section>
        );
      })}

      <ConfirmDialog
        open={!!channelToDelete}
        title="Eliminar canal?"
        message={`Esto desconecta ${
          channelToDelete?.display_name ??
          channelToDelete?.username ??
          (channelToDelete ? platformLabel(channelToDelete.platform) : "este canal")
        } y borra para siempre sus conversaciones, vinculos con contactos y estadisticas. No se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setChannelToDelete(null)}
      />

      {whatsappModalChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Conectar WhatsApp</h3>
              <button
                onClick={() => {
                  setWhatsappModalChannel(null);
                  setWhatsappActionError(null);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {whatsappActionError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{whatsappActionError}</span>
              </div>
            )}

            {whatsappModalChannel.connection_status === "connected" ? (
              <div className="mt-6 flex flex-col items-center gap-2 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Check className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">Numero conectado</p>
                <p className="text-center text-xs text-muted-foreground">
                  Ya podes recibir y responder mensajes de WhatsApp desde la bandeja.
                </p>
              </div>
            ) : whatsappModalChannel.qr_code ? (
              <div className="mt-4 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    whatsappModalChannel.qr_code.startsWith("data:")
                      ? whatsappModalChannel.qr_code
                      : `data:image/png;base64,${whatsappModalChannel.qr_code}`
                  }
                  alt="Codigo QR de WhatsApp"
                  className="h-56 w-56 rounded-lg border border-border"
                />
                <p className="text-center text-xs text-muted-foreground">
                  Abri WhatsApp en tu celular, anda a{" "}
                  <span className="font-medium text-foreground">
                    Dispositivos vinculados → Vincular un dispositivo
                  </span>{" "}
                  y escanea este codigo. La pantalla se actualiza sola cuando te conectes.
                </p>
                <button
                  onClick={() => handleReconnectWhatsapp(whatsappModalChannel)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <RefreshCw className="h-3 w-3" />
                  Generar un QR nuevo
                </button>
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-3 py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Generando codigo QR...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
