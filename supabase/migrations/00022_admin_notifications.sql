-- ============================================================
-- ADMIN NOTIFICATIONS: aviso dentro de la app (F6)
-- ============================================================
-- Notificacion in-app a Owner/Admin cuando se desconecta un canal
-- (por ahora, WhatsApp). El envio por email (Resend) se agrega en el
-- Bloque 2; esta tabla queda lista para que ese bloque la reutilice
-- con otros tipos de evento.
-- Solo el sistema (service role, desde el webhook) inserta filas.
-- ============================================================

create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  channel_id uuid references channels(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_notifications_workspace on admin_notifications(workspace_id);
create index if not exists idx_admin_notifications_unread
  on admin_notifications(workspace_id, read_at)
  where read_at is null;

alter table admin_notifications enable row level security;

drop policy if exists "Owner and admin can view notifications" on admin_notifications;
create policy "Owner and admin can view notifications"
  on admin_notifications for select
  using (is_workspace_admin(workspace_id));

drop policy if exists "Owner and admin can mark notifications as read" on admin_notifications;
create policy "Owner and admin can mark notifications as read"
  on admin_notifications for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

-- Sin policy de insert/delete para authenticated: solo el service role
-- (que bypassea RLS) crea o purga estas filas.
grant select, update on admin_notifications to authenticated;
