import { getWorkspace } from "@/lib/workspace";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, user, role, supabase } = await getWorkspace();

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .eq("user_id", user.id);

  const workspaces = (memberships ?? [])
    .map((m) => ({
      ...(m.workspaces as { id: string; name: string; slug: string }),
      role: m.role,
    }))
    .filter((w) => w.id);

  let notifications: { id: string; title: string; message: string; created_at: string }[] = [];
  if (role === "owner" || role === "admin") {
    const { data } = await supabase
      .from("admin_notifications")
      .select("id, title, message, created_at")
      .eq("workspace_id", workspace.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    notifications = data ?? [];
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        workspace={workspace}
        user={user}
        workspaces={workspaces}
        role={role}
        notifications={notifications}
      />
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
