/**
 * Un solo lugar para el chequeo "es Owner o Admin del workspace", que
 * antes estaba repetido (con la misma logica, texto por texto) en
 * lib/workspace.ts, lib/actions/whatsapp.ts, lib/actions/team.ts y
 * components/sidebar.tsx.
 */
export function isOwnerOrAdmin(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Etiquetas en espanol para el rol, usadas en el sidebar y en Mi Perfil. */
export const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  member: "Miembro",
};
