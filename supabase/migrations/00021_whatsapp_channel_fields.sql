-- ============================================================
-- CHANNELS: campos para instancias de WhatsApp (Evolution API) (F6)
-- ============================================================
-- 'whatsapp' ya es una plataforma valida en channels (migracion 00016).
-- Evolution API no usa OAuth como Zernio: conecta por instancia + QR.
-- Se reutiliza la tabla channels existente (no se crea una tabla aparte)
-- sumando los campos que ese flujo necesita.
-- ============================================================

alter table channels
  add column if not exists evolution_instance_name text,
  add column if not exists connection_status text not null default 'disconnected',
  add column if not exists qr_code text,
  add column if not exists last_connected_at timestamptz,
  add column if not exists disconnected_at timestamptz,
  add column if not exists disconnected_notified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'channels_connection_status_check'
  ) then
    alter table channels
      add constraint channels_connection_status_check
      check (connection_status in ('disconnected', 'connecting', 'connected', 'error'));
  end if;
end $$;

create unique index if not exists idx_channels_evolution_instance
  on channels(evolution_instance_name)
  where evolution_instance_name is not null;
