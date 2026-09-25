import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findContactMatch } from "./cross-channel";

/** Fake `contacts` table: matches a single column exactly, like Postgres `eq`. */
function makeFakeSupabase(rows: Array<{ id: string; [col: string]: unknown }>) {
  const client = {
    from(table: string) {
      if (table !== "contacts") throw new Error(`unexpected table ${table}`);
      const filters: Record<string, unknown> = {};
      const builder = {
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          filters[col] = val;
          return builder;
        },
        is(col: string, val: unknown) {
          filters[col] = val;
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle() {
          const match = rows.find((r) =>
            Object.entries(filters).every(([k, v]) => (r[k] ?? null) === v)
          );
          return Promise.resolve({ data: match ?? null, error: null });
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

describe("findContactMatch", () => {
  it("matches by phone before email or username", () => {
    const supabase = makeFakeSupabase([
      { id: "c1", workspace_id: "ws-1", phone: "+5491100000000", deleted_at: null },
      { id: "c2", workspace_id: "ws-1", email: "lead@example.com", deleted_at: null },
    ]);

    return findContactMatch(supabase, "ws-1", {
      phone: "+5491100000000",
      email: "lead@example.com",
    }).then((match) => {
      expect(match).toEqual({ contactId: "c1", matchField: "phone" });
    });
  });

  it("falls back to email when phone does not match", async () => {
    const supabase = makeFakeSupabase([
      { id: "c2", workspace_id: "ws-1", email: "lead@example.com", deleted_at: null },
    ]);

    const match = await findContactMatch(supabase, "ws-1", {
      phone: "+5491199999999",
      email: "lead@example.com",
    });

    expect(match).toEqual({ contactId: "c2", matchField: "email" });
  });

  it("falls back to instagram username when phone and email do not match", async () => {
    const supabase = makeFakeSupabase([
      { id: "c3", workspace_id: "ws-1", instagram_username: "leadgen", deleted_at: null },
    ]);

    const match = await findContactMatch(supabase, "ws-1", {
      instagramUsername: "leadgen",
    });

    expect(match).toEqual({ contactId: "c3", matchField: "instagram_username" });
  });

  it("ignores soft-deleted contacts", async () => {
    const supabase = makeFakeSupabase([
      { id: "c1", workspace_id: "ws-1", phone: "+5491100000000", deleted_at: "2026-01-01" },
    ]);

    const match = await findContactMatch(supabase, "ws-1", { phone: "+5491100000000" });
    expect(match).toBeNull();
  });

  it("returns null when nothing matches", async () => {
    const supabase = makeFakeSupabase([]);
    const match = await findContactMatch(supabase, "ws-1", { phone: "+5491100000000" });
    expect(match).toBeNull();
  });
});
