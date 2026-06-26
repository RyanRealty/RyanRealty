-- Migration: crm_deal_detail_columns
-- Adds milestone dates, commission fields, and two child tables to crm_deals.

-- Add milestone + commission columns to crm_deals
alter table public.crm_deals
  add column if not exists close_date            date,
  add column if not exists earnest_money_due     date,
  add column if not exists mutual_acceptance     date,
  add column if not exists due_diligence         date,
  add column if not exists final_walkthrough     date,
  add column if not exists possession            date,
  add column if not exists commission_dollars    numeric,
  add column if not exists commission_percent    numeric,
  add column if not exists description           text,
  add column if not exists property_address      text,
  add column if not exists assigned_broker       text;

-- Commission splits per deal
create table if not exists public.crm_deal_splits (
  id              bigserial primary key,
  deal_id         bigint not null references public.crm_deals(id) on delete cascade,
  broker_slug     text not null,
  split_pct       numeric not null default 100,
  split_dollars   numeric,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists crm_deal_splits_deal_id_idx on public.crm_deal_splits(deal_id);

-- Files attached to a deal
create table if not exists public.crm_deal_files (
  id              bigserial primary key,
  deal_id         bigint not null references public.crm_deals(id) on delete cascade,
  name            text not null,
  storage_path    text,
  url             text,
  uploaded_by     text,
  created_at      timestamptz not null default now()
);
create index if not exists crm_deal_files_deal_id_idx on public.crm_deal_files(deal_id);
