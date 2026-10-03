-- ============================================================
-- FIX: "new row violates row-level security policy for table
-- response_templates" al eliminar (soft delete) un template.
-- ============================================================
-- La policy de UPDATE de 00035_response_templates.sql solo tenia
-- USING, sin WITH CHECK explicito. Aca se reafirma con los dos
-- (igual patron que "Scoped update on contacts" y "Author or admin
-- updates contact_notes"), que es la convencion que sigue el resto
-- del proyecto para evitar justo este tipo de problema.
-- ============================================================

drop policy if exists "Admins update response_templates" on response_templates;
create policy "Admins update response_templates"
  on response_templates for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

-- Confirma tambien el GRANT a nivel tabla (refuerzo idempotente y gratis).
grant select, insert, update on response_templates to authenticated;
