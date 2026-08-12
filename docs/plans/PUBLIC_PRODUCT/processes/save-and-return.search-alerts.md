# Process: save-and-return.search-alerts — saved-search listing-alert loop (signed-in save → typed-event email → click-back)

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** — the save is event-driven, the send engine ticks hourly
  (`vercel.json:213-214`, schedule `0 * * * *`), and a subscription stands until the
  subscriber deactivates it; one loop can run for months.
- Verdict: **PROPOSAL — KEEP.** This is the L2 litmus span's target artifact (constitution:
  "cold visitor → a saved search or alert with contact") and the machine half of the
  exploration graph's return loop: it is the only process that brings a visitor BACK to
  listings repeatedly without paid spend. Boundary note for P3: the send engine documented in
  §5 steps 6–15 is byte-identical infrastructure shared with the registry's machine row
  `deliver-alerts` (all four provisioning channels converge on one table, one cron, one
  engine) and with the sibling `save-and-return.guest-alert-capture`. P3 should crown ONE
  owner of engine truth — proposal: this PDS + `deliver-alerts` merge their engine sections
  (MERGE→deliver-alerts for the machine half is acceptable), while the signed-in visitor
  loop (save → manage → click-back → portal consumption) stays a KEEP visitor process.
  Proposal only; the verdict locks at P3 in `decisions.md`.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A visitor who has refined a search down to what they actually want stops re-running it —
the site watches the market for them and emails what changed (new matches, price cuts, status
moves) at the pace they chose, until they say stop. (b) The machine outcome is a durable,
identified return channel — a `listing_alerts` row bound to an account and a CRM buyer
identity — which advances the "alert created" client-step of the KPI ladder; serving (a)
produces it because the save IS the visitor's own request: the email address, the intent
signal, and the recurring re-entry into the listing graph all arrive as a side effect of the
visitor asking to be told about homes they already proved they want.

## 2. Inception (what starts it)

Trigger: a signed-in visitor clicks **"Save this search"** on a listing-browse surface. The
button is always visible; guests see it too, but their branch is the sibling process
(`save-and-return.guest-alert-capture`) — the signed-in branch opens a name-this-search form
and calls `createSavedSearch` (`components/SaveSearchButton.tsx:60-64,158-166,239-291`).

| Channel | Entry surface | Evidence (opened this run) |
|---|---|---|
| Any channel (organic/paid/direct/internal) — the save happens mid-browse | `/homes-for-sale` all views: `SearchFilters` mounts the button | `app/search/page.tsx:390` → `components/search/SearchFilters.tsx:535` |
| Any channel — geo browse pages (`/homes-for-sale/{city}/…` catch-all) | `SearchFilterBar` mounts the button with server-resolved `pathContext` | `app/search/[...slug]/page.tsx:31,506`; `app/search/[...slug]/sections/MapSplitView.tsx:22,290`; `components/SearchFilterBar.tsx:9,602` |
| Sign-in conversion — a guest's alert rows are claimed into the account at OAuth return, converting the guest loop into THIS process | `app/auth/callback/route.ts:5,82` → `claimGuestSavedSearches` → `claimListingAlertsForUser` (email-matched, active, unowned rows get `user_id` + CRM link) | `lib/data/savedSearches.ts:45-50`; `lib/data/leads/listingAlertsUser.ts:38-67` |
| Broker/system provisioning — rows born without a visitor click but drained by the same loop | `createListingAlertForLead` (`origin='broker'/'system'`, weekly default); the **manual-only** neighborhood-defaults endpoint (dry-run unless `confirm=1&dryRun=0`, never scheduled) | `lib/data/leads/listingAlerts.ts:190-238`; `app/api/cron/neighborhood-default-subscriptions/route.ts:1-42`; `lib/data/crm/neighborhoodDefaultSubscriptions.ts:7-27` |

Preconditions: a session whose user has an email (`app/actions/saved-searches.ts:129-132`);
the saved filters must narrow the feed — an empty-filter row is refused at send time, never
blasted (`app/actions/saved-search-alerts.ts:187-191`). Filter capture is full-fidelity: the
server-resolved path context plus every canonical filter key in the live URL round-trips into
the stored filters (`components/SaveSearchButton.tsx:66-94`), precisely because the old
pathname-derived guess stored slugs that matched ZERO rows and silently never alerted
(`components/SaveSearchButton.tsx:29-44` — the documented bug the `pathContext` prop fixed).

## 3. Actors

- **Signed-in buyer (primary subscriber)** — saves, manages, returns. The save is
  simultaneously CRM capture: `sendEvent 'Saved Property Search'` → native lead + canonical
  `audience:buyer` / `source:idx-registration` tagging (`app/actions/saved-searches.ts:176-208`).
- **Household recipients** — additional emails on one alert row, each with their OWN
  unsubscribe token and their OWN compliance gate; a stopped recipient is dropped without
  silencing the rest (`lib/data/leads/listingAlerts.ts:28-32`; `lib/alerts/send.ts:283-357`;
  `lib/alerts/delivery-plan.ts:96-124`).
- **Assigned broker** — every alert email sends from the named broker identity with a
  monitored reply-to ("a reply to an alert must reach the assigned broker, never noreply@"),
  defaulting to `matt` (`lib/alerts/send.ts:57-60,434-448`).
- **Admin/broker (preview mode)** — `preview_mode` rows queue events for human approval
  instead of sending; approve/reject actions are `getCrmAccess`-gated and release through the
  SAME send path (`app/actions/saved-search-alerts.ts:339-366,465-542`;
  `lib/data/leads/listingAlerts.ts:452-472`).
- **Automated actors** — the hourly `saved-search-alerts` cron (`vercel.json:213-214`;
  `app/api/cron/saved-search-alerts/route.ts:14-30`).
- **Device reality**: a GA4 device split for save/click-back was NOT queried this session and
  is therefore not stated (§0) — a P4 gap item. Mobile-first is Matt-locked product truth
  regardless (`decisions.md` 2026-08-11).
- **Accountable for completion**: the cron for delivery; the subscriber for their own
  management (pause/cadence/unsubscribe are fully self-serve); the assigned broker for
  replies.

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| The subscription itself — filters, hash, cadence, event toggles, schedule days, per-key notified cursor, unsubscribe tokens, household recipients, portal seen-baseline | `public.listing_alerts` — THE unified table (migration `20260707160000_unify_listing_alerts.sql`); every alert (guest, signed-in, broker, system) keyed `(email, filters_hash)`; DAL-guarded (G1 banned-list table) | `lib/data/leads/listingAlerts.ts:8-25,34-69,150-182` |
| Held preview events | `listing_alert_queue` | `app/actions/saved-search-alerts.ts:339-366`; `lib/data/leads/listingAlertQueue.ts` (imported at `:17-22`) |
| Send/open/click measurement | `email_events` — one `'sent'` row per delivery, keyed on the same `emailKey` the open/click tracker signs | `lib/alerts/send.ts:454-475` |
| Subscriber identity | `public.crm_people` via `resolveCrmPersonId` (row born tracking-ready) and `resolvePersonForTracking` at send | `lib/data/leads/listingAlerts.ts:83-109`; `lib/alerts/send.ts:320-325` |
| Global email kill-switch | `profiles.notification_preferences.emailEnabled` — honored by the engine per row | `app/actions/saved-search-alerts.ts:167-178` |
| The match set | the search cache over live inventory via `getCachedSearchListings` (same DAL path the search page uses — the email can never disagree with the site) | `app/actions/saved-search-alerts.ts:180-206` |
| Gate-drop audit trail | `admin_actions` (`alert_gate_drop` rows) | `app/actions/saved-search-alerts.ts:302-320` |
| **NOT a SoR** | Legacy `saved_searches` — survives ONLY for the public/social "popular searches" display; mirror rows are written `is_paused:true` belt-and-suspenders and the cron scans `listing_alerts` exclusively | `app/actions/saved-searches.ts:49-54,148-168,370-374` |
| **NOT a SoR** | GA4 (`save_search` event is a mirror, never the record); the sent email itself (the row's cursor is the truth of what was notified) | `components/SaveSearchButton.tsx:173-187`; `lib/data/leads/listingAlerts.ts:50-53` |

## 5. End-to-end path (inception → completion)

1. **Save** · visitor · clicks "Save this search", names it, optionally opts into the public
   Popular Searches display · live URL filters + path context · open panel → submit ·
   `components/SaveSearchButton.tsx:196-291` · failure: inline error, nothing persisted ·
   mobile + desktop.
2. **Normalize + persist** · system · `createSavedSearch`: session check → normalize filters →
   hash → prewarm the search cache (24 tiles) → `upsertListingAlert` on `(email, filters_hash)`
   with the **resurrection guard** (re-saving a search the user one-click-unsubscribed leaves
   it muted, never forces `is_active` back on) · `app/actions/saved-searches.ts:124-146`;
   `lib/data/leads/listingAlerts.ts:120-133,150-182` · failure: "Could not save this search.
   Please try again." — generic code, raw DB error server-side only (`listingAlerts.ts:175-180`).
3. **Public mirror** (conditional) · system · when opted in, a display-only legacy
   `saved_searches` row is inserted (`is_paused:true`, result-count + tile cache stamped) ·
   `app/actions/saved-searches.ts:148-168` · failure: logged, save still succeeds.
4. **CRM capture** · system · awaited-but-non-blocking `sendEvent 'Saved Property Search'` →
   native person → canonical buyer tagging with origin context ("Listing alerts for …") ·
   `app/actions/saved-searches.ts:170-211` · failure: warn-and-continue — the durable alert
   row is the must-succeed write.
5. **Telemetry** · system · `search_save` first-party event + GA4 `save_search` with filter
   dimensions · `components/SaveSearchButton.tsx:96-104,168-187` · fire-and-forget.
6. **Hourly scan** · cron · `GET /api/cron/saved-search-alerts` (Bearer `CRON_SECRET`, 300s
   budget) → `runListingAlerts` over `getActiveListingAlertsDue` — inactive rows excluded in
   the DB, **most-overdue first** (never-notified rows lead) so the queue drains fairly ·
   scan budget default 600 rows, sends capped at 200/run ·
   `app/api/cron/saved-search-alerts/route.ts:14-30`; `app/actions/saved-search-alerts.ts:81,116-128`;
   `lib/data/leads/listingAlerts.ts:277-296` · failure: 500 JSON, next tick resumes.
7. **Cadence gate** · system · `isCadenceDue` — FOUR cron-honored cadences (`instant` ≈ the
   hourly tick with a 55-min floor, `daily`, `weekly` incl. per-day `schedule_days` in
   America/Los_Angeles at most once per local day, `monthly` = 30 days); not-due rows skip
   without touching the cursor · `app/actions/saved-search-alerts.ts:147-152`;
   `lib/saved-search-cadence.ts:19,85-96,139-163` · failure: an unparseable stored timestamp
   is treated as never-notified so a corrupt value can't silence an alert forever (`:154-161`).
8. **Global-pref gate** · system · signed-in rows honor
   `profiles.notification_preferences.emailEnabled === false` — skip + advance cursor ·
   `app/actions/saved-search-alerts.ts:167-178` · both.
9. **Sanity guards** · system · empty-filter rows ("would match the whole feed") and named
   areas that resolve to no shapes are skipped + advanced, logged loudly, never widened ·
   `app/actions/saved-search-alerts.ts:183-205` · §0's unknown-is-not-everything, mechanized.
10. **Match + shield** · system · `getCachedSearchListings` with the FULL stored filters
    (every key honored, never an over-broad subset), then the subscriber's hidden homes are
    excluded BEFORE the diff so a hidden home never fires an event ·
    `app/actions/saved-search-alerts.ts:180-215,91-109` (fail-soft hidden lookup) · both.
11. **Typed-event diff** · system · `detectListingEvents` diffs the per-key notified state
    (typed entries {key, price, status, notified_at, open_house}; legacy plain keys migrate
    forward) against current matches + a departed-key status lookup → six event types; a
    back-compat timestamp heuristic stops pre-upgrade rows from re-announcing everything ·
    `app/actions/saved-search-alerts.ts:227-278`; `lib/alerts/event-detection.ts:1-49`
    (Flexmls-inherited defaults: new ✓ price ✓ status ✓, back-on-market/sold/open-house ✗).
12. **Recipients + compliance** · system · primary + household entries resolved, missing
    per-recipient tokens backfilled AND persisted, then `isHardStopped` + `isSuppressedByEmail`
    per recipient — an unverifiable recipient FAILS CLOSED (dropped) ·
    `app/actions/saved-search-alerts.ts:283-288`; `lib/alerts/send.ts:283-357`.
13. **Delivery plan** · system · pure branching: toggle filter (sold is VOW-only — a guest row
    never gets sold events regardless of the stored toggle), `preview_mode` → queue for broker
    approval, all-recipients-stopped → skip; skips log a durable `alert_gate_drop`; a
    compliance skip advances the cursor WITHOUT absorbing the notified state so a transient
    suppression blip recovers on the next run (audit 2026-07-30) ·
    `app/actions/saved-search-alerts.ts:290-330`; `lib/alerts/delivery-plan.ts:96-124`;
    `lib/alerts/event-detection.ts:370-390`.
14. **Claim-before-send** · system · compare-and-set stamps `last_notified_at` + next state
    BEFORE Resend, so a successful delivery can never re-blast when a post-send mark fails and
    two concurrent runners can never both claim one due window (`claim_lost`); total send
    failure restores the prior cursor so a true retry stays due ·
    `app/actions/saved-search-alerts.ts:383-434`; `lib/data/leads/listingAlerts.ts:359-411`.
15. **Send** · system · per recipient: sectioned typed-event email (≤12 cards, overflow "+N
    more"), plain no-hype subject, `browseAllUrl` deep link, UTM `listing-alerts`, broker
    attribution + open/click instrumentation stamped exactly once on the final HTML, manage
    link ONLY for the signed-in primary, per-recipient token unsubscribe link, RFC 8058
    `List-Unsubscribe`/`List-Unsubscribe-Post` headers, a last-instant suppression re-check at
    the chokepoint, one `email_events 'sent'` row ·
    `lib/alerts/send.ts:53-54,365-479`; `lib/crm/listing-alert-email.ts:132-139` (subject
    builders) · failure: per-recipient error collected; zero-sent triggers the cursor restore.
16. **Return (click-back)** · visitor · opens the email → listing detail or the full search
    (both re-enter `find-a-home`); on the next portal visit `/account` shows "new since last
    visit" per saved search measured from `last_viewed_at` (falling back to `created_at`, the
    count capped honestly as "24+" when the scan window saturates — §0) ·
    `lib/data/leads/newSince.ts:1-34`; `app/account/saved-searches/page.tsx:21-24`;
    `app/account/page.tsx:95-145` (grep-verified mounts) · `markSavedSearchSeen` /
    `markAllSavedSearchesSeen` reset the baseline and can never suppress an unsent email
    (`app/actions/saved-searches.ts:319-346`).
17. **Manage / exit** · visitor · the email's manage link lands at
    `/account/saved-searches#alert-<id>` — the card carries that exact anchor id — where the
    subscriber can pause/resume, change cadence, edit filters/name, share with household, or
    delete; every write is scoped `(row id + session user_id)` ·
    `lib/alerts/manage-url.ts:17-22`; `app/account/saved-searches/SavedSearchControls.tsx:180`;
    `app/account/saved-searches/page.tsx:40-63`; `app/actions/saved-searches.ts:216-317` ·
    OR token unsubscribe: the branded page deactivates only on an explicit button POST (an
    email-client prefetch can never opt anyone out), and the RFC 8058 one-click endpoint
    POSTs straight to deactivation while its GET redirects to the confirm page; the token
    namespace is two-tier — a primary token kills the whole alert, an additional-recipient
    token removes only that recipient · `app/alerts/unsubscribe/page.tsx:9-30`;
    `app/api/alerts/unsubscribe/route.ts:27-46`; `lib/data/leads/listingAlerts.ts:494-543`.

## 6. Decision points

- **Signed-in vs guest branch** at the same button: session state decides which process runs
  (`components/SaveSearchButton.tsx:60-64,239-292`).
- **Public opt-in**: checkbox forks a display-only legacy mirror; the alert loop is untouched
  (`app/actions/saved-searches.ts:152-168`).
- **Resurrection guard**: re-save of an explicitly opted-out `(email, filters_hash)` keeps
  `is_active=false`; only an explicit opt-out is honored — NULL legacy reads as active
  (`lib/data/leads/listingAlerts.ts:111-133,157-158`).
- **Cadence + schedule-days gate** (§5.7); **global email pref** (§5.8); **empty-filter +
  area-resolve guards** (§5.9); **hidden-home shield** (§5.10).
- **Event toggles per row** — the subscriber (or broker, via engine settings) chooses which of
  the six event types fire (`lib/alerts/event-detection.ts:36-49`; `lib/data/leads/listingAlerts.ts:446-472`).
- **Compliance gates, all fail-closed**: per-recipient hard-stop + suppression at plan time
  (`lib/alerts/send.ts:329-355`), suppression re-checked at the send chokepoint
  (`lib/alerts/send.ts:428-432`), a later opt-out always beats the opt-in (§1); ODS VOW rule —
  sold events are signed-in-only (`app/actions/saved-search-alerts.ts:295-299`;
  `lib/alerts/event-detection.ts:382-388`).
- **preview_mode**: queue for broker approval vs direct send; compliance re-runs at release so
  a stop that lands while an item waits still blocks (`lib/alerts/delivery-plan.ts:87-95`;
  `app/actions/saved-search-alerts.ts:459-533`).
- **Claim CAS**: `claim_lost` aborts the row for this run — concurrency decided in the DB
  (`lib/data/leads/listingAlerts.ts:369-392`).
- **Unsubscribe tier**: primary token vs additional-recipient token (`lib/data/leads/listingAlerts.ts:500-543`).
- **Voice canon**: email subjects/sections are deliberately plain ("6 new listings for Bend
  under 800k"; sentence-case section labels, no hype) — `lib/crm/listing-alert-email.ts:132-139`;
  `lib/alerts/send.ts:62-70`.

## 7. Completion

This is a standing loop; completion is observable at two grains.

**Per cycle (one cron pass over one row), done when exactly one of:**
1. **Delivered** — Resend accepted ≥1 recipient email; an `email_events 'sent'` row exists and
   the row's cursor (`last_notified_at` + `notified_listing_keys`) was claimed
   (`lib/alerts/send.ts:437-475`; `lib/data/leads/listingAlerts.ts:369-392`).
2. **Checked-quiet** — due but nothing to say (no events / prefs off / all-stopped / queued):
   cursor advanced, "checked through now" (`app/actions/saved-search-alerts.ts:155-164,301-330`).
3. **Held** — preview events queued for broker decision (`:339-366`).

**Per subscription, terminal states:**
- **Consumed** — the visitor clicks back (open/click rows on the `emailKey`; the portal badge
  consumed via `markSavedSearchSeen`) and the loop continues — the intended steady state.
- **Paused** — `is_active=false` via /account pause; resumable (`app/actions/saved-searches.ts:267-285`).
- **Deactivated** — token unsubscribe (page POST or RFC 8058 one-click); a re-save does not
  resurrect it (`lib/data/leads/listingAlerts.ts:111-133,506-516`).
- **Recipient-removed** — one household member exits, alert lives on (`:518-542`).
- **Deleted** — the subscriber removes the search entirely (`app/actions/saved-searches.ts:245-251`).

Artifacts at completion of a healthy cycle: the sent email, the `email_events` row, the
advanced per-key cursor, and (on click-back) the attributed return session.

## 8. Time & performance

- **Loop latency budget (the number that matters):** market change → subscriber's inbox is
  bounded by the hourly cron plus cadence — `instant` delivers within ~1h (55-min floor so the
  hourly tick is never skipped by clock jitter, Matt directive 2026-07-11), `daily` 24h,
  `weekly` 7d or per-`schedule_days`, `monthly` 30d (`vercel.json:213-214`;
  `lib/saved-search-cadence.ts:82-96`).
- **Engine budgets:** 300s route budget; 600-row default scan; 200 emails/run hard cap (a mass
  rollout drips instead of bursting deliverability); ≤12 listing cards per email with an
  honest "+N more" overflow (`app/api/cron/saved-search-alerts/route.ts:14,20-26`;
  `app/actions/saved-search-alerts.ts:75-81`; `lib/alerts/send.ts:53-54`).
- **Fairness under saturation:** most-overdue-first ordering + the advance-on-empty rule are
  precisely what stops a starved queue when rows exceed one run's budget
  (`lib/data/leads/listingAlerts.ts:277-290`; `app/actions/saved-search-alerts.ts:141-164`).
- **Time-to-answer on the visitor surfaces:** the save panel answers instantly (client
  round-trip of one server action; the cache prewarm at `app/actions/saved-searches.ts:137`
  exists so the subscriber's next search render is warm). The /account manage page renders the
  same live figures the portal shows so the email deep link and the portal never disagree
  about a count (`app/account/saved-searches/page.tsx:21-24`).
- **What "slow" means and who sees it:** a send wave beyond 200 queues to the next hour —
  subscribers see a later email, never a dropped one; a Resend outage restores cursors so
  affected rows stay due (`app/actions/saved-search-alerts.ts:417-434`).
- **Stale comment hazard:** the route's scan-budget rationale still says "4x-daily cron" while
  the registered schedule is hourly — the budget math should be re-derived (§10 defect 1).
- **CWV:** not applicable to the email; /account CWV was NOT measured this session and no
  number is stated (§0). The P8 L2 litmus times the save half of this exact process on a real
  phone.

## 9. Variants

One engine, one table; variants differ only at inception or fan-out:

- **Signed-in self-save** (this process's canonical variant) — `/homes-for-sale` and geo
  browse entry (§2).
- **Guest capture** — same button + strip, no account: the sibling process
  `save-and-return.guest-alert-capture`; converts INTO this process at OAuth claim
  (`app/auth/callback/route.ts:82`; `lib/data/leads/listingAlertsUser.ts:38-67`).
- **Broker-assigned / system rows** — `origin='broker'|'system'`, weekly default, no visitor
  inception; identical delivery + management semantics
  (`lib/data/leads/listingAlerts.ts:190-238`; `lib/data/crm/neighborhoodDefaultSubscriptions.ts:7-27`).
- **Household fan-out** — one row, several recipients, per-recipient tokens/compliance
  (`lib/alerts/send.ts:283-357`).
- **Preview mode** — broker-approval hold, same send path on release
  (`app/actions/saved-search-alerts.ts:459-533`).
- **Paid-LP alert signup** (`/lp/buyer-listing-alerts`) — same table, owned by
  `arrive-from-ad` per the registry's `deliver-alerts` row; not re-claimed here.
No variant diverges materially in path or completion; none warrants a split beyond the
guest/signed-in boundary the registry already draws.

## 10. Current implementation map

- **Routes/surfaces today:** `/homes-for-sale` (+ geo catch-all) save button;
  `/account/saved-searches` (+ `/account/notifications` cadence control writing
  `setSavedSearchFrequencyForUser`, `app/actions/saved-searches.ts:348-368`);
  `/alerts/unsubscribe` (page) + `/api/alerts/unsubscribe` (one-click);
  `/api/cron/saved-search-alerts`; `/api/cron/neighborhood-default-subscriptions`
  (manual-only).
- **Design registers (of the 4 surviving languages):** the save button and /account manage
  surfaces are built on `@/components/ui/*` design-system primitives
  (`components/SaveSearchButton.tsx:21-25`; `app/account/saved-searches/page.tsx:8-9`); the
  unsubscribe page mixes **primitives** (`H1` from `components/site/primitives`) with the
  **legacy flat** `SiteFooter` (`app/alerts/unsubscribe/page.tsx:6-7`) — register mixing on a
  single small page, the exact class the P9 ratchet kills.
- **Actions/API/crons:** `createSavedSearch` / `updateSavedSearch` / `deleteSavedSearch` /
  pause/resume/cadence/rename/seen (`app/actions/saved-searches.ts:124-346`);
  `runListingAlerts` + preview approve/reject (`app/actions/saved-search-alerts.ts:111-542`);
  DAL `lib/data/leads/listingAlerts.ts` + `listingAlertsUser.ts`; hourly cron
  (`vercel.json:213-214`).
- **Known defects / drift (all verified this run):**
  1. **Stale schedule rationale** — `app/api/cron/saved-search-alerts/route.ts:21-24` sizes
     the 600-row scan "across the 4x-daily cron" but `vercel.json:213-214` registers hourly
     (`0 * * * *`). Behavior is fine (hourly cycles faster); the budget math and comment are
     stale.
  2. **Three-cadence comments vs four honored** — `app/actions/saved-searches.ts:71`
     ("instant | daily | weekly") and `:287-291` ("Only the three cron-honored values") both
     contradict the cadence module, which honors FOUR including `monthly`
     (`lib/saved-search-cadence.ts:19,85-90`); `validateCadence` accepts monthly, so the
     /account Select and the cron agree — only the comments (and the P1 registry row) are
     wrong.
  3. **Public-mirror orphan** — the opt-in mirror row in legacy `saved_searches`
     (`app/actions/saved-searches.ts:152-168`) is never updated on rename/filter edits
     (`:221-243` touches only `listing_alerts`) and never deleted on `deleteSavedSearch`
     (`:245-251`), so Popular Searches can display a search its owner renamed or removed.
  4. **Dead fields kept for UI shape** — `SavedSearchRow` hardcodes `is_public:false`,
     `public_title:null`, `result_count:null` etc. on every alert row so the account UI type
     is unchanged (`app/actions/saved-searches.ts:103-112`) — shape debt to clean at P5/P9.
  5. **Process-boundary duplication in the registry** — the engine (§5.6-15) is documented
     both here and in the `deliver-alerts` machine row; the sibling guest process shares the
     button and the table. One owner of engine truth must be crowned at P3 (§0 verdict note).
- **Duplicate/parallel paths that should die:** none inside the engine itself — the 2026-07-07
  unification already killed the dual `saved_searches`/`guest_search_alerts` split
  (`app/api/cron/saved-search-alerts/route.ts:6-8`; `lib/data/leads/listingAlerts.ts:9-11`);
  the survivors are the mirror-orphan (defect 3) and the registry-boundary duplication
  (defect 5).

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes — it is the graph's return loop and the L2 litmus artifact.** A site
that is "one lead-generation machine that never acts like it" needs exactly this: the
conversion moment ("watch this for me") is the visitor's own request, and every email is a
re-entry into the listing graph rather than an interruption. Shape derives from the job
(refine → watch → be told → return), not from today's routes; names, groupings, and where the
manage surface lives are P5 calls under amnesia.

- **Ideal step count:** ONE visitor action to start (save, already named by default from the
  filters — the name prompt is optional polish, not a required stage), ZERO visitor actions to
  keep it alive, ONE action to change or stop it from any email. Today matches this shape;
  the target keeps it.
- **Device:** the save is a mid-browse mobile action (390 is truth); the email must land
  mobile-first; management must work from the email deep link without hunting.
- **Continuity (binding decision #5):** the saved search IS persisted context — the target
  shape treats a subscriber's watches as first-class graph state that follows them (portal
  badge, "you're watching this" residue on the search surfaces), not a buried settings list.
- **Data gaps blocking correctness (P4 ✗ statements, not designs):**
  ✗ live `listing_alerts` counts by origin/cadence/active were not queried this session;
  ✗ send/open/click funnel from `email_events` not queried — the click-back rate (the loop's
  real KPI) is unmeasured; ✗ GA4 device split for save + email-return sessions not queried;
  ✗ no measured distribution of events-per-email (are subscribers getting signal or noise?).
- **Destination implication (proposal, not a lock):** NO standalone destination for the save
  moment — it stays an in-graph action mounted on the browse system. Management lives inside
  the account/portal destination (one alert-manager surface, anchor-addressable from email).
  `/alerts/unsubscribe` + the one-click API are SYSTEM pages (page-inventory sentinel), not
  destinations. The email is an off-site node whose every link re-enters the graph.

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Stop re-running this search — have the market watched for me and be
  told what changed, at the pace I choose, until I say stop."
- `machine_objective`: "Bind a proven buyer's search intent to a durable, identified,
  compliance-clean return channel that re-enters the listing graph on every send."
- `exits`: email listing card → listing detail (`find-a-home`) · email "browse all" →
  `/homes-for-sale` with the saved filters · manage link → account portal
  (`save-and-return.portal`) · portal "new since last visit" → the saved search's results ·
  unsubscribe page → back to `/search` (`app/alerts/unsubscribe/page.tsx:52-54,73-75`) ·
  broker reply-to → `contact-a-broker` (a reply reaches the assigned broker,
  `lib/alerts/send.ts:434-436`).

## 12. Acceptance checks

Prove the loop end-to-end. Persist; never delete.

1. **Cron wiring:** `grep -A1 'saved-search-alerts' vercel.json` → schedule `0 * * * *`;
   route exists at `app/api/cron/saved-search-alerts/route.ts`.
2. **Dry-run engine health:**
   `curl -s -H "Authorization: Bearer $CRON_SECRET" "https://ryan-realty.com/api/cron/saved-search-alerts?dryRun=1&limit=50"`
   → `{ ok: true, scanned, sent, skipped, queued, errors: [] }` (shape at
   `app/actions/saved-search-alerts.ts:66-73`).
3. **Save persistence:** signed in, save a Bend search, then
   `select email, name, filters_hash, is_active, notification_frequency, origin, user_id from listing_alerts where user_id = '<uid>' order by updated_at desc limit 1;`
   → one row, `is_active=true`, `origin='user'`, `source='user'`, frequency defaulting `daily`
   (`lib/data/leads/listingAlerts.ts:159-174`).
4. **Idempotent upsert:** save the identical search twice →
   `select count(*) from listing_alerts where email='<e>' and filters_hash='<h>';` → 1.
5. **Resurrection guard:** one-click unsubscribe that row
   (`curl -s -X POST "https://ryan-realty.com/api/alerts/unsubscribe?token=<t>"` → `{"ok":true}`),
   re-save the same search, then re-run check 3 → `is_active` is STILL `false`
   (`lib/data/leads/listingAlerts.ts:120-133,157-158`).
6. **Prefetch safety:** `curl -s -o /dev/null -w '%{http_code}' "https://ryan-realty.com/api/alerts/unsubscribe?token=<t>"`
   (GET) → 307/308 redirect to `/alerts/unsubscribe`, and the row's `is_active` is unchanged —
   only the page's button POST or the API POST deactivates
   (`app/api/alerts/unsubscribe/route.ts:36-46`; `app/alerts/unsubscribe/page.tsx:9-15`).
7. **Headers:** inspect a delivered alert's raw source → `List-Unsubscribe: <…/api/alerts/unsubscribe?token=…>`
   and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` present (`lib/alerts/send.ts:442-445`);
   the visible footer link points at the `/alerts/unsubscribe` page.
8. **Manage deep link:** the same email's manage link is
   `/account/saved-searches#alert-<id>` and the page renders a card with that exact element id
   (`lib/alerts/manage-url.ts:17-22`; `app/account/saved-searches/SavedSearchControls.tsx:180`);
   confirm a household recipient's email has NO manage link (`lib/alerts/send.ts:399-402`).
9. **Send measurement:**
   `select event, email_key, broker, send_type from email_events where send_type='alert' and recipient_email='<e>' order by created_at desc limit 3;`
   → a `'sent'` row keyed `listing-alert:<rowId>:<date>` (`lib/alerts/send.ts:410-413,459-469`).
10. **Cursor integrity:** after a real send,
    `select last_notified_at, jsonb_array_length(notified_listing_keys::jsonb) from listing_alerts where id='<id>';`
    → stamped at claim time, keys ≤1000 head-kept (`lib/data/leads/listingAlerts.ts:348-357,376-379`).
11. **Cadence honesty:** set the row to `weekly` with `schedule_days=[1]` (Monday), run the
    dry-run cron on a non-Monday → row counted in `skipped`, `last_notified_at` unchanged
    (`lib/saved-search-cadence.ts:149-157`).
12. **Guards:** hand-write a test row with empty `filters` → next run logs
    `skipping alert with empty filters` and sends nothing (`app/actions/saved-search-alerts.ts:187-191`);
    hide a matching listing for the user → it never appears in the next alert email (`:207-215`).
13. **VOW gate:** on a guest row (user_id null) force `events.sold=true` → sold events still
    filtered (`lib/alerts/delivery-plan.ts:103-111`; `lib/alerts/event-detection.ts:382-388`).
14. **Portal loop-close:** after an email send, load `/account` → the saved search shows a
    "new since last visit" figure (or "24+" when saturated); mark seen; the badge resets and
    `last_viewed_at` is stamped (`lib/data/leads/newSince.ts:19-34`;
    `app/actions/saved-searches.ts:325-337`).
15. **Timed span (P8 litmus L2):** on a real phone, cold visitor → signed in → search refined
    → saved — record the seconds. A timing not measured this session is not a timing.
