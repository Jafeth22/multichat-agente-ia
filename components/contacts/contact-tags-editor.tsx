"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { addTagToContact, removeTagFromContact } from "@/lib/actions/contact-tags";
import type { Database } from "@/lib/types/database";

type Tag = Database["public"]["Tables"]["tags"]["Row"];

export function ContactTagsEditor({
  contactId,
  allTags,
  currentTags,
}: {
  contactId: string;
  allTags: Tag[];
  currentTags: Tag[];
}) {
  const [tags, setTags] = useState(currentTags);
  const [adding, setAdding] = useState(false);

  const available = allTags.filter((t) => !tags.some((tag) => tag.id === t.id));

  async function handleAdd(tagId: string) {
    const tag = allTags.find((t) => t.id === tagId);
    if (!tag) return;
    setTags((prev) => [...prev, tag]);
    setAdding(false);
    const result = await addTagToContact(contactId, tagId);
    if (result.error) setTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  async function handleRemove(tagId: string) {
    const removed = tags.find((t) => t.id === tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    const result = await removeTagFromContact(contactId, tagId);
    if (result.error && removed) setTags((prev) => [...prev, removed]);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium"
          style={tag.color ? { backgroundColor: `${tag.color}20`, borderColor: `${tag.color}40`, color: tag.color } : undefined}
        >
          {tag.name}
          <button onClick={() => handleRemove(tag.id)} className="opacity-60 hover:opacity-100">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {tags.length === 0 && <span className="text-xs text-muted-foreground/70">Sin tags</span>}

      {adding ? (
        <select
          autoFocus
          onChange={(e) => e.target.value && handleAdd(e.target.value)}
          onBlur={() => setAdding(false)}
          className="rounded-full border border-input bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Elegir tag...</option>
          {available.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      ) : available.length > 0 ? (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Agregar
        </button>
      ) : null}
    </div>
  );
}
