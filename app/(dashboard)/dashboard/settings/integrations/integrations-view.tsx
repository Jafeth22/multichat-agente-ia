"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Globe, Lock, Mail, MessageCircle, Plug, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PlatformIcon } from "@/components/platform-icon";
import { CollapsibleSection } from "@/components/integrations/collapsible-section";
import { StatusChips } from "@/components/integrations/status-chips";
import { IntegrationsSummary, SetupSteps } from "@/components/integrations/integrations-summary";
import { ZernioCard } from "@/components/integrations/zernio-card";
import { WhatsappCard } from "@/components/integrations/whatsapp-card";
import { WhatsappQrModal } from "@/components/integrations/whatsapp-qr-modal";
import { ResendCard } from "@/components/integrations/resend-card";
import { AiProviderCard } from "@/components/integrations/ai-provider-card";
import { useChannels, type Channel } from "@/components/integrations/use-channels";
import { AI_PROVIDERS } from "@/lib/ai-providers";
import { platformLabel } from "@/lib/platforms";
import {
  aiStatus,
  channelsStatus,
  needsAttention,
  simpleStatus,
  whatsappStatus,
  zernioStatus,
  type StatusPart,
} from "@/lib/integration-status";
import type { Database } from "@/lib/types/database";

type IntegrationConfig = Database["public"]["Tables"]["integration_configs"]["Row"];

interface ConfigShape {
  key_hint?: string;
  from_email?: string;
  default_model?: string;
  is_default?: boolean;
}

const SECTIONS = ["channels", "zernio", "whatsapp", "email", "ai"] as const;
type SectionId = (typeof SECTIONS)[number];
/** Bloques que viven dentro de "Canales de mensajes". */
const PARENT: Partial<Record<SectionId, SectionId>> = { zernio: "channels", whatsapp: "channels" };
const STORAGE_KEY = "integrations-open-sections";

function configOf(config: IntegrationConfig | undefined): ConfigShape {
  return (config?.config as ConfigShape | null) ?? {};
}

export function IntegrationsView({
  workspaceId,
  integrationConfigs: initialConfigs,
  channels: initialChannels,
}: {
  workspaceId: string;
  integrationConfigs: IntegrationConfig[];
  channels: Channel[];
}) {
  const [configs, setConfigs] = useState(initialConfigs);
  const state = useChannels(initialChannels);

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

  const findConfig = (provider: string) => configs.find((c) => c.provider === provider);
  const zernio = findConfig("zernio");
  const resend = findConfig("resend");
  const zernioConnected = zernio?.is_active ?? false;
  const resendConnected = resend?.is_active ?? false;
  const aiConnected = AI_PROVIDERS.filter((p) => findConfig(p)?.is_active).length;

  const status: Record<SectionId, StatusPart[]> = {
    channels: channelsStatus(zernioConnected, state.zernioChannels, state.whatsappChannels),
    zernio: zernioStatus(zernioConnected, state.zernioChannels),
    whatsapp: whatsappStatus(state.whatsappChannels),
    email: simpleStatus(resendConnected),
    ai: aiStatus(aiConnected, AI_PROVIDERS.length),
  };

  // Se abre solo lo que necesita atencion; lo que ya funciona arranca cerrado.
  const [open, setOpen] = useState<Record<SectionId, boolean>>(() => ({
    channels: needsAttention(status.zernio) || needsAttention(status.whatsapp),
    zernio: needsAttention(status.zernio),
    whatsapp: needsAttention(status.whatsapp),
    email: needsAttention(status.email),
    ai: false,
  }));

  // Lo que el usuario abrio o cerro antes se recuerda (en este navegador),
  // salvo los bloques con algo roto: esos se abren siempre.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Record<SectionId, boolean>> | null;
      if (!saved) return;
      setOpen((prev) => {
        const next = { ...prev };
        for (const id of SECTIONS) {
          if (typeof saved[id] === "boolean") next[id] = saved[id];
        }
        if (status.zernio.some((p) => p.tone === "bad")) next.zernio = next.channels = true;
        if (status.whatsapp.some((p) => p.tone === "bad")) next.whatsapp = next.channels = true;
        return next;
      });
    } catch {
      // Sin acceso a localStorage: quedan los valores por defecto.
    }
    // Solo al entrar a la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateOpen(patch: Partial<Record<SectionId, boolean>>) {
    setOpen((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Sin acceso a localStorage: no se recuerda, pero funciona igual.
      }
      return next;
    });
  }

  const allOpen = SECTIONS.every((id) => open[id]);

  const [highlighted, setHighlighted] = useState<SectionId | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function goTo(id: SectionId, focus = false) {
    const parent = PARENT[id];
    updateOpen(parent ? { [parent]: true, [id]: true } : { [id]: true });
    setHighlighted(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlighted(null), 1500);

    // Espera a que el bloque se abra antes de mover la pantalla.
    setTimeout(() => {
      const el = document.getElementById(`integracion-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focus) {
        setTimeout(() => el?.querySelector<HTMLElement>("[data-step-focus]")?.focus({ preventScroll: true }), 350);
      }
    }, 80);
  }

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  const section = (id: SectionId) => ({
    id,
    open: open[id],
    onToggle: () => updateOpen({ [id]: !open[id] }),
    highlighted: highlighted === id,
    chips: <StatusChips parts={status[id]} className="justify-end" />,
  });

  const toDelete = state.channelToDelete;

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Integraciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conectá tus canales de mensajes, el email y tus proveedores de IA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => updateOpen(Object.fromEntries(SECTIONS.map((id) => [id, !allOpen])))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {allOpen ? "Contraer todo" : "Expandir todo"}
        </button>
      </div>

      <SetupSteps
        onGo={(id) => goTo(id as SectionId, true)}
        steps={[
          { id: "zernio", label: "Conectá tus redes con la API key de Zernio", minutes: 2, done: zernioConnected },
          {
            id: "whatsapp",
            label: "Escaneá el QR para sumar tu WhatsApp",
            minutes: 1,
            done: state.whatsappChannels.some((c) => c.connection_status === "connected"),
          },
          { id: "email", label: "Configurá el email para mandar invitaciones", minutes: 3, done: resendConnected },
        ]}
      />

      <IntegrationsSummary
        onSelect={(id) => goTo(id as SectionId)}
        tiles={[
          { id: "zernio", name: "Zernio (redes)", icon: <Globe className="h-3.5 w-3.5" />, parts: status.zernio },
          {
            id: "whatsapp",
            name: "WhatsApp",
            icon: <PlatformIcon platform="whatsapp" className="h-3.5 w-3.5" size={14} />,
            parts: status.whatsapp,
          },
          { id: "email", name: "Email", icon: <Mail className="h-3.5 w-3.5" />, parts: status.email },
          { id: "ai", name: "IA", icon: <Sparkles className="h-3.5 w-3.5" />, parts: status.ai },
        ]}
      />

      <CollapsibleSection {...section("channels")} icon={Plug} title="Canales de mensajes" description="Por dónde te escriben tus clientes">
        <CollapsibleSection
          {...section("zernio")}
          variant="sub"
          icon={Globe}
          title="Zernio"
          description="Redes sociales: Instagram, Facebook, X, Telegram y más"
        >
          <ZernioCard
            key={zernio?.updated_at ?? "zernio-empty"}
            isActive={zernioConnected}
            keyHint={configOf(zernio).key_hint ?? null}
            state={state}
          />
        </CollapsibleSection>
        <CollapsibleSection
          {...section("whatsapp")}
          variant="sub"
          icon={MessageCircle}
          title="WhatsApp"
          description="Números conectados por código QR"
        >
          <WhatsappCard state={state} />
        </CollapsibleSection>
      </CollapsibleSection>

      <CollapsibleSection {...section("email")} icon={Mail} title="Email" description="Envío de invitaciones y avisos (Resend)">
        <ResendCard
          key={resend?.updated_at ?? "resend-empty"}
          isActive={resendConnected}
          fromEmail={configOf(resend).from_email ?? null}
          keyHint={configOf(resend).key_hint ?? null}
        />
      </CollapsibleSection>

      <CollapsibleSection
        {...section("ai")}
        icon={Sparkles}
        title="Proveedores de IA"
        description="Usás tus propias claves (OpenAI, Anthropic, Google)"
      >
        <div className="grid gap-2.5 md:grid-cols-3">
          {AI_PROVIDERS.map((provider) => {
            const config = findConfig(provider);
            const shape = configOf(config);
            return (
              <AiProviderCard
                key={`${provider}-${config?.updated_at ?? "empty"}`}
                provider={provider}
                isActive={config?.is_active ?? false}
                defaultModel={shape.default_model ?? null}
                keyHint={shape.key_hint ?? null}
                isDefault={shape.is_default === true}
              />
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Se usan en las funciones de IA de las próximas fases. Podés dejarlo para después.
        </p>
      </CollapsibleSection>

      <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Las claves se guardan cifradas y nunca se muestran completas.
      </p>

      <ConfirmDialog
        open={!!toDelete}
        title="¿Eliminar canal?"
        message={`Esto desconecta ${
          toDelete?.display_name ?? toDelete?.username ?? (toDelete ? platformLabel(toDelete.platform) : "este canal")
        } y borra para siempre sus conversaciones, vínculos con contactos y estadísticas. No se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={state.confirmDelete}
        onCancel={state.cancelDelete}
      />

      <WhatsappQrModal state={state} />
    </div>
  );
}
