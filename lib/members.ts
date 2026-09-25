/**
 * Lista de miembros del workspace con nombre/email, para los dropdowns de
 * setter/vendedor (F11) y los filtros de contactos. auth.users no es
 * accesible por RLS, asi que esto siempre necesita el service role (mismo
 * patron que /dashboard/settings/team).
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface WorkspaceMemberOption {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberOption[]> {
  const service = await createServiceClient();

  const { data: members } = await service
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId);

  if (!members || members.length === 0) return [];

  return Promise.all(
    members.map(async (member) => {
      const {
        data: { user },
      } = await service.auth.admin.getUserById(member.user_id);

      return {
        userId: member.user_id,
        role: member.role,
        email: user?.email ?? "Desconocido",
        name:
          user?.user_metadata?.full_name ??
          user?.user_metadata?.name ??
          user?.email?.split("@")[0] ??
          "Desconocido",
      };
    })
  );
}
