-- content_classification + audit_runs
--
-- Adds the two tables the marketing brain's audit-run pipeline needs:
--
-- content_classification — per-post LLM tags produced by the classifier
--   pass over scraped competitor_intel rows. One row per (post, audit_id).
--   Generated columns expose topic + confidence for indexed filtering
--   without parsing jsonb at query time.
--
-- audit_runs — one row per audit cycle (~quarterly). Tracks scope,
--   status, cost, and the resulting analyze:audit_findings action row.
--
-- Reference: marketing_brain_skills/audit-findings/PROTOCOL.md +
-- marketing_brain_skills/tools_registry/classifier/SKILL.md.

-- ============================================================
-- 1. content_classification
-- ============================================================

create table if not exists public.content_classification (
  id uuid primary key default gen_random_uuid(),

  post_id uuid references public.competitor_intel(id) on delete cascade,
  audit_id text not null,

  classified_at timestamptz not null default now(),
  model_used text not null,
  classification jsonb not null,

  -- Generated columns for indexed filtering
  topic text generated always as ((classification ->> 'topic')) stored,
  confidence numeric generated always as ((classification ->> 'topic_confidence')::numeric) stored,
  format text generated always as ((classification ->> 'format')) stored,
  engagement_rate numeric generated always as ((classification ->> 'engagement_rate')::numeric) stored,

  -- Raw rationale for filtering low-confidence escalations
  rationale text,

  -- Cost tracking
  cost_usd numeric default 0,

  -- Full raw response for audit + replay
  raw_response jsonb,

  -- Idempotency — one classification per (post, audit) tuple
  unique (post_id, audit_id)
);

create index if not exists content_classification_post_idx
  on public.content_classification (post_id);

create index if not exists content_classification_audit_idx
  on public.content_classification (audit_id);

create index if not exists content_classification_topic_idx
  on public.content_classification (topic);

create index if not exists content_classification_format_idx
  on public.content_classification (format);

create index if not exists content_classification_low_confidence_idx
  on public.content_classification (confidence)
  where confidence < 0.6;

create index if not exists content_classification_engagement_idx
  on public.content_classification (engagement_rate desc);

grant select, insert, update, delete on public.content_classification to service_role;

-- ============================================================
-- 2. audit_runs
-- ============================================================

create table if not exists public.audit_runs (
  id uuid primary key default gen_random_uuid(),

  -- Human-friendly id; matches docs/marketing-brain/audit-YYYY-MM-DD.md
  -- and the target column on the resulting analyze:audit_findings row.
  audit_id text not null unique,

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  -- Lifecycle: running -> scraping -> classifying -> aggregating ->
  -- publishing -> published. 'killed' is terminal.
  status text not null default 'running'
    check (status in ('running', 'scraping', 'classifying', 'aggregating', 'publishing', 'published', 'killed')),

  -- Scope parameters
  window_days integer not null default 180,
  platforms_scraped text[] default array[]::text[],

  -- Counters (populated as the audit progresses)
  competitors_scraped integer default 0,
  competitors_with_data integer default 0,
  posts_scraped integer default 0,
  posts_classified integer default 0,

  -- Cost tracking
  apify_cost_usd numeric default 0,
  classifier_cost_usd numeric default 0,

  -- The resulting analyze:audit_findings row (FK to marketing_brain_actions)
  findings_action_id uuid references public.marketing_brain_actions(id) on delete set null,

  -- Path to the markdown report
  report_path text,

  -- Soft-fail errors during the run
  errors jsonb default '[]'::jsonb
);

create index if not exists audit_runs_audit_id_idx
  on public.audit_runs (audit_id);

create index if not exists audit_runs_status_idx
  on public.audit_runs (status);

create index if not exists audit_runs_started_idx
  on public.audit_runs (started_at desc);

grant select, insert, update, delete on public.audit_runs to service_role;

-- ============================================================
-- 3. audit_winners view (aggregated top-quartile combos)
-- ============================================================

-- Re-creatable view; aggregates content_classification by topic + format
-- and surfaces the top-quartile by engagement_rate. Used by the
-- generate-audit-findings builder to populate the missing_producers
-- payload.

create or replace view public.audit_winners as
select
  cc.audit_id,
  cc.topic,
  cc.format,
  count(*) as post_count,
  percentile_cont(0.5) within group (order by cc.engagement_rate) as median_engagement,
  percentile_cont(0.75) within group (order by cc.engagement_rate) as p75_engagement,
  array_agg(distinct ci.competitor) as competitors,
  -- 5 sample post urls from the top-quartile by engagement_rate
  (
    select array_agg(url)
    from (
      select ci2.url
      from public.content_classification cc2
      join public.competitor_intel ci2 on ci2.id = cc2.post_id
      where cc2.audit_id = cc.audit_id
        and cc2.topic = cc.topic
        and cc2.format = cc.format
        and ci2.url is not null
      order by cc2.engagement_rate desc nulls last
      limit 5
    ) as samples
  ) as sample_post_urls
from public.content_classification cc
join public.competitor_intel ci on ci.id = cc.post_id
where cc.topic is not null
  and cc.format is not null
  and cc.engagement_rate is not null
group by cc.audit_id, cc.topic, cc.format
having count(*) >= 5;

grant select on public.audit_winners to service_role;
