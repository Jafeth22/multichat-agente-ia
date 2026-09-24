/**
 * Cliente minimo de Resend via fetch (no agrega el SDK oficial como
 * dependencia nueva: la API de envio es un solo POST).
 * https://resend.com/docs/api-reference/emails/send-email
 */
interface SendViaResendInput {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}

export async function sendViaResend({
  apiKey,
  from,
  to,
  subject,
  html,
}: SendViaResendInput): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend respondio ${res.status}: ${body || res.statusText}`);
  }
}
