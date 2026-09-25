-- ============================================================
-- CONTACT NOTES (F13)
-- ============================================================
-- workspace_id desnormalizado a proposito (7.4 del documento de
-- requerimientos) para simplificar el RLS: evita un join contra
-- contacts solo para saber el workspace.
--
-- Scope: cualquier miembro que pueda ver el contacto (can_see_contact,
-- scope de leads del Bloque 1) puede leer y crear notas. Editar o
-- borrar (soft) una nota es solo del autor o de Admin/Owner.
-- ============================================================

create table if not exists contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contact_notes_content_not_empty'
  ) then
    alter table contact_notes
      add constraint contact_notes_content_not_empty check (btrim(content) <> '');
  end if;
end $$;

create index if not exists idx_contact_notes_contact on contact_notes(contact_id, created_at desc);
create index if not exists idx_contact_notes_workspace on contact_notes(workspace_id);
create index if not exists idx_contact_notes_deleted_at on contact_notes(deleted_at);

drop trigger if exists set_updated_at on contact_notes;
create trigger set_updated_at
  before update on contact_notes
  for each row execute function update_updated_at();

alter table contact_notes enable row level security;

drop policy if exists "Scoped select on contact_notes" on contact_notes;
create policy "Scoped select on contact_notes"
  on contact_notes for select
  using (can_see_contact(contact_id) and deleted_at is null);

drop policy if exists "Scoped insert on contact_notes" on contact_notes;
create policy "Scoped insert on contact_notes"
  on contact_notes for insert
  with check (can_see_contact(contact_id) and created_by = auth.uid());

-- Update cubre tanto editar el contenido como el soft delete
-- (deleted_at = now()): autor, o Admin/Owner del workspace.
drop policy if exists "Author or admin updates contact_notes" on contact_notes;
create policy "Author or admin updates contact_notes"
  on contact_notes for update
  using (
    deleted_at is null
    and (created_by = auth.uid() or is_workspace_admin(workspace_id))
  )
  with check (created_by = auth.uid() or is_workspace_admin(workspace_id));

-- Sin policy de delete para authenticated: siempre soft delete.
grant select, insert, update on contact_notes to authenticated;
