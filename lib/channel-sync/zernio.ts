import { createZernioClient } from "@/lib/zernio-client";
import { readChannelSecret } from "@/lib/vault";
import {
  ensureWebhookRegistered,
  getOrCreateWorkspaceWebhookSecret,
} from "@/lib/zernio-webhook";
import { backfillInboxConversations } from "@/lib/inbox-sync";
import { isSupportedPlatform } from "@/lib/platforms";
import { channelProvider } from "@/lib/channel-providers";
import { emptySyncResult, type ChannelSyncContext, type ChannelSyncResult } from "./types";

/**
 * Sync de Zernio: trae las cuentas de Zernio como canales, crea las nuevas,
 * actualiza las existentes y desactiva las que ya no estan. Solo toca
 * canales de Zernio (ver channelProvider): un canal de otro proveedor nunca
 * aparece en la lista de Zernio y no por eso tiene que apagarse.
 */
export async function syncZernioChannels({
  supabase,
  service,
  workspaceId,
}: ChannelSyncContext): Promise<ChannelSyncResult> {
  const result = emptySyncResult();

  const apiKey = await readChannelSecret(supabase, "zernio_api_key", workspaceId);
  if (!apiKey) {
    return { ...result, skipped: "Zernio no esta configurado" };
  }

  const zernio = createZernioClient(apiKey);
  const res = await zernio.accounts.listAccounts();
  const lateAccounts = res.data?.accounts ?? [];

  const { data: allChannels } = await supabase
    .from("channels")
    .select("*")
    .eq("workspace_id", workspaceId);

  const existingChannels = (allChannels ?? []).filter(
    (c) => channelProvider(c) === "zernio"
  );

  const existingByZernioId = new Map(existingChannels.map((c) => [c.late_account_id, c]));

  // The SDK type doesn't declare profilePicture but the API returns it
  const lateAccountIds = new Set(lateAccounts.map((a: { _id?: string }) => a._id).filter(Boolean));

  for (const account of lateAccounts) {
    if (!account._id) continue;
    // A Zernio key also carries accounts we can't drive (TikTok, YouTube,
    // ads accounts...). Inserting those hit the channels platform check
    // constraint and, since the error was discarded, vanished silently.
    if (!isSupportedPlatform(account.platform)) continue;
    const acc = account as typeof account & { profilePicture?: string };
    const profilePic = acc.profilePicture || null;

    const existing = existingByZernioId.get(account._id);

    if (existing) {
      if (
        existing.username !== (account.username || null) ||
        existing.display_name !== (account.displayName || account.username || null) ||
        existing.profile_picture !== profilePic
      ) {
        await supabase
          .from("channels")
          .update({
            username: account.username || null,
            display_name: account.displayName || account.username || null,
            profile_picture: profilePic,
          })
          .eq("id", existing.id);
        result.updated++;
      }
    } else {
      const { error: insertErr } = await supabase.from("channels").insert({
        workspace_id: workspaceId,
        platform: account.platform,
        late_account_id: account._id,
        username: account.username || null,
        display_name: account.displayName || account.username || null,
        profile_picture: profilePic,
        is_active: true,
      });
      if (insertErr) {
        // Reporting a channel we did not store is how #16 stayed hidden:
        // the platform check constraint rejected the row and the UI said OK.
        console.error("[channel-sync:zernio] channel insert failed:", insertErr);
        result.failed.push(`${account.platform}: ${insertErr.message}`);
        continue;
      }
      result.created++;
    }
  }

  // Deactivate Zernio channels whose accounts no longer exist in Zernio.
  for (const channel of existingChannels) {
    if (!lateAccountIds.has(channel.late_account_id) && channel.is_active) {
      await supabase.from("channels").update({ is_active: false }).eq("id", channel.id);
      result.deactivated++;
    }
  }

  // Re-register the webhook so inbound events reach the Inbox (#12).
  // Best-effort: a failure must not block the channel sync.
  try {
    const secret = await getOrCreateWorkspaceWebhookSecret(supabase, workspaceId);
    await ensureWebhookRegistered(zernio, {
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      secret,
      events: ["message.received", "comment.received"],
    });
  } catch (err) {
    console.error("[channel-sync:zernio] webhook auto-registration failed:", err);
  }

  // Backfill conversations that predate webhook registration (best-effort).
  // Con el cliente de servicio, igual que los webhooks: crear contactos es
  // algo que hace el sistema, no queda sujeto al scope de leads del usuario.
  try {
    const { data: activeChannels } = await supabase
      .from("channels")
      .select("id, late_account_id, platform, evolution_instance_name")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    const { imported } = await backfillInboxConversations({
      supabase: service,
      zernio,
      workspaceId,
      channels: (activeChannels ?? []).filter((c) => channelProvider(c) === "zernio"),
    });
    result.conversationsImported = imported;
  } catch (err) {
    console.error("[channel-sync:zernio] inbox backfill failed:", err);
  }

  return result;
}
