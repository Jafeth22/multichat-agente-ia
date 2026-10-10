import { describe, it, expect } from "vitest";
import {
  aiStatus,
  channelsStatus,
  keyHint,
  needsAttention,
  simpleStatus,
  whatsappChannelTone,
  whatsappStatus,
  zernioStatus,
  type ChannelStatusInput,
} from "./integration-status";

const wa = (
  connection_status: ChannelStatusInput["connection_status"],
  is_active = true
): ChannelStatusInput => ({ connection_status, is_active });

describe("whatsappChannelTone", () => {
  it("prioritizes the connection over the paused flag", () => {
    expect(whatsappChannelTone(wa("disconnected", false))).toBe("bad");
    expect(whatsappChannelTone(wa("error"))).toBe("bad");
    expect(whatsappChannelTone(wa("connecting"))).toBe("info");
    expect(whatsappChannelTone(wa("connected", false))).toBe("paused");
    expect(whatsappChannelTone(wa("connected"))).toBe("ok");
  });
});

describe("zernioStatus", () => {
  it("is idle when not configured and there are no accounts", () => {
    expect(zernioStatus(false, [])).toEqual([{ tone: "idle", text: "Sin configurar" }]);
  });

  it("is bad when the key was removed but accounts remain", () => {
    expect(zernioStatus(false, [{ is_active: true }])[0].tone).toBe("bad");
  });

  it("splits active and paused accounts into separate parts", () => {
    const parts = zernioStatus(true, [{ is_active: true }, { is_active: true }, { is_active: false }]);
    expect(parts).toEqual([
      { tone: "ok", text: "2 activas" },
      { tone: "paused", text: "1 pausada" },
    ]);
  });
});

describe("whatsappStatus", () => {
  it("has one part per state", () => {
    const parts = whatsappStatus([wa("connected"), wa("disconnected"), wa("connecting")]);
    expect(parts.map((p) => p.tone)).toEqual(["ok", "info", "bad"]);
    expect(parts[0].text).toBe("1 conectado");
  });

  it("is idle without numbers", () => {
    expect(whatsappStatus([])[0].tone).toBe("idle");
  });
});

describe("channelsStatus", () => {
  it("merges Zernio active accounts and connected WhatsApp numbers into one chip", () => {
    const parts = channelsStatus(
      true,
      [{ is_active: true }, { is_active: true }, { is_active: false }],
      [wa("connected"), wa("disconnected")]
    );
    expect(parts).toEqual([
      { tone: "ok", text: "3 activos", detail: "2 cuentas de Zernio y 1 número de WhatsApp" },
      { tone: "paused", text: "1 pausado", detail: "1 cuenta de Zernio" },
      { tone: "bad", text: "1 desconectado", detail: "1 número de WhatsApp para reconectar" },
    ]);
  });

  it("ignores Zernio accounts while the key is disconnected, but flags it", () => {
    const parts = channelsStatus(false, [{ is_active: true }], [wa("connected")]);
    expect(parts.map((p) => p.text)).toEqual(["1 activo", "Zernio desconectado"]);
  });

  it("is idle when nothing is set up", () => {
    expect(channelsStatus(false, [], [])).toEqual([{ tone: "idle", text: "Sin configurar" }]);
  });
});

describe("simpleStatus / aiStatus", () => {
  it("maps connected flags", () => {
    expect(simpleStatus(true)[0].tone).toBe("ok");
    expect(simpleStatus(false)[0].tone).toBe("idle");
    expect(aiStatus(1, 3)[0].text).toBe("1 de 3 conectados");
    expect(aiStatus(0, 3)[0].tone).toBe("idle");
  });
});

describe("needsAttention", () => {
  it("opens blocks with problems or pending setup, not paused ones", () => {
    expect(needsAttention([{ tone: "ok", text: "" }, { tone: "paused", text: "" }])).toBe(false);
    expect(needsAttention([{ tone: "bad", text: "" }])).toBe(true);
    expect(needsAttention([{ tone: "idle", text: "" }])).toBe(true);
    expect(needsAttention([{ tone: "info", text: "" }])).toBe(true);
  });
});

describe("keyHint", () => {
  it("keeps the last 4 characters", () => {
    expect(keyHint("  sk-abcdefa3F9 ")).toBe("a3F9");
  });
});
