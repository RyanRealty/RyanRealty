# Process: deliver-alerts — Deliver listing alerts (saved-search email engine)

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** — inceptions are event-driven on four channels plus one
  manual-trigger provisioning channel (§2), the engine ticks hourly (`vercel.json:213-214`,
  schedule `0 * * * *`), and each subscription runs until its recipient deactivates it.
- Verdict: **PROPOSAL — KEEP.** This is the ONE machine-side send engine for every listing
  alert on the site: one table (`public.listing_alerts`), one cron, one engine, one send
  path — regardless of which of the five channels minted the row. The sibling visitor PDS
  (`save-and-return.search-alerts` §0) already proposes crowning THIS process the single
  owner of engine truth at P3 and merging its own §5 steps 6–15 here; this PDS accepts that
  boundary: **deliver-alerts owns cron → detection → compliance → send → cursor →
  unsubscribe; the visitor-side loops (save UX, portal management, click-back consumption)
  stay with their visitor processes** (`save-and-return.search-alerts`,
  `save-and-return.guest-alert-capture`, `arrive-from-ad`). Proposal only; the verdict locks
  at P3 in `decisions.md`.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A visitor who told the site what they are looking for gets an email when the market
changes in the way they asked about — a new match, a price cut, a status move — at the pace
they chose, and can stop it with one click. (b) The machine outcome is the recurring
return-visit client-step: each send re-enters an identified, compliance-clean lead into the
listing graph with broker attribution and measured open/click engagement, and it is produced
BY serving (a) — every link in the email is a deep link back into listings, and the reply-to
is the assigned broker, so the visitor's own request to be told is what generates the return
channel.

## 2. Inception (what starts it)

A row becomes active in `public.listing_alerts` through one of five channels; from that
moment the machine owns it and the hourly cron starts each delivery run.

| # | Channel | Entry | Evidence (opened this run) |
|---|---|---|---|
| 1 | Signed-in Save Search (organic/direct/internal — mid-browse on `/search` + geo pages) | `createSavedSearch` → `upsertListingAlert` keyed `(email, filters_hash)`, `origin='user'`, `source='user'` | `app/actions/saved-searches.ts:124-146`; `lib/data/leads/listingAlerts.ts:150-182` |
| 2 | Guest alert capture (organic — anonymous `/search` visitor) | `submitSearchAlertSignup`: honeypot (`:41-44`), per-IP rate limit fail-closed in prod (`:50-67`), email validation (`:69-73`), narrowing-filter guard (`:86-88`), CRM buyer lead (`:101-136`), then `upsertListingAlert` (`:142-143`) | `app/actions/search-alert-capture.ts:35-158`; UI `components/search/SearchAlertCapture.tsx:24-36` (URL-as-truth filters) |
| 3 | Paid LP (`/lp/buyer-listing-alerts`, robots noindex) | form submit mints one `listing_alerts` row PER derived filter set via `upsertListingAlert`, skipped entirely for hard-stopped leads | `app/lp/buyer-listing-alerts/actions.ts:15,352-370`; `app/lp/buyer-listing-alerts/page.tsx:21-26` |
| 4 | Broker attach (internal — every CRM surface routes through `createListingAlertForLead` with `origin='broker'`, `source='broker-assigned'`) | Four live call sites, each passing an EXPLICIT frequency (the DAL weekly fallback `listingAlerts.ts:228-230` never fires): (a) CRM bulk action `assignSavedSearchHandler` — **effective default DAILY** (handler coerces anything non-weekly to daily, `assign-saved-search.ts:71`; bulk UI initial value `frequency:'daily'`, `components/admin/crm/bulk/registry.tsx:426,435`); empty-after-normalization filters refuse the WHOLE job (`:61-65`); (b) single-lead admin assign — default weekly (`app/actions/newsletter.ts:245-246`); (c) admin bulk assign — fixed weekly (`app/actions/newsletter.ts:294`); (d) listing-matches attach — default weekly (`app/actions/contact-listing-matches.ts:76,79-89`) | `lib/crm/bulk-handlers/assign-saved-search.ts:49-116`; `lib/data/leads/listingAlerts.ts:190-238` |
| 5 | System neighborhood-default provisioning (internal, MANUAL-TRIGGER ONLY — Matt directive 2026-07-06; the route exists but is deliberately NOT in `vercel.json`, dry-run by default, live requires `confirm=1&dryRun=0`) | `GET /api/cron/neighborhood-default-subscriptions` → `provisionNeighborhoodDefaultSubscriptions`: every contact on a CRM neighborhood list gets a `{neighborhoodSlug}` alert row written DIRECTLY (not via `createListingAlertForLead`) with `origin='system'`, `source='neighborhood-default'`, `notification_frequency='weekly'`, `last_notified_at=now` (soft launch — first email carries only post-enrollment listings); insert-only `ignoreDuplicates` so an existing or unsubscribed row is never touched | `app/api/cron/neighborhood-default-subscriptions/route.ts:1-42` (manual-only `:6-18`, double-confirm gate `:31`); `lib/data/crm/neighborhoodDefaultSubscriptions.ts:210-226,252-259` |

Preconditions on every channel: an email, a narrowing filter set (never a whole-feed alert —
guards at `app/actions/search-alert-capture.ts:86-88` and
`lib/crm/bulk-handlers/assign-saved-search.ts:61-65`; channel 5 is narrowing by construction,
always the normalized `{neighborhoodSlug}` filter — `neighborhoodDefaultSubscriptions.ts:49-51`;
re-checked at send time §5.4), and the **resurrection guard**: a `(email, filters_hash)` pair
the recipient explicitly one-click unsubscribed stays `is_active=false` on any re-create, from
any channel (`lib/data/leads/listingAlerts.ts:111-133,157-158,211-213`; channel 5 goes further —
insert-only `ignoreDuplicates` never touches ANY existing row, whatever its state,
`neighborhoodDefaultSubscriptions.ts:94-111,252-259`).

The run trigger is the cron: `GET /api/cron/saved-search-alerts`, Bearer `CRON_SECRET`,
registered hourly (`vercel.json:213-214`; `app/api/cron/saved-search-alerts/route.ts:16-18`).

## 3. Actors

- **Subscriber (buyer/dreamer/investor, any device)** — receives the email; their only
  in-process actions are opening/clicking (return) and stopping (unsubscribe). Device split
  from GA4 was NOT queried this session and is not stated (§0); mobile-first is Matt-locked
  product truth regardless (`decisions.md` 2026-08-11).
- **Household recipients** — extra emails on one row, each with its OWN unsubscribe token and
  OWN compliance gate; one stopped recipient never silences the rest
  (`lib/alerts/delivery-plan.ts:39-71`; `lib/alerts/send.ts:283-357`).
- **Assigned broker** — every send goes out under the named broker identity with a monitored
  reply-to, defaulting to `matt`; a reply to an alert reaches a human, never noreply@
  (`lib/alerts/send.ts:57-60,409,434-448`).
- **CRM admin (preview mode)** — approves/rejects held events in the subscriptions-hub
  Approval Queue tab; approval releases through the SAME send path
  (`components/admin/crm/subscriptions/ApprovalQueueTab.tsx:8,25-26,110-111`;
  `app/actions/saved-search-alerts.ts:465-542`).
- **Automated actors** — the hourly cron (the only scheduled actor;
  `app/api/cron/saved-search-alerts/route.ts:16-30`).
- **Accountable for completion:** the cron for every delivery cycle; the recipient for their
  own exit (unsubscribe is fully self-serve); the admin for queued preview items.

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| The subscription — filters, hash, cadence, event toggles, schedule days, per-key notified cursor, tokens, household recipients, origin/source | `public.listing_alerts` — THE unified table (migration `20260707160000` per the DAL header); DAL-guarded (G1 banned-list table, service-role writes only) | `lib/data/leads/listingAlerts.ts:8-25,34-69` |
| Held preview events | `public.listing_alert_queue` (RLS enabled, no policies — service-role only) | `lib/data/leads/listingAlertQueue.ts:1-30` |
| Send measurement | `public.email_events` — one `'sent'` row per delivery, keyed on the same `emailKey` the open/click tracker signs | `lib/alerts/send.ts:410-413,459-469` |
| Recipient identity + compliance | `public.crm_people` via `resolveCrmPersonId` (row born tracking-ready) + `resolvePersonForTracking` at send; hard-stop/suppression via `isHardStopped` / `isSuppressedByEmail` | `lib/data/leads/listingAlerts.ts:83-109`; `lib/alerts/send.ts:322-345` |
| Global email kill-switch (signed-in rows) | `profiles.notification_preferences.emailEnabled` | `app/actions/saved-search-alerts.ts:167-178`; writer type `app/actions/profile.ts:6` |
| The match set | the search cache over live inventory (`getCachedSearchListings`) — the same DAL path the search page renders, so the email can never disagree with the site | `app/actions/saved-search-alerts.ts:180-182,206` |
| Gate-drop audit trail | `admin_actions` (`alert_gate_drop` rows, actor `system:listing-alerts`) | `app/actions/saved-search-alerts.ts:301-320` |
| **NOT a SoR** | Legacy `saved_searches` — display-only public/social mirror, written `is_paused:true`, never alert-scanned | `app/actions/saved-searches.ts:148-168` |
| **NOT a SoR** | The sent email itself (the row's claimed cursor is the truth of what was notified); `guest-watch-residual` localStorage (client-side product memory only — no server role, no PII) | `lib/data/leads/listingAlerts.ts:369-392`; `lib/alerts/guest-watch-residual.ts:1-33` |

## 5. End-to-end path (inception → completion)

Steps 1 is the handoff from any of the five §2 channels; steps 2–13 are one engine cycle for
one row. Actor "system" = the cron run; device is n/a for machine steps (the email itself is
consumed mobile-first).

1. **Row minted** · visitor/broker/system · one of the five §2 channels writes an active
   `listing_alerts` row keyed `(email, filters_hash)`; upsert dedupes, resurrection guard
   holds · input: email + normalized filters · output: durable subscription ·
   `lib/data/leads/listingAlerts.ts:150-182,190-238`;
   `lib/data/crm/neighborhoodDefaultSubscriptions.ts:210-226,252-259` · failure: generic
   error to the caller, raw DB error server-side only (`:175-180`); channel-5 batch errors
   throw per neighborhood and collect into the run summary
   (`neighborhoodDefaultSubscriptions.ts:259,294-297`).
2. **Hourly scan** · cron · `GET /api/cron/saved-search-alerts` (300s budget) →
   `runListingAlerts` over `getActiveListingAlertsDue`: inactive rows excluded in the DB,
   **most-overdue first** (never-notified rows lead) so the queue drains fairly; scan budget
   default 600 (cap 1000), sends capped 200/run ·
   `app/api/cron/saved-search-alerts/route.ts:14-30`;
   `app/actions/saved-search-alerts.ts:81,116-128,141-145`;
   `lib/data/leads/listingAlerts.ts:282-296` · failure: 500 JSON, next tick resumes.
3. **Cadence gate** · system · `isCadenceDue`: four cadences — `instant` (55-min floor so the
   hourly tick is never skipped by clock jitter), `daily`, `weekly` (incl. per-day
   `schedule_days`, 0=Sun..6=Sat, America/Los_Angeles, at most once per local day),
   `monthly` (30d); unparseable stored timestamp reads as never-notified so a corrupt value
   cannot silence an alert forever; not-due rows skip WITHOUT touching the cursor ·
   `app/actions/saved-search-alerts.ts:147-152`; `lib/saved-search-cadence.ts:19,85-96,139-163`.
4. **Row guards** · system · (a) signed-in global pref `emailEnabled === false` → skip +
   advance cursor (`:167-178`); (b) empty-filter row ("would match the whole feed") → skip +
   advance, logged loudly, never blasted (`:183-191`); (c) named areas resolving to no
   shapes → skip + advance, never widened (`:195-205`). Every due-but-not-emailed decision
   advances `last_notified_at` ("checked through now") so the most-overdue-first queue can
   never be starved by one stuck row (`:154-163`) ·
   `app/actions/saved-search-alerts.ts:147-205`.
5. **Match + shield** · system · `getCachedSearchListings` with the FULL stored filters
   (never an over-broad subset), then the subscriber's hidden homes are excluded BEFORE the
   diff — a hidden home never fires an event (hidden lookup fail-soft, per-run memo per
   user) · `app/actions/saved-search-alerts.ts:97-109,131-139,180-224`.
6. **Typed-event diff** · system · `detectListingEvents` diffs the per-key notified state
   (typed entries + legacy plain keys migrate forward) against current matches plus a
   departed-key status lookup → six event types (`new / price_change / status_change /
   back_on_market / sold / open_house`); a back-compat timestamp heuristic stops
   pre-upgrade rows from re-announcing everything ·
   `app/actions/saved-search-alerts.ts:227-278`; `lib/alerts/event-detection.ts:26-58`
   (Flexmls-inherited toggle defaults `:42-49`: new ✓ price ✓ status ✓, rest ✗).
7. **Recipients + compliance** · system · primary + household entries normalized and
   deduped; missing per-recipient unsubscribe tokens backfilled AND persisted;
   `isHardStopped` + `isSuppressedByEmail` run per recipient; an unverifiable recipient
   FAILS CLOSED (dropped) · `app/actions/saved-search-alerts.ts:283-288`;
   `lib/alerts/send.ts:283-357`; `lib/alerts/delivery-plan.ts:39-71`.
8. **Delivery plan** · system · pure branching, order matters: toggle filter first (with the
   ODS VOW rule — `sold` events NEVER fire for a guest row regardless of the stored toggle),
   then `preview_mode` → queue, then compliance fan-out; all-recipients-stopped → skip.
   Skips write a durable `alert_gate_drop` on `admin_actions`; a compliance skip advances
   the cursor WITHOUT absorbing the notified state so a transient suppression blip recovers
   next run while a real stop stays quiet ·
   `lib/alerts/delivery-plan.ts:96-124`; `lib/alerts/event-detection.ts:370-390`;
   `app/actions/saved-search-alerts.ts:290-330`.
9. **Preview hold** (branch) · system → admin · events queued one row per
   (alert, listing, event) in `listing_alert_queue` with the rendered card payload; cursor
   advances; admin approves/rejects in the CRM subscriptions hub — approval re-runs
   compliance and releases through the SAME send path, rejection means the subscriber simply
   never hears about that event ·
   `app/actions/saved-search-alerts.ts:339-366,465-542`;
   `lib/data/leads/listingAlertQueue.ts:1-30`;
   `components/admin/crm/subscriptions/ApprovalQueueTab.tsx:110-111`.
10. **Claim-before-send** · system · compare-and-set stamps `last_notified_at` + next
    notified state BEFORE Resend — a successful delivery can never re-blast when a post-send
    mark fails, and two concurrent runners can never both claim one due window
    (`claim_lost` aborts the row for this run); notified keys capped at 1000 HEAD-kept
    (tail-cap would have re-fired emailed listings as `new` forever — adversarial audit
    2026-07-30 note in the DAL) · `app/actions/saved-search-alerts.ts:383-403`;
    `lib/data/leads/listingAlerts.ts:341-357,369-392`.
11. **Send** · system · per recipient: sectioned typed-event email (≤12 cards, honest "+N
    more" overflow), plain no-hype subject ("6 new listings for Bend under 800k"),
    `browseAllUrl` deep link, UTM `listing-alerts` stamped once, broker attribution +
    open/click instrumentation applied exactly once on the FINAL HTML, manage link ONLY for
    the signed-in primary, per-recipient token unsubscribe link, RFC 8058
    `List-Unsubscribe` + `List-Unsubscribe-Post` headers, a last-instant suppression
    re-check at the chokepoint, named-broker from + monitored reply-to, then one
    `email_events 'sent'` row (best-effort — a reporting failure never aborts the stamp) ·
    `lib/alerts/send.ts:53-54,114-121,365-479`; `lib/crm/listing-alert-email.ts:132-145`;
    `lib/alerts/manage-url.ts:17-22`.
12. **Failure restore** (branch) · system · zero recipients delivered → restore the prior
    cursor so the row stays due and a true retry happens next tick; partial success keeps
    the claim (the sent recipients must not be re-blasted) ·
    `app/actions/saved-search-alerts.ts:405-434`; `lib/data/leads/listingAlerts.ts:395-411`.
13. **Exit** · recipient · (a) one-click: mail provider POSTs the `List-Unsubscribe` header
    URL → `deactivateListingAlertByToken` (primary token kills the whole alert; an
    additional-recipient token removes only that recipient); (b) the branded confirm page
    deactivates only on an explicit button POST — a GET/prefetch can never opt anyone out
    (the API's GET redirects to the page); (c) signed-in users flip the global email pref or
    pause from /account (visitor-side surfaces owned by `save-and-return.*`) ·
    `app/api/alerts/unsubscribe/route.ts:27-46`; `app/alerts/unsubscribe/page.tsx:22-30`;
    `lib/data/leads/listingAlerts.ts:494-543` · mobile + desktop.

## 6. Decision points

- **Which channel mints the row** (§2) — decides `origin`/`source` and effective cadence.
  The `user` channels (1–3) write NO cadence at mint — `upsertListingAlert`'s payload has no
  `notification_frequency` (`lib/data/leads/listingAlerts.ts:159-173`), so the DB column
  default `'daily'` applies (`docs/DATABASE_SCHEMA_SNAPSHOT.md:2887` `listing_alerts`
  section, `:2899` — `notification_frequency text not-null default 'daily'`). Broker attach
  (channel 4): every live caller passes an explicit frequency, so the DAL weekly fallback
  (`listingAlerts.ts:228-230`) is dead code in practice — the CRM bulk action's effective
  default is **DAILY** (`lib/crm/bulk-handlers/assign-saved-search.ts:71` coerces
  non-weekly to daily; UI initial `components/admin/crm/bulk/registry.tsx:426`), while the
  single-lead assign, admin bulk assign, and listing-matches attach default/fix weekly
  (`app/actions/newsletter.ts:245-246,294`; `app/actions/contact-listing-matches.ts:76`).
  System provisioning (channel 5) writes weekly explicitly
  (`lib/data/crm/neighborhoodDefaultSubscriptions.ts:219`).
- **Resurrection guard** — an explicit opt-out beats every later re-create, from any channel
  (`lib/data/leads/listingAlerts.ts:111-133`).
- **Cadence + schedule-days gate** (§5.3); **global email pref** (§5.4a); **empty-filter +
  area-resolve guards** (§5.4b-c); **hidden-home shield** (§5.5).
- **Event toggles per row** — six per-type booleans, Flexmls defaults, admin-editable
  (`lib/alerts/event-detection.ts:42-49,65-74`; `lib/data/leads/listingAlerts.ts:452-472`;
  subscriber UI `app/account/saved-searches/AlertPreferences.tsx:36-47`).
- **Compliance, all fail-closed**: per-recipient hard-stop + suppression at plan time
  (`lib/alerts/send.ts:329-354`), suppression RE-CHECKED at the send chokepoint so a stop
  recorded between resolve and send still wins (`lib/alerts/send.ts:428-432`); §1 — a later
  opt-out always beats the opt-in.
- **ODS VOW gate**: `sold` events are signed-in-only; enforced in the pure filter, not just
  the toggle UI, so a `sold:true` stored on a guest row can never fire
  (`lib/alerts/event-detection.ts:370-390`; `app/actions/saved-search-alerts.ts:295-299`).
- **preview_mode**: queue vs direct send; compliance re-runs at release
  (`lib/alerts/delivery-plan.ts:87-95,114`; `app/actions/saved-search-alerts.ts:497-505`).
- **Claim CAS**: `claim_lost` → abort this row this run — concurrency decided in the DB
  (`lib/data/leads/listingAlerts.ts:381-391`).
- **Unsubscribe tier**: primary token vs additional-recipient token; checked in that order
  (`lib/data/leads/listingAlerts.ts:500-543`).
- **Voice canon (§2 brand)**: subjects and section labels are deliberately plain, sentence
  case, no hype — "N updates for {search}", "New listings" / "Price changes" / "Now pending"
  (`lib/crm/listing-alert-email.ts:132-145`; `lib/alerts/send.ts:62-70`).
- **§0 data trace**: the email renders ONLY rows the live search cache returned this run —
  the same DAL the search page uses — so every figure in the email traces to the listings
  SoR by construction (`app/actions/saved-search-alerts.ts:180-182,206`).
- **No-public-Coming-Soon**: inherited from the search DAL the engine reads through — the
  match set is the same one the public search page is allowed to render (same chokepoint,
  `app/actions/saved-search-alerts.ts:206`).

## 7. Completion

Standing loop; observable at two grains.

**Per cycle (one cron pass over one row), done when exactly one of:**
1. **Delivered** — ≥1 recipient accepted by Resend; an `email_events 'sent'` row exists and
   the cursor was claimed (`lib/alerts/send.ts:437-469`;
   `lib/data/leads/listingAlerts.ts:369-392`).
2. **Checked-quiet** — due but nothing to send (not-due skips excepted): cursor advanced,
   "checked through now" (`app/actions/saved-search-alerts.ts:154-163,301-330`).
3. **Held** — events queued for admin decision (`:339-366`).
4. **Failed-retryable** — zero sends landed, cursor restored, row stays due (`:417-434`).

**Per subscription, terminal states:**
- **Deactivated** — token unsubscribe (page POST or RFC 8058 one-click); re-creates stay
  muted (`lib/data/leads/listingAlerts.ts:506-516,111-133`).
- **Recipient-removed** — one household member exits; the alert lives on (`:518-542`).
- **Paused/deleted/pref-off** — via the visitor-side management surfaces (owned by
  `save-and-return.*`; the engine honors them at `app/actions/saved-search-alerts.ts:167-178`
  and via the DB-level `is_active` filter, `lib/data/leads/listingAlerts.ts:287`).

Artifacts of a healthy cycle: the sent email, the `email_events` row, the advanced per-key
cursor, and (on click-through) an attributed return session carrying UTM `listing-alerts`.

## 8. Time & performance

- **Loop latency budget (the number that matters):** market change → inbox is bounded by the
  hourly tick plus the row's cadence: `instant` within ~1h (55-min floor), `daily` 24h,
  `weekly` 7d or per-`schedule_days` local days, `monthly` 30d (`vercel.json:213-214`;
  `lib/saved-search-cadence.ts:85-96`).
- **Engine budgets:** 300s route budget; 600-row default scan (cap 1000); 200 emails/run
  hard cap — a mass rollout drips across hours instead of bursting deliverability; ≤12
  cards per email (`app/api/cron/saved-search-alerts/route.ts:14,25`;
  `app/actions/saved-search-alerts.ts:75-81,116`; `lib/alerts/send.ts:53-54`).
- **Fairness under saturation:** most-overdue-first ordering + advance-on-every-decision are
  what stop a starved queue when active rows exceed one run's budget
  (`lib/data/leads/listingAlerts.ts:282-290`; `app/actions/saved-search-alerts.ts:141-163`).
- **What "slow" means and who sees it:** a wave beyond 200 sends queues to the next hour —
  subscribers see a later email, never a dropped one; a Resend outage restores cursors so
  affected rows stay due (`app/actions/saved-search-alerts.ts:417-434`).
- **Time-to-answer on the one visitor surface in this process:** `/alerts/unsubscribe` is a
  single-question page — one H1, one sentence, one button; the answer is on screen at first
  paint (`app/alerts/unsubscribe/page.tsx:56-65`). CWV for it was NOT measured this session
  and no number is stated (§0); it is a noindex system page
  (`app/alerts/unsubscribe/page.tsx:17-20`), not a P8 litmus surface.
- **Stale budget rationale:** the route comment sizes the 600-row scan "across the 4x-daily
  cron" while the registered schedule is hourly — behavior is fine (hourly cycles faster),
  the math in the comment is stale (§10 defect 1;
  `app/api/cron/saved-search-alerts/route.ts:21-24` vs `vercel.json:213-214`). The cohort
  that comment sizes against — "the weekly-cadence neighborhood-default cohort (thousands of
  rows, mostly not-due skips)" — is the channel-5 population (§2.5).

## 9. Variants

One engine, one table, one send path; variants differ only at inception or fan-out — none
diverges in delivery, so no split:

- **Five inception channels** (§2) — signed-in save · guest capture · paid LP · broker
  attach · system neighborhood-default provisioning. Identical delivery semantics; only
  `origin`/`source`/effective-cadence differ
  (`lib/data/leads/listingAlerts.ts:159-174,214-233`;
  `lib/data/crm/neighborhoodDefaultSubscriptions.ts:210-226`).
- **Guest vs signed-in delivery** — same email except: no manage link (token-only exit,
  `lib/alerts/send.ts:399-403`) and no `sold` events (VOW,
  `lib/alerts/event-detection.ts:382-388`).
- **Household fan-out** — one row, several recipients, per-recipient tokens + compliance
  (`lib/alerts/send.ts:283-357`).
- **Preview mode** — admin-approval hold, same send path on release
  (`app/actions/saved-search-alerts.ts:465-542`).
- **Dry-run** — full pipeline, no writes/sends (`?dryRun=1`;
  `app/actions/saved-search-alerts.ts:117,161,389,423`).
- **NOT this process:** `/api/cron/crm-alert-drain` (internal broker notifications via
  SMS/push — different audience, different channel); the newsletter send engine (its own
  tables and cadence — see §10 defect 4); `guest-watch-residual` (client-side product
  memory only, `lib/alerts/guest-watch-residual.ts:1-15`); the visitor-side save/manage/
  click-back loops (sibling `save-and-return.*` PDSs).

## 10. Current implementation map

- **Routes/surfaces today:** `/api/cron/saved-search-alerts` (engine);
  `/api/cron/neighborhood-default-subscriptions` (channel-5 provisioning — manual-trigger
  only, deliberately NOT registered in `vercel.json`, dry-run by default;
  `app/api/cron/neighborhood-default-subscriptions/route.ts:1-18,31`);
  `/api/alerts/unsubscribe` (RFC 8058 one-click POST + GET redirect);
  `/alerts/unsubscribe` (branded confirm page); admin subscriptions-hub Approval Queue tab
  (preview releases). Inception surfaces belong to their visitor processes (§2).
- **Design registers (of the surviving languages):** the unsubscribe page mixes
  design-system primitives (`Button`, `H1` from `components/site/primitives`) with the
  legacy flat `SiteFooter` on one small page — the exact register-mixing class the P9
  ratchet kills (`app/alerts/unsubscribe/page.tsx:5-7`). The email template is its own
  render path (`lib/crm/listing-alert-email.ts`), outside the five site languages.
- **Actions/API/crons:** `runListingAlerts` + `approveAlertQueueItems` /
  `rejectAlertQueueItems` (`app/actions/saved-search-alerts.ts:111-446,465-542`); send
  machinery `lib/alerts/send.ts`; pure modules `lib/alerts/event-detection.ts`,
  `lib/alerts/delivery-plan.ts`, `lib/saved-search-cadence.ts`; DAL
  `lib/data/leads/listingAlerts.ts` + `listingAlertQueue.ts`; hourly cron
  (`vercel.json:213-214`).
- **Known defects / drift (all verified this run):**
  1. **Stale schedule rationale** — `app/api/cron/saved-search-alerts/route.ts:21-24` sizes
     the scan "across the 4x-daily cron"; `vercel.json:213-214` registers hourly.
  2. **Three-cadence comments vs four honored** — `app/actions/saved-searches.ts:70`
     ("instant | daily | weekly") and `:285-288` ("the three cron-honored values") both
     contradict `lib/saved-search-cadence.ts:19,85-90`, which honors FOUR including
     `monthly`. Behavior is correct (`validateCadence` accepts monthly); the comments lie.
  3. **`select('*')` engine read** — `ROW_COLS = '*'` is deliberate pre-migration
     resilience (`lib/data/leads/listingAlerts.ts:71-76`) but is now permanent surface: the
     typed-event migration landed 2026-07-29, so the compat rationale has expired and the
     wildcard hides future column drift. Cleanup candidate, not a bug.
  4. **page-inventory boundary drift** — `page-inventory.json` maps `/newsletter/unsubscribe`
     to `deliver-alerts`, but the newsletter engine is a separate send system with its own
     tables and DAL (`lib/data/newsletter/*` — the section region spanning
     `docs/DAL_INDEX.md:2813-2873`, `brokerAnalytics.ts` through `tracking.ts`;
     `:2247` is `lib/data/leads/listingAlerts.ts`, THIS process's DAL); this
     process touches neither newsletter table. P5 must re-map that route (or P3 must widen
     this process's charter explicitly — this PDS proposes re-mapping, not widening).
  5. **Engine truth documented twice** — §5 here and `save-and-return.search-alerts` §5
     steps 6–15 describe the same code. Deliberate during P2 (each PDS must stand alone);
     P3 crowns one owner (§0 verdict — this file).
  6. **Dead DAL defaults that mislead** — `createListingAlertForLead`'s weekly fallback
     (`lib/data/leads/listingAlerts.ts:228-230`, doc comment "Defaults to weekly" `:200-201`)
     and its `origin:'system'` → `source:'system'` branch (`:198,224`) both have ZERO live
     callers: all four callers pass `origin:'broker'` with an explicit frequency
     (`lib/crm/bulk-handlers/assign-saved-search.ts:92-102`;
     `app/actions/newsletter.ts:246,294`; `app/actions/contact-listing-matches.ts:79-89`),
     and the real system channel writes `source='neighborhood-default'` directly
     (`lib/data/crm/neighborhoodDefaultSubscriptions.ts:217-218`). An earlier draft of this
     PDS transcribed the dead fallback as the bulk channel's default — the live default there
     is daily (§2.4, §6). Cleanup candidate: delete or align the dead branches.
- **Duplicate/parallel paths that should die:** none in the engine — the 2026-07-07
  unification killed the dual `saved_searches`/`guest_search_alerts` split
  (`app/api/cron/saved-search-alerts/route.ts:6-8`; `lib/data/leads/listingAlerts.ts:8-16`);
  the legacy `saved_searches` mirror survives as a display-only orphan (owned as a defect by
  the sibling PDS §10.3).

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** The site's founding directive — "one lead-generation machine
that never acts like it" — needs exactly one machine process that turns "watch this for me"
into recurring, compliance-clean re-entries into the listing graph. The job (detect what
changed → tell the right person → give them a way back in and a way out) derives the shape;
today's single-table/single-engine/single-send-path architecture already matches it and the
target keeps it. What the job does NOT require: a second engine per channel, a per-channel
table, or any visitor-facing destination of its own.

- **Ideal step count:** ZERO visitor actions per cycle (the machine works while they live
  their life), ONE action to exit from any email, ONE email per alert per cycle — never a
  per-listing drip. Today matches.
- **Device:** the email is the surface — it must land mobile-first (390 is truth); the
  unsubscribe page must stay a one-tap, one-question page.
- **Data gaps blocking correctness (P4 ✗ statements, not designs — none queried this
  session, §0):**
  ✗ live `listing_alerts` counts by origin/cadence/active/preview_mode;
  ✗ `email_events` sent→open→click funnel for `send_type='alert'` (the loop's real KPI);
  ✗ `listing_alert_queue` depth + decision latency (is preview mode a shelf or a gate?);
  ✗ `alert_gate_drop` frequency by reason (how often compliance eats a send);
  ✗ distribution of events-per-email (signal vs noise per subscriber).
- **Destination implication (proposal, not a lock):** **NO destination.** This is a machine
  process; its pages are SYSTEM sentinels in `page-inventory.json` (`/alerts/unsubscribe`
  and the one-click API). The email is an off-site node of the exploration graph whose every
  link re-enters it; alert management lives inside the account/portal destination owned by
  `save-and-return.portal`; inception surfaces belong to their visitor processes. P5 should
  also re-map `/newsletter/unsubscribe` away from this process (§10 defect 4).

**Dual objective this process stamps on its pages (the email + the system pages):**

- `visitor_objective`: "Know what changed in the market I asked about — without re-running
  the search — and be able to stop these emails in one step."
- `machine_objective`: "Convert each detected market change into an attributed,
  compliance-gated return visit by an identified lead, with engagement measured per send."
- `exits`: email listing card → listing detail (`find-a-home`) · email "browse all" →
  `/homes-for-sale` with the saved filters (`lib/alerts/send.ts:380`) · manage link
  (signed-in primary only) → `/account/saved-searches#alert-<id>`
  (`save-and-return.portal`; `lib/alerts/manage-url.ts:17-22`) · reply → the assigned
  broker's monitored inbox (`contact-a-broker`; `lib/alerts/send.ts:434-448`) · unsubscribe
  page → back to `/search` (`app/alerts/unsubscribe/page.tsx:52-54,73-76`).

## 12. Acceptance checks

Prove the engine end-to-end. Persist; never delete.

1. **Cron wiring:** `grep -A1 'saved-search-alerts' vercel.json` → schedule `0 * * * *`;
   route file exists at `app/api/cron/saved-search-alerts/route.ts`.
2. **Dry-run engine health:**
   `curl -s -H "Authorization: Bearer $CRON_SECRET" "https://ryan-realty.com/api/cron/saved-search-alerts?dryRun=1&limit=50"`
   → `{ ok: true, scanned, sent, skipped, queued, errors: [] }`
   (shape at `app/actions/saved-search-alerts.ts:66-73`).
3. **Five-channel inception census (also P4 gap fill):**
   `select origin, source, count(*) filter (where is_active), count(*) from listing_alerts group by 1,2 order by 4 desc;`
   → rows for `user/user` (signed-in), `user/idx-registration` (guest + LP),
   `broker/broker-assigned` (all four broker surfaces), and `system/neighborhood-default` —
   the last ONLY if the manual provisioning endpoint has ever been live-run (`confirm=1&dryRun=0`;
   dry-run is the default and writes nothing, so zero system rows is a valid state, not a
   defect). `system/system` must NOT appear: that DAL branch has no live caller (§10 defect 6)
   (`lib/data/leads/listingAlerts.ts:168-169,222-224`;
   `lib/data/crm/neighborhoodDefaultSubscriptions.ts:217-218`;
   `app/api/cron/neighborhood-default-subscriptions/route.ts:31`).
4. **Idempotent upsert:** submit the identical search twice through any one channel →
   `select count(*) from listing_alerts where email='<e>' and filters_hash='<h>';` → 1.
5. **Resurrection guard, cross-channel:** one-click unsubscribe a row
   (`curl -s -X POST "https://ryan-realty.com/api/alerts/unsubscribe?token=<t>"` →
   `{"ok":true}`), then re-create the same `(email, filters_hash)` via a DIFFERENT channel
   (e.g. broker attach) → `is_active` is STILL false
   (`lib/data/leads/listingAlerts.ts:111-133,211-213`).
6. **Prefetch safety:** `curl -s -o /dev/null -w '%{http_code}' "https://ryan-realty.com/api/alerts/unsubscribe?token=<t>"`
   (GET) → 3xx redirect to `/alerts/unsubscribe` and the row's `is_active` unchanged; only
   the page's button POST or the API POST deactivates
   (`app/api/alerts/unsubscribe/route.ts:36-46`; `app/alerts/unsubscribe/page.tsx:22-30`).
7. **Recipient-tier unsubscribe:** POST an ADDITIONAL recipient's token → that entry leaves
   the `recipients` array, `is_active` stays true, primary keeps receiving
   (`lib/data/leads/listingAlerts.ts:518-542`).
8. **Headers + identity:** raw source of a delivered alert →
   `List-Unsubscribe: <…/api/alerts/unsubscribe?token=…>` and
   `List-Unsubscribe-Post: List-Unsubscribe=One-Click` present; From is the named broker
   identity, reply-to monitored, never noreply@ (`lib/alerts/send.ts:434-448`).
9. **Send measurement:**
   `select event, email_key, broker, send_type from email_events where send_type='alert' and recipient_email='<e>' order by created_at desc limit 3;`
   → a `'sent'` row keyed `listing-alert:<rowId>:<date>` (`lib/alerts/send.ts:410-413,459-469`).
10. **Claim integrity:** after a real send,
    `select last_notified_at, jsonb_array_length(notified_listing_keys::jsonb) from listing_alerts where id='<id>';`
    → stamped at claim time, keys ≤1000; force a total Resend failure (invalid API key in a
    staging run) → cursor restored, row still due next tick
    (`lib/data/leads/listingAlerts.ts:369-411`; `app/actions/saved-search-alerts.ts:417-434`).
11. **Cadence honesty:** set a row `weekly` with `schedule_days=[1]`, dry-run on a
    non-Monday → counted in `skipped`, `last_notified_at` unchanged
    (`lib/saved-search-cadence.ts:149-157`).
12. **Blast guards:** hand-write a test row with empty `filters` → next run logs
    `skipping alert with empty filters`, sends nothing, advances the cursor
    (`app/actions/saved-search-alerts.ts:187-191`); a broker bulk attach with
    empty-after-normalization filters refuses the whole job with
    `refused_empty_filters` (`lib/crm/bulk-handlers/assign-saved-search.ts:61-65`).
13. **VOW gate:** on a guest row (`user_id` null) set `events.sold=true` → sold events still
    never fire (`lib/alerts/event-detection.ts:382-388`;
    `app/actions/saved-search-alerts.ts:295-299`).
14. **Compliance chokepoint:** suppress a recipient's email AFTER resolve but BEFORE send
    (test hook or staging race) → the send-loop re-check drops them
    (`lib/alerts/send.ts:428-432`); `select details from admin_actions where action_type='alert_gate_drop' order by created_at desc limit 5;`
    shows durable gate-drop rows (`app/actions/saved-search-alerts.ts:301-320`).
15. **Preview loop:** set `preview_mode=true` on a row with due events → run → row counted
    `queued`, `listing_alert_queue` holds pending items; approve in the admin Approval Queue
    tab → email delivers through the same path and items move `approved→sent`
    (`app/actions/saved-search-alerts.ts:339-366,465-542`;
    `components/admin/crm/subscriptions/ApprovalQueueTab.tsx:110-111`).
16. **Send-cap drip:** with >200 due rows in staging, one run reports `sent ≤ 200` and the
    next run resumes with the most-overdue remainder
    (`app/actions/saved-search-alerts.ts:81,141-145`;
    `lib/data/leads/listingAlerts.ts:282-290`).
