-- ============================================================
-- SOFT DELETE (F15)
-- ============================================================
-- contacts.deleted_at y contact_notes.deleted_at ya se agregaron en
-- 00029 y 00031. Esta migracion:
-- 1. Agrega deleted_at a conversations.
-- 2. Actualiza las policies de SELECT de contacts/conversations para
--    ocultar lo borrado (ademas del filtro que ya hacen las pantallas).
-- 3. Saca las policies de DELETE de contacts/conversations para
--    authenticated: "Eliminar" siempre es deleted_at = now() (UPDATE),
--    nunca un DELETE de verdad. El borrado definitivo solo lo hace el
--    cron de purga (/api/cron/purge-deleted) con el service role, que
--    no pasa por RLS.
--
-- response_templates no existe todavia (llega en el Bloque 4): cuando
-- se cree, su migracion tiene que sumarle deleted_at desde el arranque.
-- ============================================================

alter table conversations
  add column if not exists deleted_at timestamptz;

create index if not exists idx_conversations_deleted_at on conversations(deleted_at);

-- ------------------------------------------------------------
-- CONTACTS
-- ------------------------------------------------------------
drop policy if exists "Scoped select on contacts" on contacts;
create policy "Scoped select on contacts"
  on contacts for select
  using (can_see_contact(id) and deleted_at is null);

-- El UPDATE se mantiene sin el filtro de deleted_at en el USING para
-- una excepcion puntual: la propia accion de "eliminar" es un UPDATE
-- que pone deleted_at = now() sobre una fila que todavia no esta
-- borrada, asi que el USING (evaluado sobre la fila vieja) ya la deja
-- pasar. Una vez borrada, can_see_contact() sigue siendo true pero no
-- hay forma de "reeditarla" desde la UI (no hay boton de restaurar);
-- si mas adelante se quiere bloquear tambien el UPDATE sobre lo ya
-- borrado, se puede sumar "and deleted_at is null" aca.

drop policy if exists "Scoped delete on contacts" on contacts;

-- ------------------------------------------------------------
-- CONVERSATIONS
-- ------------------------------------------------------------
drop policy if exists "Scoped select on conversations" on conversations;
create policy "Scoped select on conversations"
  on conversations for select
  using (can_see_conversation(id) and deleted_at is null);

drop policy if exists "Scoped delete on conversations" on conversations;

-- ------------------------------------------------------------
-- MESSAGES: heredan el scope de su conversation, que ya filtra
-- deleted_at via can_see_conversation -> conversations (no hace falta
-- tocar su policy, can_see_conversation ya solo mira conversaciones
-- vivas indirectamente porque la fila de conversations sigue
-- existiendo con deleted_at set; se deja pasar el mensaje mientras la
-- conversacion no se purgo de verdad, que es el comportamiento
-- esperado durante la ventana de 30 dias).
-- ------------------------------------------------------------
