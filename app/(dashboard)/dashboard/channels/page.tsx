import { redirect } from "next/navigation";

/**
 * Canales (Instagram, WhatsApp) se mudo a la seccion "Canales" de
 * /dashboard/settings/integrations (Bloque 2, F8). Se mantiene este
 * redirect para no romper links guardados o bookmarks viejos.
 */
export default function ChannelsPage() {
  redirect("/dashboard/settings/integrations");
}
