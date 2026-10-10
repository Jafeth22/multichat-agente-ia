import type { ChannelProvider } from "@/lib/channel-providers";
import { syncZernioChannels } from "./zernio";
import { syncEvolutionChannels } from "./evolution";
import type { ChannelSyncContext, ChannelSyncResult } from "./types";

export type { ChannelSyncContext, ChannelSyncResult } from "./types";

/** Un sync por proveedor. Un proveedor nuevo suma su funcion aca. */
export const CHANNEL_SYNCERS: Record<
  ChannelProvider,
  (ctx: ChannelSyncContext) => Promise<ChannelSyncResult>
> = {
  zernio: syncZernioChannels,
  evolution: syncEvolutionChannels,
};
