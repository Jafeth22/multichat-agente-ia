-- ============================================================
-- FIX: "new row violates row-level security policy for table contacts"
-- al crear un contacto nuevo desde /dashboard/contacts.
-- ============================================================
-- La policy de INSERT de contacts ("Workspace members can create
-- contacts", de 00020_leads_scope_rls.sql) no la toco ninguna
-- migracion del Bloque 3, pero se reafirma aca de forma defensiva
-- (drop + create) para garantizar que exista tal cual se espera,
-- sin importar el estado en el que haya quedado la base real.
--
-- De paso, blinda el UPDATE: create_contact no es el unico camino,
-- asignar setter/vendedor o editar datos tambien son UPDATE y
-- necesitan poder pasar el check aunque el contacto todavia no tenga
-- setter/vendedor asignado (won't-fail-open, can_see_contact ya lo
-- cubre, esto solo confirma que la policy exista).
-- ============================================================

drop policy if exists "Workspace members can create contacts" on contacts;
create policy "Workspace members can create contacts"
  on contacts for insert
  with check (is_workspace_member(workspace_id));

drop policy if exists "Scoped update on contacts" on contacts;
create policy "Scoped update on contacts"
  on contacts for update
  using (can_see_contact(id))
  with check (can_see_contact(id));

-- Confirma tambien el GRANT a nivel tabla (00017 ya lo hace para todas,
-- esto es un refuerzo idempotente y gratis).
grant select, insert, update, delete on contacts to authenticated;
