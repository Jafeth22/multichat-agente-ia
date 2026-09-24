import { describe, it, expect } from "vitest";
import { isOwnerOrAdmin } from "./permissions";

describe("isOwnerOrAdmin", () => {
  it("accepts owner and admin", () => {
    expect(isOwnerOrAdmin("owner")).toBe(true);
    expect(isOwnerOrAdmin("admin")).toBe(true);
  });

  it("rejects member and anything else", () => {
    expect(isOwnerOrAdmin("member")).toBe(false);
    expect(isOwnerOrAdmin(null)).toBe(false);
    expect(isOwnerOrAdmin(undefined)).toBe(false);
    expect(isOwnerOrAdmin("")).toBe(false);
  });
});
