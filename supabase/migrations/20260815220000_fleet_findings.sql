-- External verification fleet (Grok Bots) findings inbox.
-- Bots browse production like users and POST findings to /api/fleet/findings;
-- scripts/fleet-intake.ts converts validated findings into loop_work_nodes.
-- THE LOOP v1.6.0.

create table if not exists public.fleet_findings (
  id uuid primary key default gen_random_uuid(),
  bot text not null,
  case_id text,
  url text not null,
  viewport text,
  expected text not null,
  observed text not null,
  severity text not null default 'minor',
  evidence text,
  domain text,
  status text not null default 'new',
  fingerprint text not null,
  node_id uuid,
  created_at timestamptz not null default now(),
  triaged_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fleet_findings_severity_check') then
    alter table public.fleet_findings
      add constraint fleet_findings_severity_check check (severity in ('p0','major','minor','info'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fleet_findings_status_check') then
    alter table public.fleet_findings
      add constraint fleet_findings_status_check check (status in ('new','confirmed','node_created','duplicate','rejected'));
  end if;
end $$;

-- One row per distinct defect per bot run wave; repeat sightings dedupe here.
create unique index if not exists fleet_findings_fingerprint_uq on public.fleet_findings(fingerprint);
create index if not exists fleet_findings_status_idx on public.fleet_findings(status);

alter table public.fleet_findings enable row level security;
-- Service-role only; the API route authenticates with the fleet secret.
