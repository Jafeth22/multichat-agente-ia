/**
 * Proveedores de IA para el BYOK de la pantalla de integraciones (F8).
 * Guardan API keys propias en Vault, separadas de workspaces.ai_api_key
 * (la key unica de "Vercel AI Gateway" que usa hoy el nodo "AI Response"
 * del flow builder). Conectar estas keys al flow builder es trabajo de
 * Fase 2 ("BYOK en nodo AI Response" esta fuera de alcance de esta fase);
 * por ahora es infraestructura lista, igual que el email de Resend.
 */
export type AiProvider = "openai" | "anthropic" | "google";

export const AI_PROVIDERS: AiProvider[] = ["openai", "anthropic", "google"];

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google (Gemini)",
};

/** Prefijo esperado de la key, para la validacion de formato de F8. Null = sin prefijo fijo conocido. */
export const AI_PROVIDER_KEY_PREFIXES: Record<AiProvider, string | null> = {
  openai: "sk-",
  anthropic: "sk-ant-",
  google: null,
};

export const AI_PROVIDER_MIN_KEY_LENGTH = 20;

export const AI_PROVIDER_DEFAULT_MODELS: Record<AiProvider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  anthropic: ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5-5"],
  google: ["gemini-2.5-flash", "gemini-2.5-pro"],
};

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && (AI_PROVIDERS as string[]).includes(value);
}

export function aiProviderSecretName(provider: AiProvider): string {
  return `ai_provider_${provider}_api_key`;
}
