# Process: arrive-from-ad — Click-through lands on a capture LP; the promise is claimed and the lead is routed

## 0. Meta

- Status: **deepened**
- Cadence: **event-driven** (ad clicks, outreach-link clicks, internal CTA clicks; the
  downstream sweeps — `crm-auto-enroll` every 15 min, `saved-search-alerts` hourly — are
  owned by other processes)
- Verdict: **PROPOSAL — KEEP.** This is the paid/outreach front door of the lead machine:
  five noindex capture LPs plus two dual-role indexable ones, all ending in the same
  observable completion (crm_people row + canonical tags + enrollment + deliverable queued
  + broker notified + CAPI/GA4 mirrored). KEEP the process; inside it, MERGE the Tetherow
  form family onto the canonical capture contract (today it tags `cma-requested` but queues
  no CMA — §10 D2), and confirm `sell-your-home` stays a variant, not a sibling. The two
  SEO pages under `/lp/` (`/lp/bend`, `/lp/central-oregon-golf`) are NOT this process —
  they are `evaluate-a-place`/`read-content` nodes that exit into this one. This is a
  proposal for the P3 package, not a lock.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A visitor who clicked an ad, an outreach link, or an on-site CTA gets exactly the
specific thing that click promised — a home valuation, an FSBO pricing report, an
expired-listing audit, or matched listings by email — on a page that message-matches the
promise and asks for the minimum needed to deliver it. (b) This process converts paid and
outreach spend into an identified, attributed, broker-routed CRM lead with the promised
deliverable queued — serving (a) requires an address and/or contact details, and capturing
them with source/campaign/broker attribution IS the machine's client-step (E1→E2 feeder),
so fulfilling the promise and creating the lead are the same act.

## 2. Inception (what starts it)

Trigger: a click lands on one of the `/lp/*` capture routes. Entry channels proven in code:

| Channel | Entry | Evidence |
|---|---|---|
| **Paid (Meta)** | Seller ad creatives all drive to `/lp/seller-home-value`; `?v=` hero variants message-match the clicked concept (mountain / oos / nopressure) | `scripts/_render-seller-ads-pattern-a.mjs:130` ("All variants drive to `/lp/seller-home-value`"); `app/lp/seller-home-value/page.tsx:56-81` (HERO_VARIANTS), `:93-95` (variant resolve) |
| **Paid attribution rescue** | Middleware converts `?fbclid` into a first-party httpOnly `rr_fbc` cookie (90-day, registrable domain) when the pixel never set `_fbc`, explicitly so the LP server actions can attribute the CAPI Lead to the ad click | `middleware.ts:369-393` |
| **Outreach** | Expired-listing owner touches embed the LP URL: `Expired LP: ${siteUrl}/lp/expired-listing` | `lib/expired-listing-processor.ts:188` |
| **Internal CTA** | `/lp/bend` hero CTAs → `/lp/seller-home-value?source=bend-lp` + `/lp/buyer-listing-alerts?source=bend-lp`; `/lp/central-oregon-golf` sticky nav + hero + closing CTAs → both capture LPs with `?source=golf-lp` | `app/lp/bend/page.tsx:449-455`; `app/lp/central-oregon-golf/page.tsx:252,275,281,1005,1011` |
| **Internal (nav constant)** | `VALUATION_LP` nav constant points at `/lp/seller-home-value`, documented "Ad-funnel LP only — never use in primary chrome" | `lib/site-nav.ts:82-86` |
| **Per-broker attribution** | `?agent=<slug>` on ANY page (bridge mounts site-wide) writes the 90-day `rr_agent_attribution` cookie that later reroutes the lead | `components/AgentAttributionBridge.tsx:6-17`; mounted via `components/site/providers/IdentityBridges.tsx:23` ← `RootProvider.tsx:34` |

The nine `/lp/*` routes split three ways (the registry's "8-route hint" was wrong twice —
`sell-your-home` is a variant, `tetherow/heath` was missing):

- **Capture LPs, noindex (5):** `/lp/seller-home-value` (`page.tsx:29`),
  `/lp/sell-your-home` (`page.tsx:20`), `/lp/fsbo` (`page.tsx:38`),
  `/lp/expired-listing` (`page.tsx:39`), `/lp/buyer-listing-alerts` (`page.tsx:25`) —
  all `robots: { index: false, follow: false }`. `/lp/fsbo` and `/lp/buyer-listing-alerts`
  are additionally excluded from the sitemap (`app/sitemap.ts:144-147`).
- **Dual-role capture LPs, indexable (2):** `/lp/tetherow` — indexable but canonical
  pointed at `/communities/tetherow` to end keyword cannibalization while "The LP still
  serves ad traffic" (`app/lp/tetherow/page.tsx:63-80`); `/lp/tetherow/heath` — fully
  indexable (`app/lp/tetherow/heath/page.tsx:41`), in the sitemap
  (`app/sitemap.ts:142`), counted as a seller-intent path by the Meta audience builder
  (`scripts/meta-build-campaign-shells.mjs:59-67`).
- **Not this process (2):** `/lp/bend` (sitemap priority 0.9, `app/sitemap.ts:141`) and
  `/lp/central-oregon-golf` (`app/sitemap.ts:140`) are indexable SEO content pages whose
  job is a place/lifestyle answer; they ENTER this process via the CTAs above.

On arrival, `LandingPageTracker` fires `view_landing_page` with UTM context, persists it
to sessionStorage for the form, and wires 25/50/75/100% scroll-depth events — present on
all nine LP pages (`components/LandingPageTracker.tsx:34-93`; e.g.
`app/lp/seller-home-value/page.tsx:188`, `app/lp/buyer-listing-alerts/page.tsx:168`,
`app/lp/tetherow/heath/page.tsx:378`).

Preconditions: JavaScript (client forms + tracker); no auth. Paid entries usually carry
`utm_*` + `fbclid`; both are optional — a bare direct hit still captures.

## 3. Actors

- **Visitor segments, one per LP promise:** homeowners curious about value
  (seller-home-value), owners ready to list (sell-your-home, `variant="list-now"` —
  `page.tsx:495`), active FSBO sellers (fsbo — every one classified hot,
  `app/lp/fsbo/actions.ts:29`), owners of just-expired listings (expired-listing —
  hot by definition, `app/lp/expired-listing/actions.ts:82`), buyers wanting matched
  listings (buyer-listing-alerts), Tetherow/Heath owners and prospects (tetherow*).
  Device reality: mobile-first is the locked program truth (390 first); a GA4
  device/channel split for the LP family was not queried this pass — listed as a §11
  gap, not asserted.
- **Automated actors:** per-LP server actions (`submitSellerLPForm`,
  `submitFsboLPForm`, expired + buyer equivalents, `submitTetherowLead` via
  `POST /api/cma`, heath's CMA action); the middleware `rr_fbc` writer; the site-wide
  `AgentAttributionBridge`; `autoEnrollByFubId` + instant broker alert
  (`lib/crm/enroll.ts:267-330`); `crm-auto-enroll` sweep (every 15 min,
  `vercel.json:25-26`) and `saved-search-alerts` (hourly, `vercel.json:213-214`) as
  downstream safety nets owned by other processes; Meta CAPI + GA4 MP mirrors.
- **Accountable for completion:** the assigned broker — default Matt, rerouted by the
  `rr_agent_attribution` cookie (`app/actions/agent-attribution-read.ts:20-33`). Hot
  leads get a 5-minute call task in the broker's name; Matt additionally receives the
  always-on alert email on every seller-family submission
  (`app/lp/seller-home-value/actions.ts:631-667`).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| The lead (identity, canonical tags, custom fields, assigned broker) | `public.crm_people` via `sendEvent`/`ensureNativeLead` + `enrichNativeLead` | seller `actions.ts:376-411,486-552`; fsbo `actions.ts:213-224`; expired `actions.ts:179-190`; buyer `actions.ts:245-292` |
| Attribution on the lead | tags `channel:*` / `campaign:*` / `ad-content:*` from origin UTMs, `source:*-lp`, `broker:*`; the UTM-carrying `sourceUrl` on the event | seller `actions.ts:282-308` (referer→UTM passthrough), `:498-505` (`resolvePaidAttributionTags`); buyer `actions.ts:287-291` |
| Paid-click identity | `rr_fbc` cookie (middleware-owned) consumed by CAPI as `_fbc` fallback | `middleware.ts:379-393`; seller `actions.ts:697-699` |
| Broker attribution | `rr_agent_attribution` cookie → `assigned_broker` + `marketing_assignments` ledger | `components/AgentAttributionBridge.tsx:6-17`; seller `actions.ts:541-543,569-576` |
| Sequence membership + SMS consent | `crm_sequence_enrollments` + `crm_suppressions` (fail-closed) | `lib/crm/enroll.ts:290-305` |
| Seller deliverable queue | `public.cmas` draft + `marketing_brain_actions` `content:cma` | seller `actions.ts:611-629`; fsbo `actions.ts:318-330` |
| Buyer deliverable | `public.listing_alerts` (deduped by email+filters_hash), consumed by the hourly alert cron | buyer `actions.ts:352-366`; `app/api/cron/saved-search-alerts/route.ts:7` |
| Hot-lead follow-up | `crm_tasks` (5-min call task) | seller `actions.ts:580-589`; fsbo `actions.ts:309-318`; expired `actions.ts:300-308`; buyer `actions.ts:375-383`; heath `actions.ts:153` |
| Pre-contact partials | `visitor_events` (anonymous, session-keyed) | seller `actions.ts:115-122` |
| Arrival/engagement telemetry | GA4 (`view_landing_page`, `scroll_depth`) + first-party visitor store dual-write | `components/LandingPageTracker.tsx:53,76-88` |

Explicitly NOT a SoR: `valuation_requests` (best-effort analytics mirror, warn-only —
seller `actions.ts:341-361`); GA4 and Meta CAPI (attribution mirrors); the in-house CRM
(decommissioned — `fubPersonId` variables carry native `crm_people.id`,
`lib/crm/enroll.ts:274-287`); sessionStorage LP context (client-side convenience only,
`lib/tracking.ts:204-221`).

## 5. End-to-end path (inception → completion)

1. **Click** — visitor · taps an ad / outreach link / internal CTA · input: the promise
   in the creative · output: request for `/lp/<x>` with `utm_*`, `fbclid`, `?v=`,
   `?source=`, or `?agent=` · touches: nothing yet · failure: wrong/dead URL in a
   creative (the Tetherow class of silent loss, §10 D2 history) · device: mobile-first.
2. **Middleware attribution rescue** — machine · if `?fbclid` present and no `_fbc`/
   `rr_fbc` cookie, mint `rr_fbc = fb.1.<now>.<fbclid>` (90-day, httpOnly)
   (`middleware.ts:379-393`) · failure: none observable to the visitor; a missed write
   only degrades Meta match quality later.
3. **Message-matched render** — machine · LP renders with the hero matched to the ad
   concept (`?v=` on seller LP — `app/lp/seller-home-value/page.tsx:93-95`), server-side
   known-visitor detection via the identity cookie (`page.tsx:99-100`), live §0-clean
   stats or em-dash placeholders (`page.tsx:102-110`) · failure: slow hero pushes the
   ask below the fold.
4. **Arrival telemetry** — machine · `LandingPageTracker` fires `view_landing_page`
   (consent-gated, retry-on-consent, sessionStorage single-fire guard) and persists UTM
   context for the form; scroll-depth listeners armed
   (`components/LandingPageTracker.tsx:40-99`) · failure: gtag blocked → GA4 blind, but
   capture is unaffected (server mirrors exist).
5. **Broker attribution cookie** — machine · site-wide bridge writes
   `rr_agent_attribution` when `?agent=` present (`components/AgentAttributionBridge.tsx:12-17`).
6. **Form engagement** — visitor · fills the LP's form. Seller family: 2-step
   (address → qualify), with step-1 partial capture firing `saveSellerPartialLead`
   unless the embed passes `skipPartialLead`
   (`app/lp/seller-home-value/SellerLPForm.tsx:141-149`) — an anonymous
   `visitor_events` row always, plus a native partial event for cookie-identified
   visitors only (`actions.ts:104-154`). Known visitor with stored email skips step 2
   (`SellerLPForm.tsx:151-154`). Buyer LP: criteria form (budget/areas/beds/timeline).
   Tetherow: 5 FormData forms POSTing `/api/cma`
   (`app/lp/tetherow/_components/TetherowMultiStepForm.tsx:100-111`,
   `app/api/cma/route.ts:1-16`). Exit-intent prompt is the second-chance ask on the
   capture LPs (`app/lp/seller-home-value/page.tsx:587`, fsbo `:450`, expired `:454`,
   buyer `:628`).
7. **Submit → server action** — machine · validates the per-LP contract (seller: address
   + email-or-identity, `actions.ts:263-330`); classifies tier (seller timeline map,
   fsbo/expired always hot); resolves broker from the attribution cookie else Matt
   (`agent-attribution-read.ts:20-33`) · failure: rejection returns an inline error;
   the no-orphan contract holds at this boundary.
8. **UTM capture into the event** — machine · referer's `utm_*` params pass through into
   the event `sourceUrl` and the structured campaign object
   (`actions.ts:282-308,389-399`) · failure: malformed referer → bare LP URL; NOTE
   `?source=bend-lp|golf-lp` is NOT a utm param and is dropped here AND by the client
   tracker (`lib/tracking.ts:196-203`) — §10 D1.
9. **Native capture, never-drop** — machine · `sendEvent('<X> Inquiry')` resolves/creates
   the `crm_people` row; on failure a direct `ensureNativeLead` fallback fires with the
   full canonical tag set so the lead is never lost (seller `actions.ts:413-433`; fsbo
   `actions.ts:205-224`; expired `actions.ts:170-190`; buyer `actions.ts:245-252`) ·
   side effect: anonymous session history replayed onto the person
   (`actions.ts:440-450`).
10. **Compliance gate + enrichment** — machine · `isHardStopped` skips all workflow
    enrichment (seller `actions.ts:457-460`; buyer `actions.ts:275-279`) · otherwise
    canonical tags (`audience:*`, tier, `source:*-lp`, `broker:*`, intent tags, paid
    `channel:/campaign:/ad-content:` tags), custom fields, lead-origin timeline note,
    fire-and-forget geocode→geo tags, `marketing_assignments` ledger row
    (seller `actions.ts:462-577`).
11. **Instant enrollment + broker ping** — machine · `autoEnrollByFubId` with the form's
    `smsConsent`: SMS suppression written FAIL-CLOSED when unconsented, removed on a
    later consenting submit (`lib/crm/enroll.ts:290-305`); then `autoEnrollPerson` and
    the instant broker alert SMS carrying a prepared first touch
    (`enroll.ts:306-330`). Called inline by seller/fsbo/expired/buyer actions
    (seller `actions.ts:604-609`; fsbo `actions.ts:301-306`; expired `actions.ts:249-252`;
    buyer `actions.ts:334-337`) and by `canonicallyTagLead` for the Tetherow family
    (`lib/canonical-lead-tagger.ts:268` — no consent arg, so Tetherow leads are SMS-
    suppressed by default, correctly fail-closed).
12. **Deliverable queued** — machine · seller family: `createCmaRequest` → `cmas` draft
    + `content:cma` brain action + broker/lead emails (seller `actions.ts:611-629`;
    fsbo `actions.ts:320-333`). Buyer: narrowing-guarded, deduped `listing_alerts`
    upserts feeding the hourly alert cron (buyer `actions.ts:338-366`). Tetherow/heath:
    NOTHING is queued — tag `cma-requested` only (§10 D2). Hot leads: the 5-minute
    call task (step evidence in §4 table).
13. **Attribution mirrored server-side** — machine · Meta CAPI `Lead` value $500
    (seller/fsbo/expired) or $300 (buyer) with shared dedup `eventId`, real client
    IP/UA, and `rr_fbc` fallback (seller `actions.ts:672-715`; fsbo `actions.ts:374-390`;
    expired `actions.ts:310-325`; buyer `actions.ts:385-404`) · GA4 MP `generate_lead`
    mirror (seller `actions.ts:717-762`) · browser pixel `Lead` with the same eventID
    (`SellerLPForm.tsx:190-200`).
14. **Confirmation** — visitor · success state restates the promise and the escape-hatch
    phone number (`SellerLPForm.tsx` success card; Tetherow success card at
    `TetherowMultiStepForm.tsx:118-120`) · handoff: the deliverable itself belongs to
    `get-home-value.written-cma` (seller) / `deliver-alerts` (buyer) from here.

## 6. Decision points

- **Which LP = which promise = which contract.** Seller family requires address;
  email-or-identity is the hard gate (`actions.ts:325-330`). Buyer requires email +
  criteria. Tetherow forms accept name/email/phone with context tags. The promise on
  the page decides the fields — nothing more is asked.
- **`?v=` variant resolve** — unknown keys fall back to the default hero
  (`app/lp/seller-home-value/page.tsx:93-95`); message-match never 404s.
- **Partial capture or not** — `skipPartialLead` embed prop (working tree; consumers
  not yet passing it) vs. the Matt-locked no-save-until-contact rule
  (`SellerLPForm.tsx:141-149`; cross-ref written-cma PDS D2). P3 must decide: partial
  saves as paid-remarketing signal on LPs only, or dead everywhere.
- **Tier classification** — seller timeline→hot/warm/nurture; fsbo and expired are
  categorically hot (`fsbo/actions.ts:29`, `expired/actions.ts:82`); hot adds the
  5-minute task.
- **Broker routing** — attribution cookie else Matt; validated slug parse so a
  tampered cookie cannot inject (`app/actions/agent-attribution-read.ts:24-32`);
  `?reason=` similarly validated against a fixed map before it becomes a tag
  (`seller actions.ts:466-482`).
- **Compliance: hard stop** — `isHardStopped` blocks enrichment + enrollment on every
  LP path; buyer LP also skips alert creation for hard-stopped people
  (`buyer actions.ts:275-279,351-353`).
- **Compliance: SMS consent fail-closed** — unchecked box (or a caller that passes no
  consent, e.g. the Tetherow tagger path) writes the sms suppression
  (`lib/crm/enroll.ts:290-305`). Email is never gated here.
- **Alert dedup/narrowing** — buyer alert sets are narrowing-guarded (never a
  whole-MLS alert) and deduped by (email, filters_hash); a previously unsubscribed
  identical search stays muted (`buyer actions.ts:338-353`).
- **§0 data honesty** — LP stat bands render live DAL values or the em-dash
  placeholder, never an invented number (`app/lp/seller-home-value/page.tsx:102-110`);
  Tetherow pulls every figure server-time (`app/lp/tetherow/page.tsx:83-86`).
- **SEO integrity** — capture LPs are noindex (§2 table); fsbo + buyer-listing-alerts
  deliberately out of the sitemap (`app/sitemap.ts:144-147`); Tetherow canonical points
  at the community hub (`app/lp/tetherow/page.tsx:63-71`). Voice canon governs every
  word on these pages (all public copy). No-public-Coming-Soon / ODS-IDX: n/a on the
  capture surfaces — they render our own closed sales and curated listings, not IDX
  search results.

## 7. Completion

Done-when (observable): a `crm_people` row exists (created or enriched) carrying
`audience:*` + tier + `source:*-lp` + `broker:*` (+ paid `channel:/campaign:/ad-content:`
tags when UTMs were present); an enrollment row (or a recorded suppression/guard reason);
the promised deliverable is queued (`cmas` draft + `content:cma` row for the seller
family, `listing_alerts` rows for the buyer LP); the broker is notified (instant alert
SMS, hot-lead `crm_tasks` row when hot, Matt alert email on seller-family); and the
conversion is mirrored (CAPI `Lead` with dedup eventId, GA4 `generate_lead`).

Artifacts at completion: the tagged `crm_people` row + `crm_timeline` origin note +
`marketing_assignments` row; `crm_sequence_enrollments` + consent state;
`cmas`/`marketing_brain_actions` or `listing_alerts`; `crm_tasks` (hot); `visitor_events`
arrival/scroll telemetry; the CAPI/GA4 event pair.

Terminal states: **captured-and-queued** (success — the process hands off to
`get-home-value.written-cma` or `deliver-alerts`) · **captured, hard-stopped** (lead
recorded, no enrichment/enrollment/alerts) · **partial only** (seller step-1 address in
`visitor_events`, step 2 abandoned — remarketing signal, not a lead) · **bounced**
(arrived, never submitted — `view_landing_page` + scroll depth are the only residue) ·
**captured, no deliverable** (the Tetherow defect path — lead exists, promise untracked,
§10 D2).

## 8. Time & performance

- **Time-to-answer budget:** the ask must be in the first viewport — the visitor already
  chose the promise by clicking; the LP's only question is "give me what delivery
  requires." Seller LP renders the form in the hero and again as a closing band
  (`app/lp/seller-home-value/page.tsx:188` region and `:562` per the written-cma PDS);
  step 1 is a single field. The real answer (the deliverable) arrives later and is
  budgeted by the downstream process.
- **Message-match latency:** `?v=` variants resolve server-side pre-paint
  (`page.tsx:93-95`) — no flash of the wrong promise.
- **Submit latency risk:** the seller action awaits capture → enrichment → enroll →
  createCmaRequest sequentially before the visitor sees success
  (`actions.ts:376-629`); the buyer action similarly awaits alert upserts. No fresh
  latency measurement was taken this pass — flagged as a §11 gap, not asserted. The
  sibling `/sell/valuation` path's measured 20s/77s submits (written-cma PDS §8) are
  the cautionary precedent.
- **Partial capture must never block:** step-1 advance is fire-and-forget by contract
  (`actions.ts:110-122` "must never delay the step change").
- **Core Web Vitals:** not measured this pass for any `/lp/*` route — no numbers stated
  (§0). Paid CPC makes LP speed directly a cost lever; the pull belongs to the
  program's growth telemetry (§11 gap).

## 9. Variants

Attributes of one process (same capture contract):

- **Per-promise LP** — seller-home-value (valuation) / sell-your-home (`list-now`
  consultation: same `SellerLPForm` + action with `source:list-now-lp` +
  `seller:listing-intent` — `page.tsx:495`, seller `actions.ts:270-271,492-494`) /
  fsbo (pricing report, always hot) / expired-listing (listing audit, always hot) /
  buyer-listing-alerts (matched listings).
- **`?v=` hero variants** — paid message-match, copy/photo only
  (`seller page.tsx:56-95`).
- **Entry-channel variants** — paid (utm + fbclid), outreach (expired: the LP URL is
  embedded in owner touches, `lib/expired-listing-processor.ts:188`), internal
  (`?source=bend-lp|golf-lp` CTAs; buyer LP is primarily internal-entry today). Same
  contract either way; only the attribution residue differs.
- **`?agent=` attributed** — broker reroute via cookie, any LP
  (`agent-attribution-read.ts:20-33`).
- **Known visitor** — identity cookie skips the seller qualify step
  (`SellerLPForm.tsx:151-154`).

Materially divergent (a real fork inside the process, argument for internal MERGE):

- **Tetherow family** — `/lp/tetherow`'s five forms POST FormData to `/api/cma` →
  `submitTetherowLead` (`app/api/cma/route.ts:17-38`,
  `app/actions/lead-capture.ts:477`), and `/lp/tetherow/heath` has its own action with
  the Matt-specified tag schema (`app/lp/tetherow/heath/actions.ts:10-29`). Both
  capture + tag + CAPI + GA4 like the canon, but neither queues the promised CMA
  deliverable (§10 D2) and neither passes SMS consent explicitly (fail-closed via the
  tagger path — `lib/canonical-lead-tagger.ts:268`). One capture contract should
  swallow this fork.

## 10. Current implementation map

- **Routes:** the nine `/lp/*` routes (§2). Registers: the capture LPs use the bespoke
  landing register (`components/landing/*` — ExitIntentPrompt, ScrollReveal, TrustStrip,
  ReviewStrip: `seller page.tsx:4-7`) + `@/components/ui` primitives in the forms;
  Tetherow ships its own `_components` register
  (`app/lp/tetherow/_components/TetherowMultiStepForm.tsx`); `/lp/bend` and
  `/lp/central-oregon-golf` are page-scoped CSS worlds of their own. At least three
  visual languages inside one process family — the sprawl the program exists to end.
- **Actions/API:** `submitSellerLPForm` + `saveSellerPartialLead`
  (`app/lp/seller-home-value/actions.ts`), fsbo/expired/buyer actions
  (`app/lp/<x>/actions.ts`), `POST /api/cma` → `submitTetherowLead`
  (`app/api/cma/route.ts`, `app/actions/lead-capture.ts:477`), heath action
  (`app/lp/tetherow/heath/actions.ts`), `/api/meta-capi`, GA4 MP. Middleware `rr_fbc`
  (`middleware.ts:379-393`). Shared tail: `sendEvent`/`ensureNativeLead`,
  `enrichNativeLead`, `resolvePaidAttributionTags`, `autoEnrollByFubId` — the machinery
  hypothesized as the `capture-and-attribute` process; THIS process owns the arrival
  surfaces and per-LP capture contracts, and delegates the tail's definition there
  (boundary: everything after "server action resolved a person id" is shared machinery).
- **Known defects (all verified this pass):**
  - **D1 — internal-entry attribution is decorative.** `?source=bend-lp|golf-lp` is
    captured NOWHERE: the client tracker reads only `utm_*` + `fbclid`
    (`lib/tracking.ts:196-203`) and the server actions pass through only `utm_*` from
    the referer (`seller actions.ts:298-304`). Which internal pages feed the capture
    LPs is unmeasurable today.
  - **D2 — Tetherow promises a CMA it never queues.** Both Tetherow paths tag
    `cma-requested` (`heath actions.ts:24,89`; `TetherowMultiStepForm.tsx:102`) but
    neither calls `createCmaRequest` — no `cmas` draft, no `content:cma` row, no
    `/admin/cmas` visibility (grep-verified: zero `createCmaRequest` in
    `app/actions/lead-capture.ts` and `heath/actions.ts`). Fulfillment rides entirely
    on the broker noticing the alert/task. Same family as the 2026-05-31 incident in
    which `/api/cma` 404'd and silently dropped every Tetherow lead while the form
    showed fake success (`app/api/cma/route.ts:4-10`).
  - **D3 — partial saves vs the no-save lock.** `skipPartialLead` exists (uncommitted)
    but no embed passes it; address-only saves fire on every seller embed
    (`SellerLPForm.tsx:141-149`). Owned jointly with the written-cma PDS (its D2);
    the LP-side question is whether paid LPs KEEP partials as remarketing signal.
  - **D4 — FSBO missing from the seller-intent audience paths.** The Meta audience
    builder's `SELLER_LP_PATHS` includes seller-home-value, home-valuation,
    sell/valuation, sell/plan, sell, expired-listing, and tetherow/heath — but NOT
    `/lp/fsbo` (`scripts/meta-build-campaign-shells.mjs:59-67`), so FSBO visits never
    feed the seller-intent custom audience.
  - **D5 — value asymmetry is intentional but undocumented at the source.** CAPI Lead
    $500 seller-family / $300 buyer (seller `actions.ts:709`; buyer
    `actions.ts:399-404` region) — fine, but the figure lives hard-coded in five
    actions; a repriced lead value is a five-file hunt.
- **Duplicate/parallel paths that should die:** the Tetherow form fork (fold onto the
  canonical capture contract + real deliverable queue); heath's bespoke action
  duplicating the seller pipeline minus the CMA queue; the registry hint's framing of
  `/lp/bend` + `/lp/central-oregon-golf` as capture LPs (they are content nodes —
  reassign in the registry, don't rebuild them here).

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** Paid and outreach traffic needs arrival surfaces whose only
job is message-match + minimum-friction claim of a specific promise — that job is real
and distinct from the exploration graph. The shape follows from the job, not from
today's routes:

- **One capture contract, N promises.** Every arrival surface = a promise + the minimum
  fields delivery requires + the SAME canonical tail (never-drop capture, canonical
  tags, fail-closed consent, instant enroll, deliverable queued, broker notified,
  CAPI/GA4 mirrored). A new campaign should mean a new promise config, not a new
  bespoke action. The Tetherow fork merges in or dies.
- **Every promise queues a tracked deliverable.** A capture that only tags
  (`cma-requested`) is a broken promise waiting to be noticed. The deliverable row IS
  the completion state; D2 closes.
- **Attribution becomes total.** Paid (utm/fbclid/rr_fbc) is solid today; internal
  entry (`?source=`) and outreach entry deserve the same first-class residue so spend,
  CTAs, and outreach can be compared on one ledger (D1 closes; either utm-ify internal
  CTAs or capture the param).
- **Off-graph on arrival, into the graph on completion.** Capture LPs stay
  noindex/off-nav (arrival is channel-owned), but the confirmation state is a graph
  door, not a dead end — into the deliverable's node and the visitor's place/market
  nodes. Ideal visitor step count: 2 (arrive → claim), matching the locked E2 contract.
- **Data gaps blocking correctness:** no GA4 device/channel/volume split pulled for
  the LP family this pass; no CWV or submit-latency numbers for any `/lp/*` route; no
  per-LP conversion-rate readout tying `view_landing_page` → capture → deliverable
  (the funnel exists event-by-event but rolls up nowhere).

**Destination implication:** no public destination in the IA. Capture LPs are noindex
arrival surfaces addressed by channel (ads, outreach links, internal CTAs), not nodes in
the exploration graph — the P5 map records them as SYSTEM/off-graph routes with exits
into the graph. The two indexable Tetherow pages must pick a side at P5: community node
(fold into `evaluate-a-place`, capture embedded) or noindex LP — dual-role is how the
cannibalization defect happened.

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Claim the specific thing the ad or link promised — valuation,
  pricing report, listing audit, or matched listings — in one short step."
- `machine_objective`: "Convert the paid/outreach/internal click into an identified,
  attributed, broker-routed CRM lead with the promised deliverable queued."
- `exits`: confirmation state → the deliverable's node (`/cma/[slug]` when it arrives;
  the alert emails' listing links for buyers) → the visitor's city/neighborhood market
  node → direct broker contact (phone). Entry-side exits stay minimal by design (the
  page's job is the claim), but the confirmation is never a dead end.

## 12. Acceptance checks

Persist these; never delete. Use a marked test identity
(`e2e-lp-test+<date>@ryan-realty.com`) and clean up created rows after.

1. **Noindex/sitemap posture:** `curl -s https://ryan-realty.com/lp/seller-home-value | grep -i 'noindex'`
   → present; same for sell-your-home, fsbo, expired-listing, buyer-listing-alerts.
   `curl -s https://ryan-realty.com/sitemap.xml | grep -c '/lp/'` → exactly the
   indexable set (central-oregon-golf, bend, tetherow/heath), never a noindex LP.
   `curl -s https://ryan-realty.com/lp/tetherow | grep 'rel="canonical"'` →
   `/communities/tetherow`.
2. **Message match:** `/lp/seller-home-value?v=oos` renders the "Own a Bend Home From
   Another State?" H1; an unknown `?v=zzz` renders the default hero, HTTP 200.
3. **fbclid rescue:** request any LP with `?fbclid=TEST123` and no `_fbc`/`rr_fbc`
   cookie → response sets `rr_fbc=fb.1.<ts>.TEST123` (httpOnly, Max-Age 7776000).
4. **Arrival telemetry:** with consent granted, GA4 DebugView (or the first-party
   `visitor_events` mirror) shows one `view_landing_page` with `lp_variant` set, then
   `scroll_depth` at 25/50/75/100 as you scroll; the sessionStorage guard prevents a
   second fire on reload within the session.
5. **Capture contract (seller):** submit `/lp/seller-home-value` with the test email,
   timeline "ready to sell now", SMS consent UNCHECKED, arriving via a URL carrying
   `utm_source=facebook&utm_campaign=test-camp&utm_content=test-ad`. Then:
   `SELECT tags, assigned_broker FROM crm_people WHERE emails::text ILIKE '%e2e-lp-test%'`
   → tags include `audience:seller`, `seller:hot`, `source:seller-lp`, `broker:matt`,
   `channel:facebook`, `campaign:test-camp`, `ad-content:test-ad`.
6. **Fail-closed consent + enrollment:**
   `SELECT channel, reason FROM crm_suppressions WHERE person_id=<id>` → `sms` /
   `no-sms-consent` row; `SELECT status FROM crm_sequence_enrollments WHERE person_id=<id>`
   → `running`; `SELECT name, due_at FROM crm_tasks WHERE person_id=<id>` → the 5-min
   hot call task.
7. **Deliverable queued (seller family):**
   `SELECT status FROM cmas WHERE lead_email ILIKE '%e2e-lp-test%'` → `draft`, and a
   `marketing_brain_actions` row with `action_type='content:cma'` for it. Repeat on
   `/lp/fsbo` → same pair plus `intent:fsbo` tag.
8. **Deliverable queued (buyer):** submit `/lp/buyer-listing-alerts` with budget +
   one area →
   `SELECT name, filters_hash FROM listing_alerts WHERE email ILIKE '%e2e-lp-test%'`
   → ≥1 row; resubmit identical criteria → row count unchanged (dedup); then
   `curl -H "Authorization: Bearer $CRON_SECRET" https://ryan-realty.com/api/cron/saved-search-alerts`
   → the alert is evaluated (ok:true).
9. **Broker attribution:** visit any LP with `?agent=rebecca`, submit → `crm_people.
   assigned_broker='rebecca'` and a `marketing_assignments` row naming her; without
   the param → `matt`.
10. **Tetherow contract (pins D2 until fixed, then flips):**
    `curl -X POST https://ryan-realty.com/api/cma -F intent=seller -F name=Test -F email=e2e-lp-test+tth@ryan-realty.com -F resort=tetherow -F tags=seller-intent,resort:tetherow`
    → 200 `{ok:true}`; a `crm_people` row with `resort:tetherow` exists. CURRENT
    expected failure: no `cmas` row is created — once the merge ships, this check
    inverts to require the draft + `content:cma` row.
11. **Attribution mirrors:** Meta Events Manager shows ONE `Lead` deduped across
    pixel + CAPI on the shared eventID with `content_name` matching the LP; GA4
    shows one `generate_lead` with `lp_variant` + `broker_slug`; for a submit that
    arrived with `?fbclid` and a blocked pixel, the CAPI event still carries an
    `fbc` value (the `rr_fbc` fallback).
12. **Never-drop fallback:** with `sendEvent` forced to fail (invalid env in a
    preview deploy), a submit still creates the `crm_people` row via
    `ensureNativeLead` with the full canonical tag set.
13. **Hard-stop gate:** tag the test person `compliance:hard-stop`, resubmit → no new
    enrollment, no alert rows, no CMA queue entry; the person row itself may update.
14. **Internal-entry attribution (pins D1 until fixed):** submit after arriving via
    `/lp/seller-home-value?source=bend-lp` → grep the person's tags and timeline note
    for any `bend-lp` residue. CURRENT expected result: none (the defect); after the
    fix, the check inverts to require it.
