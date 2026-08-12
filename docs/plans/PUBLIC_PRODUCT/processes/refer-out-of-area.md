# Process: refer-out-of-area — Out-of-area city → referral capture (/oregon/[city])

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (organic + typed entry any time; the MV feeding it refreshes hourly)
- Verdict (**PROPOSAL, not a lock — P3 decides**): **KEEP** — inception (an out-of-market
  query the middleware actively routes OUT of the in-market graph) and completion (a
  hard-gated no-drip referral lead awaiting a manual broker-to-broker handoff) are both
  unique; the lead-creation step *delegates to* the `capture-and-attribute` substrate
  (`ensureNativeLead`) rather than duplicating it, so merging there would erase the only
  process that monetizes out-of-market demand and the only one whose defining behavior is
  what must NOT happen (no auto-send). Keep standalone; record the shared tail explicitly.
- Last evidence pass: **2026-08-11** (every file:line below opened this run)

## 1. Purpose

A visitor interested in an Oregon city outside Central Oregon sees live statewide-MLS
inventory for that city and gets an honest answer — this is not Ryan Realty's market —
plus a no-cost introduction to a local broker the team would use themselves. The machine
outcome is **contact made** on a lead the standard funnel must never touch: precisely
because the page admits the market is not ours, leaving an email for a broker introduction
becomes the rational next step, producing a `referral:candidate` row in `crm_people` that a
broker converts by hand into a broker-to-broker referral (a recorded receivable), instead
of a mis-aimed Central Oregon drip that would burn the lead.

## 2. Inception (what starts it)

Trigger: a visitor's interest lands on an Oregon city the statewide MLS feed carries
(~362 cities) but the Central Oregon service area does not.

Entry channels and routes:

- **Organic search (deliberately throttled):** only out-of-area cities with
  ≥ `OUT_OF_AREA_INDEXABLE_MIN_ACTIVE` (5) active listings, capped at
  `OUT_OF_AREA_INDEXABLE_TOP_N` (100, widened from 25 by Matt directive 2026-07-22),
  are indexable and sitemap-emitted (`lib/out-of-area-cities.ts:41-52,102-107`;
  sitemap wiring `app/sitemap.ts:20,434` via `getOutOfAreaCitySitemapEntries`,
  `lib/data/geo/getOutOfAreaCities.ts:119-128`). Every other city SSRs on demand and
  renders noindex (`app/oregon/[city]/page.tsx:52-60,86-92`).
- **Typed/linked `/cities/<slug>`:** middleware 308s any `/cities/` slug not in
  `CENTRAL_OREGON_CITY_SLUGS` to `/oregon/<slug>` (`middleware.ts:302-309`, invoked at
  `middleware.ts:497-509`). The reverse also holds — `/oregon/<service-area-city>` 308s
  back to `/cities/<slug>` (`middleware.ts:311-318`) so no city has two URLs (duplicate
  content prevention). Edge-safe: static set lookups only, no DB (`middleware.ts:286-301`).
- **Internal cross-links:** every out-of-area city page links up to 8 sibling top markets
  ("Other Oregon markets", `app/oregon/[city]/page.tsx:127-136,235-243`) plus a CTA to the
  Central Oregon `/cities` index, so the referral tier interlinks instead of dead-ending.

Preconditions: the slug must resolve to a `geo_snapshot_mv` city row with ≥1 active
listing after noise filtering — otherwise the page guard returns a REAL 404 before any
streaming boundary (`app/oregon/[city]/page.tsx:99-102`; index fetch and filters
`lib/data/geo/getOutOfAreaCities.ts:52-80,96-101`; plausibility + out-of-area predicates
`lib/out-of-area-cities.ts:75-90`). A junk `/cities/xyz` slug therefore terminates as
308 → real 404, the same terminal signal the old edge-404 gave Google
(`middleware.ts:295-300`).

## 3. Actors

- **Visitor segments:** buyers or sellers whose target market is a non-Central-Oregon
  Oregon city (Medford, Grants Pass, Klamath Falls, ...). The form copy captures both
  intents ("Buying, selling, budget, timing" —
  `components/site/kb/KbOutOfAreaReferral.client.tsx:112`); the action currently stamps
  `audience:buyer` regardless (`app/actions/out-of-area-referral.ts:59` — see §10 defects).
  Device: GA4 split for `/oregon/*` was NOT pulled this session (gap, §11); program law is
  mobile-first, 390 is truth (decisions.md 2026-08-11).
- **Automated actors:** `refresh-mvs` cron (vercel.json, `8 * * * *`) refreshes
  `geo_snapshot_mv` hourly (`app/api/cron/refresh-mvs/route.ts:71-83`); `crm-alert-drain`
  cron (`* * * * *`) delivers the queued INTERNAL broker SMS; the `crm-auto-enroll`
  catch-all cron (`4,19,34,49 * * * *`) is an actor whose defining role here is to be
  BLOCKED — `geoReferralEnrollBlock` refuses referral candidates inside `autoEnrollPerson`
  (`lib/crm/enroll.ts:65-72`, `lib/referral-geo.ts:143-152`).
- **Accountable for completion:** the assigned broker (default `matt`,
  `app/actions/out-of-area-referral.ts:71`), prompted by a same-business-day task
  (240 min, `:94-100`), an internal SMS alert (`:104-113`), and the referral queue at
  `/admin/crm/referrals` (`app/admin/(protected)/crm/referrals/page.tsx:1-12`).

## 4. Systems of record

| Artifact | SoR |
|---|---|
| The lead (identity, tags, assigned broker) | `crm_people` + `crm_contact_points` via `ensureNativeLead` (`lib/data/crm/ensureNativeLead.ts:1-40` — find-or-create, email-first then phone; never touches suppressions, never subscribes a channel) |
| Intent note ("what they want", source page, routing instruction) | `crm_timeline` origin note via `enrichNativeLead` (`app/actions/out-of-area-referral.ts:76-91`) |
| Broker follow-up | `crm_tasks` via `createNativeTask` (`:94-100`) |
| Internal broker alert | `crm_broker_alerts` queue (`lib/crm/broker-alerts.ts:141,181`), drained by `crm-alert-drain` |
| The handoff + fee trail (post-completion terminal) | `referral_receivables` (migration `20260722212000_referral_tier.sql`; feature-detected — `lib/data/crm/referralReceivables.ts:94-118,127-170`) + `referral:referred-out` person tag (`lib/referral-geo.ts:38,45-49`) |
| City stats shown on page | `geo_snapshot_mv` (city level, statewide GROUP BY — `lib/data/geo/getOutOfAreaCities.ts:1-25`); tiles from `listing_tile_mv` via `getListingTiles` (`app/oregon/[city]/page.tsx:106-114`) |

Explicitly NOT a SoR: the GA4 Measurement Protocol mirror (`fireLeadGenerated`,
`lib/lead-tracking.ts:75` — analytics only, `.catch(() => {})`); raw `listings` at request
time (nothing aggregates it — `app/oregon/[city]/page.tsx:19-22`); the rendered page itself.

## 5. End-to-end path (inception → completion)

1. **Enter** · visitor · searches/types/clicks toward an out-of-area Oregon city · query
   or URL · request for `/oregon/<slug>` or `/cities/<slug>` · — · mistyped garbage slug
   heads for a 404 · any device.
2. **Boundary routing** · middleware (edge) · slug set membership check, 308 both
   directions · pathname · canonical URL (`/oregon/<slug>` for out-of-area,
   `/cities/<slug>` for in-market) · `middleware.ts:302-318,497-509` · none — static set
   lookups, no DB · any.
3. **Guard + render** · server (ISR, `revalidate 3600`, `dynamicParams true`) ·
   validate slug against the cached MV-backed index; unknown → `notFound()` BEFORE
   streaming · slug · the page or a real 404 · `app/oregon/[city]/page.tsx:52-53,99-102`;
   resilient cache `lib/data/geo/getOutOfAreaCities.ts:88-93` (fetch THROWS on error so an
   empty list is never poison-cached) · DB blip serves the cached index · any.
4. **Answer the question** · page · hero with live count + median, then the honest block
   ("We don't work in {city}" + what we do instead) and up to 12 live tiles ·
   `geo_snapshot_mv` row + `listing_tile_mv` tiles · rendered answer ·
   `app/oregon/[city]/page.tsx:192-230` (hero :192-208, honest block :211-220, tiles
   :222-230); tile fetch bounded by `withTimeoutFallback` 5000 ms → `[]`
   (`:109-114`) · timeout hides the inventory section rather than faking it · any.
5. **Track** · client · `KbSectionTracker pageType="out-of-area-city"` fires
   `section_view` + scroll-depth to GA4/Pixel AND `/api/visitors/track` ·
   `app/oregon/[city]/page.tsx:181`, `components/site/kb/KbSectionTracker.client.tsx:1-40`
   · best-effort, never breaks the page · any.
6. **Form fill** · visitor · name (optional) + email (required) + free-text notes; a
   hidden honeypot field · `components/site/kb/KbOutOfAreaReferral.client.tsx:71-118` ·
   email-only contact BY DESIGN: no phone input, so no SMS-consent surface is required
   (A2P gate, `:7-14`) · abandonment = terminal state (c) in §7 · any.
7. **Submit → validate** · `submitOutOfAreaReferral` server action · email regex, honeypot
   check (filled honeypot returns a FAKE success and creates nothing), server-side city
   re-validation against the same index · form payload ·
   `app/actions/out-of-area-referral.ts:46-55` · invalid email / unknown city → inline
   error, visitor can retry · any.
8. **Create the lead** · server · `ensureNativeLead` find-or-create with tags
   `audience:buyer, buyer:nurture, source:out-of-area-lp, geo:out-of-area,
   referral:candidate, city-interest:<slug>`, assigned to `matt` ·
   `app/actions/out-of-area-referral.ts:58-72`; tag constants
   `lib/referral-geo.ts:30,52` · dedup: an existing email/phone match reuses the person ·
   null personId → generic error to visitor · server.
9. **Enrich** · server · origin note on `crm_timeline` (market, wants, source page,
   routing instruction naming the referral queue) + `outOfAreaCity` custom field ·
   `app/actions/out-of-area-referral.ts:75-91` · server.
10. **Internal-only follow-up machinery** · server · `createNativeTask` (Referral, due
    240 min) + `queueBrokerAlert` (queued SMS to the BROKER's own phone — never a message
    to the lead) + `fireLeadGenerated` GA4 mirror (`lp_variant: out-of-area-city`,
    value 100) · `app/actions/out-of-area-referral.ts:94-122` · alert + GA4 are
    fire-and-forget `.catch` — their failure never fails the submit · server.
11. **Confirm** · client · success state: "A broker from our team reads this today and
    connects you with a {city} agent." ·
    `components/site/kb/KbOutOfAreaReferral.client.tsx:41-52` · any.
12. **The gate holds (background, continuous)** · `autoEnrollPerson` (called by BOTH the
    intake fire-and-forget path and the 15-min catch-all cron) · `geoReferralEnrollBlock`
    returns a block reason for `referral:candidate` → `{ enrolled: false }` — NOTHING
    auto-sends to the lead · `lib/crm/enroll.ts:65-72`, `lib/referral-geo.ts:143-152` ·
    this step is the process's defining invariant · server.
13. **Broker reads the queue** · broker · `/admin/crm/referrals` lists candidates
    (`listReferralCandidates` — tag overlap on `referral:candidate` / `geo:unclassified`,
    `lib/data/crm/referralReceivables.ts:65-92`), connects the visitor with a local broker
    by hand · **← process completion (§7)** · desktop/admin.
14. **(Post-completion terminal)** · broker · records the handoff:
    `recordReferralReceivable` inserts a `referral_receivables` row (default 25% fee
    basis, status `pending`), stamps a timeline entry and the idempotent
    `referral:referred-out` tag · `lib/data/crm/referralReceivables.ts:127-170`,
    `lib/referral-geo.ts:45-49` · admin.

## 6. Decision points

- **Service-area membership** (`middleware.ts:302-318`): in-set → the in-market
  `evaluate-a-place` ladder; out-of-set → this process. The single branch that separates
  the two processes.
- **Real city vs garbage** (`app/oregon/[city]/page.tsx:99-102`): guard before any
  streaming boundary; unknown slug → real 404, no soft-404 sprawl.
- **Indexable vs noindex** (`lib/out-of-area-cities.ts:102-107`;
  `app/oregon/[city]/page.tsx:86-92`): ≥5 active AND top-100 → index + sitemap; else
  noindex. Thin-content protection is a policy branch, not an accident.
- **Honeypot** (`app/actions/out-of-area-referral.ts:51`): filled → fake success, zero
  writes.
- **Enroll gate — keyed on `referral:candidate`, deliberately NOT the bare
  `geo:out-of-area` tag** (`lib/referral-geo.ts:136-152`): the seller-LP geocode path has
  stamped `geo:out-of-area` on out-of-polygon seller leads since before the referral tier
  existed; gating on the bare tag would silently change the live seller funnel. The
  referral tier owns only leads it explicitly routes.
- **Compliance gates:** email-only form → no A2P/SMS-consent surface required
  (`components/site/kb/KbOutOfAreaReferral.client.tsx:7-14`); `ensureNativeLead` never
  touches suppressions or subscribes a channel (`lib/data/crm/ensureNativeLead.ts:33-36`);
  §0 traces — every on-page stat comes from `geo_snapshot_mv` and the JSON-LD Dataset
  block enumerates them (`app/oregon/[city]/page.tsx:139-170`); voice canon holds on the
  page copy (fact-then-stop honest block, `:211-220`); tiles come only through
  `getListingTiles` with `status: 'active'` (`:110`), the same public browse chokepoint as
  in-market pages.

## 7. Completion

Done-when (observable): a `crm_people` row exists carrying
`geo:out-of-area` + `referral:candidate` (+ `source:out-of-area-lp`,
`city-interest:<slug>`), with its origin note on `crm_timeline`, a Referral task in
`crm_tasks` due in 240 minutes, a queued `crm_broker_alerts` row — and **zero**
`crm_sequence_enrollments` rows for that person (the gate held). The visitor saw the
confirmation state. The observable done-state is the tagged row **awaiting manual broker
action** in `/admin/crm/referrals`.

Artifacts at completion: the person row + contact point, timeline note, task, queued
alert, GA4 `lead_generated` event.

Terminal states:

- **(a) Referred out** — broker records the handoff: `referral_receivables` row (status
  `pending`) + `referral:referred-out` tag + timeline entry
  (`lib/data/crm/referralReceivables.ts:127-170`).
- **(b) Read-only visit** — visitor got the honest answer and left without submitting.
  The page still served its visitor objective; no lead exists.
- **(c) Rejected submit** — validation error surfaced inline; visitor may retry.
- **(d) Honeypot drop** — bot saw success, nothing was written.

## 8. Time & performance

- **Time-to-answer budget:** the visitor's two questions — "is this Ryan Realty's
  market?" and "what's for sale here?" — are both answered in the first two viewports:
  live count + median in the hero (`app/oregon/[city]/page.tsx:192-208`) and the honest
  block immediately after (`:211-220`). No stat is computed at request time: counts/median
  come from `geo_snapshot_mv` (refreshed hourly, `vercel.json` cron `8 * * * *`) through a
  resilient cache (`revalidate: 3600`, `lib/data/geo/getOutOfAreaCities.ts:88-93`), and
  the page is ISR (`revalidate = 3600`, `app/oregon/[city]/page.tsx:53`) with the
  indexable set pre-built by `generateStaticParams` (`:55-60`).
- **Bounded degradation:** tile fetch capped at 5000 ms, sibling-index fetch at 4000 ms;
  both fall back to `[]` (`:106-121`) — a slow DB hides the inventory/sibling sections
  rather than blocking the answer or faking data.
- **What "slow" means and who sees it:** a long-tail (non-prebuilt) city pays the first
  SSR; a timeout-degraded render shows hero + honest block + form with no tiles. The
  form submit runs 4 sequential writes plus 2 fire-and-forgets; the visitor waits only on
  the writes (`app/actions/out-of-area-referral.ts:58-122`).
- **Core Web Vitals for `/oregon/*`:** NOT measured this session — named gap. No CWV
  number is claimed here (§0).

## 9. Variants

All variants share the completion contract (referral-candidate lead, no drip, referral
queue) — the shared tail is one gate (`lib/crm/enroll.ts:65-72`). Inception differs:

- **City-page form (this spine):** `/oregon/[city]` → `submitOutOfAreaReferral`.
- **Listing-inquiry classifier:** a visitor on an in-market surface inquires about an
  out-of-area PROPERTY (the feed is statewide). `track-contact-agent` classifies the
  property's city and appends `referralIntakeTags`
  (`app/actions/track-contact-agent.ts:7,76-77,140`), as does the contact form
  (`app/contact/actions.ts:9,56-65`). Inception is `contact-a-broker` / listing surfaces,
  not this page — the tail merges here.
- **Out-of-state:** same classifier, `geo:out-of-state` + `referral:candidate`
  (`lib/referral-geo.ts:115-120`) — same queue, same gate.
- **Fail-closed unclassified:** a property inquiry whose city cannot be classified gets
  ONLY `geo:unclassified` — not auto-enrolled, human review, `unclassified` bucket in the
  queue (`lib/referral-geo.ts:121-123,148-151`).

No split warranted: the paths diverge only at inception and re-converge at the tagged-lead
contract. P3 should record the classifier variants as this process's shared tail (they are
also the overlap with `capture-and-attribute`).

## 10. Current implementation map

- **Routes:** `/oregon/[city]` (`app/oregon/[city]/page.tsx`); middleware boundary
  (`middleware.ts:286-320,497-509`); sitemap emission (`app/sitemap.ts:20,434`); admin
  completion surface `/admin/crm/referrals`
  (`app/admin/(protected)/crm/referrals/page.tsx:1-40`, admin v2 language, P11D).
- **Registers:** the page composes entirely from the **kb** register (`KbHero`, `KbAbout`,
  `KbFeatured`, `KbExploreTowns`, `KbFooter`, `KbOutOfAreaReferral`, `kb.css` —
  `app/oregon/[city]/page.tsx:37-48`), declared `@no-parity` (`:1-2`). kb is one of the
  design languages this program replaces — its use here is a fact, not a shape to inherit.
- **Actions/DAL/crons:** `submitOutOfAreaReferral` (`app/actions/out-of-area-referral.ts`);
  DAL `lib/data/geo/getOutOfAreaCities.ts` + pure policy `lib/out-of-area-cities.ts` +
  pure classifier `lib/referral-geo.ts` (unit tests on main: `lib/referral-geo.test.ts`,
  `lib/out-of-area-cities.test.ts`); crons `refresh-mvs` (`8 * * * *`), `crm-alert-drain`
  (`* * * * *`), `crm-auto-enroll` (`4,19,34,49 * * * *` — blocked by design here).
- **Known defects (evidence, this run):**
  1. **Stale pointer:** `lib/referral-geo.ts:14` cites `app/oregon/[city]/actions.ts` as
     a caller; that file does not exist (`app/oregon/[city]/` contains only `page.tsx`).
     The action lives at `app/actions/out-of-area-referral.ts`. Doc drift.
  2. **Label vs definition:** the page labels the count "Active listings"
     (`app/oregon/[city]/page.tsx:173`) while `activeAllCount` is defined as Active +
     Coming Soon + Active Under Contract (`lib/out-of-area-cities.ts:31-33`), and the
     tiles show `status: 'active'` only (`page.tsx:110`) — hero count and visible
     inventory can diverge. Precision defect against §0 labeling discipline.
  3. **Intent mislabel:** sellers submitting the form are stamped `audience:buyer` +
     `buyer:nurture` (`app/actions/out-of-area-referral.ts:59-60`) even when the notes say
     "selling". Harmless today only because the gate blocks all drips; wrong the moment
     any tag-driven surface trusts it.
  4. **Swallowed read error:** `listReferralCandidates` warn-swallows failures and
     returns `[]` (`lib/data/crm/referralReceivables.ts:73-76`) — a broken read renders a
     confident empty referral queue (the swallowed-errors-lie class; internal surface,
     still a defect).
  5. **Imagery mismatch:** every out-of-area hero uses the Central Oregon Smith Rock
     poster (`app/oregon/[city]/page.tsx:207`) — a Medford page opens on Terrebonne
     scenery.
  6. **Breadcrumb naming:** the trail renders "Oregon"/"Cities" pointing at `/cities`
     (`page.tsx:151,183-190`), which is the Central-Oregon-only index — the label claims
     statewide scope the target does not have. (Naming observation only; P5 owns naming.)
- **Duplicate/parallel paths that should die:** none found — the capture tail is
  deliberately shared with the buyer-intake classifier through one gate, and the
  middleware makes the two-URL problem structurally impossible.

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** It is the honest edge of the statewide feed: without it,
out-of-market queries either soft-404 (the pre-W12 state killed valid cities like Medford
with 672 active at audit — `middleware.ts:288-291`) or, worse, leak into the Central
Oregon drip. It is also the only process that converts out-of-market demand into revenue
(referral fee) and the clearest expression of the north star — useful first, honest about
limits, conversion as the natural next step.

**Ideal shape:** one screen answers everything — honest statement, live inventory, one
email-only capture — with doors back into the graph (sibling markets, the in-market
index). Step count is already minimal (view → one form → done); keep it. The invariant to
preserve through any rebuild: **the no-auto-send gate and the email-only capture are
product law for this tier**, not implementation detail. Fix the §10 defects in the roll
(honest count label, seller/buyer intent from the notes or a selector, market-appropriate
imagery).

**Destination implication:** NOT a destination of its own. This is a leaf tier of the
places pillar — the out-of-market answer at the boundary of whatever P5 names the places
destination — reached by routing (middleware boundary preserved verbatim, including the
double-308 duplicate-content guard) and throttled organic entry, never by nav. The
indexable set's URLs carry earned search equity (60 cities at the 2026-07-22 §0 count);
per the SEO carve-out they are data — any P5 rename requires GSC evidence + 301s.

**Dual objective stamped on its pages:**

- `visitor_objective`: "See live MLS inventory for this Oregon city and get a no-cost
  introduction to a trusted local broker, from a brokerage that says plainly this is not
  its market."
- `machine_objective`: "Capture an out-of-area referral candidate (email + intent) that a
  broker converts by hand into a broker-to-broker referral with a recorded receivable —
  and keep that lead out of every automated drip."
- `exits`: `/oregon/<sibling-city>` (other top out-of-area markets), `/cities` (the
  in-market places index), `homesForSalePath(city)` (full statewide browse for that city),
  `#referral` (the capture form — the conversion exit).

**Data gaps blocking correctness:** none blocking — the chain
(`geo_snapshot_mv` → page → `crm_people` → queue → `referral_receivables`) is complete.
Named measurement gaps: GA4 device split and CWV for `/oregon/*` not pulled this session;
no funnel number for submits-per-visit exists yet (the GA4 `lead_generated` mirror with
`lp_variant: out-of-area-city` makes it queryable — `app/actions/out-of-area-referral.ts:116-122`).

## 12. Acceptance checks

Persist; never delete. Run against production (`ryan-realty.com`) unless noted.

1. **Boundary 308s (both directions):**
   `curl -sI https://ryan-realty.com/cities/medford | grep -i '^\(HTTP\|location\)'`
   → `308` + `location: /oregon/medford`;
   `curl -sI https://ryan-realty.com/oregon/bend | grep -i '^\(HTTP\|location\)'`
   → `308` + `location: /cities/bend`.
2. **Garbage terminates as a real 404:**
   `curl -s -o /dev/null -w '%{http_code}' -L https://ryan-realty.com/cities/xyzzy-not-a-city`
   → `404` (after the 308 hop to `/oregon/xyzzy-not-a-city`).
3. **Honest block renders:**
   `curl -sL https://ryan-realty.com/oregon/medford | grep -c "work in Medford"` ≥ 1.
4. **Indexability policy:** for a top city,
   `curl -sL https://ryan-realty.com/oregon/medford | grep -o '<meta name="robots"[^>]*'`
   contains no `noindex`; for a below-threshold city (pick one with < 5 active from the
   §0 query below) the same grep DOES contain `noindex`.
5. **Sitemap count reconciles (§0):**
   `curl -s https://ryan-realty.com/sitemap.xml | grep -c '/oregon/'` equals the live
   count from `SELECT count(*) FROM geo_snapshot_mv WHERE geo_type='city' AND
   active_all_count >= 5` minus service-area + feed-noise keys (the exact client-side
   filter: `lib/out-of-area-cities.ts:75-90`; helper `countOutOfAreaCities()`,
   `lib/data/geo/getOutOfAreaCities.ts:136-140`), capped at 100.
6. **Classifier + policy units:**
   `npx vitest run lib/referral-geo.test.ts lib/out-of-area-cities.test.ts` — green.
7. **Capture E2E (test email, then clean up):** submit the form on any `/oregon/[city]`,
   then verify in one pass —
   `SELECT id, tags FROM crm_people WHERE 'referral:candidate' = ANY(tags) ORDER BY
   created_at DESC LIMIT 1` carries `geo:out-of-area`, `source:out-of-area-lp`, and
   `city-interest:<slug>`; with that `id` as `:pid`:
   `SELECT count(*) FROM crm_sequence_enrollments WHERE person_id = :pid` → **0** (the
   gate held); `SELECT count(*) FROM crm_tasks WHERE person_id = :pid AND type='Referral'`
   → 1; `SELECT count(*) FROM crm_broker_alerts WHERE person_id = :pid` → 1;
   `SELECT count(*) FROM crm_timeline WHERE person_id = :pid` ≥ 1 (origin note).
8. **Gate unit-proof (no live lead needed):** in `autoEnrollPerson`, any person whose tags
   include `referral:candidate` returns `{ enrolled: false, reason: 'referral candidate
   (out-of-area — referral queue, no local drip)' }` — covered by
   `lib/referral-geo.test.ts` against `geoReferralEnrollBlock`.
9. **Queue visibility:** the E2E lead from check 7 appears at `/admin/crm/referrals` in
   the `referral` bucket with its `city-interest` slug rendered.
10. **Honeypot:** submit with the hidden `company` field filled → UI shows success AND
    `crm_people` gained no row (repeat the check-7 SELECT; newest row unchanged).
