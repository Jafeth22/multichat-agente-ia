import { requireWorkspaceAdmin } from "@/lib/workspace";
import { IntegrationsView } from "./integrations-view";

export default async function IntegrationsPage() {
  const { workspace, supabase } = await requireWorkspaceAdmin();

  const [{ data: integrationConfigs }, { data: channels }] = await Promise.all([
    supabase.from("integration_configs").select("*").eq("workspace_id", workspace.id),
    supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="border-b border-border px-8 py-6">
        <h1 className="text-2xl font-bold">Integraciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecta canales de mensajeria, el email saliente y tus proveedores de IA
        </p>
      </div>

      <IntegrationsView
        workspaceId={workspace.id}
        integrationConfigs={integrationConfigs ?? []}
        channels={channels ?? []}
      />
    </div>
  );
}
