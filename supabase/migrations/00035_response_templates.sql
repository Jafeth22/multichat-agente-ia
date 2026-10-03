-- ============================================================
-- RESPONSE TEMPLATES (F17)
-- ============================================================
-- Templates de respuesta rapida por workspace, usados desde el
-- selector "/" en el campo de respuesta de la bandeja.
--
-- deleted_at se suma desde el arranque (ya anticipado en el
-- comentario de 00032_soft_delete.sql).
--
-- Scope: cualquier miembro del workspace puede ver y usar los
-- templates (los necesita para responder), pero crear/editar/borrar
-- es solo Owner/Admin (F17, tabla de seguridad 13b).
-- ============================================================

create table if not exists response_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  content text not null,
  shortcut text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'response_templates_name_not_empty'
  ) then
    alter table response_templates
      add constraint response_templates_name_not_empty check (btrim(name) <> '');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'response_templates_content_not_empty'
  ) then
    alter table response_templates
      add constraint response_templates_content_not_empty check (btrim(content) <> '');
  end if;
end $$;

create index if not exists idx_response_templates_workspace
  on response_templates(workspace_id) where deleted_at is null;

-- Evita dos shortcuts iguales activos en el mismo workspace: el
-- selector "/" busca por shortcut y necesita que sea univoco para no
-- tener que desempatar.
create unique index if not exists idx_response_templates_workspace_shortcut
  on response_templates(workspace_id, lower(shortcut))
  where deleted_at is null and shortcut is not null;

drop trigger if exists set_updated_at on response_templates;
create trigger set_updated_at
  before update on response_templates
  for each row execute function update_updated_at();

alter table response_templates enable row level security;

drop policy if exists "Members select response_templates" on response_templates;
create policy "Members select response_templates"
  on response_templates for select
  using (is_workspace_member(workspace_id) and deleted_at is null);

drop policy if exists "Admins insert response_templates" on response_templates;
create policy "Admins insert response_templates"
  on response_templates for insert
  with check (is_workspace_admin(workspace_id));

-- Update cubre tanto editar el contenido como el soft delete
-- (deleted_at = now()): solo Owner/Admin.
drop policy if exists "Admins update response_templates" on response_templates;
create policy "Admins update response_templates"
  on response_templates for update
  using (is_workspace_admin(workspace_id));

-- Sin policy de delete para authenticated: siempre soft delete.
grant select, insert, update on response_templates to authenticated;
