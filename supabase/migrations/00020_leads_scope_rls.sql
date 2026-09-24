-- ============================================================
-- SCOPE DE LEADS POR RLS (F3)
-- ============================================================
-- Un Member solo ve/edita los contactos y conversaciones donde es
-- setter, vendedor o (en conversaciones) el asignado. Owner y Admin
-- ven todo. Para los leads sin asignar, el workspace decide si los ve
-- cualquier Member o solo Owner/Admin (default: solo Owner/Admin).
-- Se aplica en la base de datos (RLS), no solo en la UI.
-- ============================================================

-- Valida que workspace_members.role sea siempre uno de los 3 roles
-- que soporta el sistema (antes no habia ningun constraint).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_role_check'
  ) then
    alter table workspace_members
      add constraint workspace_members_role_check check (role in ('owner', 'admin', 'member'));
  end if;
end $$;

-- Config del workspace: quien ve los leads sin asignar.
alter table workspaces
  add column if not exists unassigned_leads_visible_to text not null default 'owner_admin';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_unassigned_leads_visible_to_check'
  ) then
    alter table workspaces
      add constraint workspaces_unassigned_leads_visible_to_check
      check (unassigned_leads_visible_to in ('owner_admin', 'everyone'));
  end if;
end $$;

-- ------------------------------------------------------------
-- can_see_contact: helper de scope para la tabla contacts
-- ------------------------------------------------------------
create or replace function can_see_contact(p_contact_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_workspace_id uuid;
  v_setter_id uuid;
  v_vendedor_id uuid;
  v_visibility text;
begin
  select workspace_id, setter_id, vendedor_id
    into v_workspace_id, v_setter_id, v_vendedor_id
  from contacts
  where id = p_contact_id;

  if v_workspace_id is null or not is_workspace_member(v_workspace_id) then
    return false;
  end if;

  if is_workspace_admin(v_workspace_id) then
    return true;
  end if;

  if v_setter_id = auth.uid() or v_vendedor_id = auth.uid() then
    return true;
  end if;

  if v_setter_id is null and v_vendedor_id is null then
    select unassigned_leads_visible_to into v_visibility
    from workspaces where id = v_workspace_id;

    if v_visibility = 'everyone' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

-- ------------------------------------------------------------
-- can_see_conversation: helper de scope para conversations/messages.
-- Ademas de setter/vendedor del contacto, suma el assigned_to propio
-- de la conversacion.
-- ------------------------------------------------------------
create or replace function can_see_conversation(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_workspace_id uuid;
  v_assigned_to uuid;
  v_contact_id uuid;
  v_setter_id uuid;
  v_vendedor_id uuid;
  v_visibility text;
begin
  select conv.workspace_id, conv.assigned_to, conv.contact_id
    into v_workspace_id, v_assigned_to, v_contact_id
  from conversations conv
  where conv.id = p_conversation_id;

  if v_workspace_id is null or not is_workspace_member(v_workspace_id) then
    return false;
  end if;

  if is_workspace_admin(v_workspace_id) then
    return true;
  end if;

  if v_assigned_to = auth.uid() then
    return true;
  end if;

  if v_contact_id is not null then
    select setter_id, vendedor_id into v_setter_id, v_vendedor_id
    from contacts where id = v_contact_id;

    if v_setter_id = auth.uid() or v_vendedor_id = auth.uid() then
      return true;
    end if;
  end if;

  if v_assigned_to is null and v_setter_id is null and v_vendedor_id is null then
    select unassigned_leads_visible_to into v_visibility
    from workspaces where id = v_workspace_id;

    if v_visibility = 'everyone' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

revoke all on function can_see_contact(uuid) from public;
revoke all on function can_see_conversation(uuid) from public;
grant execute on function can_see_contact(uuid) to authenticated;
grant execute on function can_see_conversation(uuid) to authenticated;

-- ------------------------------------------------------------
-- CONTACTS: reemplaza el scope "todo el workspace" por el scope de leads
-- ------------------------------------------------------------
drop policy if exists "Users can view contacts in their workspaces" on contacts;
drop policy if exists "Users can manage contacts in their workspaces" on contacts;

create policy "Scoped select on contacts"
  on contacts for select
  using (can_see_contact(id));

create policy "Workspace members can create contacts"
  on contacts for insert
  with check (is_workspace_member(workspace_id));

create policy "Scoped update on contacts"
  on contacts for update
  using (can_see_contact(id))
  with check (can_see_contact(id));

create policy "Scoped delete on contacts"
  on contacts for delete
  using (can_see_contact(id));

-- ------------------------------------------------------------
-- CONVERSATIONS: idem
-- ------------------------------------------------------------
drop policy if exists "Users can view conversations in their workspaces" on conversations;
drop policy if exists "Users can manage conversations in their workspaces" on conversations;

create policy "Scoped select on conversations"
  on conversations for select
  using (can_see_conversation(id));

create policy "Workspace members can create conversations"
  on conversations for insert
  with check (is_workspace_member(workspace_id));

create policy "Scoped update on conversations"
  on conversations for update
  using (can_see_conversation(id))
  with check (can_see_conversation(id));

create policy "Scoped delete on conversations"
  on conversations for delete
  using (can_see_conversation(id));

-- ------------------------------------------------------------
-- MESSAGES: heredan el scope de su conversation
-- ------------------------------------------------------------
drop policy if exists "Users can view messages via conversation" on messages;
drop policy if exists "Users can insert messages via conversation" on messages;

create policy "Scoped select on messages"
  on messages for select
  using (can_see_conversation(conversation_id));

create policy "Scoped insert on messages"
  on messages for insert
  with check (can_see_conversation(conversation_id));
