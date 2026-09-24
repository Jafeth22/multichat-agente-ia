-- ============================================================
-- TEAM: Owner y Admin pueden cambiar el rol de un miembro (F3)
-- ============================================================
-- Antes, solo el Owner podia actualizar workspace_members (por eso
-- Admin no podia cambiar roles). Se amplia a Owner/Admin, pero se
-- bloquea a nivel de base que alguien le cambie el rol al Owner o que
-- se asigne el rol 'owner' por esta via (evita transferencias de
-- ownership accidentales).
-- ============================================================

drop policy if exists "Owners can update members" on workspace_members;

create policy "Owner and admin can update member roles"
  on workspace_members for update
  using (
    is_workspace_admin(workspace_members.workspace_id)
    and workspace_members.role <> 'owner'
  )
  with check (
    is_workspace_admin(workspace_members.workspace_id)
    and role in ('admin', 'member')
  );
