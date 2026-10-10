import * as evolution from "@/lib/evolution-client";
import { channelProvider } from "@/lib/channel-providers";
import { emptySyncResult, type ChannelSyncContext, type ChannelSyncResult } from "./types";

const STATUS_BY_STATE = {
  open: "connected",
  connecting: "connecting",
  close: "disconnected",
} as const;

/**
 * Sync de Evolution (WhatsApp): por cada instancia, trae el estado real de
 * la conexion y vuelve a registrar el webhook con la URL actual de la app
 * (por si cambio el dominio desde que se conecto). No toca `is_active`:
 * prender o apagar un canal es decision del usuario.
 */
export async function syncEvolutionChannels({
  supabase,
  workspaceId,
}: ChannelSyncContext): Promise<ChannelSyncResult> {
  const result = emptySyncResult();

  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    return { ...result, skipped: "Evolution API no esta configurada" };
  }

  const { data: allChannels } = await supabase
    .from("channels")
    .select("*")
    .eq("workspace_id", workspaceId);

  const channels = (allChannels ?? []).filter((c) => channelProvider(c) === "evolution");

  for (const channel of channels) {
    const instanceName = channel.evolution_instance_name!;
    const label = channel.display_name ?? instanceName;

    try {
      if (channel.webhook_secret) {
        await evolution.setWebhook(
          instanceName,
          evolution.evolutionWebhookUrl(channel.webhook_secret)
        );
      }

      const state = (await evolution.getConnectionState(instanceName)).instance?.state;
      const status = state ? STATUS_BY_STATE[state] : null;
      if (!status || status === channel.connection_status) continue;

      await supabase
        .from("channels")
        .update(
          status === "connected"
            ? {
                connection_status: status,
                qr_code: null,
                last_connected_at: new Date().toISOString(),
                disconnected_at: null,
                disconnected_notified_at: null,
              }
            : status === "disconnected"
              ? { connection_status: status, disconnected_at: new Date().toISOString() }
              : { connection_status: status }
        )
        .eq("id", channel.id);
      result.updated++;
    } catch (err) {
      console.error(`[channel-sync:evolution] ${instanceName} failed:`, err);
      result.failed.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
