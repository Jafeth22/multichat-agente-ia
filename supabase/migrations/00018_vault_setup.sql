-- ============================================================
-- SUPABASE VAULT: almacenamiento cifrado de API keys (F2)
-- ============================================================
-- Habilita la extension Vault (cifrado AES-256 para secrets) y agrega
-- 3 funciones RPC para guardar, leer y eliminar secrets aislados por
-- workspace. Solo Owner/Admin del workspace pueden usarlas.
--
-- No hay UI directa de Vault: la UI es la pantalla de integraciones
-- del Bloque 2 (/settings/integrations), que va a llamar a estas
-- funciones via supabase.rpc(...).
-- ============================================================

-- El nombre real de la extension en Supabase es "supabase_vault" (no
-- "vault"): ella misma crea y controla el schema "vault", no se elige
-- con WITH SCHEMA. En la mayoria de los proyectos Supabase ya viene
-- habilitada por defecto, por eso el IF NOT EXISTS.
create extension if not exists supabase_vault;

-- Helper: rol owner/admin en el workspace. Se reutiliza en bloques
-- siguientes (integration_configs, audit_log, etc).
create or replace function is_workspace_admin(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$ language sql security definer stable;

-- Mapea un nombre logico de secret (ej: "zernio_api_key") al id real
-- del secret en vault.secrets, por workspace. Esta tabla no se
-- consulta directo desde el cliente: solo la usan las funciones de
-- abajo (security definer), por eso no tiene politicas RLS permisivas.
create table if not exists workspace_secrets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  secret_name text not null,
  vault_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, secret_name)
);

create index if not exists idx_workspace_secrets_workspace on workspace_secrets(workspace_id);

alter table workspace_secrets enable row level security;
-- A proposito: no se agregan policies. Con RLS habilitada y sin
-- policies, authenticated no puede leer/escribir esta tabla en forma
-- directa (ni siquiera Owner/Admin): el unico camino es via las
-- funciones store_secret/read_secret/delete_secret, que corren como
-- el dueno de la funcion (bypassea RLS) y validan el rol a mano.

grant select, insert, update, delete on workspace_secrets to authenticated;

-- ------------------------------------------------------------
-- store_secret: crea o actualiza un secret
-- ------------------------------------------------------------
create or replace function store_secret(
  p_secret_name text,
  p_secret_value text,
  p_workspace_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'No autorizado: se requiere rol Owner o Admin del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is not null then
    perform vault.update_secret(v_vault_id, p_secret_value);
    update workspace_secrets
      set updated_at = now()
      where workspace_id = p_workspace_id and secret_name = p_secret_name;
  else
    v_vault_id := vault.create_secret(
      p_secret_value,
      p_workspace_id::text || ':' || p_secret_name,
      'Secret de integracion, workspace ' || p_workspace_id::text
    );
    insert into workspace_secrets (workspace_id, secret_name, vault_secret_id)
    values (p_workspace_id, p_secret_name, v_vault_id);
  end if;

  return v_vault_id;
end;
$$;

-- ------------------------------------------------------------
-- read_secret: devuelve el valor original, o null si no existe
-- ------------------------------------------------------------
create or replace function read_secret(
  p_secret_name text,
  p_workspace_id uuid
)
returns text
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
  v_value text;
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'No autorizado: se requiere rol Owner o Admin del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is null then
    return null;
  end if;

  select decrypted_secret into v_value
  from vault.decrypted_secrets
  where id = v_vault_id;

  return v_value;
end;
$$;

-- ------------------------------------------------------------
-- delete_secret: borra el secret. Devuelve false si no existia.
-- ------------------------------------------------------------
create or replace function delete_secret(
  p_secret_name text,
  p_workspace_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'No autorizado: se requiere rol Owner o Admin del workspace';
  end if;

  select vault_secret_id into v_vault_id
  from workspace_secrets
  where workspace_id = p_workspace_id and secret_name = p_secret_name;

  if v_vault_id is null then
    return false;
  end if;

  delete from vault.secrets where id = v_vault_id;
  delete from workspace_secrets
    where workspace_id = p_workspace_id and secret_name = p_secret_name;

  return true;
end;
$$;

revoke all on function store_secret(text, text, uuid) from public;
revoke all on function read_secret(text, uuid) from public;
revoke all on function delete_secret(text, uuid) from public;
revoke all on function is_workspace_admin(uuid) from public;

grant execute on function store_secret(text, text, uuid) to authenticated;
grant execute on function read_secret(text, uuid) to authenticated;
grant execute on function delete_secret(text, uuid) to authenticated;
grant execute on function is_workspace_admin(uuid) to authenticated;
