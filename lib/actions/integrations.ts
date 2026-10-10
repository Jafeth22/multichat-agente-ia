"use server";

import { getWorkspace } from "@/lib/workspace";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { storeSecret, deleteSecret, type DbClient } from "@/lib/vault";
import { createServiceClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit";
import { createZernioClient } from "@/lib/zernio-client";
import {
  ensureWebhookRegistered,
  getOrCreateWorkspaceWebhookSecret,
} from "@/lib/zernio-webhook";
import { backfillInboxConversations } from "@/lib/inbox-sync";
import { isSupportedPlatform } from "@/lib/platforms";
import { keyHint } from "@/lib/integration-status";
import { sendEmail } from "@/lib/email/send-email";
import {
  AI_PROVIDERS,
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
  const { workspace, user, supabase } = await requireAdmin();
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
      config: { key_hint: keyHint(trimmed) },
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

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "channel",
    entityId: null,
    action: "channel_connected",
    performedBy: user.id,
    metadata: { platform: "zernio" },
  });

  return { ok: true, accountCount: accounts.length };
}

/**
 * Desconecta la integracion de Zernio: borra la key de Vault y marca la
 * integracion inactiva. No borra los canales ni conversaciones ya
 * sincronizados (esos se borran individualmente desde la card del
 * canal, con su propio aviso de confirmacion).
 */
export async function disconnectZernio(): Promise<{ ok: true } | { error: string }> {
  const { workspace, user, supabase } = await requireAdmin();

  await deleteSecret(supabase, ZERNIO_SECRET_NAME, workspace.id);

  const { error } = await supabase
    .from("integration_configs")
    .update({ is_active: false, connected_at: null })
    .eq("workspace_id", workspace.id)
    .eq("provider", "zernio");
  if (error) return { error: error.message };

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "channel",
    entityId: null,
    action: "channel_disconnected",
    performedBy: user.id,
    metadata: { platform: "zernio" },
  });

  return { ok: true };
}

// ------------------------------------------------------------
// Resend (email saliente)
// ------------------------------------------------------------

/**
 * Guarda remitente y API key de Resend. Si ya estaba conectado, la key
 * puede venir vacia: se cambia solo el remitente y se mantiene la key.
 */
export async function saveResendConfig(
  apiKey: string,
  fromEmail: string
): Promise<{ ok: true } | { error: string }> {
  const { workspace, user, supabase } = await requireAdmin();
  const trimmedKey = apiKey.trim();
  const trimmedEmail = fromEmail.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { error: "El remitente tiene que ser un email valido" };
  }

  let hint: string;
  if (!trimmedKey) {
    const { data: existing } = await supabase
      .from("integration_configs")
      .select("config, is_active")
      .eq("workspace_id", workspace.id)
      .eq("provider", "resend")
      .maybeSingle();
    if (!existing?.is_active) return { error: "Pega la API key de Resend" };
    hint = (existing.config as { key_hint?: string } | null)?.key_hint ?? "";
  } else {
    if (!trimmedKey.startsWith("re_") || trimmedKey.length < 10) {
      return { error: "La API key de Resend empieza con \"re_\"" };
    }
    const stored = await storeSecret(supabase, RESEND_SECRET_NAME, trimmedKey, workspace.id);
    if (!stored.ok) return { error: stored.error };
    hint = keyHint(trimmedKey);
  }

  const { error } = await supabase.from("integration_configs").upsert(
    {
      workspace_id: workspace.id,
      type: "email_provider",
      provider: "resend",
      display_name: "Resend",
      vault_secret_name: RESEND_SECRET_NAME,
      config: { from_email: trimmedEmail, key_hint: hint },
      is_active: true,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "workspace_id,provider" }
  );
  if (error) return { error: error.message };

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "workspace_settings",
    entityId: null,
    action: "settings_updated",
    performedBy: user.id,
    metadata: { provider: "resend" },
  });

  return { ok: true };
}

export async function disconnectResend(): Promise<{ ok: true } | { error: string }> {
  const { workspace, user, supabase } = await requireAdmin();

  await deleteSecret(supabase, RESEND_SECRET_NAME, workspace.id);

  const { error } = await supabase
    .from("integration_configs")
    .update({ is_active: false, connected_at: null })
    .eq("workspace_id", workspace.id)
    .eq("provider", "resend");
  if (error) return { error: error.message };

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "workspace_settings",
    entityId: null,
    action: "settings_updated",
    performedBy: user.id,
    metadata: { provider: "resend", disconnected: true },
  });

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
  const { workspace, user, supabase } = await requireAdmin();
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

  // El primer proveedor conectado queda como predeterminado; si ya lo era, lo sigue siendo.
  const configs = await activeAiConfigs(supabase, workspace.id);
  const isDefault =
    configs.find((c) => c.provider === provider)?.config.is_default === true ||
    !configs.some((c) => c.provider !== provider && c.config.is_default === true);

  const { error } = await supabase.from("integration_configs").upsert(
    {
      workspace_id: workspace.id,
      type: "ai_provider",
      provider,
      display_name: AI_PROVIDER_LABELS[provider],
      vault_secret_name: secretName,
      config: { default_model: defaultModel, key_hint: keyHint(trimmed), is_default: isDefault },
      is_active: true,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "workspace_id,provider" }
  );
  if (error) return { error: error.message };

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "workspace_settings",
    entityId: null,
    action: "settings_updated",
    performedBy: user.id,
    metadata: { provider },
  });

  return { ok: true };
}

export async function disconnectAiProvider(
  provider: AiProvider
): Promise<{ ok: true } | { error: string }> {
  const { workspace, user, supabase } = await requireAdmin();

  await deleteSecret(supabase, aiProviderSecretName(provider), workspace.id);

  const configs = await activeAiConfigs(supabase, workspace.id);
  const current = configs.find((c) => c.provider === provider);

  const { error } = await supabase
    .from("integration_configs")
    .update({
      is_active: false,
      connected_at: null,
      ...(current ? { config: { ...current.config, is_default: false } } : {}),
    })
    .eq("workspace_id", workspace.id)
    .eq("provider", provider);
  if (error) return { error: error.message };

  // Si era el predeterminado, pasa a serlo el siguiente proveedor conectado.
  const next = configs.find((c) => c.provider !== provider);
  if (current?.config.is_default && next) {
    await supabase
      .from("integration_configs")
      .update({ config: { ...next.config, is_default: true } })
      .eq("workspace_id", workspace.id)
      .eq("provider", next.provider);
  }

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "workspace_settings",
    entityId: null,
    action: "settings_updated",
    performedBy: user.id,
    metadata: { provider, disconnected: true },
  });

  return { ok: true };
}

interface AiConfigShape {
  default_model?: string;
  key_hint?: string;
  is_default?: boolean;
}

/** Proveedores de IA conectados, con su config tipada. */
async function activeAiConfigs(
  supabase: DbClient,
  workspaceId: string
): Promise<{ provider: AiProvider; config: AiConfigShape }[]> {
  const { data } = await supabase
    .from("integration_configs")
    .select("provider, config")
    .eq("workspace_id", workspaceId)
    .eq("type", "ai_provider")
    .eq("is_active", true);
  return (data ?? [])
    .filter((row) => (AI_PROVIDERS as string[]).includes(row.provider))
    .map((row) => ({
      provider: row.provider as AiProvider,
      config: (row.config as AiConfigShape | null) ?? {},
    }));
}

/** Cambia el modelo por defecto de un proveedor ya conectado, sin pedir la key de nuevo. */
export async function updateAiProviderModel(
  provider: AiProvider,
  model: string
): Promise<{ ok: true } | { error: string }> {
  const { workspace, user, supabase } = await requireAdmin();
  if (!AI_PROVIDER_DEFAULT_MODELS[provider]?.includes(model)) {
    return { error: "Modelo invalido" };
  }

  const current = (await activeAiConfigs(supabase, workspace.id)).find((c) => c.provider === provider);
  if (!current) return { error: `${AI_PROVIDER_LABELS[provider]} no esta conectado` };

  const { error } = await supabase
    .from("integration_configs")
    .update({ config: { ...current.config, default_model: model } })
    .eq("workspace_id", workspace.id)
    .eq("provider", provider);
  if (error) return { error: error.message };

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "workspace_settings",
    entityId: null,
    action: "settings_updated",
    performedBy: user.id,
    metadata: { provider, default_model: model },
  });

  return { ok: true };
}

/** Marca un proveedor de IA conectado como el predeterminado (y desmarca al resto). */
export async function setDefaultAiProvider(
  provider: AiProvider
): Promise<{ ok: true } | { error: string }> {
  const { workspace, user, supabase } = await requireAdmin();

  const configs = await activeAiConfigs(supabase, workspace.id);
  if (!configs.some((c) => c.provider === provider)) {
    return { error: `${AI_PROVIDER_LABELS[provider]} no esta conectado` };
  }

  for (const c of configs) {
    const isDefault = c.provider === provider;
    if ((c.config.is_default === true) === isDefault) continue;
    const { error } = await supabase
      .from("integration_configs")
      .update({ config: { ...c.config, is_default: isDefault } })
      .eq("workspace_id", workspace.id)
      .eq("provider", c.provider);
    if (error) return { error: error.message };
  }

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "workspace_settings",
    entityId: null,
    action: "settings_updated",
    performedBy: user.id,
    metadata: { default_ai_provider: provider },
  });

  return { ok: true };
}

/** Manda un email de prueba al usuario actual con la configuracion de Resend guardada. */
export async function sendResendTestEmail(): Promise<{ ok: true; to: string } | { error: string }> {
  const { workspace, user, supabase } = await requireAdmin();
  if (!user.email) return { error: "Tu usuario no tiene un email para mandarte la prueba" };

  const result = await sendEmail({
    supabase,
    workspaceId: workspace.id,
    to: user.email,
    subject: "Email de prueba",
    html: `<p>Si estas leyendo esto, el email de <strong>${workspace.name}</strong> funciona bien.</p>`,
    template: "test_email",
  });
  if (!result.ok) return { error: result.error ?? "No se pudo mandar el email" };

  return { ok: true, to: user.email };
}
