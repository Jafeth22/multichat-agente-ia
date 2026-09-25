"use server";

import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";

export async function addTagToContact(contactId: string, tagId: string) {
  const { supabase } = await getWorkspace();

  const { error } = await supabase
    .from("contact_tags")
    .insert({ contact_id: contactId, tag_id: tagId });

  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath(`/dashboard/contacts/${contactId}`);
  return { ok: true };
}

export async function removeTagFromContact(contactId: string, tagId: string) {
  const { supabase } = await getWorkspace();

  const { error } = await supabase
    .from("contact_tags")
    .delete()
    .eq("contact_id", contactId)
    .eq("tag_id", tagId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/contacts/${contactId}`);
  return { ok: true };
}
