-- ============================================================================
-- Visitor tracking foundation (source-agnostic)
-- ============================================================================
-- Purpose: capture every page view on ANY Ryan Realty surface (today:
-- ryan-realty.com WordPress + ryanrealty.vercel.app Next.js; future: a
-- single consolidated Vercel-only site) to a server-side store, INCLUDING
-- BEFORE the visitor identifies via Google One-Tap / Facebook Login.
--
-- When they later identify, /api/fub/identify backfills every prior event
-- for the session into FUB as Viewed Property / Viewed Page events tied to
-- the now-known person. The lead carries their full browsing history, not
-- just the page they were on when they clicked sign-in.
--
-- Two tables:
--   1. visitor_sessions — one row per browser session_id (uuid v4 generated
--      client-side, persisted in localStorage for 1 year). Carries first-
--      touch attribution, geography, identification state, and running
--      engagement score.
--   2. visitor_events   — one row per tracked event (page view, listing
--      view, search, scroll-depth, CTA click, identify, signin).
--
-- Source-agnostic: `source_domain` text column distinguishes today's two
-- domains. When ryan-realty.com migrates onto Vercel and WordPress retires,
-- only the Vercel writes continue. No schema migration needed.
--
-- Behavioral scoring: trigger updates engagement_score on every event insert.
-- Threshold crossings fire FUB hot-lead tasks via a separate cron.
--
-- Live visitor admin view: /admin/visitors/live queries visitor_sessions
-- ORDER BY last_seen_at DESC for real-time visibility.
-- ============================================================================

-- ─── visitor_sessions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  -- session_id is generated client-side (uuid v4) and persisted in
  -- localStorage as 'rr_session_id'. Survives across pageloads and tabs
  -- for the same browser profile.
  session_id text PRIMARY KEY,

  -- Which Ryan Realty surface this session lives on. Today: 'ryan-realty.com'
  -- or 'ryanrealty.vercel.app'. After WP retirement: single value. Indexed.
  source_domain text NOT NULL DEFAULT 'ryan-realty.com',

  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),

  -- ─── First-touch attribution (captured on session creation) ───────────────
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  referrer     text,
  landing_page text,

  -- ─── Device + geography (best-effort from request headers) ────────────────
  user_agent text,
  ip_country text,  -- 2-letter, from Cloudflare CF-IPCountry header or similar
  ip_region  text,
  ip_city    text,

  -- ─── Identification (NULL until visitor signs in) ────────────────────────
  identified_at    timestamptz,
  fub_person_id    integer,
  identified_email text,
  identified_via   text,  -- 'google' | 'facebook' | 'email_click_fuid' | 'form_submit'

  -- ─── Engagement scoring (updated by trigger on every event) ──────────────
  engagement_score integer NOT NULL DEFAULT 0,
  intent_tags      text[]  NOT NULL DEFAULT '{}'::text[],
  -- Highest score the session has ever reached. Used by the cron to detect
  -- threshold crossings without re-scanning all events.
  peak_score       integer NOT NULL DEFAULT 0,
  -- Set when the session crosses the hot-lead threshold so we only fire
  -- the FUB task once per session.
  hot_lead_fired_at timestamptz,

  -- ─── Backfill tracking ────────────────────────────────────────────────────
  events_backfilled_at    timestamptz,
  events_backfilled_count integer NOT NULL DEFAULT 0
);

-- Indexes optimized for the core queries:
-- 1. Live visitor view  → last_seen_at DESC, optionally filtered to anonymous
-- 2. Per-domain reports → source_domain + last_seen_at
-- 3. FUB person lookup  → fub_person_id (find all sessions for one person)
-- 4. Hot-lead scoring   → engagement_score DESC among un-fired anonymous
CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_idx
  ON public.visitor_sessions (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS visitor_sessions_source_last_seen_idx
  ON public.visitor_sessions (source_domain, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS visitor_sessions_fub_person_idx
  ON public.visitor_sessions (fub_person_id) WHERE fub_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS visitor_sessions_anon_score_idx
  ON public.visitor_sessions (engagement_score DESC, last_seen_at DESC)
  WHERE identified_at IS NULL;
CREATE INDEX IF NOT EXISTS visitor_sessions_hot_unfired_idx
  ON public.visitor_sessions (engagement_score DESC)
  WHERE hot_lead_fired_at IS NULL;

-- ─── visitor_events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visitor_events (
  id bigserial PRIMARY KEY,
  session_id text NOT NULL REFERENCES public.visitor_sessions(session_id) ON DELETE CASCADE,
  event_at timestamptz NOT NULL DEFAULT now(),

  -- Denormalized so per-event queries don't always need a join to sessions.
  source_domain text NOT NULL DEFAULT 'ryan-realty.com',

  -- ─── Event classification ─────────────────────────────────────────────────
  event_type    text NOT NULL,  -- 'page_view' | 'listing_view' | 'search' | 'scroll_depth' | 'cta_click' | 'identify' | 'signin'
  page_url      text NOT NULL,
  page_title    text,
  page_category text,             -- 'listing_detail' | 'seller_intent' | 'buyer_intent' | 'search' | 'area_guide' | 'blog' | 'financial_tools' | 'home' | 'about' | 'other'

  -- ─── Property metadata (populated when event_type = 'listing_view') ───────
  listing_mls       text,
  listing_street    text,
  listing_city      text,
  listing_state     text,
  listing_postal    text,
  listing_price     numeric,
  listing_bedrooms  integer,
  listing_bathrooms numeric,
  listing_area_sqft integer,

  -- ─── Engagement signal ────────────────────────────────────────────────────
  scroll_depth_pct integer,  -- 0-100, populated when event_type = 'scroll_depth'
  dwell_seconds    integer,  -- approximate time on previous page

  -- ─── Score contribution from this event (rolled into session.score) ──────
  score_delta integer NOT NULL DEFAULT 0,

  -- ─── FUB sync status ──────────────────────────────────────────────────────
  -- NULL = not yet pushed to FUB. Timestamp = successfully pushed.
  pushed_to_fub_at timestamptz,

  -- Raw payload for debugging / future enrichment
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS visitor_events_session_at_idx
  ON public.visitor_events (session_id, event_at DESC);
CREATE INDEX IF NOT EXISTS visitor_events_at_idx
  ON public.visitor_events (event_at DESC);
CREATE INDEX IF NOT EXISTS visitor_events_source_at_idx
  ON public.visitor_events (source_domain, event_at DESC);
CREATE INDEX IF NOT EXISTS visitor_events_category_idx
  ON public.visitor_events (page_category, event_at DESC);
CREATE INDEX IF NOT EXISTS visitor_events_listing_mls_idx
  ON public.visitor_events (listing_mls, event_at DESC) WHERE listing_mls IS NOT NULL;
CREATE INDEX IF NOT EXISTS visitor_events_unpushed_idx
  ON public.visitor_events (session_id) WHERE pushed_to_fub_at IS NULL;

-- ─── Scoring function ───────────────────────────────────────────────────────
-- Pure function. Score deltas calibrated against BoomTown + Sierra
-- Interactive lead scoring patterns. Listing view = 10, seller intent = 25,
-- buyer intent = 15, financial tools = 10, area guide = 5, search = 3,
-- deep scroll (>= 75%) = 5, CTA click = 20, identify = 30, default = 1.
CREATE OR REPLACE FUNCTION public.visitor_score_delta_for_event(
  p_event_type    text,
  p_page_category text,
  p_scroll_depth  integer
) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_event_type = 'listing_view'                                      THEN 10
    WHEN p_event_type = 'page_view'    AND p_page_category = 'seller_intent'   THEN 25
    WHEN p_event_type = 'page_view'    AND p_page_category = 'buyer_intent'    THEN 15
    WHEN p_event_type = 'page_view'    AND p_page_category = 'financial_tools' THEN 10
    WHEN p_event_type = 'page_view'    AND p_page_category = 'area_guide'      THEN 5
    WHEN p_event_type = 'search'                                            THEN 3
    WHEN p_event_type = 'page_view'    AND p_page_category = 'search'          THEN 3
    WHEN p_event_type = 'scroll_depth' AND COALESCE(p_scroll_depth, 0) >= 75   THEN 5
    WHEN p_event_type = 'cta_click'                                         THEN 20
    WHEN p_event_type = 'identify'                                          THEN 30
    WHEN p_event_type = 'page_view'                                         THEN 1
    ELSE 0
  END;
$$;

-- ─── Trigger: update session score + last_seen on every event insert ────────
CREATE OR REPLACE FUNCTION public.visitor_event_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_delta    integer;
  v_new_tags text[];
BEGIN
  v_delta := public.visitor_score_delta_for_event(
    NEW.event_type, NEW.page_category, NEW.scroll_depth_pct
  );

  -- Persist the delta back on the event row for auditability
  IF v_delta != COALESCE(NEW.score_delta, 0) THEN
    NEW.score_delta := v_delta;
  END IF;

  -- Build the new intent_tags set: existing tags plus any new ones implied
  -- by this event's category. set-style merge so duplicates collapse.
  v_new_tags := ARRAY(
    SELECT DISTINCT t FROM unnest(
      COALESCE((SELECT intent_tags FROM public.visitor_sessions WHERE session_id = NEW.session_id), '{}'::text[])
      ||
      CASE
        WHEN NEW.page_category = 'seller_intent'   THEN ARRAY['seller_intent']
        WHEN NEW.page_category = 'buyer_intent'    THEN ARRAY['buyer_intent']
        WHEN NEW.page_category = 'listing_detail'  THEN ARRAY['listing_viewer']
        WHEN NEW.page_category = 'financial_tools' THEN ARRAY['mortgage_curious']
        WHEN NEW.page_category = 'area_guide'      THEN ARRAY['area_researcher']
        ELSE ARRAY[]::text[]
      END
    ) AS t WHERE t IS NOT NULL
  );

  -- Atomic update: bump score, refresh last_seen, set intent tags, update peak.
  UPDATE public.visitor_sessions
     SET engagement_score = engagement_score + v_delta,
         peak_score       = GREATEST(peak_score, engagement_score + v_delta),
         intent_tags      = v_new_tags,
         last_seen_at     = NEW.event_at
   WHERE session_id = NEW.session_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visitor_event_score_trigger ON public.visitor_events;
CREATE TRIGGER visitor_event_score_trigger
  BEFORE INSERT ON public.visitor_events
  FOR EACH ROW
  EXECUTE FUNCTION public.visitor_event_after_insert();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Service-role-only. Endpoints use the service role key to write; admin
-- dashboard reads via the same key. No public exposure.
ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_events   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.visitor_sessions FROM anon;
REVOKE ALL ON TABLE public.visitor_sessions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitor_sessions TO service_role;

REVOKE ALL ON TABLE public.visitor_events FROM anon;
REVOKE ALL ON TABLE public.visitor_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitor_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.visitor_events_id_seq TO service_role;

-- ─── Comments (live documentation) ──────────────────────────────────────────
COMMENT ON TABLE public.visitor_sessions IS
  'Server-side record of every browser session on a Ryan Realty surface. source_domain distinguishes ryan-realty.com (AgentFire WordPress) from ryanrealty.vercel.app (Next.js LPs). Populated by /api/visitors/track. fub_person_id stays NULL until visitor identifies via One-Tap / FB / email_click, at which point /api/fub/identify backfills events to FUB.';

COMMENT ON TABLE public.visitor_events IS
  'Per-event log for Ryan Realty visitors across all source_domains. Inserts trigger score updates on visitor_sessions. pushed_to_fub_at = NULL means not yet mirrored to FUB.';

COMMENT ON FUNCTION public.visitor_score_delta_for_event IS
  'Returns the engagement score delta for a single event. Listing view = 10, seller intent = 25, buyer intent = 15, financial tools = 10, area guide = 5, search = 3, deep scroll (>= 75%) = 5, CTA click = 20, identify = 30, default page view = 1.';
