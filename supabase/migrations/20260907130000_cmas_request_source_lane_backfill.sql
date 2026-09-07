-- CMA funnel mission (Matt 2026-09-07): "expireds/fsbo/seller valuation/and BPOs all using the
-- same engine but with their own nuances, easily managed and tracked."
--
-- 212 of 442 `cmas` rows carry a NULL `request_source`, so /admin/cmas cannot say which lane
-- they belong to and the send rule behind the button (asked → now, cold → weekday drip) has
-- nothing to route on. `request_source` did not exist as a column until 20260827110000, and
-- 20260827110000 could only recover the rows whose prose `generation_reason` named a source.
-- This recovers the rest from the prospect LINK tables, which the detection processors and the
-- prospecting dashboard both stamp at build time.
--
-- WHAT THIS CAN AND CANNOT PROVE
-- The link proves the LANE. It does not prove the TRIGGER: `expired_listings.cma_id` is written
-- by lib/expired-listing-processor.ts (requestSource 'expired-listing-cron') AND by
-- app/actions/prospecting.ts → linkProspectCma (requestSource 'expired-dashboard'), and the same
-- pair holds for FSBO. Writing 'expired-listing-cron' onto a row the dashboard may have built
-- would be a fabricated specific (CLAUDE.md §0). So the backfill writes 'expired-backfill' /
-- 'fsbo-backfill': lib/cma/origin.ts classifies both into the right lane, and the row still
-- admits its trigger was never recorded.
--
-- WHAT IT DELIBERATELY DOES NOT TOUCH
-- Every step is guarded by `request_source is null`. 15 of the 30 rows reachable from
-- fsbo_listings.cma_id already carry 'seller-lp' (9) or 'lead-form' (6) — a homeowner asked for
-- a value on a home a scraper independently found listed FSBO. Those people ASKED; overwriting
-- them to 'fsbo' would move them from send-now onto a cold drip and swap the email that opens
-- the document. The FSBO link is a prospect row pointing at a document it can serve, never a
-- claim about who requested it.
--
-- ORDER MATTERS. FSBO first, then expired-by-link, then the doc_type inference: several
-- FSBO-linked documents were built with doc_type 'expired-audit', and running the doc_type step
-- first would file them under the wrong lane and send them the expired story.

-- 1. FSBO lane, recovered from the link table (13 NULL-source rows at time of writing).
update public.cmas c
   set request_source = 'fsbo-backfill'
 where c.request_source is null
   and exists (select 1 from public.fsbo_listings f where f.cma_id = c.id);

-- 2. Expired lane, recovered from the link table.
update public.cmas c
   set request_source = 'expired-backfill'
 where c.request_source is null
   and exists (select 1 from public.expired_listings e where e.cma_id = c.id);

-- 3. Expired lane, inferred from doc_type. `expired-audit` is the only doc_type the expired path
--    produces and the only path that produces it (lib/cma/worker.ts threads it from the expired
--    detection payload; app/actions/prospecting.ts expectedDocTypeFor pins it to kind 'expired'),
--    which is why lib/cma/origin.ts already falls back to it. This records the inference on the
--    row instead of re-deriving it on every read.
update public.cmas
   set request_source = 'expired-backfill'
 where request_source is null
   and doc_type = 'expired-audit';

-- 4. THE REMAINDER STAYS NULL — 15 rows, listed here because "we left these alone" is a result,
--    not an omission. 8 are `zz-test-rebrand-*` integration-test fixtures that leaked into
--    production (3 of them marked delivered); 6 carry only a rebuild trigger in
--    generation_reason ('Deterministic build (cli-rebuild)'), which says how the document was
--    last built and nothing about who asked for it; 1 (cma-3480-sw-45th) carries a hand-typed
--    broker note. None of those is an unambiguous origin. An unknown origin classifies to
--    sendMode 'manual' — it can still be sent from the row itself, it just cannot ride a batch.

-- ── VERIFICATION (run after apply; each must hold) ──────────────────────────────────────────
--
-- a. Nothing that already had a source was overwritten. Expect 9 seller-lp + 6 lead-form
--    among the FSBO-linked rows, exactly as before:
--
--      select c.request_source, c.slug from public.cmas c
--        join (select distinct cma_id from public.fsbo_listings where cma_id is not null) f
--          on f.cma_id = c.id
--       order by c.request_source nulls last, c.slug;
--
-- b. Every FSBO-linked and expired-linked row now carries a source:
--
--      select c.slug from public.cmas c
--       where c.request_source is null
--         and (exists (select 1 from public.fsbo_listings f where f.cma_id = c.id)
--           or exists (select 1 from public.expired_listings e where e.cma_id = c.id));
--      -- expect zero rows
--
-- c. No expired-audit document is left without a source:
--
--      select slug from public.cmas where request_source is null and doc_type = 'expired-audit';
--      -- expect zero rows
--
-- d. The residue is exactly the 15 rows step 4 names:
--
--      select slug, generation_reason, status from public.cmas
--       where request_source is null order by created_at;
--      -- expect 15 rows: 8 zz-test-rebrand-*, cma-19496-tumalo-reservoir, cma-3480-sw-45th,
--      --   cma-5663-sw-impala, cma-655-sw-12th, cma-56628-sunstone, verify-latest-expired,
--      --   cma-909-nw-delaware
--
-- e. The lane census moves as expected — run the read-only script, which goes through the same
--    DAL read /admin/cmas renders, so the screen and the census cannot disagree:
--
--      npx tsx scripts/cma-lanes-check.ts
--
--    BEFORE (verified live 2026-09-07T18:40Z, 442 rows):
--      expired 378 · fsbo 2 · seller-valuation 18 · lead-form 8 · unknown 36
