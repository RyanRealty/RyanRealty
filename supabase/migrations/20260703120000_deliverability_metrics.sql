-- Newsletter Phase 5b (spec §6.7): Google Postmaster Tools reputation snapshots.
-- A daily cron (/api/cron/postmaster-sync) upserts per-domain, per-day traffic
-- stats from gmailpostmastertools.googleapis.com; the pre-send guard reads the
-- latest row for news.ryan-realty.com and BLOCKS a large bulk send on Gmail
-- LOW/BAD reputation or spam_ratio > 0.30% (G-NL-20), with a no-data → warm-up
-- fallback. domain_reputation is Gmail's HIGH|MEDIUM|LOW|BAD verdict.
create table if not exists public.deliverability_metrics (
  id                    bigint generated always as identity primary key,
  domain                text not null,
  metric_date           date not null,
  spam_ratio            numeric,
  domain_reputation     text,
  ip_reputation_summary jsonb not null default '[]'::jsonb,
  spf_ok                boolean,
  dkim_ok               boolean,
  dmarc_ok              boolean,
  delivery_errors       jsonb not null default '[]'::jsonb,
  fetched_at            timestamptz not null default now(),
  unique (domain, metric_date)
);
create index if not exists deliverability_metrics_domain_date_idx
  on public.deliverability_metrics (domain, metric_date desc);
comment on table public.deliverability_metrics is
  'Google Postmaster Tools daily reputation per sending domain (spec §6.7). Pre-send guard reads the latest news.ryan-realty.com row to gate large sends (G-NL-20).';
