-- Buyer-lead attribution column on content_performance, mirroring
-- north_star_attributed_seller_leads. The buyer-lead-attribution cron increments
-- this when a buyer FUB lead's sourceUrl utm_content (= an action_id) matches a
-- content_performance row, so paid buyer-ad creative can be tied back to leads.
-- Additive + default 0 → safe, no backfill needed.
alter table public.content_performance
  add column if not exists north_star_attributed_buyer_leads integer not null default 0;
