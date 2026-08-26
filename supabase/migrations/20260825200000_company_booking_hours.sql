-- Bookable hours for the public /book surface (Matt 2026-08-25).
--
-- WHY NOT REUSE office_hours. crm_company_settings.office_hours already exists
-- and has the right SHAPE, but it means something else: it gates INBOUND CALL
-- ROUTING (lib/crm/office-hours.isWithinOfficeHours), where an EMPTY list means
-- "always open" and a populated list starts sending after-hours calls to
-- voicemail. Filling it in to make booking work would silently change what
-- happens when a lead phones at 7pm. So booking gets its own column, sharing
-- the OfficeHoursBlock vocabulary but not the semantics.
--
-- The two also disagree about empty on purpose: empty office_hours = phones
-- always ring; empty booking_hours = nothing is offerable. Failing open on a
-- ringing phone is harmless. Failing open on a calendar would publish bookable
-- time nobody agreed to.
--
-- Seeded Mon-Fri 9:00-17:00 Pacific so /book works the moment it ships.

alter table public.crm_company_settings
  add column if not exists booking_hours jsonb not null default '[]'::jsonb;

update public.crm_company_settings
set booking_hours = '[{"days":["Mon","Tue","Wed","Thu","Fri"],"start_time":"09:00","end_time":"17:00"}]'::jsonb
where booking_hours = '[]'::jsonb;

comment on column public.crm_company_settings.booking_hours is
  'Bookable windows for the public /book page (OfficeHoursBlock[]). Empty = booking closed. Distinct from office_hours, which gates inbound call routing.';
