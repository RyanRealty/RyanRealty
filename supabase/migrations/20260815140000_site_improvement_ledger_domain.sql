-- THE LOOP v1.2.0: site_improvement_ledger scores every company domain,
-- not only Growth/SEO. Existing rows default to seo-aeo (that is what
-- the ledger recorded before this column existed).
-- docs/plans/COMPANY_IMPROVEMENT.md

alter table public.site_improvement_ledger
  add column if not exists domain text not null default 'seo-aeo';

alter table public.site_improvement_ledger
  drop constraint if exists site_improvement_ledger_domain_check;

alter table public.site_improvement_ledger
  add constraint site_improvement_ledger_domain_check
  check (domain in (
    'public-ux',
    'seo-aeo',
    'leads',
    'nurture',
    'social-presence',
    'sales-insights',
    'transactions',
    'broker-tools',
    'recruit-retain',
    'data-sync',
    'factory',
    'license-voice'
  ));

comment on column public.site_improvement_ledger.domain is
  'THE LOOP v1.2.0 company domain. Confidence is learned per (domain, change_class). docs/plans/COMPANY_IMPROVEMENT.md';

create index if not exists site_improvement_ledger_domain_class_idx
  on public.site_improvement_ledger (domain, change_class);
