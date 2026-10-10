"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { channelProvider, type ChannelProvider } from "@/lib/channel-providers";
import type { ChannelSyncResult } from "@/lib/channel-sync/types";
import type { Platform } from "@/lib/platforms";
import type { Database } from "@/lib/types/database";
import {
  createWhatsappInstance,
  refreshWhatsappQr,
  disconnectWhatsappInstance,
  checkWhatsappConnectionState,
} from "@/lib/actions/whatsapp";

export type Channel = Database["public"]["Tables"]["channels"]["Row"];

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
  return parts.length > 0 ? parts.join(", ") : "Todo al día";
}

/**
 * Estado y acciones de los canales (Zernio y WhatsApp) de la pantalla de
 * integraciones. Los avisos salen como toast (abajo a la derecha).
 */
export function useChannels(initialChannels: Channel[]) {
  const [channels, setChannels] = useState(initialChannels);

  // Cuando se conecta Zernio, la card pide un router.refresh() que vuelve
  // a traer los canales desde el server component. Sin este efecto, este
  // estado local quedaba pegado en la lista del primer render.
  useEffect(() => {
    setChannels(initialChannels);
  }, [initialChannels]);

  const [syncing, setSyncing] = useState<ChannelProvider | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [whatsappModalChannel, setWhatsappModalChannel] = useState<Channel | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

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
        setWhatsappError(result.error);
        return;
      }
      const data = result.channel;
      setChannels((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      setWhatsappModalChannel((prev) => (prev?.id === data.id ? data : prev));
      if (data.connection_status === "connected") toast.success("WhatsApp conectado");
    }, 3000);
    return () => clearInterval(interval);
  }, [whatsappModalChannel]);

  async function connect(provider: ChannelProvider, platform: Platform) {
    setConnecting(platform);

    if (provider === "evolution") {
      const result = await createWhatsappInstance();
      setConnecting(null);
      if (result.error || !result.channel) {
        toast.error(result.error || "No se pudo crear la instancia de WhatsApp");
        return;
      }
      setChannels((prev) => [result.channel as Channel, ...prev]);
      setWhatsappError(null);
      setWhatsappModalChannel(result.channel as Channel);
      return;
    }

    try {
      const res = await fetch("/api/v1/channels/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error || "No se pudo conectar");
        return;
      }
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      toast.error("No se pudo iniciar la conexión");
    } finally {
      setConnecting(null);
    }
  }

  async function sync(provider: ChannelProvider) {
    setSyncing(provider);
    try {
      const res = await fetch(`/api/v1/channels/sync?provider=${provider}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error || "No se pudo sincronizar");
        return;
      }

      setChannels(data.channels ?? []);
      const results = (data.results ?? {}) as Partial<Record<ChannelProvider, ChannelSyncResult>>;
      for (const result of Object.values(results)) {
        if (!result) continue;
        const failed = !!result.error || result.failed.length > 0;
        if (failed) toast.error(describeSyncResult(result), { duration: 10000 });
        else toast.success(describeSyncResult(result));
      }
    } catch {
      toast.error("No se pudo sincronizar. Revisá tu conexión.");
    } finally {
      setSyncing(null);
    }
  }

  async function toggleActive(channel: Channel) {
    setTogglingId(channel.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("channels")
      .update({ is_active: !channel.is_active })
      .eq("id", channel.id);
    setTogglingId(null);

    if (error) {
      toast.error("No se pudo cambiar el estado del canal");
      return;
    }
    setChannels((prev) => prev.map((c) => (c.id === channel.id ? { ...c, is_active: !c.is_active } : c)));
    const name = channel.display_name ?? channel.username ?? "El canal";
    toast.success(channel.is_active ? `${name} quedó pausado` : `${name} vuelve a recibir mensajes`);
  }

  async function confirmDelete() {
    if (!channelToDelete) return;
    const id = channelToDelete.id;
    setChannelToDelete(null);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/v1/channels/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "No se pudo eliminar el canal");
        return;
      }
      setChannels((prev) => prev.filter((c) => c.id !== id));
      toast.success("Canal eliminado");
    } catch {
      toast.error("No se pudo eliminar el canal. Revisá tu conexión.");
    } finally {
      setDeletingId(null);
    }
  }

  async function reconnectWhatsapp(channel: Channel) {
    setWhatsappError(null);
    setWhatsappModalChannel(channel);
    const result = await refreshWhatsappQr(channel.id);
    if (result.error) {
      setWhatsappError(result.error);
      return;
    }
    const patch = { qr_code: result.qrCode ?? null, connection_status: "connecting" as const };
    setChannels((prev) => prev.map((c) => (c.id === channel.id ? { ...c, ...patch } : c)));
    setWhatsappModalChannel((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function disconnectWhatsapp(channel: Channel) {
    setDisconnectingId(channel.id);
    const result = await disconnectWhatsappInstance(channel.id);
    setDisconnectingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channel.id ? { ...c, connection_status: "disconnected", qr_code: null } : c
      )
    );
    toast.success("Número desconectado");
  }

  function closeWhatsappModal() {
    setWhatsappModalChannel(null);
    setWhatsappError(null);
  }

  return {
    channels,
    zernioChannels: channels.filter((c) => channelProvider(c) === "zernio"),
    whatsappChannels: channels.filter((c) => channelProvider(c) === "evolution"),
    syncing,
    togglingId,
    deletingId,
    disconnectingId,
    connecting,
    channelToDelete,
    whatsappModalChannel,
    whatsappError,
    connect,
    sync,
    toggleActive,
    requestDelete: setChannelToDelete,
    cancelDelete: () => setChannelToDelete(null),
    confirmDelete,
    reconnectWhatsapp,
    disconnectWhatsapp,
    closeWhatsappModal,
  };
}

export type ChannelsState = ReturnType<typeof useChannels>;
