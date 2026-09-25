"use server";

import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";

export async function setContactCustomFieldValue(contactId: string, fieldId: string, value: string) {
  const { supabase } = await getWorkspace();

  const trimmed = value.trim();

  if (!trimmed) {
    const { error } = await supabase
      .from("contact_custom_fields")
      .delete()
      .eq("contact_id", contactId)
      .eq("field_id", fieldId);
    if (error) return { error: error.message };
    revalidatePath(`/dashboard/contacts/${contactId}`);
    return { ok: true };
  }

  const { error } = await supabase
    .from("contact_custom_fields")
    .upsert(
      { contact_id: contactId, field_id: fieldId, value: trimmed },
      { onConflict: "contact_id,field_id" }
    );

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/contacts/${contactId}`);
  return { ok: true };
}
