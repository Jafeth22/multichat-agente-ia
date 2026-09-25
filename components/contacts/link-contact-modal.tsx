"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Search, Link2 } from "lucide-react";
import { searchContactsForLinking, linkContactChannel } from "@/lib/actions/contacts";

interface ContactSearchResult {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  instagram_username: string | null;
}

/** Se monta solo mientras el modal esta abierto, ver ContactFormModal. */
export function LinkContactModal({
  contactId,
  contactName,
  onClose,
}: {
  contactId: string;
  contactName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const result = await searchContactsForLinking(value, contactId);
      setSearching(false);
      if ("contacts" in result) setResults(result.contacts as ContactSearchResult[]);
    }, 300);
  }

  async function handleLink(sourceId: string) {
    setLinkingId(sourceId);
    setError(null);
    const result = await linkContactChannel(contactId, sourceId);
    setLinkingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Vincular con otro contacto</h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="mb-3 text-xs text-muted-foreground">
            Busca el contacto duplicado. Sus canales, notas y conversaciones se van a mover a{" "}
            <strong>{contactName}</strong>, y el duplicado queda eliminado (se puede recuperar desde
            la base de datos durante 30 dias).
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Nombre, email, telefono o Instagram..."
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {searching && (
            <div className="mt-3 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!searching && results.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {results.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.display_name ?? "Sin nombre"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.email, c.phone, c.instagram_username && `@${c.instagram_username}`]
                        .filter(Boolean)
                        .join(" · ") || "Sin datos"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLink(c.id)}
                    disabled={linkingId === c.id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                  >
                    {linkingId === c.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                    Vincular
                  </button>
                </div>
              ))}
            </div>
          )}

          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground/70">Sin resultados</p>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
