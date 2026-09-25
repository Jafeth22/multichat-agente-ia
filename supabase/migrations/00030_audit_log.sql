-- ============================================================
-- AUDIT LOG global (F20)
-- ============================================================
-- Tabla central de auditoria: que cambio, quien lo hizo, cuando y
-- (si aplica) el valor anterior/nuevo. Nunca se edita ni se borra.
--
-- Se inserta solo desde el servidor con el service role (lib/audit.ts),
-- nunca directo desde el cliente: por eso la policy de insert exige
-- is_service_role() en vez de is_workspace_member(). Los Server Actions
-- y webhooks ya corren en el servidor, asi que usan el cliente de
-- service role para dejar el registro.
-- ============================================================

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  changes jsonb,
  metadata jsonb,
  performed_by uuid references auth.users(id) on delete set null,
  performed_at timestamptz not null default now()
);

create index if not exists idx_audit_log_workspace on audit_log(workspace_id, performed_at desc);
create index if not exists idx_audit_log_entity on audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_performed_at on audit_log(performed_at);

alter table audit_log enable row level security;

-- Admin/Owner ven todo el historial del workspace; Member solo sus
-- propias acciones (F20, 13b).
drop policy if exists "Scoped select on audit_log" on audit_log;
create policy "Scoped select on audit_log"
  on audit_log for select
  using (
    is_workspace_member(workspace_id)
    and (is_workspace_admin(workspace_id) or performed_by = auth.uid())
  );

drop policy if exists "Service role inserts audit_log" on audit_log;
create policy "Service role inserts audit_log"
  on audit_log for insert
  with check (is_service_role());

-- Nunca se edita ni se borra: sin policies de update/delete para
-- authenticated. El GRANT de la tabla no incluye update/delete.
grant select, insert on audit_log to authenticated;
