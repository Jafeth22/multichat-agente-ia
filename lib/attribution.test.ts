import { describe, it, expect } from "vitest";
import { buildAttributionClick, applyAttribution } from "./attribution";

describe("buildAttributionClick", () => {
  it("returns null when there is no tracking data", () => {
    expect(buildAttributionClick({})).toBeNull();
    expect(buildAttributionClick({ utm_source: "" })).toBeNull();
  });

  it("only includes fields that have a value", () => {
    const click = buildAttributionClick(
      { utm_source: "instagram", utm_medium: "" },
      "2026-01-01T00:00:00.000Z"
    );
    expect(click).toEqual({
      utm_source: "instagram",
      captured_at: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("applyAttribution", () => {
  it("sets first_click and last_click on the first interaction with data", () => {
    const result = applyAttribution(null, { utm_source: "instagram" }, "2026-01-01T00:00:00.000Z");
    expect(result.first_click?.utm_source).toBe("instagram");
    expect(result.last_click?.utm_source).toBe("instagram");
  });

  it("never overwrites an existing first_click", () => {
    const first = applyAttribution(null, { utm_source: "instagram" }, "2026-01-01T00:00:00.000Z");
    const second = applyAttribution(first, { utm_source: "whatsapp" }, "2026-02-01T00:00:00.000Z");

    expect(second.first_click?.utm_source).toBe("instagram");
    expect(second.last_click?.utm_source).toBe("whatsapp");
  });

  it("leaves attribution untouched when the new interaction has no tracking data", () => {
    const first = applyAttribution(null, { utm_source: "instagram" }, "2026-01-01T00:00:00.000Z");
    const second = applyAttribution(first, {});

    expect(second).toEqual(first);
  });
});
