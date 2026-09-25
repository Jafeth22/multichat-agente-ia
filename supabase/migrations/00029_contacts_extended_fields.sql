-- ============================================================
-- CONTACTS: modelo extendido (F9) + atribucion (F10)
-- ============================================================
-- setter_id y vendedor_id ya se agregaron en el Bloque 1 (00019), los
-- necesitaba el scope de leads por RLS desde ese momento. Este bloque
-- suma el resto: identidad (telefono, redes, pais), seguimiento,
-- "no contactar", resumen de IA, temperatura del lead, soft delete y
-- el JSONB de atribucion (first_click / last_click).
--
-- phone y whatsapp_phone se normalizan a formato internacional
-- (+XX...) desde la app antes de guardarse (lib/phone.ts); esta
-- migracion no valida el formato, solo guarda texto.
-- instagram_username se guarda sin "@".
-- ============================================================

alter table contacts
  add column if not exists phone text,
  add column if not exists secondary_email text,
  add column if not exists country text,
  add column if not exists instagram_username text,
  add column if not exists tiktok_username text,
  add column if not exists youtube_channel_id text,
  add column if not exists linkedin_profile_url text,
  add column if not exists whatsapp_phone text,
  add column if not exists twitter_username text,
  add column if not exists facebook_id text,
  add column if not exists next_followup_date timestamptz,
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists do_not_contact_reason text,
  add column if not exists do_not_contact_at timestamptz,
  add column if not exists ai_conversation_summary text,
  add column if not exists lead_temperature text,
  add column if not exists deleted_at timestamptz,
  add column if not exists attribution jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_lead_temperature_check'
  ) then
    alter table contacts
      add constraint contacts_lead_temperature_check
      check (lead_temperature is null or lead_temperature in ('cold', 'warm', 'hot'));
  end if;
end $$;

create index if not exists idx_contacts_phone on contacts(phone) where phone is not null;
create index if not exists idx_contacts_email on contacts(email) where email is not null;
create index if not exists idx_contacts_instagram_username on contacts(instagram_username) where instagram_username is not null;
create index if not exists idx_contacts_tiktok_username on contacts(tiktok_username) where tiktok_username is not null;
create index if not exists idx_contacts_whatsapp_phone on contacts(whatsapp_phone) where whatsapp_phone is not null;
create index if not exists idx_contacts_deleted_at on contacts(deleted_at);

-- Deduplicacion cross-canal (F12): busquedas exactas por telefono/email
-- dentro del workspace, excluyendo lo borrado.
create index if not exists idx_contacts_workspace_phone on contacts(workspace_id, phone) where phone is not null and deleted_at is null;
create index if not exists idx_contacts_workspace_email on contacts(workspace_id, email) where email is not null and deleted_at is null;
