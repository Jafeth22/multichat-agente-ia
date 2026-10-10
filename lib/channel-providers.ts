/**
 * Proveedores de canales: por donde se conecta cada canal (Zernio para
 * Instagram y las redes opcionales, Evolution API para WhatsApp).
 *
 * Cada proveedor es un bloque independiente: su propia seccion en
 * Integraciones, su propio sync, y un sync nunca toca canales de otro
 * proveedor. Para sumar uno nuevo: agregarlo a CHANNEL_PROVIDERS, a
 * channelProvider() y su funcion de sync en lib/channel-sync/.
 *
 * Este archivo se usa tambien desde el cliente: no importar nada de servidor.
 */

import { PLATFORMS, type Platform } from "@/lib/platforms";

export const CHANNEL_PROVIDER_IDS = ["zernio", "evolution"] as const;

export type ChannelProvider = (typeof CHANNEL_PROVIDER_IDS)[number];

export interface ChannelProviderInfo {
  id: ChannelProvider;
  title: string;
  description: string;
  /** Plataformas que se conectan a traves de este proveedor. */
  platforms: readonly Platform[];
}

export const CHANNEL_PROVIDERS: readonly ChannelProviderInfo[] = [
  {
    id: "zernio",
    title: "Zernio",
    description: "Instagram y las redes opcionales",
    platforms: PLATFORMS.filter((p) => p !== "whatsapp"),
  },
  {
    id: "evolution",
    title: "WhatsApp",
    description: "Numeros conectados por codigo QR (Evolution API)",
    platforms: ["whatsapp"],
  },
];

export function isChannelProvider(value: unknown): value is ChannelProvider {
  return (
    typeof value === "string" &&
    (CHANNEL_PROVIDER_IDS as readonly string[]).includes(value)
  );
}

/**
 * A que proveedor pertenece un canal. Es la unica regla que lo decide: los
 * canales de Evolution son los unicos con instancia propia.
 */
export function channelProvider(channel: {
  evolution_instance_name: string | null;
}): ChannelProvider {
  return channel.evolution_instance_name ? "evolution" : "zernio";
}
