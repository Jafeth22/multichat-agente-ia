-- ============================================================
-- WORKSPACES: solo Owner/Admin editan la configuracion (F3)
-- ============================================================
-- Antes, cualquier miembro podia hacer UPDATE sobre su fila en
-- workspaces por RLS, incluyendo campos sensibles (API keys, webhook
-- secret, config de scope de leads). "Member no puede... cambiar
-- configuracion del workspace" tiene que valer en la base, no solo
-- ocultando la pantalla de Settings.
-- ============================================================

drop policy if exists "Users can update their workspaces" on workspaces;

create policy "Owner and admin can update their workspace"
  on workspaces for update
  using (is_workspace_admin(id))
  with check (is_workspace_admin(id));
