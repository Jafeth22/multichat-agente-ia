import { describe, it, expect } from "vitest";
import {
  CHANNEL_PROVIDERS,
  CHANNEL_PROVIDER_IDS,
  channelProvider,
  isChannelProvider,
} from "./channel-providers";
import { PLATFORMS } from "./platforms";

describe("channelProvider", () => {
  it("assigns channels with an Evolution instance to evolution", () => {
    expect(channelProvider({ evolution_instance_name: "ws-abc-123" })).toBe("evolution");
  });

  it("assigns every other channel to zernio", () => {
    expect(channelProvider({ evolution_instance_name: null })).toBe("zernio");
  });
});

describe("isChannelProvider", () => {
  it("accepts known providers and rejects anything else", () => {
    expect(isChannelProvider("zernio")).toBe(true);
    expect(isChannelProvider("evolution")).toBe(true);
    expect(isChannelProvider("whatsapp")).toBe(false);
    expect(isChannelProvider(null)).toBe(false);
  });
});

describe("CHANNEL_PROVIDERS", () => {
  it("has one entry per provider id", () => {
    expect(CHANNEL_PROVIDERS.map((p) => p.id)).toEqual([...CHANNEL_PROVIDER_IDS]);
  });

  it("connects each platform through exactly one provider", () => {
    const all = CHANNEL_PROVIDERS.flatMap((p) => p.platforms);
    expect([...all].sort()).toEqual([...PLATFORMS].sort());
  });
});
