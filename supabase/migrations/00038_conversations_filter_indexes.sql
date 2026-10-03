-- ============================================================
-- INDICES DE SOPORTE PARA FILTROS DE BANDEJA (F16) Y AUTO-ASIGNACION
-- ============================================================
-- conversations.assigned_to ya existe desde 00001 pero nada lo escribia
-- hasta ahora (Bloque 4: auto-asignacion al responder + filtro "Sin
-- asignar" / "asignado a X" del inbox). Sin cambios de RLS, solo
-- indices para que esos filtros no escaneen toda la tabla.
-- ============================================================

create index if not exists idx_conversations_assigned_to
  on conversations(assigned_to) where deleted_at is null;

create index if not exists idx_conversations_workspace_last_message
  on conversations(workspace_id, last_message_at desc) where deleted_at is null;
