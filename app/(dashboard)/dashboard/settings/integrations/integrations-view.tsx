"use client";

import { useEffect, useState } from "react";
import { Plug, Mail, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CollapsibleSection } from "@/components/integrations/collapsible-section";
import { ZernioCard } from "@/components/integrations/zernio-card";
import { ResendCard } from "@/components/integrations/resend-card";
import { AiProviderCard } from "@/components/integrations/ai-provider-card";
import { ChannelsView } from "@/app/(dashboard)/dashboard/channels/channels-view";
import { AI_PROVIDERS } from "@/lib/ai-providers";
import type { Database } from "@/lib/types/database";

type IntegrationConfig = Database["public"]["Tables"]["integration_configs"]["Row"];
type Channel = Database["public"]["Tables"]["channels"]["Row"];

export function IntegrationsView({
  workspaceId,
  integrationConfigs: initialConfigs,
  channels,
}: {
  workspaceId: string;
  integrationConfigs: IntegrationConfig[];
  channels: Channel[];
}) {
  const [configs, setConfigs] = useState(initialConfigs);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("integration-configs-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "integration_configs",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as IntegrationConfig;
            setConfigs((prev) => prev.filter((c) => c.id !== oldRow.id));
            return;
          }
          const updated = payload.new as IntegrationConfig;
          setConfigs((prev) => {
            const exists = prev.some((c) => c.id === updated.id);
            return exists ? prev.map((c) => (c.id === updated.id ? updated : c)) : [...prev, updated];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  function findConfig(provider: string) {
    return configs.find((c) => c.provider === provider);
  }

  const zernio = findConfig("zernio");
  const resend = findConfig("resend");

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-8 py-8">
      <CollapsibleSection
        icon={Plug}
        title="Canales de mensajeria"
        description="Instagram, WhatsApp y las redes opcionales de Zernio"
      >
        <ZernioCard key={zernio?.updated_at ?? "zernio-empty"} isActive={zernio?.is_active ?? false} />
        <div className="pt-2">
          <ChannelsView channels={channels} workspaceId={workspaceId} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon={Mail} title="Email" description="Email transaccional saliente (Resend)">
        <ResendCard
          key={resend?.updated_at ?? "resend-empty"}
          isActive={resend?.is_active ?? false}
          fromEmail={(resend?.config as { from_email?: string } | null)?.from_email ?? null}
        />
      </CollapsibleSection>

      <CollapsibleSection
        icon={Sparkles}
        title="Proveedores de IA (BYOK)"
        description="Infraestructura para las funciones de IA de las proximas fases"
        defaultOpen={false}
      >
        {AI_PROVIDERS.map((provider) => {
          const config = findConfig(provider);
          return (
            <AiProviderCard
              key={`${provider}-${config?.updated_at ?? "empty"}`}
              provider={provider}
              isActive={config?.is_active ?? false}
              defaultModel={(config?.config as { default_model?: string } | null)?.default_model ?? null}
            />
          );
        })}
      </CollapsibleSection>
    </div>
  );
}
