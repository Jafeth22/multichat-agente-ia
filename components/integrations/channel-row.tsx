"use client";

import { Copy, ExternalLink, PowerOff, QrCode, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/platform-icon";
import { ActionsMenu, type ActionsMenuItem } from "@/components/ui/actions-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { StatusChip } from "@/components/integrations/status-chips";
import { platformLabel, type Platform } from "@/lib/platforms";
import { whatsappChannelTone, type StatusTone } from "@/lib/integration-status";
import type { Channel, ChannelsState } from "@/components/integrations/use-channels";

function getDmLink(platform: Platform, username: string | null): { url: string; label: string } | null {
  const handle = username || "";
  switch (platform) {
    case "instagram":
      return handle ? { url: `https://ig.me/m/${handle}`, label: `ig.me/m/${handle}` } : null;
    case "facebook":
      return handle ? { url: `https://m.me/${handle}`, label: `m.me/${handle}` } : null;
    case "telegram":
      return handle ? { url: `https://t.me/${handle}`, label: `t.me/${handle}` } : null;
    case "twitter":
      return handle ? { url: `https://x.com/${handle}`, label: `x.com/${handle}` } : null;
    case "reddit":
      return handle ? { url: `https://reddit.com/message/compose/?to=${handle}`, label: `reddit.com/.../to=${handle}` } : null;
    case "whatsapp": {
      // Los numeros vienen formateados ("+34 902 80 82 90"); wa.me solo acepta digitos.
      const digits = handle.replace(/\D/g, "");
      return digits ? { url: `https://wa.me/${digits}`, label: `wa.me/${digits}` } : null;
    }
    default:
      return null;
  }
}

const WHATSAPP_LABELS: Record<StatusTone, string> = {
  ok: "Conectado",
  paused: "Pausado",
  info: "Esperando QR",
  bad: "Desconectado",
  idle: "",
};

/** Interruptor activo / pausado del sistema. */
function ActiveSwitch({
  active,
  disabled,
  name,
  onToggle,
}: {
  active: boolean;
  disabled: boolean;
  name: string;
  onToggle: () => void;
}) {
  return (
    <Tooltip content={active ? "Recibiendo mensajes. Tocá para pausar." : "Pausado. Tocá para activarlo."}>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={`Recibir mensajes de ${name}`}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
          active ? "bg-green-500" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            active && "translate-x-4"
          )}
        />
      </button>
    </Tooltip>
  );
}

/** Fila compacta de un canal: interruptor a la vista y lo poco usado en el menu ⋯. */
export function ChannelRow({ channel, state }: { channel: Channel; state: ChannelsState }) {
  const isWhatsapp = !!channel.evolution_instance_name;
  const label = platformLabel(channel.platform);
  const name = channel.display_name ?? channel.username ?? label;
  const dm = getDmLink(channel.platform as Platform, channel.username);
  const tone: StatusTone = isWhatsapp ? whatsappChannelTone(channel) : channel.is_active ? "ok" : "paused";
  const dimmed = !channel.is_active || tone === "bad";

  const subtitle = isWhatsapp
    ? channel.username || "Sin número todavía"
    : `${channel.username ? `@${channel.username} · ` : ""}${label}`;

  const items: ActionsMenuItem[] = [];
  if (dm) {
    items.push(
      {
        label: `Copiar link (${dm.label})`,
        icon: <Copy className="h-3.5 w-3.5" />,
        onClick: () => {
          navigator.clipboard
            .writeText(dm.url)
            .then(() => toast.success("Link copiado"))
            .catch(() => toast.error("No se pudo copiar el link"));
        },
      },
      {
        label: "Abrir chat",
        icon: <ExternalLink className="h-3.5 w-3.5" />,
        onClick: () => window.open(dm.url, "_blank", "noopener,noreferrer"),
      }
    );
  }
  if (isWhatsapp && channel.connection_status === "connected") {
    items.push({
      label: "Desconectar número",
      icon: <PowerOff className="h-3.5 w-3.5" />,
      onClick: () => state.disconnectWhatsapp(channel),
    });
  }
  items.push({
    label: "Eliminar canal",
    icon: <Trash2 className="h-3.5 w-3.5" />,
    destructive: true,
    onClick: () => state.requestDelete(channel),
  });

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className={cn("relative shrink-0", dimmed && "opacity-50")}>
        {channel.profile_picture ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={channel.profile_picture} alt="" className="h-9 w-9 rounded-lg object-cover" />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-background">
              <PlatformIcon platform={channel.platform} className="h-2.5 w-2.5" size={10} />
            </span>
          </>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <PlatformIcon platform={channel.platform} className="h-4 w-4" size={16} />
          </span>
        )}
      </div>

      <div className={cn("min-w-0 flex-1", dimmed && "opacity-60")}>
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {isWhatsapp ? (
        <StatusChip part={{ tone, text: channel.connection_status === "error" ? "Error" : WHATSAPP_LABELS[tone] }} />
      ) : (
        !channel.is_active && <StatusChip part={{ tone: "paused", text: "Pausado" }} />
      )}

      {isWhatsapp && (tone === "info" || tone === "bad") && (
        <button
          type="button"
          onClick={() => state.reconnectWhatsapp(channel)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          {tone === "info" ? <QrCode className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {tone === "info" ? "Ver QR" : "Reconectar"}
        </button>
      )}

      <ActiveSwitch
        active={channel.is_active}
        disabled={state.togglingId === channel.id}
        name={name}
        onToggle={() => state.toggleActive(channel)}
      />

      <ActionsMenu
        items={items}
        loading={state.deletingId === channel.id || state.disconnectingId === channel.id}
        title={`Más acciones de ${name}`}
      />
    </div>
  );
}
