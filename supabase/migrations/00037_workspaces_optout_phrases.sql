-- ============================================================
-- FRASES DE "NO CONTACTAR" (F18)
-- ============================================================
-- Lista configurable por workspace de frases que, detectadas en un
-- mensaje entrante, marcan al contacto como do_not_contact=true
-- (columnas ya agregadas en 00029). Se guarda separada de
-- global_keywords (que es un feature distinto: dispara flows por
-- match exacto, ver app/api/webhooks/late/route.ts) porque el
-- matching de opt-out es por substring, no exacto.
--
-- workspaces ya tiene RLS de update admin-only (00025), no hace
-- falta ninguna policy nueva.
-- ============================================================

alter table workspaces
  add column if not exists optout_phrases jsonb not null default
    '["no me escribas más","dejá de mandar mensajes","no quiero recibir mensajes","stop","unsubscribe","basta","no me contactes"]'::jsonb;
