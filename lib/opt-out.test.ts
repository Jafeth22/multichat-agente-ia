import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectOptOutPhrase } from "./opt-out";

function makeFakeSupabase(optoutPhrases: string[] | null) {
  const client = {
    from(table: string) {
      if (table !== "workspaces") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single() {
          return Promise.resolve({ data: { optout_phrases: optoutPhrases }, error: null });
        },
      };
    },
  };
  return client as unknown as SupabaseClient;
}

describe("detectOptOutPhrase", () => {
  const phrases = ["no me escribas más", "stop", "no me contactes"];

  it("matches a configured phrase as a case-insensitive substring", async () => {
    const supabase = makeFakeSupabase(phrases);
    const match = await detectOptOutPhrase(supabase, "ws-1", "Por favor STOP de una vez");
    expect(match).toBe("stop");
  });

  it("matches a full-sentence phrase embedded in a longer message", async () => {
    const supabase = makeFakeSupabase(phrases);
    const match = await detectOptOutPhrase(supabase, "ws-1", "Che, no me escribas más porfa");
    expect(match).toBe("no me escribas más");
  });

  it("returns null when nothing matches", async () => {
    const supabase = makeFakeSupabase(phrases);
    const match = await detectOptOutPhrase(supabase, "ws-1", "Hola, quiero mas info");
    expect(match).toBeNull();
  });

  it("returns null for empty text or no configured phrases", async () => {
    expect(await detectOptOutPhrase(makeFakeSupabase(phrases), "ws-1", "")).toBeNull();
    expect(await detectOptOutPhrase(makeFakeSupabase(phrases), "ws-1", undefined)).toBeNull();
    expect(await detectOptOutPhrase(makeFakeSupabase([]), "ws-1", "stop")).toBeNull();
    expect(await detectOptOutPhrase(makeFakeSupabase(null), "ws-1", "stop")).toBeNull();
  });
});
