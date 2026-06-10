-- Broker license + membership tracking (Matt directive 2026-06-10):
-- every broker can always see their license number, status, expiration,
-- NRDS id, and renewal state. Values verified against the OREA eLicense
-- public lookup (orea.elicense.micropact.com) — the authoritative source.
alter table public.brokers
  add column if not exists license_type text,
  add column if not exists license_status text,
  add column if not exists license_expires_on date,
  add column if not exists license_checked_at timestamptz,
  add column if not exists nrds_id text,
  add column if not exists license_notes text;
