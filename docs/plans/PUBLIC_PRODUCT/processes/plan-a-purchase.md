# Process: plan-a-purchase — buyer education to a named buyer lead

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (organic + paid + internal traffic, 24/7; the CRM enrollment and
  alert-delivery crons that consume its output run every 15 minutes and hourly)
- Verdict: **PROPOSAL — KEEP.** The buyer-education front door is the only surface that turns
  an anonymous "how does buying here even work" researcher into a named lead with a stated
  intent (first-time / relocation / investment) and a timeline — an artifact no find-a-home
  completion carries. The P1 split of the `/tools` calculators into `run-the-numbers` is
  affirmed (they share no completion artifact and no renderer with this process). Two
  consolidation questions ride to P3/P5: (1) the `/lp/buyer-listing-alerts` parallel ad-LP
  duplicates this process's on-page alerts capture and belongs to `arrive-from-ad`'s
  disposition; (2) `/buy` is orphaned from primary chrome — either the IA gives buyer
  education a reachable home or the education content folds into the browse surfaces.
  Proposal only; the verdict locks at P3 in `decisions.md`.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A prospective Central Oregon buyer — first-timer, relocator, or investor — understands
how buying works here (representation rules, earnest money, timelines, the broker's role)
and the path that fits their specific situation, well enough to commit to a concrete next
step. (b) The machine outcome is a named buyer lead in `crm_people` carrying intent +
timeframe (or a durable `listing_alerts` row with an email), which advances the
"contact made / alert created" client-step and is produced precisely because answering the
questions that stand between researching and acting is what makes handing over a name the
obvious next move.

## 2. Inception (what starts it)

Trigger: a buyer-intent visitor lands on `/buy` or one of the exactly three `/buy/[intent]`
guide LPs (`BUY_INTENT_PAGES` holds three keys and `getBuyLanding` 404s everything else,
`lib/lead-landing-content.ts:162-298,304-306`; `app/buy/[intent]/page.tsx:41-42`).
Preconditions: none — every entry is anonymous-capable; `/buy/[intent]` reads session +
identity-bridge cookies only to pin dynamic rendering (`app/buy/[intent]/page.tsx:44-47`).

| Channel | Entry routes | Evidence (opened this run) |
|---|---|---|
| Organic search | `/buy` (sitemap priority 0.6) + the three intent LPs (0.55 each), all with full SEO metadata; `/buy` emits BreadcrumbList + WebPage + FAQPage JSON-LD | `app/sitemap.ts:130,136-138`; `app/buy/page.tsx:40-53,171-192` (faqPage `:187-190`); `app/buy/[intent]/page.tsx:14-37` (per-intent title/description/canonical/OG) |
| Paid / UTM-capable | Any entry with `utm_*` — the form captures real first-touch attribution (`getLpContext()` reads `utm_*` + persisted `rr_lp_context`) and the anonymous `rr` session id at submit | `components/landing/LeadLandingForm.tsx:57-79` (capture `:63-64`); honored server-side in the campaign block, `app/actions/lead-landing.ts:92-98` |
| Internal | `/buy` → the three guide cards; each LP's breadcrumb back to `/buy`; the `/lp/bend` buyers CTA "See the buyer track" → `/buy` | `app/buy/page.tsx:141-157,336-346`; `components/landing/LeadLandingPage.tsx:42-47,54-61`; `app/lp/bend/page.tsx:917` |
| **NOT in primary chrome** | The top-nav "Buy" group links `/homes-for-sale`, and none of its nine children is `/buy` (one IS the parallel `/lp/buyer-listing-alerts`); `KbFooter` carries no `/buy` link (grep this run: only a comment mentions "buyer") | `lib/site-nav.ts:94-108` (group href `:96-97`, LP child `:107`); `components/site/kb/KbFooter.client.tsx` grep |

Chrome at inception: `/buy` and `/buy/[intent]` are KB routes (`lib/site/chrome-routes.ts:29`)
— legacy default chrome suppressed — but they DO receive the single global header
(`PublicNav` → `KbNav`, mounted in `app/layout.tsx:144-149`; its hide set excludes `/buy`,
`components/site/PublicNav.client.tsx:15-27,39-45`). Inception is telemetered:
`KbSectionTracker pageType="buy"` (`app/buy/page.tsx:168`) and `pageType="lead-landing"`
(`components/landing/LeadLandingPage.tsx:53`) dual-sink `section_view` + scroll-depth
milestones to GA4 and `/api/visitors/track`
(`components/site/kb/KbSectionTracker.client.tsx:7-38`).

## 3. Actors

- **The three named buyer segments** — the process's own content model splits its audience
  into first-time buyer, relocator, and investor, each with its own LP config (budget/offer
  education; remote-move shortlisting; buy-box underwriting)
  (`lib/lead-landing-content.ts:163-207,208-253,254-297`). The generic `/buy` visitor is the
  fourth: undifferentiated buyer-curious, served value props + process + FAQ
  (`app/buy/page.tsx:101-157`).
- **Device reality:** mobile 390 is Matt-locked product truth (`decisions.md` 2026-08-11);
  `/buy` even carries a mobile-specific hero fix (the >=760px compact hero exists because the
  4-line H1 + 5 chips overflowed into the fixed nav on phones, `app/buy/page.tsx:196,201-203`).
  A GA4 device-split number was NOT queried this session and is therefore not stated (§0);
  pulling it is a P4/P8 gap item.
- **Automated actors:** `canonicallyTagLead` fire-and-forgets auto-enrollment into the buyer
  workflow, with the 15-minute `crm-auto-enroll` cron as catch-all
  (`lib/canonical-lead-tagger.ts:264-270`; `vercel.json:25`); `crm-sequence-engine` +
  `crm-scheduled-sends` fire the enrolled touches (`vercel.json:57,53`); the hourly
  `saved-search-alerts` cron delivers what the alerts-band completion captures
  (`vercel.json:213`). Alert signups also get a 5-minute-due broker reminder task
  (`app/actions/search-alert-capture.ts:130-135`).
- **Accountable for completion:** the visitor completes the form/alert themselves; the
  assigned broker (resolved inside `canonicallyTagLead` → `recordAssignment`,
  `lib/canonical-lead-tagger.ts:255-263`) owns the follow-up, notified by email on every LP
  lead (`app/actions/lead-landing.ts:151-157`).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Lead identity | `public.crm_people` via `sendEvent` → `ensureNativeLead` (the FUB module is a native shim: FUB decommissioned 2026-06-24, `sendEvent` is the one live capture entry point returning the native personId) | `lib/followupboss.ts:2-34` (esp. `:27-29`); `app/actions/lead-landing.ts:84-99`; direct `ensureNativeLead` fallback `:106-124` |
| Guest alert (path b) | `public.listing_alerts` via `upsertListingAlert` — the must-succeed write | `app/actions/search-alert-capture.ts:141-143` |
| Broker follow-up | `public.crm_tasks` — written for alert signups only; LP submits notify by email with NO task row (an asymmetry, see §10) | `app/actions/search-alert-capture.ts:130-135`; `app/actions/lead-landing.ts:151-157` |
| Behavioral trail + attribution | first-party `visitor_sessions`/`visitor_events` (section/scroll beacons) and the submit-time session stitch (`backfillSessionToFub`) that marks the session identified — what the Marketing ROI dashboard counts as "matched to a name" | `components/site/kb/KbSectionTracker.client.tsx:7-28`; `app/actions/lead-landing.ts:49-51,178-185` |
| Page content | Code, not a DB: the entire intent-LP content model is the static `BUY_INTENT_PAGES` map; `/buy`'s FAQ/value-prop/process copy is in-file constants | `lib/lead-landing-content.ts:162-298`; `app/buy/page.tsx:55-157` |
| Hero imagery | `/buy`: the approved asset library via `getSurfaceImage` (DAL); the three intent LPs: hotlinked Unsplash URLs — explicitly NOT the asset-library SoR (defect, §10) | `app/buy/page.tsx:28,160-164`; `lib/lead-landing-content.ts:172,218,263` |
| **NOT a SoR** | GA4 (a mirror — `fireLeadGenerated`), Meta CAPI (a paid-attribution side effect), the form's client state, toasts | `app/actions/lead-landing.ts:126-149,192-202` |

## 5. End-to-end path (inception → completion)

1. **Land** · visitor · arrives on `/buy` (ISR 300s, `app/buy/page.tsx:38`) or directly on an
   intent LP (dynamic per-request — the session reads pin it,
   `app/buy/[intent]/page.tsx:44-47`) · URL (+ any `utm_*`) · SSR page; section/scroll
   telemetry armed (`app/buy/page.tsx:168`; `components/landing/LeadLandingPage.tsx:53`) ·
   Next ISR/dynamic + `getSurfaceImage` DAL for the `/buy` hero (`app/buy/page.tsx:160-164`) ·
   failure: unknown intent slug 404s via `notFound()` (`app/buy/[intent]/page.tsx:41-42`) ·
   both devices.
2. **Orient** · visitor · reads the `/buy` hero and picks from six quick-links — "Search
   homes" is the single filled primary (design-audit CNV-5), the rest ghost: alerts anchor,
   open houses, price drops, contact, area guides · click · navigation or in-page anchor
   (`app/buy/page.tsx:91-98,232-241`) · none · failure: n/a — static links · both.
3. **Learn the process** · visitor · reads value props ("the broker who walks the house
   writes the offer"), the 4-step walkthrough, and the 6-item FAQ (representation agreement,
   earnest money, timelines, buyer-broker pay) · scroll · `section_view` beacons per section
   (`app/buy/page.tsx:101-157,246-324,358-405`) · visitor-track API · failure: tracking is
   fire-and-forget, never blocks (`KbSectionTracker.client.tsx:7-28`) · both.
4. **Choose an intent** · visitor · opens one of the three guide cards → `/buy/[intent]`
   resolves its config via `getBuyLanding` · click · the intent LP
   (`app/buy/page.tsx:141-157,336-346`; `app/buy/[intent]/page.tsx:39-49`;
   `lib/lead-landing-content.ts:304-306`) · none · failure: only the three registered slugs
   exist · both.
5. **Read the intent LP** · visitor · hero (title/subtitle + primary CTA anchoring to
   `#lead-form` + intent-specific secondary CTA), challenge bullets, process steps, trust
   bullets, three testimonials, FAQ with FAQPage JSON-LD emitted from the same visible Q&A ·
   scroll · beacons (`components/landing/LeadLandingPage.tsx:67-95,100-133,150-197`;
   JSON-LD `:171-177`) · none · failure: none — fully static content from config · both;
   desktop gets the form sticky in-viewport (`:233`), mobile reaches it via the hero anchor
   (`:87`).
6. **Submit the lead form** · visitor · fills name (required), email (required), phone
   (optional), timeline select (5 options, default "just planning"), free-text message; the
   client captures `getLpContext()` + `readRrSessionId()` at submit, then dynamic-imports the
   server action · form fields · `submitLeadLandingForm(...)` call
   (`components/landing/LeadLandingForm.tsx:32-38,57-79,111-176`) · server action · failure:
   server-side validation rejects empty name / invalid email with a field-level error toast
   (`app/actions/lead-landing.ts:62-63`; `LeadLandingForm.tsx:81-84`) · both.
7. **Capture** · system · `sendEvent` (buyer → event type `'General Inquiry'`) writes the
   native lead via `ensureNativeLead` with the true first-touch campaign (lp_source falls
   back to `'landing_page'` only when no context exists), message =
   `intent=… | timeframe=… | message=…` · person + campaign · `crm_people` row + returned
   personId (`app/actions/lead-landing.ts:66-99`; `lib/followupboss.ts:27-29`) · failure: on
   a capture failure the action writes a direct `ensureNativeLead` fallback row tagged
   `fub-fallback` so the lead is never dropped, then STILL surfaces the error so the visitor
   retries (the native row dedupes on retry) (`app/actions/lead-landing.ts:100-124`) · n/a —
   server.
8. **Side effects** · system · Meta CAPI `Lead` (buyer value 300, `buyer_inquiry`,
   fire-and-forget); broker notification email ("Buyer Lead Landing"); canonical
   `audience:buyer` tagging + broker assignment + fire-and-forget auto-enroll (15-min cron
   catch-all); anonymous-session stitch when the submitted sessionId is a valid v4 UUID; GA4
   Measurement Protocol mirror with intent/page/timeframe · personId + eventId ·
   dashboards + CRM enrollment (`app/actions/lead-landing.ts:126-149,151-157,165-189,192-202`;
   `lib/canonical-lead-tagger.ts:264-270`; `vercel.json:25`) · failure: every side effect is
   individually caught; none can fail the capture (`:147-149,157,187-189`) · n/a — server.
9. **Confirm** · visitor · sees the in-card "Request received" state + success toast; the CTA
   click is tracked · state flip · done-state UI
   (`components/landing/LeadLandingForm.tsx:86-93,103-109`) · GA4 · failure: n/a · both.
10. **Complete — alternate path b, listing alert on `/buy`** · visitor · submits email on the
    mid-page `RegionalSfrAlertsBand` (Central Oregon + `propertyType:'A'` prefilled) →
    `KbCommunityAlerts` → `submitSearchAlertSignup`: honeypot → per-IP rate limit
    (fail-closed in prod) → email validation → narrowing-filter guard → native buyer lead +
    `idx-registration` canonical tagging + 5-min `crm_tasks` reminder → durable
    `listing_alerts` row → GA4 mirror; the client remembers a guest-watch residual and fires
    `alert_create` · email · alert + lead artifacts
    (`app/buy/page.tsx:351-354`; `components/site/kb/RegionalSfrAlertsBand.tsx:24-31`;
    `components/site/kb/KbCommunityAlerts.client.tsx:61-86`;
    `app/actions/search-alert-capture.ts:41-155`) · failure: CRM capture is best-effort; the
    `listing_alerts` upsert is the must-succeed write (`:141-143`) · both.
11. **Complete — alternate path c, exit into a sibling process** · visitor · leaves via the
    primary "Search homes" chip or an LP secondary CTA (browse `/homes-for-sale`, area
    guides, `/housing-market`) → `find-a-home` / `evaluate-a-place` /
    `explore-market-knowledge`; or "Talk to a broker" → `/contact?inquiry=Buying`, which
    pre-selects the Buying inquiry → `contact-a-broker` · click · process handoff
    (`app/buy/page.tsx:91-98,353`; `lib/lead-landing-content.ts:176,222,267`;
    `app/contact/page.tsx:50,80-81`) · n/a · failure: n/a · both.
12. **Handoff** · system · the enrolled sequence engine takes over touches
    (`vercel.json:57,53`) and the hourly alert cron emails matches (`vercel.json:213`) — the
    boundary where this process ends and `capture-and-attribute` / `deliver-alerts` begin ·
    n/a — machine step · cron-owned, out of scope here.

## 6. Decision points

- **Intent resolution**: registered slug renders its config; anything else 404s — no
  catch-all buyer LP (`app/buy/[intent]/page.tsx:41-42`; `lib/lead-landing-content.ts:304-306`).
- **Audience branch in the SHARED action**: `submitLeadLandingForm` serves both this process
  and `plan-a-sale`'s `/sell/[intent]` — buyer forks to event type `'General Inquiry'`,
  lead value 300, source `buyer-lp`, `buyer_inquiry` CAPI type
  (`app/actions/lead-landing.ts:73,106,127,141,170`).
- **Capture-failure fallback**: failed `sendEvent` → direct native row + surfaced retry error
  (dedupes on retry) (`app/actions/lead-landing.ts:100-124`).
- **personId + UUID gates**: canonical tagging/stitch run only with a returned personId;
  the stitch only for a valid v4 session UUID (`app/actions/lead-landing.ts:167,178`).
- **Alerts-band spam guards**: honeypot pretends success and writes nothing; missing/downed
  rate limiter fail-closes in production; a filterless signup is rejected (no "every home"
  alerts) (`app/actions/search-alert-capture.ts:41-44,46-67,86-88`).
- **Compliance gates in-path**: A2P/SMS consent disclosure sits under the LP form
  (`components/landing/LeadLandingForm.tsx:175`); `canonicallyTagLead` skips enrollment on a
  compliance hard-stop tag (`lib/canonical-lead-tagger.ts:228-231`); voice canon + §0 apply
  to all rendered copy. ODS/IDX attribution and no-public-Coming-Soon: n/a — these pages
  render zero listing data (verified across `app/buy/page.tsx` and
  `components/landing/LeadLandingPage.tsx` this run; the moment a listing rail is added,
  both gates apply).
- **§0 watch**: `/buy`'s FAQ states numeric practice claims — earnest money "1 to 3
  percent", closing "30 to 45 days", cash "10 to 21 days" — with no named basis in-file
  (`app/buy/page.tsx:62-64,76-79`). They are practice knowledge, not queried stats; P4
  either names a basis or the numbers soften to conditions.

## 7. Completion

Done when ONE observable artifact exists:

1. **Named buyer lead** — a `crm_people` row carrying `intent=` + `timeframe=` in its event
   message, canonical `audience:buyer` + `source:buyer-lp` tags, broker assignment, and (when
   stitchable) an identified `visitor_sessions` row
   (`app/actions/lead-landing.ts:76-99,165-185`).
2. **Guest alert** — a `listing_alerts` row + native lead + `crm_tasks` reminder from the
   `/buy` alerts band (`app/actions/search-alert-capture.ts:101-143`).
3. **Process handoff** — a deliberate exit into `find-a-home`, `contact-a-broker`,
   `evaluate-a-place`, or `explore-market-knowledge` via the page's own CTAs
   (`app/buy/page.tsx:91-98`; `lib/lead-landing-content.ts:176,222,267`) — completion for
   THIS process because education succeeded and the next process's inception fired.

Artifacts at completion: the CRM person with intent + timeframe; the broker notification
email; the Meta CAPI `Lead` + GA4 `lead_generated` mirrors; the durable alert filters +
hash; the guest-watch residual for return visits
(`components/site/kb/KbCommunityAlerts.client.tsx:70-77`). Terminal states: **converted**
(artifact 1 or 2), **handed off** (artifact 3 — observable as a tracked exit click),
**abandoned** (section/scroll trail only — still CRM-visible warmth via first-party events).

## 8. Time & performance

- **Time-to-answer budget**: `/buy` answers "who helps me buy here" in the first viewport
  (H1 + broker-model lede + the six next-step chips, `app/buy/page.tsx:204-243`); each intent
  LP answers its segment's question in the hero title/subtitle and puts the conversion form
  one anchor-click away (`components/landing/LeadLandingPage.tsx:84-93`), sticky in-viewport
  on desktop (`:233`). The visitor's question must be answered before any scroll; the form
  must never be the first thing (education earns the ask — north-star requirement).
- **Freshness windows**: `/buy` ISR 300s (`app/buy/page.tsx:38`); the three intent LPs are
  fully dynamic per-request because two cookie reads pin them (`app/buy/[intent]/page.tsx:44-47`)
  — a deliberate trade recorded in-file, but it makes every ad click a cold render; whether
  the pin is still needed post-FUB is a P4 question (the mirror it fed was deleted, `:45-47`).
- **LCP dependency defect**: the intent-LP hero is a priority `next/image` pointed at
  hotlinked `images.unsplash.com` URLs (`components/landing/LeadLandingPage.tsx:68-77`;
  `lib/lead-landing-content.ts:172,218,263`) — the LP's LCP depends on a third party.
- **What "slow" means and who sees it**: paid/UTM visitors landing on a dynamic intent LP
  bear the worst case (cold serverless render + third-party hero); a slow render here is a
  paid click reading a blank hero.
- **Core Web Vitals reality**: NOT measured this session — no CWV number is stated (§0).
  Field CWV for `/buy` and `/buy/[intent]` is a required P8 litmus input.

## 9. Variants

- **The three intents** — first-time / relocation / investment share one renderer
  (`LeadLandingPage`), one form, one server action, one config map; only copy, secondary CTA
  target, and the `intent` string differ (`lib/lead-landing-content.ts:162-298`). Lenses, not
  splits.
- **Paid vs organic entry** — identical path; the only difference is the lpContext payload
  the form carries (`components/landing/LeadLandingForm.tsx:63-64`;
  `app/actions/lead-landing.ts:92-98`). No split.
- **The audience twin** — `/sell/[intent]` (plan-a-sale) shares the renderer, form, action,
  and config file with an `audience` fork (`lib/lead-landing-content.ts:26-160`;
  `components/landing/LeadLandingPage.tsx:45-49`). Shared implementation, different process —
  a P4/P9 coupling fact: a change here ships to seller LPs too.
- **The alerts band** — the same `listing_alerts` product as homepage/cities
  (`components/site/kb/RegionalSfrAlertsBand.tsx:1-5`), completing into `save-and-return` /
  `deliver-alerts` territory. In-process capture, not a variant.
- **Returned split (P1, affirmed)** — the `/tools` calculators (`mortgage-calculator`,
  `rental-property-calculator`, `appreciation`) were seeded here and returned as
  `run-the-numbers`: different renderer, different completion, no shared code with this
  process. NOTE: `page-inventory.json` still maps the two calculators to `plan-a-purchase`
  from the P1 best-effort pass — the inventory correction is a P3-package item (verified
  this run; registry already lists `run-the-numbers` as its own row).

## 10. Current implementation map

- **Routes**: `/buy` (`app/buy/page.tsx`), `/buy/first-time-home-buyer`, `/buy/relocation`,
  `/buy/investment` (`app/buy/[intent]/page.tsx` over `BUY_INTENT_PAGES`,
  `lib/lead-landing-content.ts:162-298`). All four in the sitemap
  (`app/sitemap.ts:130,136-138`).
- **Design registers (of the 4 surviving languages)**: **kb** owns both surfaces (`kb.css`,
  Kb* chrome, `app/buy/page.tsx:31-36`; `components/landing/LeadLandingPage.tsx:31-36`) with
  large inline `<style>` blocks on the LP renderer (`:205-256`) and inline style objects
  throughout `/buy` — section styling lives in page files, not a system. The form inside is
  **shadcn/ui primitives** (`components/landing/LeadLandingForm.tsx:5-17`). Register mixing
  inside one surface; the P9 ratchet's target.
- **Actions/API/crons**: `submitLeadLandingForm` (`app/actions/lead-landing.ts:54-209`),
  `submitSearchAlertSignup` (`app/actions/search-alert-capture.ts:35-158`), `/api/meta-capi`
  (fired from the action, `:128`), `/api/visitors/track` (beacons), crons `crm-auto-enroll` /
  `crm-sequence-engine` / `crm-scheduled-sends` / `saved-search-alerts`
  (`vercel.json:25,57,53,213`).
- **Known defects / duplicates that should die (P3/P5 input)**:
  1. **Orphaned front door**: no primary-chrome path reaches `/buy` — the nav Buy group is
     `/homes-for-sale` and its children omit `/buy` (`lib/site-nav.ts:94-108`); reach is
     sitemap, LP breadcrumbs, and one `/lp/bend` CTA (`app/lp/bend/page.tsx:917`).
  2. **Duplicate capture surface**: `/lp/buyer-listing-alerts` is a parallel noindex ad-LP
     for the same `listing_alerts` product (`app/lp/buyer-listing-alerts/page.tsx:25`),
     linked from the nav (`lib/site-nav.ts:107`) and from the alerts band's "Prefer a longer
     form" (`components/site/kb/RegionalSfrAlertsBand.tsx:45-51`) — two funnels, one product.
  3. **Off-library hero assets**: all three intent LPs hotlink Unsplash
     (`lib/lead-landing-content.ts:172,218,263`) instead of the approved asset library that
     `/buy` itself uses (`app/buy/page.tsx:160-164`).
  4. **Stale docblock + dead import**: `LeadLandingPage` imports `KbNav` and never renders it;
     its docblock still claims KbNav-on-page chrome and calls the capture "the FUB lead path"
     (`components/landing/LeadLandingPage.tsx:22,32` vs the global-nav reality,
     `components/site/PublicNav.client.tsx:15-27`; FUB is a native shim,
     `lib/followupboss.ts:2-34`).
  5. **Untraced FAQ numbers**: earnest-money and timeline ranges with no named basis in-file
     (`app/buy/page.tsx:62-64,76-79`) — §0 watch.
  6. **Notification asymmetry**: an alert signup writes a 5-minute `crm_tasks` reminder
     (`app/actions/search-alert-capture.ts:130-135`); a full intent-LP lead — richer intent —
     gets only email (`app/actions/lead-landing.ts:151-157`). The stronger signal has the
     weaker follow-up mechanism.
  7. **Buyer leads land as `'General Inquiry'`** while sellers get `'Seller Inquiry'`
     (`app/actions/lead-landing.ts:73`) — the event type erases the buyer intent the form
     just captured (the tags recover it, but the event stream reads generic).
  8. **Dynamic pin of unknown value**: the session reads that force per-request rendering fed
     a deleted FUB mirror (`app/buy/[intent]/page.tsx:44-47`) — possibly a free ISR win.

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes — as the education layer of the buyer pillar,** not as a parallel
funnel. The exploration-graph north star makes find-a-home the buyer spine; this process is
what catches the visitor who is not ready to browse — they need the rules, the local
mechanics, and a segment-specific plan first. Its shape derives from that job (orient →
match my situation → hand over my name or start browsing), NOT from today's hub-plus-three-LPs
route structure; whether buyer education is a destination, a layer inside the browse
surfaces, or both is a P5 call under amnesia (SEO carve-out: all four routes are indexed
with earned metadata — GSC evidence per route is mandatory before any P5 cut/rename, and
cuts get 301s).

- **Ideal step count**: 2 visitor steps on the happy path — match my situation (segment
  self-selection, on entry) → commit (form, alert, or a confident exit into browsing).
  Today's happy path is 3 (hub → intent LP → form); the hub adds a hop for every visitor who
  already knows their segment.
- **Device**: mobile 390 is truth (Matt-locked); the desktop sticky-form pattern must have a
  mobile equivalent that keeps the commit action one gesture away without interrupting
  reading.
- **Continuity (binding decision #5)**: a visitor arriving from a place page or a search
  should see buyer education in the context they established (their city, their price band)
  — today the process is context-blind: every entry gets identical Central-Oregon-generic
  copy, and an exit to `/homes-for-sale` starts a cold search. P5 must specify which context
  persists across the education ↔ browse edges.
- **Consolidations implied**: ONE alerts capture product with one funnel (the band vs
  `/lp/buyer-listing-alerts` duplication dies with `arrive-from-ad`'s disposition); intent
  education either earns nav reachability or stops pretending to be a destination; the
  seller/buyer shared renderer is kept only if P6 wants one LP pattern for both.
- **Data gaps blocking correctness**: GA4 traffic + device split per route and per-intent
  conversion counts (which intent actually produces leads) — none queried this session, all
  needed before P5 sizes this process's destination; GSC equity per route; a named basis for
  the FAQ practice numbers; whether the intent-LP dynamic pin can drop (ISR).

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Understand how buying works in Central Oregon for my situation —
  first home, relocation, or investment — well enough to take the next step with confidence."
- `machine_objective`: "Capture a named buyer lead with intent and timeline (or a listing
  alert with an email) at the moment the education makes reaching out the obvious next move."
- `exits`: intent guide → its segment LP → form (`contact-a-broker` handoff on submit) ·
  "Search homes" / secondary CTAs → `find-a-home` (`app/buy/page.tsx:91-98`;
  `lib/lead-landing-content.ts:176`) · "Area guides" → `evaluate-a-place`
  (`lib/lead-landing-content.ts:222`) · "View market reports" → `explore-market-knowledge`
  (`lib/lead-landing-content.ts:267`) · alerts band → `save-and-return` / `deliver-alerts`
  (`app/buy/page.tsx:351-354`) · "Talk to a broker" → `contact-a-broker`
  (`app/buy/page.tsx:96,353`). Exact exit routes are P5 output; these are the graph edges
  the process requires.

**Destination implication (proposal, not a lock):** buyer education lives as ONE reachable
node in the buyer pillar (a destination or an integrated layer of the browse destination —
P5 decides), with segment guides as its modes; it must not remain an orphaned parallel
funnel with its own duplicate capture products.

## 12. Acceptance checks

Prove the process end-to-end. Persist; never delete.

1. **Entry + metadata**:
   `curl -s https://ryan-realty.com/buy | grep -o '<title>[^<]*</title>'` → the buy title
   (`app/buy/page.tsx:41`); `curl -s https://ryan-realty.com/buy/relocation | grep -o '<link rel="canonical"[^>]*>'`
   → canonical `/buy/relocation` (`app/buy/[intent]/page.tsx:21`).
2. **Intent 404 contract**:
   `curl -s -o /dev/null -w '%{http_code}' https://ryan-realty.com/buy/not-a-real-intent`
   → 404 (`app/buy/[intent]/page.tsx:41-42`).
3. **Sitemap presence**: `curl -s https://ryan-realty.com/sitemap.xml | grep -c '/buy'` ≥ 4
   (hub + three intents, `app/sitemap.ts:130,136-138`).
4. **JSON-LD**: `curl -s https://ryan-realty.com/buy | grep -o '"@type":"FAQPage"'` → present
   (`app/buy/page.tsx:187-190`); same check on an intent LP
   (`components/landing/LeadLandingPage.tsx:171-177`).
5. **Lead completion (path a)** — submit the relocation form with a test email, then:
   `select id, first_name, email from crm_people where email = '<test>';` → one row; and the
   person's latest event message contains `intent=relocation` and the chosen
   `timeframe=` (`app/actions/lead-landing.ts:76-91`); and the person carries
   `audience:buyer` + `source:buyer-lp` tags (`lib/canonical-lead-tagger.ts` via `:165-176`).
6. **Fallback honesty (path a, dev)** — force the capture to fail (dev), submit, confirm the
   visitor sees a retry error AND a `crm_people` row tagged `fub-fallback` exists
   (`app/actions/lead-landing.ts:100-124`).
7. **Session stitch** — submit with a browsed session, then:
   `select identified_via from visitor_sessions where session_id = '<uuid>';` →
   `form_submit` (`app/actions/lead-landing.ts:178-185`).
8. **Alert completion (path b)** — submit a test email on the `/buy` band, then:
   `select email, filters from listing_alerts where email = '<test>' order by created_at desc limit 1;`
   → one row whose filters include `propertyType: 'A'`
   (`components/site/kb/RegionalSfrAlertsBand.tsx:28`;
   `app/actions/search-alert-capture.ts:141-143`); and
   `select name, due_at from crm_tasks where person_id = (select id from crm_people where email='<test>') order by created_at desc limit 1;`
   → the 5-minute reminder (`:130-135`).
9. **Spam guards (path b)**: fill the honeypot → `{ok:true}` with NO rows written
   (`app/actions/search-alert-capture.ts:41-44`); submit the band's payload with empty
   filters → rejected with the "add a filter" error (`:86-88`).
10. **Exit wiring**: on `/buy`, the first hero chip links `/homes-for-sale` and renders as
    the single filled primary (`app/buy/page.tsx:92,236-240`); "Talk to a broker" lands on
    `/contact` with the Buying inquiry pre-selected (`app/contact/page.tsx:80-81`).
11. **Telemetry**: load `/buy` in a browser, scroll; confirm `section_view` beacons POST to
    `/api/visitors/track` with full URLs (`components/site/kb/KbSectionTracker.client.tsx:11-17`).
12. **Cron wiring**: `grep -n 'crm-auto-enroll' vercel.json` → `4,19,34,49 * * * *`
    (`vercel.json:25`); `grep -n 'saved-search-alerts' vercel.json` → `0 * * * *`
    (`vercel.json:213`).
13. **Orphan check (holds until P5 changes it)**:
    `grep -rn "href: '/buy'" lib/site-nav.ts` → no match (the nav Buy group must NOT silently
    grow a `/buy` link outside a P5 decision; today's truth is `lib/site-nav.ts:94-108`).
14. **Timed span (P8 litmus input)**: on a real phone, cold `/buy` → intent LP → lead
    submitted — record the seconds; a timing not measured this session is not a timing.
