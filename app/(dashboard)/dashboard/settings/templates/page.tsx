import { getWorkspace } from "@/lib/workspace";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { listWorkspaceMembers } from "@/lib/members";
import { TemplatesView } from "./templates-view";

export default async function TemplatesPage() {
  const { workspace, role, supabase } = await getWorkspace();

  const [{ data: templates }, members] = await Promise.all([
    supabase
      .from("response_templates")
      .select("*")
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .order("name"),
    listWorkspaceMembers(workspace.id),
  ]);

  const authorNames = Object.fromEntries(members.map((m) => [m.userId, m.name]));

  return (
    <TemplatesView
      templates={templates ?? []}
      workspaceName={workspace.name}
      canManage={isOwnerOrAdmin(role)}
      authorNames={authorNames}
    />
  );
}
