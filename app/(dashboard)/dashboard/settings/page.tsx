import { requireWorkspaceAdmin } from "@/lib/workspace";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const { workspace } = await requireWorkspaceAdmin();

  return (
    <SettingsView
      workspace={{
        id: workspace.id,
        name: workspace.name,
        hasAiKey: !!workspace.ai_api_key,
        globalKeywords: (workspace.global_keywords as string[]) ?? [],
      }}
    />
  );
}
