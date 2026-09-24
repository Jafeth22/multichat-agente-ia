/**
 * Un solo lugar para el chequeo "es Owner o Admin del workspace", que
 * antes estaba repetido (con la misma logica, texto por texto) en
 * lib/workspace.ts, lib/actions/whatsapp.ts, lib/actions/team.ts y
 * components/sidebar.tsx.
 */
export function isOwnerOrAdmin(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
