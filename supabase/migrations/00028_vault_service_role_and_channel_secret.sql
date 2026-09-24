-- ============================================================
-- VAULT: acceso del service role + read_channel_secret (Bloque 2)
-- ============================================================
-- Parche sobre 00018_vault_setup.sql. Supabase CLI controla que
-- migraciones ya corrieron por nombre de archivo, no por contenido: si
-- 00018 ya se aplico contra esta base antes de estos cambios, editar
-- ese archivo no alcanza para que el cambio llegue. Esta migracion
-- nueva aplica el mismo cambio con create or replace (idempotente),
-- asi corre bien tanto si 00018 ya se aplico como si no.
--
-- Que cambia:
-- 1. store_secret/read_secret/delete_secret ahora tambien aceptan al
--    service role (antes solo Owner/Admin autenticado). Lo necesita el
--    webhook de Evolution API (F7): corre con el service role, sin
--    auth.uid(), y tiene que poder leer la key de Resend para avisar
--    por email que WhatsApp se desconecto.
-- 2. Funcion nueva read_channel_secret: variante mas permisiva de
--    read_secret para secrets que necesita cualquier Member del
--    workspace en tiempo de ejecucion (hoy: la key de Zernio, para
--    mandar/recibir mensajes desde la bandeja, los flows, las
--    secuencias, los comentarios y los broadcasts). Lista blanca de
--    nombres a proposito: nunca deja leer las keys de Resend o de IA
--    (esas siguen siendo solo Owner/Admin, via read_secret).
-- ============================================================

create or replace function is_service_role()
returns boolean as $$
  select auth.role() = 'service_role';
$$ language sql security definer stable;

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
  if not is_workspace_admin(p_workspace_id) and not is_service_role() then
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
  if not is_workspace_admin(p_workspace_id) and not is_service_role() then
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
  if not is_workspace_admin(p_workspace_id) and not is_service_role() then
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

create or replace function read_channel_secret(
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
  if p_secret_name <> 'zernio_api_key' then
    raise exception 'read_channel_secret no puede leer "%"', p_secret_name;
  end if;

  if not is_workspace_member(p_workspace_id) and not is_service_role() then
    raise exception 'No autorizado: se requiere ser miembro del workspace';
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

revoke all on function store_secret(text, text, uuid) from public;
revoke all on function read_secret(text, uuid) from public;
revoke all on function delete_secret(text, uuid) from public;
revoke all on function read_channel_secret(text, uuid) from public;
revoke all on function is_service_role() from public;

grant execute on function store_secret(text, text, uuid) to authenticated, service_role;
grant execute on function read_secret(text, uuid) to authenticated, service_role;
grant execute on function delete_secret(text, uuid) to authenticated, service_role;
grant execute on function read_channel_secret(text, uuid) to authenticated, service_role;
grant execute on function is_service_role() to authenticated, service_role;
