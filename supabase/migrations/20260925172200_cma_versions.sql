-- Snapshot a CMA row plus its comps before a rebuild overwrites them.
-- RLS matches public.cmas: enabled, zero policies, anon/authenticated revoked.
-- Service role (the only writer) bypasses RLS.
-- Not applied in this delivery; file only.

alter table public.cmas
  add column if not exists build_failed_at timestamptz;

comment on column public.cmas.build_failed_at is
  'When the last rebuild failed. The prior document, pricing and comps stay on the row; only build_error is written with this stamp.';

create table if not exists public.cma_versions (
  id uuid primary key default gen_random_uuid(),
  cma_id uuid not null references public.cmas (id) on delete cascade,
  slug text not null,
  snapshot jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists cma_versions_cma_id_created_idx
  on public.cma_versions (cma_id, created_at desc);

create index if not exists cma_versions_slug_created_idx
  on public.cma_versions (slug, created_at desc);

comment on table public.cma_versions is
  'Point-in-time copies of public.cmas + public.cma_comps taken before a rebuild overwrites the live row.';

alter table public.cma_versions enable row level security;
revoke all on public.cma_versions from anon;
revoke all on public.cma_versions from authenticated;
