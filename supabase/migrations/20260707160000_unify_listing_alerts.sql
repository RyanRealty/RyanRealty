-- Unify the two listing-alert models into ONE canonical table: listing_alerts.
--
-- Before this migration, listing alerts lived in two tables with parallel
-- semantics (audit: out/admin-audit/agent-f49b4acb-6a55-4eaf-952d-4f6568be04f8.md):
--   - saved_searches       signed-in users, keyed by user_id, is_paused (inverted),
--                          nullable filters_hash, NO db dedupe, email resolved at
--                          send time via the auth admin API
--   - guest_search_alerts  guests + broker/system-assigned, keyed by email,
--                          is_active, NOT NULL filters_hash, unique
--                          (email, filters_hash), origin/assigned_by/source
--
-- listing_alerts reconciles every divergence the audit's §(c) table lists:
--   - identity: email is ALWAYS stored (lowercased); user_id / crm_person_id /
--     fub_person_id are optional links stamped when known
--   - active flag: one boolean, is_active (no inverted is_paused)
--   - dedupe: unique (email, filters_hash) for every row, guest or signed-in
--   - provenance: origin/assigned_by/source on every row
--   - unsubscribe: ONE token namespace, NOT NULL + unique
--   - claim-on-sign-in: stamping user_id on existing email rows replaces the old
--     copy-to-saved_searches-then-deactivate flow (no more dual-table duplicates,
--     audit foot-gun #1)
--
-- The market-report model (crm_report_subscriptions) is a different product and
-- is deliberately untouched.
--
-- The saved_searches PUBLIC-search feature (is_public / public_title /
-- cache_listing_keys / public_click_count, read by getPopularPublicSearches)
-- stays on the legacy table. Only ALERT functionality moves off.
--
-- The legacy tables are NOT dropped here (the parent decides drop timing after
-- production verification); they are marked legacy via COMMENT ON TABLE.

-- ── 0. Clear the name collision with the 2026-05-18 expired-LP orphans ────────
-- Hosted production already carries a DIFFERENT table named listing_alerts
-- (migrations 20260518214244 + 20260519010231: source_lp / criteria / status /
-- consent_marketing shape, built for the expired-listing landing pages and
-- never wired up) plus its FK child listing_alert_matches. Verified 2026-07-07:
-- 0 rows in both, 0 code consumers (no file references their columns).
-- Shape-guarded on the absence of filters_hash so a re-run can NEVER touch the
-- canonical table below. The pair moves as a unit (the FK ties them): both
-- empty → drop child then parent; either holds rows → rename both out of the
-- way (the FK follows the renames).

DO $$
DECLARE legacy_rows bigint := 0;
DECLARE match_rows bigint := 0;
DECLARE has_matches boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'listing_alerts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listing_alerts'
      AND column_name = 'filters_hash'
  ) THEN
    has_matches := EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'listing_alert_matches'
    );
    SELECT count(*) INTO legacy_rows FROM public.listing_alerts;
    IF has_matches THEN
      SELECT count(*) INTO match_rows FROM public.listing_alert_matches;
    END IF;
    IF legacy_rows = 0 AND match_rows = 0 THEN
      IF has_matches THEN
        DROP TABLE public.listing_alert_matches;
      END IF;
      DROP TABLE public.listing_alerts;
    ELSE
      IF has_matches THEN
        ALTER TABLE public.listing_alert_matches RENAME TO listing_alert_matches_lp_legacy;
      END IF;
      ALTER TABLE public.listing_alerts RENAME TO listing_alerts_lp_legacy;
      COMMENT ON TABLE public.listing_alerts_lp_legacy IS
        'ORPHAN (renamed 2026-07-07): 2026-05-18 expired-LP alert capture table. No code consumers. Held rows at unification time so it was renamed instead of dropped.';
    END IF;
  END IF;
END
$$;

-- ── 1. Canonical table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.listing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Recipient address, stored lowercased + trimmed by the DAL. Always present:
  -- signed-in rows carry the account email so the send path never needs the
  -- auth admin API (closes the audit's "email via auth admin at send" split).
  email text NOT NULL,
  -- Auth user link when the subscriber is (or later becomes) a signed-in user.
  user_id uuid,
  -- CRM person link for open/click tracking attribution (crm_people.id).
  crm_person_id bigint,
  -- FUB legacy id for the compliance hard-stop + ?_fuid click attribution.
  fub_person_id bigint,
  name text NOT NULL,
  -- normalizeSavedSearchFilters output (lib/search-filters.ts).
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- getSavedSearchHash(normalizedFilters); NOT NULL so (email, filters_hash)
  -- dedupe holds for every row (legacy null hashes get a synthetic value below).
  filters_hash text NOT NULL,
  notification_frequency text NOT NULL DEFAULT 'daily'
    CHECK (notification_frequency IN ('instant', 'daily', 'weekly')),
  -- One boolean, true = receiving alerts. Replaces saved_searches.is_paused
  -- (inverted) and guest_search_alerts.is_active.
  is_active boolean NOT NULL DEFAULT true,
  -- Who created the alert: the subscriber themselves, a broker, or the system
  -- (e.g. neighborhood defaults).
  origin text NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'broker', 'system')),
  assigned_by text,
  source text NOT NULL DEFAULT 'user',
  unsubscribe_token text NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One alert per (email, search): re-submitting the same search re-activates +
  -- refreshes the row instead of duplicating (the DAL upserts on this pair).
  CONSTRAINT listing_alerts_email_hash_key UNIQUE (email, filters_hash)
);

-- Cron scan: active rows, most-overdue first.
CREATE INDEX IF NOT EXISTS idx_listing_alerts_active_notified
  ON public.listing_alerts (is_active, last_notified_at);

CREATE INDEX IF NOT EXISTS idx_listing_alerts_user
  ON public.listing_alerts (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listing_alerts_crm_person
  ON public.listing_alerts (crm_person_id)
  WHERE crm_person_id IS NOT NULL;

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
-- Authenticated users may read/update/delete their OWN rows (user_id =
-- auth.uid()). No insert policy: creation always goes through the service-role
-- DAL (which normalizes email + filters and stamps identity links). The service
-- role bypasses RLS for the cron/admin/broker paths.

ALTER TABLE public.listing_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'listing_alerts'
      AND policyname = 'listing_alerts_select_own'
  ) THEN
    CREATE POLICY listing_alerts_select_own ON public.listing_alerts
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'listing_alerts'
      AND policyname = 'listing_alerts_update_own'
  ) THEN
    CREATE POLICY listing_alerts_update_own ON public.listing_alerts
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'listing_alerts'
      AND policyname = 'listing_alerts_delete_own'
  ) THEN
    CREATE POLICY listing_alerts_delete_own ON public.listing_alerts
      FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END
$$;

-- ── 3. Data migration (lossless, idempotent) ──────────────────────────────────
-- Row counts at authoring time (2026-07-07): guest_search_alerts = 1,
-- saved_searches = 2. Guest rows migrate first (they carry the richer
-- provenance and the NOT NULL hash); saved_searches rows that collide on
-- (email, filters_hash) with an already-migrated guest row are skipped by
-- ON CONFLICT DO NOTHING (the guest row already represents that subscription;
-- the claim flow stamps user_id onto it on the user's next sign-in).
--
-- unsubscribe_token: preserved so token links in already-sent emails keep
-- working. If a token is somehow already present in listing_alerts (re-run, or
-- a cross-table collision), a fresh default is generated instead — the CASE
-- runs before the ON CONFLICT arbiter so a re-run can never trip the token
-- unique index.

-- 3a. guest_search_alerts → listing_alerts (columns map 1:1).
INSERT INTO public.listing_alerts (
  email, user_id, crm_person_id, fub_person_id, name, filters, filters_hash,
  notification_frequency, is_active, origin, assigned_by, source,
  unsubscribe_token, last_notified_at, created_at, updated_at
)
SELECT
  lower(trim(g.email)),
  NULL,
  g.crm_person_id,
  g.fub_person_id,
  COALESCE(NULLIF(trim(g.name), ''), 'Saved search'),
  COALESCE(g.filters, '{}'::jsonb),
  g.filters_hash,
  CASE WHEN lower(trim(g.notification_frequency)) IN ('instant', 'daily', 'weekly')
       THEN lower(trim(g.notification_frequency)) ELSE 'daily' END,
  g.is_active,
  CASE WHEN g.origin IN ('user', 'broker', 'system') THEN g.origin ELSE 'user' END,
  g.assigned_by,
  COALESCE(NULLIF(trim(g.source), ''), 'idx-registration'),
  CASE WHEN g.unsubscribe_token IS NULL
         OR EXISTS (SELECT 1 FROM public.listing_alerts t WHERE t.unsubscribe_token = g.unsubscribe_token)
       THEN gen_random_uuid()::text
       ELSE g.unsubscribe_token END,
  g.last_notified_at,
  g.created_at,
  COALESCE(g.updated_at, g.created_at)
FROM public.guest_search_alerts g
ON CONFLICT (email, filters_hash) DO NOTHING;

-- 3b. saved_searches → listing_alerts. Email resolves from auth.users (rows
-- whose auth user has no email cannot receive alerts and are skipped — they
-- remain intact in the legacy table). A null/blank filters_hash gets the
-- synthetic 's_legacy_<id>' value so the unique pair holds; the app recomputes
-- the real hash on the next edit. is_active = NOT is_paused.
INSERT INTO public.listing_alerts (
  email, user_id, crm_person_id, fub_person_id, name, filters, filters_hash,
  notification_frequency, is_active, origin, assigned_by, source,
  unsubscribe_token, last_notified_at, created_at, updated_at
)
SELECT
  lower(trim(u.email)),
  s.user_id,
  s.crm_person_id,
  NULL,
  COALESCE(NULLIF(trim(s.name), ''), 'Saved search'),
  COALESCE(s.filters, '{}'::jsonb),
  COALESCE(NULLIF(trim(s.filters_hash), ''), 's_legacy_' || s.id::text),
  CASE WHEN lower(trim(s.notification_frequency)) IN ('instant', 'daily', 'weekly')
       THEN lower(trim(s.notification_frequency)) ELSE 'daily' END,
  NOT s.is_paused,
  'user',
  NULL,
  'user',
  CASE WHEN s.unsubscribe_token IS NULL
         OR EXISTS (SELECT 1 FROM public.listing_alerts t WHERE t.unsubscribe_token = s.unsubscribe_token)
       THEN gen_random_uuid()::text
       ELSE s.unsubscribe_token END,
  s.last_notified_at,
  s.created_at,
  s.created_at
FROM public.saved_searches s
JOIN auth.users u ON u.id = s.user_id
WHERE u.email IS NOT NULL AND trim(u.email) <> ''
ON CONFLICT (email, filters_hash) DO NOTHING;

-- ── 4. Mark the legacy tables (NOT dropped here) ──────────────────────────────

COMMENT ON TABLE public.listing_alerts IS
  'Canonical listing-alert subscriptions (unified 2026-07-07 from saved_searches + guest_search_alerts). One row per (email, filters_hash). DAL: lib/data/leads/listingAlerts.ts.';

COMMENT ON TABLE public.guest_search_alerts IS
  'LEGACY (2026-07-07): alert rows migrated to public.listing_alerts. No code writes here anymore. Kept for verification; parent decides drop timing.';

COMMENT ON TABLE public.saved_searches IS
  'LEGACY for alerts (2026-07-07): alert rows migrated to public.listing_alerts. Still LIVE for the public-search feature (is_public / public_title / cache_listing_keys / public_click_count via app/actions/saved-searches.ts). Do not drop without migrating the public feature.';
