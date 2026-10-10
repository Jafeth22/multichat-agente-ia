import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  CHANNEL_PROVIDER_IDS,
  isChannelProvider,
  type ChannelProvider,
} from "@/lib/channel-providers";
import { CHANNEL_SYNCERS, type ChannelSyncResult } from "@/lib/channel-sync";

async function getWorkspace(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(*)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership?.workspaces) return null;
  return membership.workspaces;
}

/**
 * POST /api/v1/channels/sync[?provider=zernio|evolution]
 *
 * Sincroniza los canales de un proveedor, o de todos si no se indica.
 * Cada proveedor corre por separado y solo toca sus propios canales: si
 * uno falla (o no esta configurado), los demas siguen igual.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase);
  if (!workspace)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requested = request.nextUrl.searchParams.get("provider");
  let providers: readonly ChannelProvider[] = CHANNEL_PROVIDER_IDS;
  if (requested) {
    if (!isChannelProvider(requested)) {
      return NextResponse.json({ error: `Proveedor desconocido: ${requested}` }, { status: 400 });
    }
    providers = [requested];
  }

  const service = await createServiceClient();
  const results: Partial<Record<ChannelProvider, ChannelSyncResult>> = {};

  for (const provider of providers) {
    try {
      results[provider] = await CHANNEL_SYNCERS[provider]({
        supabase,
        service,
        workspaceId: workspace.id,
      });
    } catch (err) {
      console.error(`[channels/sync] ${provider} failed:`, err);
      results[provider] = {
        created: 0,
        updated: 0,
        deactivated: 0,
        conversationsImported: 0,
        failed: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const { data: channels } = await supabase
    .from("channels")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ channels: channels ?? [], results });
}
