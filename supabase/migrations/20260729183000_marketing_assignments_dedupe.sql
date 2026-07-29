-- marketing_assignments: one row per assignment, not one row per event (F8).
--
-- The ledger was written with a plain INSERT from six call sites
-- (lib/canonical-lead-tagger.ts, the seller / buyer / expired / FSBO LP actions,
-- and the Meta lead webhook), so it grew a row every time a lead re-touched the
-- site rather than a row per assignment. A live production audit measured ONE
-- test buyer producing 16 rows in a few hours: 12 identical
-- `buyer / matt / idx-registration / warm` rows (one per saved-search action),
-- 3 `seller / matt / cma-request / warm`, 1 `seller / rebecca / seller-lp`.
-- Every dashboard counting "assignments" over-reported by roughly an order of
-- magnitude for any active lead.
--
-- Measured on production 2026-07-29, immediately before this migration:
--   before: 23 rows, 21 distinct (fub_person_id, audience, source) grains
--   after:  21 rows  (2 rows collapsed, across 2 duplicate groups)
--           2 survivors have assigned_at rewound to their group's first touch
--   0 rows carry a NULL fub_person_id or a NULL source, so the backfill's
--   NOT NULL guard excludes nothing today.
-- The 16-row test-lead burst measured by the audit is no longer present in the
-- table (the newest surviving row is 2026-07-23); the code path that produced
-- it is still live, which is what the unique index below closes.
--
-- GRAIN: (fub_person_id, audience, source).
--   - audience is in the key so the same person can be both a buyer and a
--     seller. Collapsing to person-only would erase that split.
--   - source is in the key so two genuinely different acquisition doors stay
--     two rows. Production already has that case: crm person 13168 arrived via
--     `idx-registration` and later via `contact-form`. A person+audience-only
--     grain would have wrongly merged those two touches.
--   - broker and tier are NOT in the key. A re-route to another broker, or a
--     lead warming nurture -> hot, is a state change to an existing assignment;
--     the writer UPDATEs broker / fub_user_id / tier in place. Keying on them
--     would re-open the churn on every routing flip and leave two rows both
--     claiming the same lead.
--
-- assigned_at semantics: FIRST touch. The writer
-- (lib/data/crm/recordMarketingAssignment.ts) omits assigned_at from the upsert
-- payload, so the column default stamps it on INSERT and PostgREST leaves it
-- alone on the ON CONFLICT DO UPDATE path. Step 1 below applies the same rule
-- retroactively: the surviving row keeps the LATEST state (broker, tier,
-- fub_user_id, notes) but inherits the EARLIEST timestamp of the group it
-- absorbs, so collapsing duplicates cannot drag a lead's attribution date
-- forward into a window it did not originate in.
--
-- No readers to break: as of this migration nothing in the codebase SELECTs
-- from marketing_assignments. The dashboards moved to getLeadIntake
-- (lib/data/crm/getLeadIntake.ts) at the 2026-06-24 CRM cutover, and broker
-- routing moved to lib/crm/lead-routing.ts. The table is now write-only audit.
--
-- NOT CONCURRENTLY, deliberately: CREATE INDEX CONCURRENTLY cannot run inside a
-- transaction, and this file must stay transactional because the backfill has to
-- commit atomically with the index that depends on it. The table holds 23 rows,
-- so the ACCESS EXCLUSIVE lock is sub-millisecond and blocks nothing. If this
-- table ever grows to a size where that stops being true, split the file: run
-- the backfill transactionally first, then CREATE UNIQUE INDEX CONCURRENTLY on
-- its own outside any transaction, and note that the operator must not wrap it.
--
-- Re-runnable: step 1 no-ops once every group is a singleton (min = the row's
-- own value, and the IS DISTINCT FROM guard skips it), step 2 finds no rn > 1
-- rows, and step 3 is IF NOT EXISTS. Safe to replay.

-- ---------------------------------------------------------------------------
-- 1 + 2. Backfill: collapse each grain to its most recent row, carrying the
--        group's first-touch timestamp onto the survivor.
--
-- Both operations live in ONE statement on purpose. Every CTE here reads the
-- same snapshot, so `ranked` is computed once and the UPDATE cannot perturb the
-- row_number() the DELETE depends on. Running them as two sequential statements
-- would be wrong: step 1 rewrites the survivor's assigned_at to the group
-- minimum, which would re-rank it BELOW the rows step 2 is supposed to delete.
-- The two sub-statements touch disjoint rows (rn = 1 vs rn > 1), so there is no
-- "update the same row twice" hazard, and a data-modifying CTE is executed
-- exactly once whether or not the primary query references its output.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY fub_person_id, audience, source
      ORDER BY assigned_at DESC, id DESC
    ) AS rn,
    min(assigned_at) OVER (
      PARTITION BY fub_person_id, audience, source
    ) AS first_assigned_at
  FROM public.marketing_assignments
  -- NULL keys cannot dedupe under a NULLS-DISTINCT unique index, so leave them
  -- exactly as they are rather than inventing a merge rule the index won't hold.
  WHERE fub_person_id IS NOT NULL
    AND source IS NOT NULL
),
keep_first_touch AS (
  UPDATE public.marketing_assignments m
     SET assigned_at = r.first_assigned_at
    FROM ranked r
   WHERE m.id = r.id
     AND r.rn = 1
     AND m.assigned_at IS DISTINCT FROM r.first_assigned_at
  RETURNING m.id
)
DELETE FROM public.marketing_assignments m
 USING ranked r
 WHERE m.id = r.id
   AND r.rn > 1;

-- ---------------------------------------------------------------------------
-- 3. The unique index the upsert arbitrates on.
--
-- Plain unique index, NOT partial. PostgREST emits `ON CONFLICT (cols) DO
-- UPDATE` with no index predicate, and Postgres can only infer a PARTIAL unique
-- index when the predicate is supplied — a partial index here would make every
-- upsert fail with "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Rows with a NULL fub_person_id or NULL source therefore never
-- conflict and always insert, which is the pre-existing behavior for those rows.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS marketing_assignments_person_audience_source_key
  ON public.marketing_assignments (fub_person_id, audience, source);

COMMENT ON INDEX public.marketing_assignments_person_audience_source_key IS
  'Dedupe grain for the assignment ledger (F8, 2026-07-29): one row per person per audience per acquisition source. Arbiter for the upsert in lib/data/crm/recordMarketingAssignment.ts. broker/tier are mutable state on the row, never part of the key.';

COMMENT ON COLUMN public.marketing_assignments.assigned_at IS
  'FIRST touch for this (fub_person_id, audience, source) assignment. The writer omits it from the upsert payload, so it is stamped once on INSERT and preserved across every repeat event. Do not refresh it — date-window lead reporting buckets on this column.';

COMMENT ON TABLE public.marketing_assignments IS
  'Assignment ledger for inbound lead intake: one row per person per audience per acquisition source, upserted via lib/data/crm/recordMarketingAssignment.ts. Write-only audit trail as of the 2026-06-24 CRM cutover — lead counts come from lib/data/crm/getLeadIntake.ts and broker routing from lib/crm/lead-routing.ts, neither of which reads this table.';
