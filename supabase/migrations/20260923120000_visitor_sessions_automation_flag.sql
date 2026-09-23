-- P7 identity loop + TRACK-4 (visibility audit 2026-09-22): server-side
-- automation class on first-party visitor sessions.
--
-- Why: /api/visitors/track had no bot check and does not STORE the user agent
-- at essential consent (97.5% of sessions), so crawlers and humans were
-- indistinguishable after the fact. Measured 2026-09-23 (visitor_sessions,
-- first_seen_at >= 2026-09-16): 1,062 no-referrer sessions landed on /contact,
-- 987 of them on /contact?intent=&listingKey= (the link on every listing page),
-- each on a fresh rr_vid with one event, around the clock.
--
-- What: the track route classifies each NEW session from the request's UA
-- header and navigator.webdriver (lib/analytics/automation.ts) and stores only
-- the class label below, never the UA string, so the essential-tier rule in
-- docs/TRACKING_POLICY.md holds. Flagged sessions stay in the table (volume
-- remains measurable) but are never mirrored into GA4, and UA-flagged ones are
-- excluded from the known-people activity view and never identified.
-- One PROVISIONAL behavioural reason, 'contact-deep-link' (a fresh session
-- whose first page is /contact?listingKey=<mls> with no referrer, campaign or
-- token: 882 such sessions in the 7 days to 2026-09-23T06:09Z, each one event,
-- zero seconds, never identified), is cleared by the session's next event.
--
-- Safe before/after deploy: the route retries its insert without these columns
-- while they are absent (lib/data/identity/sessionIdentity.ts). Existing rows
-- default to false (unclassified history reads as human, as it always has).

alter table public.visitor_sessions
  add column if not exists is_automated boolean not null default false,
  add column if not exists automation_reason text;

comment on column public.visitor_sessions.is_automated is
  'True when the track route classified the session as automation at birth: from the UA header (declared crawler, HTTP tool, headless browser, navigator.webdriver, empty UA; never identified, left off /admin/visitors/live Known people) or the provisional contact-deep-link shape (cleared by the next event). Never mirrored to GA4. See lib/analytics/automation.ts.';
comment on column public.visitor_sessions.automation_reason is
  'Why is_automated is true: declared-crawler | tool | headless | webdriver | empty-ua (from the UA header, permanent) or contact-deep-link (behavioural, provisional: cleared by the session''s next event). The UA string itself is not stored at essential consent.';

-- The known-people activity view reads identified sessions by recency.
create index if not exists visitor_sessions_identified_recent_idx
  on public.visitor_sessions (last_seen_at desc)
  where crm_person_id is not null;
