import { describe, it, expect } from "vitest";
import { normalizePhone, normalizeWhatsAppJidPhone } from "./phone";

describe("normalizePhone", () => {
  it("normalizes a number that already has a country code", () => {
    expect(normalizePhone("+54 9 11 2345-6789").normalized).toBe("+5491123456789");
  });

  it("normalizes using an explicit default country when there is no +", () => {
    const result = normalizePhone("11 2345-6789", "AR");
    expect(result.valid).toBe(true);
    expect(result.normalized).toMatch(/^\+54/);
  });

  it("rejects a number with no country code and no default country", () => {
    expect(normalizePhone("2345-6789").valid).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(normalizePhone("not a phone").valid).toBe(false);
  });

  it("returns invalid for empty input", () => {
    expect(normalizePhone("").valid).toBe(false);
    expect(normalizePhone(null).valid).toBe(false);
    expect(normalizePhone(undefined).valid).toBe(false);
  });
});

describe("normalizeWhatsAppJidPhone", () => {
  it("normalizes a bare Baileys JID number (no +)", () => {
    const result = normalizeWhatsAppJidPhone("5491123456789");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("+5491123456789");
  });

  it("rejects invalid digit strings", () => {
    expect(normalizeWhatsAppJidPhone("123").valid).toBe(false);
  });
});
