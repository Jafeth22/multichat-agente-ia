"use server";

import { getWorkspace } from "@/lib/workspace";

export async function markNotificationRead(notificationId: string) {
  const { supabase } = await getWorkspace();

  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function markAllNotificationsRead(workspaceId: string) {
  const { workspace, supabase } = await getWorkspace();
  if (workspace.id !== workspaceId) return { error: "Workspace mismatch" };

  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .is("read_at", null);

  if (error) return { error: error.message };
  return { ok: true };
}
