-- ============================================================
-- CSV IMPORTS (F19)
-- ============================================================
-- Log append-only de cada importacion de contactos por CSV: resumen
-- (importados/actualizados/errores) y detalle de errores por fila.
-- No es una entidad de negocio editable, es un registro historico:
-- sin soft delete, sin policy de update/delete para authenticated
-- (igual criterio que audit_log, pero cualquier miembro puede
-- insertar su propia importacion, no solo el service role).
-- ============================================================

create table if not exists csv_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  file_name text not null,
  total_rows integer not null default 0,
  imported integer not null default 0,
  updated integer not null default 0,
  errors integer not null default 0,
  error_details jsonb,
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_csv_imports_workspace
  on csv_imports(workspace_id, created_at desc);

alter table csv_imports enable row level security;

drop policy if exists "Members select csv_imports" on csv_imports;
create policy "Members select csv_imports"
  on csv_imports for select
  using (is_workspace_member(workspace_id));

drop policy if exists "Members insert csv_imports" on csv_imports;
create policy "Members insert csv_imports"
  on csv_imports for insert
  with check (is_workspace_member(workspace_id) and imported_by = auth.uid());

-- Sin policy de update/delete para authenticated: es un registro
-- historico inmutable una vez creado.
grant select, insert on csv_imports to authenticated;
