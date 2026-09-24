import type { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Conector a las funciones RPC de Supabase Vault (creadas en la
 * migracion 00018). No hay tabla ni columna que leer directo: el unico
 * camino es store_secret/read_secret/delete_secret, que validan que
 * quien llama sea Owner/Admin del workspace (o el service role, para
 * webhooks y cron).
 */
export type DbClient =
  | Awaited<ReturnType<typeof createClient>>
  | Awaited<ReturnType<typeof createServiceClient>>;

export async function storeSecret(
  supabase: DbClient,
  secretName: string,
  secretValue: string,
  workspaceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("store_secret", {
    p_secret_name: secretName,
    p_secret_value: secretValue,
    p_workspace_id: workspaceId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function readSecret(
  supabase: DbClient,
  secretName: string,
  workspaceId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("read_secret", {
    p_secret_name: secretName,
    p_workspace_id: workspaceId,
  });

  if (error) {
    console.error(`[vault] read_secret("${secretName}") failed:`, error.message);
    return null;
  }

  return data ?? null;
}

/**
 * Como readSecret, pero para secrets que cualquier miembro del
 * workspace necesita en tiempo de ejecucion (hoy: la key de Zernio,
 * para enviar/recibir mensajes desde la bandeja, los flows, las
 * secuencias, los comentarios y los broadcasts). La funcion RPC
 * read_channel_secret solo sirve una lista blanca de nombres de
 * secret; no es un passthrough generico como readSecret.
 */
export async function readChannelSecret(
  supabase: DbClient,
  secretName: string,
  workspaceId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("read_channel_secret", {
    p_secret_name: secretName,
    p_workspace_id: workspaceId,
  });

  if (error) {
    console.error(`[vault] read_channel_secret("${secretName}") failed:`, error.message);
    return null;
  }

  return data ?? null;
}

export async function deleteSecret(
  supabase: DbClient,
  secretName: string,
  workspaceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("delete_secret", {
    p_secret_name: secretName,
    p_workspace_id: workspaceId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
