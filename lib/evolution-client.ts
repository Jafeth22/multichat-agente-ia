/**
 * Evolution API client (WhatsApp / Baileys).
 *
 * Capa fina sobre el REST de Evolution API. A diferencia de Zernio, aca
 * no hay SDK oficial en npm: se pega directo con fetch contra
 * EVOLUTION_API_URL (la URL interna de Railway, no expuesta a internet).
 *
 * Referencia: https://doc.evolution-api.com
 */

function baseUrl(): string {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL no esta configurada");
  return url.trim().replace(/\/$/, "");
}

function apiKey(): string {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY no esta configurada");
  return key;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey(),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      (data as { message?: string; error?: string })?.message ??
      (data as { message?: string; error?: string })?.error ??
      `Evolution API respondio ${res.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data as T;
}

export interface EvolutionCreateInstanceResult {
  instance?: { instanceName?: string; instanceId?: string };
  qrcode?: { base64?: string };
}

/** Crea una instancia nueva (un numero de WhatsApp por instancia). */
export function createInstance(instanceName: string) {
  return request<EvolutionCreateInstanceResult>("/instance/create", {
    method: "POST",
    body: {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    },
  });
}

/** Configura a donde Evolution API manda los eventos de esta instancia. */
export function setWebhook(instanceName: string, webhookUrl: string) {
  return request(`/webhook/set/${instanceName}`, {
    method: "POST",
    body: {
      webhook: {
        enabled: true,
        url: webhookUrl,
        events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT"],
      },
    },
  });
}

export interface EvolutionQrCodeResult {
  base64?: string;
  code?: string;
}

/** Pide un QR nuevo (instancia recien creada o desconectada). */
export function getQrCode(instanceName: string) {
  return request<EvolutionQrCodeResult>(`/instance/connect/${instanceName}`);
}

export interface EvolutionConnectionState {
  instance?: { state?: "open" | "connecting" | "close" };
}

export function getConnectionState(instanceName: string) {
  return request<EvolutionConnectionState>(
    `/instance/connectionState/${instanceName}`
  );
}

/** Cierra la sesion de WhatsApp (queda la instancia, se puede reconectar con un QR nuevo). */
export function logoutInstance(instanceName: string) {
  return request(`/instance/logout/${instanceName}`, { method: "DELETE" });
}

/** Borra la instancia por completo. */
export function deleteInstance(instanceName: string) {
  return request(`/instance/delete/${instanceName}`, { method: "DELETE" });
}

export function sendTextMessage(instanceName: string, number: string, text: string) {
  return request<{ key?: { id?: string } }>(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: { number, text },
  });
}
