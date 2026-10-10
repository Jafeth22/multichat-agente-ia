import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export interface ChannelSyncContext {
  /** Cliente con la sesion del usuario (RLS). */
  supabase: SupabaseClient<Database>;
  /** Cliente de servicio, para lo que corre como el sistema (ej: crear contactos). */
  service: SupabaseClient<Database>;
  workspaceId: string;
}

/**
 * Resumen de un sync. `skipped` indica que el proveedor no esta configurado
 * (no es un error); `error` que fallo; `failed` canales puntuales que no se
 * pudieron guardar.
 */
export interface ChannelSyncResult {
  created: number;
  updated: number;
  deactivated: number;
  conversationsImported: number;
  failed: string[];
  skipped?: string;
  error?: string;
}

export function emptySyncResult(): ChannelSyncResult {
  return { created: 0, updated: 0, deactivated: 0, conversationsImported: 0, failed: [] };
}
