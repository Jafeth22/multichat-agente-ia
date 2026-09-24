-- ============================================================
-- INTEGRATION CONFIGS: tabla generica de integraciones (F8)
-- ============================================================
-- Un registro por integracion (canal, proveedor de IA o de email) del
-- workspace. El secret real vive en Vault (workspace_secrets +
-- vault.secrets, ver 00018); esta tabla solo guarda el nombre logico
-- del secret y metadata no sensible (estado, config, ultimo error).
-- Generica a proposito: agregar una integracion nueva (ej: LinkedIn en
-- Etapa 2) no requiere cambiar esta tabla, solo insertar una fila con
-- un "provider" nuevo.
-- ============================================================

create table if not exists integration_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null check (type in ('channel', 'ai_provider', 'email_provider')),
  provider text not null,
  display_name text,
  vault_secret_name text,
  oauth_data jsonb,
  config jsonb,
  is_active boolean not null default false,
  connected_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index if not exists idx_integration_configs_workspace on integration_configs(workspace_id);
create index if not exists idx_integration_configs_workspace_type on integration_configs(workspace_id, type);

drop trigger if exists set_updated_at on integration_configs;
create trigger set_updated_at
  before update on integration_configs
  for each row execute function update_updated_at();

alter table integration_configs enable row level security;

-- Solo Owner/Admin ven y gestionan integraciones (F8, 13b). Un Member no
-- deberia ni enterarse de que existen estas filas.
drop policy if exists "Owner and admin can view integrations" on integration_configs;
create policy "Owner and admin can view integrations"
  on integration_configs for select
  using (is_workspace_admin(workspace_id));

drop policy if exists "Owner and admin can insert integrations" on integration_configs;
create policy "Owner and admin can insert integrations"
  on integration_configs for insert
  with check (is_workspace_admin(workspace_id));

drop policy if exists "Owner and admin can update integrations" on integration_configs;
create policy "Owner and admin can update integrations"
  on integration_configs for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

drop policy if exists "Owner and admin can delete integrations" on integration_configs;
create policy "Owner and admin can delete integrations"
  on integration_configs for delete
  using (is_workspace_admin(workspace_id));

grant select, insert, update, delete on integration_configs to authenticated;

-- Nota para el Bloque 3: cuando exista audit_log, cada conexion/
-- desconexion/error de una integracion (insert o update de is_active
-- en esta tabla) deberia quedar registrada ahi (evento "channel_*" o
-- "integration_*", entity_type = 'integration_configs').
