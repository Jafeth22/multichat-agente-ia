"use client";

import { useState } from "react";
import { Film, FileText, Image as ImageIcon, Mic, Paperclip, Smile, ExternalLink } from "lucide-react";
import { attachmentLabel, normalizeAttachments, type MessageAttachment } from "@/lib/message-attachments";

const TYPE_ICON = {
  sticker: Smile,
  image: ImageIcon,
  video: Film,
  audio: Mic,
  file: FileText,
  share: Film,
} as const;

/** Imagen remota; si el link vencio o no carga, se cae a un recuadro con icono. */
function RemoteImage({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function AttachmentItem({ attachment }: { attachment: MessageAttachment }) {
  const label = attachmentLabel(attachment.type);
  const Icon = TYPE_ICON[attachment.type as keyof typeof TYPE_ICON] ?? Paperclip;

  const labelRow = (
    <span className="flex items-center gap-1 text-xs opacity-70">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );

  // Sticker: la imagen sola, chica, con la etiqueta abajo.
  if (attachment.type === "sticker" && attachment.url) {
    return (
      <div className="flex flex-col gap-0.5">
        <RemoteImage
          src={attachment.url}
          alt="Sticker"
          className="h-28 w-28 object-contain"
          fallback={labelRow}
        />
        {labelRow}
      </div>
    );
  }

  if (attachment.type === "image" && attachment.url) {
    return (
      <div className="flex flex-col gap-0.5">
        <a href={attachment.url} target="_blank" rel="noreferrer">
          <RemoteImage
            src={attachment.url}
            alt="Foto"
            className="max-h-60 max-w-full rounded-lg object-cover"
            fallback={labelRow}
          />
        </a>
        {labelRow}
      </div>
    );
  }

  if (attachment.type === "audio" && attachment.url) {
    return (
      <div className="flex flex-col gap-1">
        {labelRow}
        <audio controls src={attachment.url} className="max-w-full" />
      </div>
    );
  }

  // Reel, publicacion compartida y video: portada si viene, mas enlace.
  if (attachment.type === "share" || attachment.type === "video") {
    return (
      <div className="flex flex-col gap-1">
        {attachment.previewUrl && (
          <RemoteImage
            src={attachment.previewUrl}
            alt={`Portada: ${label}`}
            className="max-h-60 max-w-full rounded-lg object-cover"
            fallback={null}
          />
        )}
        <div className="flex items-center gap-2">
          {labelRow}
          {attachment.url && (
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-0.5 text-xs underline"
            >
              {attachment.type === "share" ? "Ver en Instagram" : "Abrir"}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    );
  }

  // Archivo u otro tipo: nombre (si viene) con enlace.
  return (
    <div className="flex items-center gap-2">
      {labelRow}
      {attachment.url && (
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline"
        >
          {attachment.filename ?? "Abrir"}
        </a>
      )}
    </div>
  );
}

export function MessageAttachments({ attachments }: { attachments: unknown }) {
  const items = normalizeAttachments(attachments);
  if (!items) return null;

  return (
    <div className="mt-1 flex flex-col gap-2">
      {items.map((a, i) => (
        <AttachmentItem key={`${a.url ?? a.type}-${i}`} attachment={a} />
      ))}
    </div>
  );
}
