/**
 * Adjuntos de mensajes de Instagram (Zernio): normalizacion y etiquetas.
 *
 * Zernio manda cada adjunto con type (image | video | audio | file |
 * sticker | share), url y, a veces, previewUrl (portada). Un Reel o una
 * publicacion compartida llega como "share".
 */

export interface MessageAttachment {
  type: string;
  url: string | null;
  previewUrl: string | null;
  filename: string | null;
}

const LABELS: Record<string, string> = {
  sticker: "Sticker",
  image: "Foto",
  video: "Video",
  audio: "Audio",
  file: "Archivo",
  share: "Reel o publicacion compartida",
};

/** Etiqueta corta para el preview de la lista de conversaciones. */
const PREVIEW_LABELS: Record<string, string> = {
  sticker: "Sticker",
  image: "Foto",
  video: "Video",
  audio: "Audio",
  file: "Archivo",
  share: "Reel compartido",
};

export function attachmentLabel(type: string): string {
  return LABELS[type] ?? "Adjunto";
}

/**
 * Convierte la lista cruda de Zernio a la forma que usa la UI. Devuelve
 * null si no hay adjuntos, para no mostrar un bloque vacio.
 */
export function normalizeAttachments(raw: unknown): MessageAttachment[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  return raw.map((a: any) => ({
    type: typeof a?.type === "string" ? a.type : "file",
    url: typeof a?.url === "string" ? a.url : null,
    previewUrl: typeof a?.previewUrl === "string" ? a.previewUrl : null,
    filename: typeof a?.filename === "string" ? a.filename : null,
  }));
}

/**
 * Texto de respaldo para last_message_preview cuando el mensaje no trae
 * texto: usa el tipo del primer adjunto. Sin adjuntos devuelve "".
 */
export function attachmentPreviewText(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "";
  const type = typeof raw[0]?.type === "string" ? raw[0].type : "";
  return PREVIEW_LABELS[type] ?? "Adjunto";
}
