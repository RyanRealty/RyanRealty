-- Principal-broker document review record (OAR 863-015-0140).
--
-- Oregon law (OAR 863-015-0140(4), verified 2026-06-13 against
-- https://oregon.public.law/rules/oar_863-015-0140): "The principal broker must
-- review each document of agreement generated in a real estate transaction
-- within seven banking days after it has been accepted, rejected, or withdrawn."
-- Electronic review must "make an electronic record of the review showing the
-- name of the reviewer and the date of the review."
--
-- This table IS that electronic record: one immutable row per principal-broker
-- review action, capturing reviewer name + date. Append-only (a compliance
-- artifact must not be editable after the fact).

create table if not exists public.tc_principal_reviews (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.tc_deals(id) on delete cascade,
  cycle_id uuid references public.tc_cycles(id) on delete cascade,
  item_id uuid references public.tc_checklist_items(id) on delete set null,
  item_name text,                                   -- snapshot of what was reviewed
  document_ids jsonb not null default '[]'::jsonb,  -- the documents under that item at review time
  reviewer_email text not null,
  reviewer_name text not null,                      -- the rule's "name of the reviewer"
  reviewed_at timestamptz not null default now(),   -- the rule's "date of the review"
  decision text not null check (decision in ('approved', 'sent_back')),
  note text,
  rule_basis text not null default 'OAR 863-015-0140',
  created_at timestamptz not null default now()
);

comment on table public.tc_principal_reviews is
  'Immutable principal-broker review record per OAR 863-015-0140 (reviewer name + date per document of agreement).';

alter table public.tc_principal_reviews enable row level security;
-- zero policies = service-role only (the admin surface reaches it via service role)

create index if not exists tc_principal_reviews_deal_idx on public.tc_principal_reviews(deal_id);
create index if not exists tc_principal_reviews_item_idx on public.tc_principal_reviews(item_id);
create index if not exists tc_principal_reviews_reviewer_idx on public.tc_principal_reviews(reviewer_email);

-- Append-only: block UPDATE/DELETE even for the service role, so the compliance
-- record is tamper-evident (mirrors the tc_events guarantee).
create or replace function public.tc_principal_reviews_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'tc_principal_reviews is append-only (OAR 863-015-0140 review record)';
end;
$$;

drop trigger if exists tc_principal_reviews_no_mutate on public.tc_principal_reviews;
create trigger tc_principal_reviews_no_mutate
  before update or delete on public.tc_principal_reviews
  for each row execute function public.tc_principal_reviews_immutable();
