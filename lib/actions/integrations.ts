"use server";

import { getWorkspace } from "@/lib/workspace";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { storeSecret, deleteSecret } from "@/lib/vault";
import { createZernioClient } from "@/lib/zernio-client";
import {
  ensureWebhookRegistered,
  getOrCreateWorkspaceWebhookSecret,
} from "@/lib/zernio-webhook";
import { backfillInboxConversations } from "@/lib/inbox-sync";
import { isSupportedPlatform } from "@/lib/platforms";
import {
  AI_PROVIDER_DEFAULT_MODELS,
  AI_PROVIDER_KEY_PREFIXES,
  AI_PROVIDER_LABELS,
  AI_PROVIDER_MIN_KEY_LENGTH,
  aiProviderSecretName,
  type AiProvider,
} from "@/lib/ai-providers";

const ZERNIO_SECRET_NAME = "zernio_api_key";
const RESEND_SECRET_NAME = "resend_api_key";

async function requireAdmin() {
  const ctx = await getWorkspace();
  if (!isOwnerOrAdmin(ctx.role)) {
    throw new Error("Solo Owner o Admin pueden gestionar integraciones");
  }
  return ctx;
}

// ------------------------------------------------------------
// Zernio (Instagram / Facebook / Twitter opcionales)
// ------------------------------------------------------------

/**
 * Prueba la API key de Zernio, la guarda en Vault (en vez del texto
 * plano que usaba workspaces.late_api_key_encrypted hasta ahora) y
 * sincroniza los canales, igual que hacia /api/v1/channels/test-key.
 */
export async function saveZernioApiKey(
  apiKey: string
): Promise<{ ok: true; accountCount: number } | { error: string }> {
  const { workspace, supabase } = await requireAdmin();
  const trimmed = apiKey.trim();
  if (!trimmed) return { error: "La API key no puede estar vacia" };

  let accounts: Array<{
    _id?: string;
    platform?: string;
    username?: string;
    displayName?: string;
    profilePicture?: string;
  }>;
  try {
    const zernio = createZernioClient(trimmed);
    const res = await zernio.accounts.listAccounts();
    accounts = (res.data?.accounts ?? []) as typeof accounts;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "API key invalida o error de conexion",
    };
  }

  const stored = await storeSecret(supabase, ZERNIO_SECRET_NAME, trimmed, workspace.id);
  if (!stored.ok) return { error: stored.error };

  const { error: upsertError } = await supabase.from("integration_configs").upsert(
    {
      workspace_id: workspace.id,
      type: "channel",
      provider: "zernio",
      display_name: "Zernio (Instagram, Facebook, Twitter)",
      vault_secret_name: ZERNIO_SECRET_NAME,
      is_active: true,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "workspace_id,provider" }
  );
  if (upsertError) return { error: upsertError.message };

  // Registrar (o refrescar) el webhook de Zernio. Best-effort: igual que
  // en test-key, un fallo aca no debe bloquear guardar la key.
  try {
    const secret = await getOrCreateWorkspaceWebhookSecret(supabase, workspace.id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const zernio = createZernioClient(trimmed);
    await ensureWebhookRegistered(zernio, {
      appUrl,
      secret,
      events: ["message.received", "comment.received"],
    });
  } catch (err) {
    console.error("[integrations] zernio webhook registration failed:", err);
  }

  // Auto-sync de canales, igual que test-key.
  const { data: existingChannels } = await supabase
    .from("channels")
    .select("*")
    .eq("workspace_id", workspace.id);
  const existingByLateId = new Map((existingChannels ?? []).map((c) => [c.late_account_id, c]));

  for (const account of accounts) {
    if (!account._id) continue;
    if (existingByLateId.has(account._id)) continue;
    if (!isSupportedPlatform(account.platform)) continue;

    const { error: insertErr } = await supabase.from("channels").insert({
      workspace_id: workspace.id,
      platform: account.platform,
      late_account_id: account._id,
      username: account.username || null,
      display_name: account.displayName || account.username || null,
      profile_picture: account.profilePicture || null,
      is_active: true,
    });
    if (insertErr) {
      console.error("[integrations] zernio channel insert failed:", insertErr);
    }
  }

  try {
    const { data: activeChannels } = await supabase
      .from("channels")
      .select("id, late_account_id, platform")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true);

    await backfillInboxConversations({
      supabase,
      zernio: createZernioClient(trimmed),
      workspaceId: workspace.id,
      channels: activeChannels ?? [],
    });
  } catch (err) {
    console.error("[integrations] zernio inbox backfill failed:", err);
  }

  return { ok: true, accountCount: accounts.length };
}

/**
 * Desconecta la integracion de Zernio: borra la key de Vault y marca la
 * integracion inactiva. No borra los canales ni conversaciones ya
 * sincronizados (esos se borran individualmente desde la card del
 * canal, con su propio aviso de confirmacion).
 */
export async function disconnectZernio(): Promise<{ ok: true } | { error: string }> {
  const { workspace, supabase } = await requireAdmin();

  await deleteSecret(supabase, ZERNIO_SECRET_NAME, workspace.id);

  const { error } = await supabase
    .from("integration_configs")
    .update({ is_active: false, connected_at: null })
    .eq("workspace_id", workspace.id)
    .eq("provider", "zernio");
  if (error) return { error: error.message };

  // Punto de enganche Bloque 3: audit_log ("channel_disconnected", provider "zernio").
  return { ok: true };
}

// ------------------------------------------------------------
// Resend (email saliente)
// ------------------------------------------------------------

export async function saveResendConfig(
  apiKey: string,
  fromEmail: string
): Promise<{ ok: true } | { error: string }> {
  const { workspace, supabase } = await requireAdmin();
  const trimmedKey = apiKey.trim();
  const trimmedEmail = fromEmail.trim();

  if (!trimmedKey.startsWith("re_") || trimmedKey.length < 10) {
    return { error: "La API key de Resend empieza con \"re_\"" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { error: "El remitente tiene que ser un email valido" };
  }

  const stored = await storeSecret(supabase, RESEND_SECRET_NAME, trimmedKey, workspace.id);
  if (!stored.ok) return { error: stored.error };

  const { error } = await supabase.from("integration_configs").upsert(
    {
      workspace_id: workspace.id,
      type: "email_provider",
      provider: "resend",
      display_name: "Resend",
      vault_secret_name: RESEND_SECRET_NAME,
      config: { from_email: trimmedEmail },
      is_active: true,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "workspace_id,provider" }
  );
  if (error) return { error: error.message };

  return { ok: true };
}

export async function disconnectResend(): Promise<{ ok: true } | { error: string }> {
  const { workspace, supabase } = await requireAdmin();

  await deleteSecret(supabase, RESEND_SECRET_NAME, workspace.id);

  const { error } = await supabase
    .from("integration_configs")
    .update({ is_active: false, connected_at: null })
    .eq("workspace_id", workspace.id)
    .eq("provider", "resend");
  if (error) return { error: error.message };

  return { ok: true };
}

// ------------------------------------------------------------
// IA BYOK (OpenAI, Anthropic, Google) — infraestructura para Fase 2/3
// ------------------------------------------------------------

export async function saveAiProviderKey(
  provider: AiProvider,
  apiKey: string,
  defaultModel: string
): Promise<{ ok: true } | { error: string }> {
  const { workspace, supabase } = await requireAdmin();
  const trimmed = apiKey.trim();

  if (trimmed.length < AI_PROVIDER_MIN_KEY_LENGTH) {
    return { error: "La API key parece invalida (muy corta)" };
  }
  const prefix = AI_PROVIDER_KEY_PREFIXES[provider];
  if (prefix && !trimmed.startsWith(prefix)) {
    return { error: `Las keys de ${AI_PROVIDER_LABELS[provider]} empiezan con "${prefix}"` };
  }
  if (!AI_PROVIDER_DEFAULT_MODELS[provider].includes(defaultModel)) {
    return { error: "Modelo invalido" };
  }

  const secretName = aiProviderSecretName(provider);
  const stored = await storeSecret(supabase, secretName, trimmed, workspace.id);
  if (!stored.ok) return { error: stored.error };

  const { error } = await supabase.from("integration_configs").upsert(
    {
      workspace_id: workspace.id,
      type: "ai_provider",
      provider,
      display_name: AI_PROVIDER_LABELS[provider],
      vault_secret_name: secretName,
      config: { default_model: defaultModel },
      is_active: true,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "workspace_id,provider" }
  );
  if (error) return { error: error.message };

  return { ok: true };
}

export async function disconnectAiProvider(
  provider: AiProvider
): Promise<{ ok: true } | { error: string }> {
  const { workspace, supabase } = await requireAdmin();

  await deleteSecret(supabase, aiProviderSecretName(provider), workspace.id);

  const { error } = await supabase
    .from("integration_configs")
    .update({ is_active: false, connected_at: null })
    .eq("workspace_id", workspace.id)
    .eq("provider", provider);
  if (error) return { error: error.message };

  return { ok: true };
}
