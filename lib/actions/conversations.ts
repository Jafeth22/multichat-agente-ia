"use server";

import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit";

/**
 * Soft delete de conversacion (nuevo en el Bloque 4) + su reversion, para
 * el flujo de "eliminar con confirmacion y despues deshacer por 5s" en la
 * bandeja. Sin chequeo de rol propio: la policy RLS "Scoped update on
 * conversations" (can_see_conversation) ya limita esto a quien puede ver
 * la conversacion (igual criterio que abrir/cerrar/snooze, que tampoco
 * tienen chequeo de rol aparte).
 */
export async function softDeleteConversation(conversationId: string) {
  const { workspace, user, supabase } = await getWorkspace();

  // El scope se valida leyendo con el cliente con RLS (solo devuelve lo que
  // el usuario puede ver); el UPDATE va con el cliente de servicio porque la
  // fila borrada ya no pasa la policy de SELECT.
  const { data: visible } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!visible) return { error: "Conversacion no encontrada" };

  const service = await createServiceClient();
  const { error } = await service
    .from("conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id);

  if (error) return { error: error.message };

  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "conversation",
    entityId: conversationId,
    action: "deleted",
    performedBy: user.id,
  });

  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

export async function restoreConversation(conversationId: string) {
  const { workspace, user, supabase } = await getWorkspace();

  const { error } = await supabase
    .from("conversations")
    .update({ deleted_at: null })
    .eq("id", conversationId);

  if (error) return { error: error.message };

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "conversation",
    entityId: conversationId,
    action: "restored",
    performedBy: user.id,
  });

  revalidatePath("/dashboard/inbox");
  return { ok: true };
}
