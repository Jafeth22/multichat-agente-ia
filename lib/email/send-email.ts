import type { DbClient } from "@/lib/vault";
import { readSecret } from "@/lib/vault";
import { sendViaResend } from "@/lib/email/resend-client";

const RESEND_SECRET_NAME = "resend_api_key";
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 3000];

interface SendEmailInput {
  supabase: DbClient;
  workspaceId: string;
  to: string;
  subject: string;
  html: string;
  /** Etiqueta corta para el historial (ej: "team_invite"), no es el asunto. */
  template?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envia un email transaccional via Resend (F7): la key y el remitente
 * salen de integration_configs + Vault, con hasta 3 reintentos y un
 * registro final en email_logs. Nunca lanza: si Resend no esta
 * configurado, o si los 3 intentos fallan, devuelve { ok: false } y
 * queda todo en el log, para no bloquear la accion que disparo el
 * email (invitar a alguien, avisar una desconexion, etc).
 */
export async function sendEmail({
  supabase,
  workspaceId,
  to,
  subject,
  html,
  template,
}: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const [{ data: config }, apiKey] = await Promise.all([
    supabase
      .from("integration_configs")
      .select("config, is_active")
      .eq("workspace_id", workspaceId)
      .eq("provider", "resend")
      .maybeSingle(),
    readSecret(supabase, RESEND_SECRET_NAME, workspaceId),
  ]);

  const fromEmail = (config?.config as { from_email?: string } | null)?.from_email;

  if (!apiKey || !config?.is_active || !fromEmail) {
    const error = "Resend no esta configurado en Integraciones";
    await logEmail(supabase, { workspaceId, to, subject, template, status: "failed", attempts: 0, error });
    return { ok: false, error };
  }

  let lastError = "Error desconocido al enviar el email";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await sendViaResend({ apiKey, from: fromEmail, to, subject, html });
      await logEmail(supabase, { workspaceId, to, subject, template, status: "sent", attempts: attempt });
      return { ok: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  console.error(`[email] failed to send "${subject}" to ${to} after ${MAX_ATTEMPTS} attempts:`, lastError);
  await logEmail(supabase, { workspaceId, to, subject, template, status: "failed", attempts: MAX_ATTEMPTS, error: lastError });
  return { ok: false, error: lastError };
}

async function logEmail(
  supabase: DbClient,
  entry: {
    workspaceId: string;
    to: string;
    subject: string;
    template?: string;
    status: "sent" | "failed";
    attempts: number;
    error?: string;
  }
) {
  const { error } = await supabase.from("email_logs").insert({
    workspace_id: entry.workspaceId,
    to_email: entry.to,
    subject: entry.subject,
    template: entry.template ?? null,
    status: entry.status,
    attempts: entry.attempts,
    error: entry.error ?? null,
  });

  if (error) {
    console.error("[email] failed to write email_logs entry:", error.message);
  }
}
