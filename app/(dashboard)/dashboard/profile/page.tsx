import { getWorkspace } from "@/lib/workspace";
import { ProfileView } from "./profile-view";

export default async function ProfilePage() {
  const { user, workspace, supabase } = await getWorkspace();

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .eq("user_id", user.id);

  const workspaces = (memberships ?? [])
    .map((m) => ({
      ...(m.workspaces as { id: string; name: string; slug: string } | null),
      role: m.role,
    }))
    .filter((w): w is { id: string; name: string; slug: string; role: string } => !!w.id);

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";

  return (
    <ProfileView
      fullName={fullName}
      email={user.email ?? ""}
      currentWorkspaceId={workspace.id}
      workspaces={workspaces}
    />
  );
}
