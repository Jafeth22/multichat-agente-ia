import { describe, it, expect } from "vitest";
import {
  AI_PROVIDERS,
  AI_PROVIDER_DEFAULT_MODELS,
  AI_PROVIDER_LABELS,
  aiProviderSecretName,
  isAiProvider,
} from "./ai-providers";

describe("ai-providers", () => {
  it("has a label and at least one default model for every provider", () => {
    for (const provider of AI_PROVIDERS) {
      expect(AI_PROVIDER_LABELS[provider]).toBeTruthy();
      expect(AI_PROVIDER_DEFAULT_MODELS[provider].length).toBeGreaterThan(0);
    }
  });

  it("accepts supported providers and rejects everything else", () => {
    expect(isAiProvider("openai")).toBe(true);
    expect(isAiProvider("anthropic")).toBe(true);
    expect(isAiProvider("google")).toBe(true);
    expect(isAiProvider("cohere")).toBe(false);
    expect(isAiProvider(undefined)).toBe(false);
  });

  it("builds a distinct vault secret name per provider", () => {
    const names = AI_PROVIDERS.map(aiProviderSecretName);
    expect(new Set(names).size).toBe(names.length);
    expect(aiProviderSecretName("openai")).toBe("ai_provider_openai_api_key");
  });
});
