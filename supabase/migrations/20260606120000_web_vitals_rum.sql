-- Real-user Core Web Vitals (RUM). Captures LCP / INP / CLS / FCP / TTFB from
-- real visitors via next/web-vitals -> /api/web-vitals, so the scoreboard shows
-- the FIELD numbers Google actually ranks on (lab ≠ field, and we had neither).
create table if not exists public.web_vitals (
  id uuid primary key default gen_random_uuid(),
  metric text not null,                 -- LCP | INP | CLS | FCP | TTFB | FID
  value double precision not null,      -- ms (CLS is unitless)
  rating text,                          -- good | needs-improvement | poor
  path text,                            -- page path the sample came from
  navigation_type text,                 -- navigate | reload | back-forward | prerender
  device text,                          -- mobile | desktop (viewport-derived)
  created_at timestamptz not null default now()
);
create index if not exists web_vitals_metric_created_idx on public.web_vitals (metric, created_at desc);
-- Service-role only (the /api/web-vitals ingest + the admin scoreboard use the
-- service client, which bypasses RLS). RLS on with no policies = deny-by-default
-- for the anon/auth roles.
alter table public.web_vitals enable row level security;
