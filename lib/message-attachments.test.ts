import { describe, it, expect } from "vitest";
import {
  attachmentLabel,
  attachmentPreviewText,
  normalizeAttachments,
} from "./message-attachments";

describe("attachmentLabel", () => {
  it("devuelve la etiqueta de cada tipo conocido", () => {
    expect(attachmentLabel("sticker")).toBe("Sticker");
    expect(attachmentLabel("image")).toBe("Foto");
    expect(attachmentLabel("video")).toBe("Video");
    expect(attachmentLabel("audio")).toBe("Audio");
    expect(attachmentLabel("file")).toBe("Archivo");
    expect(attachmentLabel("share")).toBe("Reel o publicacion compartida");
  });

  it("usa 'Adjunto' para un tipo desconocido", () => {
    expect(attachmentLabel("hologram")).toBe("Adjunto");
  });
});

describe("normalizeAttachments", () => {
  it("devuelve null sin adjuntos", () => {
    expect(normalizeAttachments(undefined)).toBeNull();
    expect(normalizeAttachments([])).toBeNull();
    expect(normalizeAttachments("nope")).toBeNull();
  });

  it("normaliza campos y rellena con null lo que falta", () => {
    expect(
      normalizeAttachments([
        { type: "share", url: "https://cdn/x", previewUrl: "https://cdn/p" },
        { type: "file", url: "https://cdn/f", filename: "a.pdf" },
        { url: 123 },
      ])
    ).toEqual([
      { type: "share", url: "https://cdn/x", previewUrl: "https://cdn/p", filename: null },
      { type: "file", url: "https://cdn/f", previewUrl: null, filename: "a.pdf" },
      { type: "file", url: null, previewUrl: null, filename: null },
    ]);
  });
});

describe("attachmentPreviewText", () => {
  it("usa el tipo del primer adjunto", () => {
    expect(attachmentPreviewText([{ type: "sticker" }])).toBe("Sticker");
    expect(attachmentPreviewText([{ type: "share" }, { type: "image" }])).toBe("Reel compartido");
  });

  it("devuelve vacio sin adjuntos y 'Adjunto' si el tipo no se reconoce", () => {
    expect(attachmentPreviewText([])).toBe("");
    expect(attachmentPreviewText(undefined)).toBe("");
    expect(attachmentPreviewText([{}])).toBe("Adjunto");
  });
});
