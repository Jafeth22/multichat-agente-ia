"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { createContactNote, updateContactNote, deleteContactNote } from "@/lib/actions/contact-notes";
import { isOwnerOrAdmin } from "@/lib/permissions";

interface Note {
  id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactNotes({
  contactId,
  notes: initialNotes,
  currentUserId,
  role,
  authorNames,
}: {
  contactId: string;
  notes: Note[];
  currentUserId: string;
  role: string | null;
  /** created_by -> nombre para mostrar, resuelto en el server. */
  authorNames: Record<string, string>;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function handleCreate() {
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    const result = await createContactNote(contactId, content);
    setSaving(false);
    if (result.ok && result.note) {
      setNotes((prev) => [result.note as Note, ...prev]);
      setDraft("");
    }
  }

  async function handleUpdate(noteId: string) {
    const content = editValue.trim();
    if (!content) return;
    const result = await updateContactNote(noteId, content);
    if (result.ok) {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, content } : n)));
      setEditingId(null);
      router.refresh();
    }
  }

  async function handleDelete(noteId: string) {
    const result = await deleteContactNote(noteId);
    if (result.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  }

  const canManage = isOwnerOrAdmin(role);

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          placeholder="Escribi una nota y apreta Enter..."
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={handleCreate}
          disabled={!draft.trim() || saving}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agregar"}
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground/70">Todavia no hay notas</p>
      ) : (
        <div className="mt-3 space-y-2">
          {notes.map((note) => {
            const canEdit = canManage || note.created_by === currentUserId;
            return (
              <div key={note.id} className="rounded-lg border border-border p-3">
                {editingId === note.id ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdate(note.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button onClick={() => handleUpdate(note.id)} className="text-green-600">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">
                        {authorNames[note.created_by ?? ""] ?? "Desconocido"} · {formatDateTime(note.created_at)}
                        {note.updated_at !== note.created_at && " (editada)"}
                      </p>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingId(note.id);
                              setEditValue(note.content);
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-accent"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(note.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
