import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Purga definitiva de lo soft-deleted hace mas de 30 dias (F15).
 * GET /api/cron/purge-deleted?key=CRON_SECRET
 *
 * El borrado de contacts es en cascada por las FK ON DELETE CASCADE que ya
 * tienen contact_channels, contact_notes, contact_tags,
 * contact_custom_fields, conversations y messages: borrar el contacto
 * arrastra todo lo demas. Las filas de conversations/contact_notes
 * borradas por su cuenta (sin borrar el contacto entero) se purgan aparte
 * por si mismas.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: purgedContacts, error: contactsError } = await supabase
    .from("contacts")
    .delete()
    .lt("deleted_at", cutoff)
    .select("id");

  if (contactsError) {
    console.error("[purge-deleted] failed to purge contacts:", contactsError);
  }

  const { data: purgedConversations, error: conversationsError } = await supabase
    .from("conversations")
    .delete()
    .lt("deleted_at", cutoff)
    .select("id");

  if (conversationsError) {
    console.error("[purge-deleted] failed to purge conversations:", conversationsError);
  }

  const { data: purgedNotes, error: notesError } = await supabase
    .from("contact_notes")
    .delete()
    .lt("deleted_at", cutoff)
    .select("id");

  if (notesError) {
    console.error("[purge-deleted] failed to purge contact_notes:", notesError);
  }

  return NextResponse.json({
    contacts: purgedContacts?.length ?? 0,
    conversations: purgedConversations?.length ?? 0,
    contact_notes: purgedNotes?.length ?? 0,
  });
}
