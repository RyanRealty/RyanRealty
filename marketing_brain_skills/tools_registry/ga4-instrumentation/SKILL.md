---
name: tools_registry-ga4-instrumentation
description: Use this skill when adding, auditing, or debugging Google Analytics 4 event tracking on Ryan Realty sites. Use whenever the user mentions "GA4 events", "track this CTA", "conversion tracking", "landing page tracking", "UTM tagging", "Key events", "GA4 custom dimensions", "audiences for remarketing", "lead attribution", "funnel exploration", "trackEvent", "what events fire on this page", "is the brain seeing this conversion", "build a new landing page" (because every new LP must follow the tracking convention here), or "audit-website is empty". This is the canonical contract between the site (which fires events) and the brain (which ingests and audits them). Read this before editing `lib/tracking.ts`, adding any new `trackEvent()` call site, building a new landing page, or extending the brain's GA4 ingestor.
---

# GA4 Instrumentation — canonical contract between site + brain

## Canonical references

This skill is the **operational contract** for the loop: site → GA4 → brain → audit-website → opportunities. Every change to event names, dimensions, conversions, or LP tracking lands here first, then propagates to code and admin.

Every task that invokes this skill also loads:

- [`CLAUDE.md`](../../../CLAUDE.md) §0 — Data Accuracy mandate (outranks everything)
- [`CLAUDE.md`](../../../CLAUDE.md) §0.5 — Draft-First, Commit-Last
- [`marketing_brain_skills/tools_registry/ga4/SKILL.md`](../ga4/SKILL.md) — auth, API endpoints, query patterns (the "how to call GA4" reference)
- [`lib/tracking.ts`](../../../lib/tracking.ts) — the live `EventName` taxonomy (source of truth — the skill below references it but does not duplicate it)

The brain's downstream consumers:

- [`app/api/cron/marketing-snapshot-ga4/route.ts`](../../../app/api/cron/marketing-snapshot-ga4/route.ts) — daily 06:30 UTC ingestor → `marketing_channel_daily`
- [`lib/marketing-brain/audit-website.ts`](../../../lib/marketing-brain/audit-website.ts) — funnel + page-leak analysis
- [`lib/marketing-brain/diagnose-performance.ts`](../../../lib/marketing-brain/diagnose-performance.ts) — anomaly detection against 30-day baselines
- [`app/actions/ga4-report.ts`](../../../app/actions/ga4-report.ts) — `LEAD_EVENT_NAMES` for on-site lead-event tracking + per-listing attribution

---

## The model: three layers, one taxonomy

```
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 1 — SITE: every page fires events via window.gtag             │
│  Source of truth: lib/tracking.ts (EventName type)                   │
│  Entry points: trackEvent(), trackLeadGenerated(), trackPageView()   │
│  Auto-bound: cookie consent (ryan_realty_cookie_consent cookie)      │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 2 — GA4 PROPERTY 527333348 (G-ST40W4WM6T)                     │
│  Stores: events, dimensions, conversions (Key events), audiences     │
│  Service account: viewer@ryanrealty.iam.gserviceaccount.com (Viewer) │
│  Configured via: GA4 Admin → Events / Conversions / Custom defs      │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 3 — BRAIN: ingests via Data API into marketing_channel_daily  │
│  Cron: app/api/cron/marketing-snapshot-ga4/route.ts (06:30 UTC daily)│
│  Scopes ingested: account, channel, source, page, lead_event         │
│  Consumers: audit-website, diagnose-performance, dashboard           │
└──────────────────────────────────────────────────────────────────────┘
```

Each layer has its own canonical reference. If you change layer 1, you usually also change layer 3. Layer 2 is admin-panel state and is configured per the "GA4 admin configuration" section below.

---

## Layer 1 — Site event firing

### The single API: `trackEvent` from `lib/tracking.ts`

```ts
import { trackEvent } from '@/lib/tracking'

// Any client component
trackEvent('generate_lead', { source: 'seller_lp', lp_variant: 'home-value' })
```

The helper:
- Pushes to `window.dataLayer` (for any GTM-based debugging)
- Calls `window.gtag('event', name, params)` (fires to GA4)
- Calls `window.fbq('track', ...)` for the subset of events that have Meta Pixel equivalents
- Is a no-op until cookie consent is granted (gated by `hasAnalyticsConsent()` in `CookieConsentBanner`)

**`EventName` is enforced by the type system.** Adding a new event = add it to the `EventName` union in `lib/tracking.ts` first. Pick a snake_case verb_noun phrase aligned with GA4's recommended event conventions (`view_listing`, `generate_lead`, `play_video`).

### What params to include

Every event fires with the global UTM params already on `gtag('config')` (browser-side capture from `?utm_source=...&utm_medium=...&utm_campaign=...`). Per-event extra params should be:

| Param | When to include | Example |
|---|---|---|
| `source` | Always for lead events. Identifies which surface generated the lead. | `'seller_lp'`, `'contact_page'`, `'home_valuation'`, `'listing_cta'` |
| `lp_variant` | Every event on a landing page. | `'seller-home-value'`, `'buyer-listing-alerts'`, `'tetherow'` |
| `listing_key` | Every event on a listing-detail page. | `mls_id:220189422` |
| `broker_slug` | Every event on a broker page or broker-initiated form. | `'matt-ryan'`, `'paul-stevenson'`, `'rebecca-peterson'` |
| `city_slug` | Every event on a city page. | `'bend'`, `'redmond'`, `'sisters'` |
| `community_slug` | Every event on a community page. | `'tetherow'`, `'sunriver'`, `'three-rivers-south'` |
| `cta_location` | Always when a click event. Disambiguates where the same CTA fires from. | `'hero_search'`, `'sticky_bar'`, `'mobile_drawer'` |

**Custom dimensions are how the brain pivots later.** A `trackEvent('generate_lead', { source, lp_variant, broker_slug, listing_key })` fire becomes pivotable by source × LP × broker × listing in the brain dashboard once the matching custom dimensions are registered in GA4 Admin (see Layer 2 below).

### Anti-pattern alert: duplicate event names

`lib/tracking.ts` currently has both `schedule_tour_click` and `schedule_showing_click`, and both `view_city` and `city_view`. **Pick one canonical name per concept and stop using the other.** When auditing, run:

```bash
grep -rohE "trackEvent\(['\"][a-z_]+['\"]" --include="*.ts" --include="*.tsx" . | sort -u | wc -l
```

If the count exceeds the size of the `EventName` union, there's a stray (the union catches typos at compile time, but call sites that bypass typing do not).

---

## Landing-page tracking convention — MANDATORY

Every Next.js page under `app/lp/<variant>/` AND every static HTML page under `public/lp/<variant>/` follows this template. Matt is shipping new LPs continuously; without this convention, each one ends up firing different events with different param names and the brain can't compare them.

### The minimum tracking surface per LP

| Event | When | Required params |
|---|---|---|
| `view_landing_page` | Fires once on initial mount (after consent). | `lp_variant`, `lp_source` (= `utm_source` if present, else `'direct'`), `lp_medium`, `lp_campaign` |
| `scroll_depth` | Fires at 25 / 50 / 75 / 100 %. | `lp_variant`, `depth_percent` |
| `click_cta` | Every primary CTA click that doesn't already fire a more specific event. | `lp_variant`, `cta_location`, `cta_label` |
| `generate_lead` | Form submit success. | `lp_variant`, `source` (same string as `lp_variant`), plus form-specific fields (`classification`, `cma_sent`, etc.) |
| `valuation_requested` / `tour_requested` / `cma_downloaded` | Whichever flavor the LP is — fired ADDITIONAL to `generate_lead`. | `lp_variant`, `source` |

### The shared component: `<LandingPageTracker>`

Every Next.js LP imports `<LandingPageTracker lpVariant="seller-home-value" />` at the top of its `page.tsx`. This component:

1. On mount: fires `view_landing_page` with UTM params captured from URL.
2. Sets up scroll-depth listeners that fire `scroll_depth` at 25 / 50 / 75 / 100.
3. Persists UTM params to sessionStorage so any later `trackEvent` call on the page can read them (forms call `getLpContext()` from `lib/tracking.ts` to enrich their submit event).

Static HTML LPs (`public/lp/<variant>/index.html`) replicate the same pattern in inline `<script>` — see `public/lp/tetherow/index.html` for the reference implementation.

### Standard URL convention for an LP visit

```
https://ryan-realty.com/lp/seller-home-value/?utm_source=facebook&utm_medium=paid_social&utm_campaign=seller-funnel-may&utm_content=ad-set-12&utm_term=bend-sellers
```

| Param | Constraint |
|---|---|
| `utm_source` | one of `facebook`, `instagram`, `tiktok`, `google`, `bing`, `linkedin`, `youtube`, `email`, `direct`, `referral`, `qr` |
| `utm_medium` | one of `paid_social`, `organic_social`, `cpc`, `email`, `referral`, `print`, `qr` |
| `utm_campaign` | kebab-case campaign slug — matches a `marketing_brain_actions.id` substring whenever possible so the seller-lead-attribution cron can pair leads back to the action that drove them (see `app/api/cron/seller-lead-attribution/route.ts` Method 3) |
| `utm_content` | ad-set / variant identifier — free-form |
| `utm_term` | targeting / keyword — free-form |

The brain's attribution loop ([`app/api/cron/seller-lead-attribution/route.ts`](../../../app/api/cron/seller-lead-attribution/route.ts)) reads UTM params off the lead's `path` field and pairs them to `marketing_brain_actions` rows. **Inconsistent UTMs break attribution silently.** Use the table above.

---

## Layer 2 — GA4 admin configuration (property 527333348)

Configured via [analytics.google.com](https://analytics.google.com/) → "Ryan Realty" account → "Ryan Realty" property → Admin. Drive Chrome via `mcp__Claude_in_Chrome__*` to make changes; never hand-edit these instructions and call it done.

### Key events (a.k.a. conversions)

GA4 calls them "Key events" since 2025. Marking an event as a Key event in Admin tells GA4 to surface it in conversion reports and lets Google Ads use it as a remarketing audience seed. **Every event in this list must be flagged as a Key event** at GA4 Admin → Events → toggle "Mark as key event":

| Event | Why it's a Key event |
|---|---|
| `generate_lead` | Master conversion — every lead form submit. |
| `tour_requested` | High-intent buyer signal. |
| `valuation_requested` | High-intent seller signal. |
| `cma_downloaded` | High-intent seller signal. |
| `sign_up` | Account creation — repeat-visit foundation. |
| `newsletter_signup` | Email list growth. |
| `contact_agent` | Direct agent contact form. |
| `schedule_tour_click` | Click intent (pre-form). Lower priority but still counted. |
| `contact_agent_click` | Click intent (pre-form). |
| `open_house_rsvp` | Event attendance signal. |

Engagement events stay as events but NOT Key events: `view_listing`, `save_listing`, `play_video`, `scroll_depth`, `share`, `hero_search`, `view_featured_listings`, etc. They're useful for cohort + audience definitions but not as conversion goals.

### Custom dimensions

Register these in Admin → Custom definitions → Custom dimensions. **User-scoped or Event-scoped per the table:**

| Dimension name | Scope | Event parameter | Why |
|---|---|---|---|
| `lp_variant` | Event | `lp_variant` | Pivot per landing page in funnel reports. |
| `source_detail` | Event | `source` | Free-form source string (`seller_lp`, `contact_page`, `home_valuation`) — finer than `sessionSource`. |
| `lp_source` | Event | `lp_source` | UTM-captured source on LP first visit. |
| `lp_campaign` | Event | `lp_campaign` | UTM-captured campaign — pairs with `marketing_brain_actions.id`. |
| `listing_key` | Event | `listing_key` | MLS number — pivot lead events per listing. |
| `broker_slug` | Event | `broker_slug` | Pivot per broker (matt-ryan / paul-stevenson / rebecca-peterson). |
| `city_slug` | Event | `city_slug` | Pivot per city page. |
| `community_slug` | Event | `community_slug` | Pivot per community page (subdivision). |
| `cta_location` | Event | `cta_location` | Disambiguate which CTA position fired the click. |

Custom dimensions take ~24h to start populating reports after registration. Register them BEFORE shipping a new event that uses them, otherwise the params drop silently.

### Audiences (Admin → Audiences)

These three are the minimum useful set. All three export to Google Ads as remarketing audiences once GA4 ↔ Google Ads is linked.

| Audience name | Definition | Used by |
|---|---|---|
| `Engaged sellers (no convert 30d)` | `view_landing_page` with `lp_variant` containing `seller-` OR `valuation_requested` event in last 30 days, AND `generate_lead` event NOT in last 30 days. | Seller-funnel remarketing on Meta + Google Ads. |
| `Active buyers (3+ listings)` | `view_listing` event ≥ 3 in last 14 days. | Buyer-funnel remarketing. Email-list opt-in CTA. |
| `CMA downloaders` | `cma_downloaded` event fired in last 90 days. | Email nurture, direct outreach by listing agent. |

### Integrations

| Link | Status | Why |
|---|---|---|
| GA4 ↔ Google Ads (`AW-...`) | Verify Admin → Product links → Google Ads. Required for Key events to export as conversions and for audiences to seed remarketing campaigns. | Conversion attribution + remarketing. |
| GA4 ↔ Google Search Console | Verify Admin → Product links → Search Console. Already linked; brain pulls GSC separately but the in-GA4 join makes Search Console clicks visible alongside on-site events. | SEO insight in GA4 reports. |
| GA4 ↔ BigQuery (free export) | OPTIONAL — defer until needed. Free tier supports our volume. Unlocks raw event-level data instead of aggregated reports — gives the brain access to single-user paths through the site. | Deep brain analysis (future). |

---

## Layer 3 — Brain ingestor scope

The cron at [`app/api/cron/marketing-snapshot-ga4/route.ts`](../../../app/api/cron/marketing-snapshot-ga4/route.ts) runs at 06:30 UTC daily and writes to `public.marketing_channel_daily` (Supabase project `dwvlophlbvvygjfxcrhm`).

### Scopes currently ingested

| Scope | scope_id format | Metrics | Cardinality |
|---|---|---|---|
| `account` | `'site'` (literal) | `sessions`, `total_users`, `new_users`, `avg_session_duration_seconds`, `engagement_rate`, `bounce_rate`, `lead_event_rate`, `total_lead_events` | 1 row/day |
| `channel` | `sessionDefaultChannelGroup` value | `sessions`, `users` | ~6 rows/day |
| `source` | `sessionSource / sessionMedium` | `sessions`, `users`, `engaged_sessions` | ~10-30 rows/day |
| `page` | `pagePath` | `page_views`, `page_users` | ~50-500 rows/day |
| `lead_event` | `lead_event:<event_name>` | `event_count` (event-level aggregate) | 9 rows/day (one per `LEAD_EVENT_NAMES` entry) |

### Scopes the brain SHOULD also ingest (gap)

| Scope | scope_id format | Metrics | Why |
|---|---|---|---|
| `lp` | `lp_variant` custom dim value | `view_landing_page_count`, `generate_lead_count`, `valuation_requested_count`, `tour_requested_count` | Per-LP funnel comparison. Today the brain only knows traffic to `/lp/seller-home-value` exists, not how many visitors converted vs bounced. |
| `event` | `event_name` for non-lead events | `event_count`, distinct_user_count | Engagement-event aggregate (`view_listing`, `save_listing`, `hero_search`) — feeds `audit-website` engagement analysis. |
| `page_event` | `<pagePath>::<event_name>` composite | `event_count` | Per-page conversion rates. Today only `page_views` is per-page; per-page conversion is computed downstream from joining the two, but doing it in the ingestor is cheaper. |
| `audience` | `audience_name` (one of the 3 registered) | `active_users`, `growth_28d` | Track audience size growth for remarketing budget allocation. |

When extending the ingestor:
1. Add a new `runReport()` call (or extend `batchRunReports()`) with the matching dimensions + metrics.
2. Append rows to the same `marketing_channel_daily` upsert via `upsertMetricRows()` with the new scope.
3. Dedup by composite PK (scope, scope_id, metric, date) — see the dedup helper in [`lib/marketing-brain/snapshot.ts`](../../../lib/marketing-brain/snapshot.ts).
4. Add the new scope to the audit-website diagnostics so it shows up as opportunities.

### Verification queries (run against Supabase `dwvlophlbvvygjfxcrhm`)

**Is the brain receiving data?** Run daily.

```sql
SELECT channel, max(date) AS latest_date, max(fetched_at) AS latest_fetch
FROM public.marketing_channel_daily
WHERE channel = 'ga4'
GROUP BY channel;
```

Latest_date should be yesterday (GA4 has a 24-48h processing lag on stable reports). Latest_fetch should be today around 06:30 UTC.

**What scopes are populated?** Run weekly.

```sql
SELECT scope, metric, count(*) AS rows, count(DISTINCT scope_id) AS unique_ids
FROM public.marketing_channel_daily
WHERE channel = 'ga4' AND date >= current_date - 7
GROUP BY scope, metric
ORDER BY scope, metric;
```

Compare against the "Scopes currently ingested" table above. Missing rows = the ingestor isn't pulling that dimension.

**Top pages — last 7 days.** Sanity check site coverage.

```sql
SELECT scope_id, sum(value)::int AS views
FROM public.marketing_channel_daily
WHERE channel = 'ga4' AND scope = 'page' AND metric = 'page_views' AND date >= current_date - 7
GROUP BY scope_id
ORDER BY views DESC
LIMIT 30;
```

After the 2026-05-17 WordPress GA4 swap, this list should include WordPress paths (`/`, `/about-us/`, `/contact/`, `/explore/bend/<neighborhood>/`, blog URLs) alongside Vercel paths.

**Per-LP funnel (after the ingestor is extended).**

```sql
SELECT
  scope_id AS lp_variant,
  sum(case when metric = 'view_landing_page_count' then value else 0 end)::int AS lp_views,
  sum(case when metric = 'generate_lead_count' then value else 0 end)::int AS leads,
  CASE WHEN sum(case when metric = 'view_landing_page_count' then value else 0 end) > 0
       THEN round(100.0 * sum(case when metric = 'generate_lead_count' then value else 0 end) /
                  sum(case when metric = 'view_landing_page_count' then value else 0 end), 1)
       ELSE NULL END AS conversion_pct
FROM public.marketing_channel_daily
WHERE channel = 'ga4' AND scope = 'lp' AND date >= current_date - 30
GROUP BY scope_id
ORDER BY leads DESC;
```

---

## Operational playbook — common changes

### Add a new event

1. Add it to the `EventName` union in [`lib/tracking.ts`](../../../lib/tracking.ts).
2. Decide: is it a Key event (conversion) or engagement event? If Key, add it to the "Key events" table above AND mark it as a Key event in GA4 Admin → Events.
3. Decide: does it need a custom dimension? If yes, register the dimension in GA4 Admin BEFORE shipping the event firing (or the param drops).
4. Fire the event from the appropriate component with the right params.
5. Verify in GA4 Realtime view (Admin → Realtime → DebugView) within 5 minutes of shipping.
6. Within 24h, verify the brain ingests it via the verification queries above.

### Add a new landing page

1. Create `app/lp/<variant>/page.tsx` (or `public/lp/<variant>/` for static HTML).
2. Import and render `<LandingPageTracker lpVariant="<variant>" />` at the top of the page component.
3. The submit form imports `trackEvent` and calls `trackEvent('generate_lead', { lp_variant: '<variant>', source: '<variant>', ...form_fields })`.
4. Verify `lp_variant` is registered as a custom dimension in GA4 Admin (it's already registered if you followed Layer 2; if not, register it).
5. Run a test visit + form submit. Confirm via Realtime view in GA4.
6. Within 24h, verify the brain sees the LP in the `lp` scope via the per-LP funnel query.

### Audit "is event X firing on page Y"

Drive Chrome to the page, accept consent if needed, then run:

```js
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/g/collect'))
  .map(r => {
    const u = new URL(r.name)
    return { en: u.searchParams.get('en'), dp: u.searchParams.get('dp'), tid: u.searchParams.get('tid') }
  })
```

`en` is the event name. `dp` is the page path. `tid` should be `G-ST40W4WM6T`. If `en` shows your event, it's firing. If not, check the consent state (`document.cookie.includes('ryan_realty_cookie_consent')`).

### Audit "is the brain seeing event X"

```sql
SELECT scope_id, sum(value)::int AS event_count
FROM public.marketing_channel_daily
WHERE channel = 'ga4'
  AND scope = 'lead_event'
  AND scope_id = 'lead_event:<event_name>'
  AND date >= current_date - 30
GROUP BY scope_id;
```

If 0 rows: the event isn't in `LEAD_EVENT_NAMES` (only the 9 lead events are ingested today). Extend the ingestor per Layer 3.

---

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Event fires in DevTools but doesn't show in GA4 Realtime | Cookie consent not granted; gtag is a no-op | Check `document.cookie` for `ryan_realty_cookie_consent`. Accept via the banner. |
| Event shows in GA4 Realtime but not in stable reports | GA4 has a 24-48h processing lag on stable (non-realtime) reports | Wait 48h. If still missing, check Admin → Events to confirm the event is registered. |
| GA4 reports event correctly but brain shows 0 | Event isn't in `LEAD_EVENT_NAMES` so the ingestor doesn't pull it | Add to `LEAD_EVENT_NAMES` in `app/actions/ga4-report.ts` OR extend the ingestor per Layer 3. |
| `lp_variant` custom dimension shows `(not set)` in GA4 reports | Dimension registered in Admin AFTER events started firing — historical events lack the param | New events will populate. Don't backfill. |
| UTM source shows in `sessionSource` but `lp_source` event param is missing | LP didn't call `<LandingPageTracker>` OR the form didn't enrich submit with `getLpContext()` | Audit the LP per "Landing-page tracking convention". |
| Two metrics for the same concept (e.g., `view_city` + `city_view`) | Duplicate event names in the codebase | Pick one canonical, deprecate the other, grep for stragglers. |

---

## Migration checklist — current state vs target

As of 2026-05-18:

- [x] GA4 property cleanup (one account, one property, one measurement ID) — see 2026-05-17 memory log
- [x] FUB pixel installed on both sites — see 2026-05-17 memory log
- [x] `trackEvent` helper in `lib/tracking.ts` with `EventName` union ~50 events
- [x] Most key surfaces fire events: home hero, contact form, valuation form, seller LP form, listing actions, broker contact, city tracker, etc.
- [ ] **`app/lp/buyer-listing-alerts/BuyerLPForm.tsx` fires NO tracking** — known gap to fix
- [ ] **`<LandingPageTracker>` component does not exist** — to be built
- [ ] **Custom dimensions registered in GA4 Admin** — none of `lp_variant`, `source_detail`, `listing_key`, `broker_slug`, etc. registered yet
- [ ] **Key events marked in GA4 Admin** — none of the 10 events in the Key events table are marked yet
- [ ] **Audiences defined** — none of the 3 audiences exist yet
- [ ] **Brain ingestor's `lp`, `event`, `page_event`, `audience` scopes** — not ingested yet
- [ ] **Duplicate event names cleaned up** — `schedule_tour_click` vs `schedule_showing_click`, `view_city` vs `city_view` not deduped

The "Operational playbook" above is the per-change loop. Use it for every new LP, every new event, every audit pass.

---

## Related skills and references

| Resource | Purpose |
|---|---|
| [`marketing_brain_skills/tools_registry/ga4/SKILL.md`](../ga4/SKILL.md) | Auth + API endpoint reference (the "how" of calling GA4 Data API) |
| [`marketing_brain_skills/tools_registry/follow-up-boss/SKILL.md`](../follow-up-boss/SKILL.md) | FUB pixel + lead intake (companion tracking on the other side of the funnel) |
| [`marketing_brain_skills/tools_registry/meta-graph/SKILL.md`](../meta-graph/SKILL.md) | Meta Pixel side (every form that fires `generate_lead` also fires `fbq('track', 'Lead', ...)`; both must stay in sync) |
| [`lib/tracking.ts`](../../../lib/tracking.ts) | The live `EventName` union — source of truth |
| [`components/CookieConsentBanner.tsx`](../../../components/CookieConsentBanner.tsx) | Consent gate that wraps gtag + fbq + widgetTracker |
| [`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`](../../../docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md) | End-to-end FB seller funnel — defines the UTM convention the LPs must match |
| [`docs/MARKETING_LEAD_FLOW.md`](../../../docs/MARKETING_LEAD_FLOW.md) | Path-by-path lead creation across the site |
| `app/api/cron/seller-lead-attribution/route.ts` | Lead → marketing-action attribution (consumes UTM params) |
| `.auto-memory/memory_marketing_brain_decisions.md` | Persistent gotchas + decisions log |
