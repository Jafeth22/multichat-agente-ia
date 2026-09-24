-- ============================================================
-- CONTACTS: setter_id y vendedor_id, adelantados desde el Bloque 3 (F9/F11)
-- ============================================================
-- El scope de leads por RLS (Bloque 1, F3) tiene que poder filtrar por
-- "es setter, vendedor o asignado". Para eso hacen falta estas dos
-- columnas ahora. El resto del modelo de contacto extendido (telefono,
-- redes, atribucion, etc.) se agrega recien en el Bloque 3.
-- ============================================================

alter table contacts
  add column if not exists setter_id uuid references auth.users(id) on delete set null,
  add column if not exists vendedor_id uuid references auth.users(id) on delete set null;

create index if not exists idx_contacts_setter on contacts(setter_id);
create index if not exists idx_contacts_vendedor on contacts(vendedor_id);
