-- ============================================================
-- EMAIL LOGS: registro de emails enviados por Resend (F7)
-- ============================================================
-- Un registro por intento final de envio (con la cantidad de intentos
-- que hicieron falta). No guarda el cuerpo del email, solo lo
-- necesario para diagnosticar fallos y para el historial.
-- Queda lista para que Fase 2 la reutilice con las secuencias.
-- ============================================================

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  to_email text not null,
  subject text not null,
  template text,
  status text not null check (status in ('sent', 'failed')),
  attempts integer not null default 1,
  error text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_logs_workspace on email_logs(workspace_id);
create index if not exists idx_email_logs_workspace_created on email_logs(workspace_id, created_at desc);

alter table email_logs enable row level security;

-- Solo Owner/Admin ven el historial de envios (mismo criterio que
-- integration_configs). El service role (webhooks, cron) inserta sin
-- pasar por RLS.
drop policy if exists "Owner and admin can view email logs" on email_logs;
create policy "Owner and admin can view email logs"
  on email_logs for select
  using (is_workspace_admin(workspace_id));

drop policy if exists "Owner and admin can insert email logs" on email_logs;
create policy "Owner and admin can insert email logs"
  on email_logs for insert
  with check (is_workspace_admin(workspace_id));

-- Nunca se edita ni se borra un log de envio: sin policies de
-- update/delete para authenticated.
grant select, insert on email_logs to authenticated;
