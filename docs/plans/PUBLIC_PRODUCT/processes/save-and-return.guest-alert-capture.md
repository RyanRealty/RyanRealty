# Process: save-and-return.guest-alert-capture — Guest email alert capture (no account → alert emails → optional account claim)

## 0. Meta

- Status: deepened
- Cadence: continuous
- Verdict (PROPOSAL, not a lock): **KEEP** — this is the only anonymous→identified
  conversion mechanism on the site's highest-intent browse surfaces (search + every place
  page family), and it is structurally distinct from both siblings: unlike
  `save-and-return.search-alerts` it needs no account and carries the full spam-hardening
  + lead-generation contract (honeypot, fail-closed rate limit, CRM buyer lead, broker
  task); unlike `deliver-alerts` it is a visitor-facing capture process, not the machine
  engine. Its completion side is deliberately thin: delivery is owned by `deliver-alerts`,
  and its best exit CONVERTS the subscriber into `save-and-return.search-alerts` via
  claim-on-sign-in. P3 should ratify it as the bridge process with two hard interfaces
  (hand-off to the delivery engine at the `listing_alerts` row; hand-off to the portal
  process at the claim) rather than merging it into either side.
- Last evidence pass: 2026-08-11 (every file:line below opened this session)

## 1. Purpose

(a) An anonymous visitor browsing homes gets the market watched for them: they type one
email address into the page they are already on and new listings matching their exact
current search arrive in their inbox, with no account, no password, and no phone number.
(b) It advances the capture-and-identify step of the machine — an anonymous browse session
becomes a canonical CRM buyer lead (`audience:buyer`, warm, broker-assigned, with a 5-minute
follow-up task) plus a durable `listing_alerts` subscription that keeps a permanent
return-visit channel open — and serving (a) produces it because the watching service cannot
be delivered without an email address, so the visitor hands over exactly the one identifier
the machine needs in exchange for the service.

## 2. Inception (what starts it)

Trigger: an anonymous visitor submits an email in one of three guest capture affordances.
Preconditions: NOT signed in (every affordance is guest-gated — the strip returns null for
signed-in users, components/search/SearchAlertCapture.tsx:180); email is the only required
field; the captured filters must narrow inventory (§6).

Entry channels: any — organic, direct, internal link, social. (The PAID capture is a
separate LP with its own action — §9.) Concrete inception surfaces (all opened this run):

- **The inline alert strip on search** (`SearchAlertCapture`): list view mounts the sticky
  variant, map/split mounts the inline variant, on both search routes —
  app/search/page.tsx:397-401 (variant by view), app/search/[...slug]/page.tsx:379-385
  (city/preset routes, path-derived default filters), app/search/[...slug]/sections/
  MapSplitView.tsx:329-335 (split view, inline). The canonical public URL family is
  `/homes-for-sale...`: `/search` 301s to `/homes-for-sale` (next.config.ts:211-212) and
  `/homes-for-sale` rewrites internally to the `/search` app routes (next.config.ts:299-300).
- **The "Get alerts" chip in the filter row** scrolls to the strip and focuses its email
  input (components/search/SearchFilters.tsx:133-141 focus helper, :537-545 the chip).
- **The guest branch of SaveSearchButton** — "Save this search" is always visible to
  guests by design (components/SaveSearchButton.tsx:60-64 comment, :293-358 the guest
  email form); mounted in both filter bars (components/SearchFilterBar.tsx:602,
  components/search/SearchFilters.tsx:535). Guest submit routes through the same server
  action (SaveSearchButton.tsx:115-131 `handleGuestSave` → `submitSearchAlertSignup`).
- **The place-page capture block** (`KbCommunityAlerts`) — same action, place-prefilled
  filters (components/site/kb/KbCommunityAlerts.client.tsx:8,50-55,66), mounted on ten
  page families (grep this run): `/` (app/page.tsx), `/buy`, `/cities/[slug]`,
  `/cities/[slug]/[neighborhoodSlug]`, `/communities/[slug]` (mount at
  app/communities/[slug]/page.tsx:891-895), `/zip/[zip]`, `/open-houses` (+ per-city),
  `/price-drops` (+ per-city).

The captured filters are URL-as-truth: the strip reads the live query through the FULL
field-registry union (SearchAlertCapture.tsx:91-100 `SAVED_SEARCH_QUERY_KEYS`, :143-172
filter build with path-supplied defaults), so the alert matches exactly what the visitor
is looking at, including registry filters and path-only presets.

## 3. Actors

- **Visitor segment:** anonymous buyer-side browser (buyer/dreamer/investor) — tagged
  `audience:buyer`, tier `warm`, `source:idx-registration` at capture
  (app/actions/search-alert-capture.ts:113-118). Device reality: GA4 device split for the
  inception surfaces was NOT queried this run (gap, §11); the binding posture is Matt's
  mobile-first "390 is truth" decision (decisions.md 2026-08-11 absorbed block), and the
  strip carries 390-specific fixes (honeypot width war, SearchAlertCapture.tsx:354-357).
- **Automated actors:** the per-IP rate limiter (5 requests / 60s sliding window,
  lib/rate-limit.ts:60-71); the hourly delivery cron `/api/cron/saved-search-alerts`
  (vercel.json:212-214, schedule `0 * * * *`; route budgets at app/api/cron/
  saved-search-alerts/route.ts:14-26) running the unified engine
  (app/actions/saved-search-alerts.ts:111-190); Resend send path with per-recipient
  compliance gates (lib/alerts/send.ts:365-479); the OAuth callback claim
  (app/auth/callback/route.ts:77-86).
- **Accountable for completion:** the assigned broker — capture creates an awaited native
  `crm_tasks` follow-up row due in 5 minutes so a signup is never silently missed
  (search-alert-capture.ts:129-135); broker routing via `canonicallyTagLead` →
  `recordAssignment` (lib/canonical-lead-tagger.ts:235,256-263).

## 4. Systems of record

- **`public.listing_alerts`** — the subscription of record. ONE canonical table for guest,
  signed-in, broker, and system alerts, unified 2026-07-07 by migration
  `20260707160000_unify_listing_alerts.sql` (DAL header, lib/data/leads/listingAlerts.ts:8-23).
  Guest rows: keyed `(email, filters_hash)`, `origin='user'`, `source='idx-registration'`,
  `user_id` null, `crm_person_id` resolved at insert when possible (listingAlerts.ts:150-182).
  Schema (docs/DATABASE_SCHEMA_SNAPSHOT.md §`listing_alerts`, lines 2887-2913):
  `notification_frequency` defaults `'daily'`, `is_active` defaults true,
  `unsubscribe_token` defaults a random UUID, `events` defaults
  `{new, price_change, status_change}` on.
- **`crm_people` (+ tags) · `marketing_assignments` · `crm_tasks`** — the person, routing,
  and follow-up of record: `sendEvent` → `ensureNativeLead` (email-first dedup,
  lib/crm/send-event.ts:101,129-130), canonical tags + assignment
  (canonical-lead-tagger.ts:237-263), the 5-minute task (search-alert-capture.ts:130-135).
- **`email_events`** — the delivery ledger, one `sent` row per alert email keyed to the
  open/click tracking identity (lib/alerts/send.ts:459-469).
- Explicitly NOT SoR: the client-side guest residual `rr_guest_alert_watch` (localStorage
  only, label + relative href, NO email/token/ids, 90-day TTL —
  lib/alerts/guest-watch-residual.ts:23-42) — product memory, deliberately unsynced; GA4
  (`fireLeadGenerated` mirror, search-alert-capture.ts:146-152) and the `alert_create`
  search event (SearchAlertCapture.tsx:289-292) — measurement mirrors; the in-house CRM
  (decommissioned 2026-06-24 — `sendEvent` is the in-house chokepoint, retiredVendorCrm.ts:29).

## 5. End-to-end path (inception → completion)

1. **Arrive on a browse surface** · visitor · lands on `/homes-for-sale...` or a place
   page via any channel · output: guest-only capture affordance renders (strip null for
   signed-in — SearchAlertCapture.tsx:180) · system: static/ISR page render · failure:
   WAF bot screen on non-browser UAs · device: both; strip variant differs by view
   (app/search/page.tsx:397-401).
2. **Live-filter mirror** · client · the strip continuously mirrors the URL + path
   defaults into the capture payload (SearchAlertCapture.tsx:143-172), full registry union
   so no filter silently drops (:91-100, the 2026-07-11 "Awbrey Butte panoramic views"
   fix in the comment at :83-90) · device: both.
3. **Enter email + submit** · visitor · one required field (email, maxLength 254) + hidden
   honeypot (SearchAlertCapture.tsx:344-394) — OR the guest SaveSearchButton form
   (SaveSearchButton.tsx:293-358, serialization :119-131) — OR the place block
   (KbCommunityAlerts.client.tsx:50-55,66) · output: `submitSearchAlertSignup(input)`
   server-action POST · failure: browser email validation blocks empty/invalid before POST.
4. **Honeypot gate** · server · a filled hidden field returns pretend-success and writes
   NOTHING (search-alert-capture.ts:41-44) · failure mode: none (by design bots cannot
   distinguish).
5. **Per-IP rate limit** · server · `getAuthLimiter` 5/60s sliding window
   (lib/rate-limit.ts:60-71) keyed `search-alert:<ip>`; FAIL CLOSED in production when
   Upstash is missing or throws (search-alert-capture.ts:46-67 — server actions bypass
   the middleware `/api` limiter, so this is the only throttle on a public DB+CRM write).
6. **Email validation** · server · trim/lowercase, RFC 5321 length bound + regex
   (search-alert-capture.ts:69-73) · failure: error string re-rendered `role="alert"`
   (SearchAlertCapture.tsx:401-411).
7. **Filter hardening** · server · attacker-controlled strings capped at 200 chars, then
   allowlist-normalized; the NARROWING guard rejects saves whose only keys are
   view/sort/poly/status so no one is ever signed up for the whole feed (the 2026-07-11
   attack finding) (search-alert-capture.ts:75-88; lib/search-filters.ts:415-436).
8. **CRM capture** · server · `sendEvent({type:'Saved Property Search', …, sourceUrl:
   searchUrl})` → `ensureNativeLead` → native personId (search-alert-capture.ts:101-111;
   retiredVendorCrm.ts:129-130). Best-effort: a capture blip never blocks the signup
   (:137-139) · failure: `fubPersonId` null — the alert row still persists (step 10) but
   no person row exists yet (the engine can re-link later, saved-search-alerts.ts:43).
9. **Canonical tagging + broker task** · server · `canonicallyTagLead({audience:'buyer',
   source:'idx-registration', tier:'warm'})` — compliance hard-stop check, tags
   `audience:buyer, buyer:warm, source:idx-registration, broker:<slug>`, a
   `marketing_assignments` row, fire-and-forget `autoEnrollByFubId`
   (search-alert-capture.ts:112-126; canonical-lead-tagger.ts:229-271) — then an AWAITED
   native `crm_tasks` follow-up due in 5 minutes (search-alert-capture.ts:129-135) ·
   failure: caught, non-blocking (:137-139).
10. **Durable persist** · server · `upsertListingAlert` on `(email, filters_hash)` with
    the resurrection guard — re-saving a search the lead explicitly unsubscribed leaves it
    muted (listingAlerts.ts:120-133,157-174); `crm_person_id` resolved fub-id-first then
    email (:83-109) · THE one blocking step: a persist failure returns an error to the
    visitor (search-alert-capture.ts:142-143) · failure: `persist_failed` (generic by
    design, listingAlerts.ts:175-180).
11. **Measurement mirrors** · server + client · GA4 `generate_lead`
    `lp_variant:'search-alert'`, value 0 (search-alert-capture.ts:145-155); on success the
    client writes the F2 residual (label + href only) and fires `alert_create`
    (SearchAlertCapture.tsx:284-292) · failure: all best-effort.
12. **Return-visit residual** · client · the strip shows "You're watching {label}" instead
    of re-asking for email (SearchAlertCapture.tsx:174-177,218-273); everywhere else the
    sitewide `GuestWatchingBanner` (mounted globally via
    components/layout/PublicClientLayer.tsx:36-37,69) shows the same residual with
    See-homes / Manage-in-account / dismiss, suppressed on lp/admin/auth/search paths
    (components/site/GuestWatchingBanner.client.tsx:27-41,80-135) · device: both.
13. **Delivery loop** · cron (owned by process `deliver-alerts`) · hourly
    (vercel.json:212-214), 600-row scan budget, 200 emails/run cap (route.ts:20-26;
    saved-search-alerts.ts:75-81); cadence gate — guest rows ride the DB default `'daily'`
    (schema snapshot line 2899; the capture offers no picker) (saved-search-alerts.ts:
    147-152); one grouped typed-event email per alert per run; per-recipient token
    unsubscribe link + RFC 8058 List-Unsubscribe header + suppression re-check at the
    send chokepoint (lib/alerts/send.ts:382-403,428-445).
14. **Terminal exits** · visitor · (a) token unsubscribe: the in-email link lands on the
    POST-confirmed page (app/alerts/unsubscribe/page.tsx:22-30 — never deactivates on GET,
    prefetch-safe) and the provider one-click POSTs `/api/alerts/unsubscribe`
    (app/api/alerts/unsubscribe/route.ts:27-34; GET redirects to the confirm page :36-46);
    both call `deactivateListingAlertByToken` (listingAlerts.ts:506-543) · (b) sign-in
    claim: the OAuth/magic-link callback claims active email-matching rows into the new
    account by stamping `user_id` (+`crm_person_id`) — verified-email gated
    (`email_confirmed_at`), idempotent, never re-assigns rows already owned by another
    account (app/auth/callback/route.ts:77-86,157,183; lib/data/leads/
    listingAlertsUser.ts:38-67) — converting the subscriber into process
    `save-and-return.search-alerts`.

## 6. Decision points

- **Bot?** honeypot filled → pretend success, zero writes (search-alert-capture.ts:41-44).
- **Rate limited?** limiter missing/down in prod → fail closed; over 5/60s → error
  (search-alert-capture.ts:50-67; lib/rate-limit.ts:60-71).
- **Email valid?** (search-alert-capture.ts:69-73).
- **Narrowing filter present?** whole-feed saves rejected at capture
  (search-alert-capture.ts:86-88) AND re-checked per-row in the engine so a bad row skips,
  never blasts (saved-search-alerts.ts:183-189).
- **Capture succeeded?** personId gates tagging + the broker task
  (search-alert-capture.ts:111-112); persist proceeds regardless.
- **Compliance hard-stop:** `isHardStopped` inside `canonicallyTagLead` skips
  tagging/enrollment for do-not-email/unsubscribed people
  (canonical-lead-tagger.ts:228-232).
- **Resurrection guard:** an existing `(email, filters_hash)` row with an explicit
  `is_active=false` stays muted on re-save (listingAlerts.ts:120-133,157-170) —
  unsubscribing one search never mutes the lead's other searches, and re-saving never
  un-mutes.
- **Send-time suppression:** `isSuppressedByEmail` re-checked at the chokepoint even
  though the recipient list arrives pre-filtered (send.ts:428-432).
- **Guest cadence:** no picker at capture → DB default `'daily'` digest + default event
  map (schema snapshot lines 2899,2909); only signed-in `user_id` rows can flip the
  global email toggle the engine honors (saved-search-alerts.ts:165-178) — guests have no
  equivalent.
- **Claim gates:** verified email only (`email_confirmed_at`), ACTIVE rows only,
  `user_id IS NULL` rows only (auth/callback/route.ts:78-80; listingAlertsUser.ts:55-61).
- **Voice canon:** every string in the strip, panels, banner, and alert emails is
  public-facing copy under §2 canon, mechanically gated by `ci:brand-voice` at commit and
  `lib/voice/check.ts` on the send path (CLAUDE.md §2).

## 7. Completion

Done when ALL of: (1) an active `listing_alerts` row exists for `(email, filters_hash)`
with `origin='user'`, `source='idx-registration'`, a valid `unsubscribe_token`, and
`crm_person_id` linked when resolvable; (2) a `crm_people` person exists carrying
`audience:buyer`, `buyer:warm`, `source:idx-registration`, `broker:*` tags plus a
`marketing_assignments` row and a near-due `crm_tasks` follow-up (unless capture
best-effort failed — see terminal states); (3) the visitor saw the on-page confirmation
and the client residual was written; (4) the delivery loop subsequently mails the row on
its cadence (the ongoing done-state guests live in).

Artifacts at completion: the `listing_alerts` row; the tagged person + assignment + task;
the localStorage residual; the GA4 `generate_lead` + `alert_create` events; per delivered
email an `email_events` 'sent' row.

Terminal states: **watching** (the ongoing loop — receiving/clicking alert emails) ·
**unsubscribed** (`is_active=false` via token, the guest's only management lever) ·
**claimed** (`user_id` stamped at sign-in — exits this process into
`save-and-return.search-alerts`) · **captured-without-person** (alert row persisted, CRM
capture failed — lead recoverable; the engine re-links via `linkAlertRowToPerson`,
saved-search-alerts.ts:43) · **bot-swallowed** (pretend success, zero server writes) ·
**rejected** (rate-limit / invalid email / no narrowing filter — nothing written).

## 8. Time & performance

- **Time-to-answer budget (page):** the visitor's question ("can someone watch this market
  for me?") is answered in-place by the strip itself in one line + one field — no
  navigation, no modal, no second step. The strip must never compete with the search task
  it rides on: the sticky variant is one row docked under filters, the inline variant is
  `shrink-0` chrome that cannot overlap the filter chips (SearchAlertCapture.tsx:300-310).
  No numeric budget exists yet; setting one is a P5/P6 output.
- **Submit latency:** the action awaits, in sequence, the rate limiter, `sendEvent`
  (CRM write), `canonicallyTagLead` (tags + assignment), `createNativeTask`, and the
  `listing_alerts` upsert before the visitor sees "You are set"
  (search-alert-capture.ts:51-143) — five sequential network dependencies with NO
  `after()` split (contrast the valuation path). Post-submit latency was NOT measured this
  run (gap, §11); "slow" here is the guest staring at "Setting up..."
  (SearchAlertCapture.tsx:379) on the site's highest-traffic surface.
- **Core Web Vitals:** not measured for the inception routes this run (gap, §11). The
  strip itself is a client component reading `useSearchParams` — its cost is hydration,
  not queries.

## 9. Variants

- **Strip variants** — sticky (list view, document flow) vs inline (map/split, layout-safe
  chrome): presentation only, identical payload path (SearchAlertCapture.tsx:111-130).
- **Guest SaveSearchButton** — same server action, different framing ("Save this search"
  → email form). Serializes normalized filters to strings and lets the action
  re-normalize (SaveSearchButton.tsx:119-131; boolean round-trip safe via
  lib/search-filters.ts:98-102). No split — but the dual affordance is a §10 defect.
- **Place-page capture (KbCommunityAlerts)** — place-prefilled filters
  (city/subdivision/extras), same action, same table, KB register styling
  (KbCommunityAlerts.client.tsx:50-55; mount list in §2). Attribution differs only in the
  filters captured — the recorded sourceUrl is still the CONSTRUCTED search URL (§10 D6).
- **Paid LP `/lp/buyer-listing-alerts`** — a separate inception belonging to
  `arrive-from-ad`: its own form + action writing the same `listing_alerts` table
  (deliver-alerts registry row: app/lp/buyer-listing-alerts/actions.ts:356). Shares the
  completion machine, not this process's capture surfaces.
- **Broker attach (`origin='broker'`) and system provisioning** — CRM-side row creation
  (listingAlerts.ts:190-238); inceptions of `deliver-alerts`, not of this visitor process.
- **The signed-in sibling** (`save-and-return.search-alerts`) is NOT a variant — it is
  this process's best exit, reached via claim-on-sign-in (§5 step 14b).

## 10. Current implementation map

**Routes/pages today:** `/homes-for-sale` + `/homes-for-sale/[...slug]` (internally
app/search/page.tsx + app/search/[...slug]/page.tsx via rewrite, next.config.ts:299-300)
and the ten `KbCommunityAlerts` page families (§2). Owned terminal surface:
`/alerts/unsubscribe` (+ `/api/alerts/unsubscribe`). No destination of its own.

**Registers used (of the design languages):** product register (`@/components/ui` Input/
Button in strip + save button, SearchAlertCapture.tsx:9-10); KB register for the place
block (`.comm-alerts-*` in kb.css, KbCommunityAlerts.client.tsx:24); one bespoke
fixed-position banner (GuestWatchingBanner.client.tsx:90-135).

**Actions/API/crons:** `submitSearchAlertSignup` (app/actions/search-alert-capture.ts:35);
DAL `upsertListingAlert` + claim + token deactivate (lib/data/leads/listingAlerts.ts:150,
506; listingAlertsUser.ts:38); the hourly cron (vercel.json:212-214) → `runListingAlerts`
(app/actions/saved-search-alerts.ts:111); send path (lib/alerts/send.ts:365); the OAuth
callback claim (app/auth/callback/route.ts:77-86).

**Known defects (each verified this run):**

- **D1 — two competing capture affordances on one filter row.** "Save this search"
  (guest branch) and the "Get alerts" chip + strip sit side by side
  (SearchFilters.tsx:535-545) and do the same thing under two names — two UI contracts,
  one action, no articulated difference for the visitor.
- **D2 — success copy overpromises cadence.** The sticky strip footer says "One email per
  new match" (SearchAlertCapture.tsx:398) but guest rows default to a `'daily'` grouped
  digest (schema snapshot line 2899) and the engine sends one email per alert per run
  (saved-search-alerts.ts:56). The `alert_create` analytics payload also hardcodes
  `'daily'` by convention rather than reading the row (SearchAlertCapture.tsx:289-292).
- **D3 — broken manage link parameter.** The done-state "Sign in to manage alerts" links
  `/login?returnUrl=%2Faccount%2Fsaved-searches` (SearchAlertCapture.tsx:204) but the
  login page reads only `next` (app/login/page.tsx:20-23) — after sign-in the guest lands
  on `/`, not their alerts.
- **D4 — password sign-in never claims.** The claim runs only in the OAuth/magic-link/
  recovery callback (auth/callback/route.ts:157,183); `signInWithEmailPassword`
  (app/actions/auth.ts:94-122) never calls `claimGuestSavedSearches` (grep this run: the
  callback is the only caller) — a guest who later uses a password account keeps orphaned
  guest rows until some OAuth/magic-link event fires.
- **D5 — the guest's only lever is the kill switch.** No cadence picker, no event
  toggles, no per-search list: guests manage exclusively via full-deactivation token
  unsubscribe (lib/alerts/manage-url.ts:14-15; send.ts:399-402). Pausing "for a while" or
  switching to weekly requires creating an account.
- **D6 — capture-surface attribution is lost.** The CRM sourceUrl is the CONSTRUCTED
  search URL (search-alert-capture.ts:92-93,108), and `listing_alerts.source` is the
  constant `'idx-registration'` (listingAlerts.ts:169) — nothing records whether the
  conversion came from the strip, the save button, or which place page, so surface-level
  conversion performance is unmeasurable.
- **D7 — `source:idx-registration` is a misnomer.** A no-registration email capture is
  tagged with a portal-era "registration" concept (search-alert-capture.ts:116) that
  flows into CRM smart lists and analytics segmentation as a name that describes nothing
  the visitor did.
- **D8 — bot pretend-success pollutes client measurement.** On the honeypot's fake
  `ok:true` the client still writes the residual and fires `alert_create`
  (SearchAlertCapture.tsx:284-292) — GA4 alert_create can count bot fills as conversions;
  reconciliation against `listing_alerts` inserts has never been run (gap, §11).
- **D9 — strip dismissal is per-pageview.** `dismissed` is React state
  (SearchAlertCapture.tsx:136,385) — every navigation re-mounts the strip for a guest who
  dismissed it, on the highest-traffic surface, with no persistence parallel to the
  banner's 14-day dismiss (guest-watch-residual.ts:29-30 exists but the strip does not
  use it for its own dismissal).
- **D10 — submit chain is fully inline.** Five sequential awaited dependencies before the
  visitor gets confirmation (§8) — the same class of latency the valuation path already
  solved with `after()` (that file documents 20-150s inline-capture history); unmeasured
  here.

## 11. Target shape (process-level, not pixels)

**Should this exist?** Yes. The job — "watch the market for me without making me sign up"
— is real, is the lowest-friction conversion on the site, and is the bridge that turns
the anonymous funnel into both the CRM machine and the portal process. What the target
shape changes:

- **One guest capture primitive, one name.** A single affordance contract stamped on
  search and place nodes (P5 names it under amnesia), replacing the strip/save-button/
  place-block trio of framings. Presentation may vary by surface; the visitor-facing
  language and the promise must not (D1).
- **An honest promise at capture.** The affordance states the actual cadence contract
  ("a daily email when something changes" today, or per-match if the product decision is
  instant) — copy and row defaults derived from one source so they cannot drift (D2).
- **Continuity into the account is airtight.** Claim runs on EVERY authentication path
  (OAuth, magic link, password — D4), and every post-capture "manage" pointer survives
  the sign-in round-trip to land on the claimed alerts (D3). The claim is this process's
  designed exit; leaks in it are conversion losses at the exact moment of highest intent.
- **Guests get one notch more control than the kill switch** — at minimum
  cadence-choice/pause on the token-authenticated surface they already reach from every
  email (D5), so "too many emails" has an answer other than unsubscribe-everything.
- **Ideal step count:** ONE visitor step (email into the page they are on), zero
  navigation, then zero further visitor work — everything downstream is machine or
  broker. Mobile-first per the locked 390 posture.
- **Data gaps blocking correctness** (✗ statements for P4):
  - ✗ Guest-vs-claimed row split, claim rate, and unsubscribe rate never queried — the
    process's conversion funnel is unmeasured (SQL in §12 checks 8-9 are the instrument).
  - ✗ Capture-surface attribution not persisted (D6) — cannot rank strip vs save button
    vs place block by conversion.
  - ✗ GA4 `alert_create` vs `listing_alerts` insert reconciliation never run (D8).
  - ✗ Submit-chain latency unmeasured (D10).
  - ✗ GA4 device split for inception surfaces not pulled this run — needed before P5
    sets the capture-affordance budget.

**Destination implication:** no destination node. This process stamps a capture
affordance onto other processes' destinations (find-a-home's search node, evaluate-a-
place's place nodes) plus one owned utility surface (token unsubscribe/manage). P5 must
treat it as a component-level contract those nodes carry, not as a page; its exits point
INTO the portal process's destination once claimed.

**Dual objective this process stamps on its pages** (on the host nodes it rides):

- `visitor_objective`: "Have new homes matching your exact search sent to your email —
  no account needed."
- `machine_objective`: "Convert an anonymous browse session into an identified CRM buyer
  lead (canonical buyer tags, broker assignment, follow-up task) and a durable
  listing_alerts subscription that keeps a permanent return channel open."
- `exits`: the alert email click-back to matching homes (the loop) · a listing detail
  from an alert email (→ evaluate/inquire) · sign-in/claim → the portal saved-search
  process · token unsubscribe (respectful terminal).

## 12. Acceptance checks

Persist; never delete. Run against production unless marked staging.

1. **Strip present for guests:** in a real signed-out browser, load
   `https://ryan-realty.com/homes-for-sale?city=Bend` → the alert strip renders under the
   filter row with an email input (`id="search-alert-capture"`); sign in → the strip is
   gone (SearchAlertCapture.tsx:180).
2. **Narrowing guard:** submit the strip on a URL whose only params are view/sort → the
   server rejects with "Add a filter…" (search-alert-capture.ts:86-88); and
   `select count(*) from listing_alerts where filters = '{}'::jsonb;` returns 0.
3. **E2E capture (internal test email):** submit `city=Bend, maxPrice=700000` + a flagged
   internal email → success panel renders, then verify checks 4-6 and delete the test
   artifacts.
4. **Subscription of record:**
   `select id, email, name, filters, notification_frequency, is_active, origin, source, user_id, crm_person_id from listing_alerts order by created_at desc limit 5;`
   → the test row: `origin='user'`, `source='idx-registration'`, `notification_frequency='daily'`,
   `is_active=true`, `user_id` null, non-null `unsubscribe_token`.
5. **Person + routing + task:**
   `select id, tags from crm_people where tags @> array['source:idx-registration'] order by created_at desc limit 5;`
   → test person carries `audience:buyer`, `buyer:warm`, `broker:*`;
   `select audience, broker, source, tier from marketing_assignments where source='idx-registration' order by assigned_at desc limit 5;` → assignment present;
   `select name, due_at from crm_tasks where person_id = <id> order by created_at desc limit 3;`
   → the "New listing-alert signup" task due ~5 minutes after capture.
6. **Resurrection guard:** one-click unsubscribe the test row, re-submit the identical
   search/email → `select is_active from listing_alerts where email='<test>' and filters_hash='<hash>';`
   stays `false` (listingAlerts.ts:157-170).
7. **Unsubscribe both channels:** (a) GET the in-email link → the branded confirm page
   renders and does NOT deactivate until the button POST (alerts/unsubscribe/page.tsx:22-30);
   (b) `curl -s -X POST -A "Mozilla/5.0" "https://ryan-realty.com/api/alerts/unsubscribe?token=<t>"`
   → `{"ok":true}` and the row flips `is_active=false` (route.ts:27-34).
8. **Claim-on-sign-in:** with an active guest row for a test email, complete Google OAuth
   for that email → `select user_id, crm_person_id from listing_alerts where email='<test>';`
   shows the new auth user id stamped on active rows only (listingAlertsUser.ts:55-61);
   the alert now appears in `/account/saved-searches`.
9. **Funnel instrument (the §11 gap, run and record):**
   `select count(*) filter (where user_id is null) as guest_rows, count(*) filter (where user_id is not null) as claimed_or_native, count(*) filter (where is_active=false) as inactive from listing_alerts where origin='user' and source='idx-registration';`
10. **Rate limit fail-closed:** 6 rapid submits from one IP → the 6th returns "Too many
    requests" (limiter 5/60s, lib/rate-limit.ts:66); with Upstash env removed in a prod
    build, ANY submit fails closed (search-alert-capture.ts:53-54,65-66).
11. **Delivery loop wired:** `grep -A1 saved-search-alerts vercel.json` → `0 * * * *`;
    a due test row with a fresh matching listing produces one email carrying the token
    unsubscribe link + List-Unsubscribe header and one `email_events` 'sent' row
    (send.ts:443-445,459-469).
12. **Gates:** `npm run ci:gates` green on any commit touching these files.
