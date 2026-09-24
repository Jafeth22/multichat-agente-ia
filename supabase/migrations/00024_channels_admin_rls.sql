-- ============================================================
-- CHANNELS: solo Owner/Admin gestionan canales (F3)
-- ============================================================
-- Antes, cualquier miembro del workspace podia insertar/editar/borrar
-- canales por RLS (la restriccion era solo de UI). "Member no puede...
-- gestionar canales" tiene que valer tambien en la base de datos.
-- Select se mantiene abierto a todo el workspace (la bandeja necesita
-- leer los canales para mostrar el icono de plataforma, etc).
-- ============================================================

drop policy if exists "Users can manage channels in their workspaces" on channels;

create policy "Owner and admin can insert channels"
  on channels for insert
  with check (is_workspace_admin(workspace_id));

create policy "Owner and admin can update channels"
  on channels for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

create policy "Owner and admin can delete channels"
  on channels for delete
  using (is_workspace_admin(workspace_id));
