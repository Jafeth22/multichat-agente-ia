/**
 * Estado de cada integracion para la pantalla /settings/integrations:
 * chips de color, tarjetas del resumen y que bloques se abren solos.
 *
 * Un color por estado, igual en todo el sistema:
 *   ok     verde  activo / conectado
 *   paused ambar  pausado a proposito (is_active = false)
 *   info   azul   a medio conectar (WhatsApp esperando QR)
 *   bad    rojo   desconectado o con error
 *   idle   gris   sin configurar
 *
 * Este archivo se usa desde el cliente: no importar nada de servidor.
 */

export type StatusTone = "ok" | "paused" | "info" | "bad" | "idle";

export interface StatusPart {
  tone: StatusTone;
  text: string;
  /** Detalle para el tooltip del chip (ej: de donde sale el numero). */
  detail?: string;
}

export interface ChannelStatusInput {
  is_active: boolean;
  connection_status: "disconnected" | "connecting" | "connected" | "error";
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Estado de un canal de Zernio: el proveedor no maneja conexion por canal. */
export function zernioChannelTone(channel: Pick<ChannelStatusInput, "is_active">): StatusTone {
  return channel.is_active ? "ok" : "paused";
}

/** Estado de un numero de WhatsApp: primero la conexion, despues si esta pausado. */
export function whatsappChannelTone(channel: ChannelStatusInput): StatusTone {
  if (channel.connection_status === "connecting") return "info";
  if (channel.connection_status !== "connected") return "bad";
  return channel.is_active ? "ok" : "paused";
}

function countTones<T>(items: T[], toneOf: (item: T) => StatusTone) {
  const counts: Record<StatusTone, number> = { ok: 0, paused: 0, info: 0, bad: 0, idle: 0 };
  for (const item of items) counts[toneOf(item)]++;
  return counts;
}

export function zernioStatus(
  connected: boolean,
  channels: Pick<ChannelStatusInput, "is_active">[]
): StatusPart[] {
  if (!connected) {
    return channels.length > 0
      ? [{ tone: "bad", text: "Key desconectada", detail: "Las cuentas no reciben mensajes hasta que vuelvas a cargar la API key" }]
      : [{ tone: "idle", text: "Sin configurar" }];
  }
  if (channels.length === 0) return [{ tone: "idle", text: "Sin cuentas todavía" }];

  const c = countTones(channels, zernioChannelTone);
  const parts: StatusPart[] = [];
  if (c.ok) parts.push({ tone: "ok", text: plural(c.ok, "activa", "activas") });
  if (c.paused) parts.push({ tone: "paused", text: plural(c.paused, "pausada", "pausadas") });
  return parts;
}

export function whatsappStatus(channels: ChannelStatusInput[]): StatusPart[] {
  if (channels.length === 0) return [{ tone: "idle", text: "Sin números" }];

  const c = countTones(channels, whatsappChannelTone);
  const parts: StatusPart[] = [];
  if (c.ok) parts.push({ tone: "ok", text: plural(c.ok, "conectado", "conectados") });
  if (c.paused) parts.push({ tone: "paused", text: plural(c.paused, "pausado", "pausados") });
  if (c.info) parts.push({ tone: "info", text: `${c.info} esperando QR` });
  if (c.bad) parts.push({ tone: "bad", text: plural(c.bad, "desconectado", "desconectados") });
  return parts;
}

/**
 * Encabezado de "Canales de mensajes": un solo chip por color, sumando
 * Zernio y WhatsApp. El tooltip explica de donde sale cada numero.
 */
export function channelsStatus(
  zernioConnected: boolean,
  zernioChannels: Pick<ChannelStatusInput, "is_active">[],
  whatsappChannels: ChannelStatusInput[]
): StatusPart[] {
  const z = zernioConnected
    ? countTones(zernioChannels, zernioChannelTone)
    : { ok: 0, paused: 0, info: 0, bad: 0, idle: 0 };
  const w = countTones(whatsappChannels, whatsappChannelTone);

  const detail = (zn: number, zTxt: [string, string], wn: number, wTxt: [string, string]) =>
    [zn ? plural(zn, ...zTxt) : "", wn ? plural(wn, ...wTxt) : ""].filter(Boolean).join(" y ");

  const parts: StatusPart[] = [];
  if (z.ok + w.ok) {
    parts.push({
      tone: "ok",
      text: plural(z.ok + w.ok, "activo", "activos"),
      detail: detail(z.ok, ["cuenta de Zernio", "cuentas de Zernio"], w.ok, ["número de WhatsApp", "números de WhatsApp"]),
    });
  }
  if (z.paused + w.paused) {
    parts.push({
      tone: "paused",
      text: plural(z.paused + w.paused, "pausado", "pausados"),
      detail: detail(z.paused, ["cuenta de Zernio", "cuentas de Zernio"], w.paused, ["número de WhatsApp", "números de WhatsApp"]),
    });
  }
  if (w.info) {
    parts.push({ tone: "info", text: `${w.info} esperando QR`, detail: "Números de WhatsApp a medio conectar" });
  }
  if (w.bad) {
    parts.push({
      tone: "bad",
      text: plural(w.bad, "desconectado", "desconectados"),
      detail: `${plural(w.bad, "número", "números")} de WhatsApp para reconectar`,
    });
  }
  if (!zernioConnected && zernioChannels.length > 0) {
    parts.push({ tone: "bad", text: "Zernio desconectado", detail: "Volvé a cargar la API key de Zernio" });
  }
  if (parts.length === 0) parts.push({ tone: "idle", text: "Sin configurar" });
  return parts;
}

export function simpleStatus(connected: boolean): StatusPart[] {
  return [connected ? { tone: "ok", text: "Conectado" } : { tone: "idle", text: "Sin configurar" }];
}

export function aiStatus(connectedCount: number, total: number): StatusPart[] {
  return [
    connectedCount > 0
      ? { tone: "ok", text: `${connectedCount} de ${total} conectados` }
      : { tone: "idle", text: "Opcional por ahora" },
  ];
}

/** Un bloque se abre solo si algo necesita accion (lo pausado es a proposito). */
export function needsAttention(parts: StatusPart[]): boolean {
  return parts.some((p) => p.tone === "bad" || p.tone === "idle" || p.tone === "info");
}

/** Ultimos 4 caracteres de una key, para mostrarla oculta (••••a3F9). */
export function keyHint(apiKey: string): string {
  return apiKey.trim().slice(-4);
}
