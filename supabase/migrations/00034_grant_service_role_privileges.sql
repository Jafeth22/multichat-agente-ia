-- ============================================================
-- FIX: "permission denied for table workspace_invites" para service_role
-- ============================================================
-- 00017_grant_table_privileges.sql le dio GRANT a "anon" y "authenticated"
-- (para que las policies de RLS se puedan evaluar), pero se olvido de
-- "service_role". La mayoria de las tablas no lo sufrieron porque su
-- service_role ya tenia privilegios heredados de otro lado, pero
-- workspace_invites no, y la pagina /invite/[inviteId] (que lee con el
-- service role a proposito, porque el usuario todavia puede no estar
-- logueado) fallaba con "permission denied" en vez de encontrar la fila.
--
-- Esto lo cubre para TODAS las tablas de una, no solo workspace_invites,
-- para que ninguna tabla futura (ni las de este proyecto ni las de un
-- fork) pueda pisar el mismo problema.
-- ============================================================

grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

grant usage, select
  on all sequences in schema public
  to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;
