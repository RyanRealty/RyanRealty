# Process: newsletter-lifecycle — Newsletter: subscribe, draft, tiered send, reconcile, unsubscribe

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** — the ISSUE rhythm is monthly (auto-draft on the 1st Pacific,
  `app/api/cron/newsletter-monthly-draft/route.ts:1-22,71-77`), but the machine runs
  continuously: send drain every 2 minutes (`vercel.json:149-151`), reconcile hourly
  (`vercel.json:145-147`), Postmaster deliverability sync daily (`vercel.json:165-166`),
  and a subscription lives until its recipient exits.
- Verdict: **PROPOSAL — KEEP.** This is the site's one recurring OUTBOUND edition of the
  market-knowledge pillar: one subscriber table, one issue table, one approve-then-drain
  queue, one engagement ledger, one unsubscribe surface. Nothing else on the site does
  this job, and two other products already ride its rails instead of building their own
  (bulk market-report delivery `lib/newsletter/market-report-bulk.ts:1-30`; the CRM
  single-contact send `app/actions/contact-newsletter.ts:1-28`) — evidence the engine is
  the right shape. KEEP as a machine process with SYSTEM pages only. Proposal only; the
  verdict locks at P3 in `decisions.md`.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A visitor who wants to keep up with the Central Oregon market without doing any work
gets one calm, source-verified market briefing a month — live city stats, a featured
community, recent writing, this month's events — signed by a named broker, stoppable in
one step. (b) The machine outcome is the recurring identified-return client-step: each
issue re-enters a known email into the exploration graph with a frozen broker
attribution and per-recipient engagement measurement, and it is produced BY serving (a)
— every figure and place in the issue is a deep link back into the site's market and
listing nodes, and the reply-to is the recipient's own broker, so the visitor's request
to be kept current is itself what builds the return channel
(`lib/newsletter/send-queue.ts:453-489`; `lib/newsletter/produce-draft.ts:3-29`).

## 2. Inception (what starts it)

Two inception planes: a SUBSCRIPTION begins (a `newsletter_subscribers` row goes
active), and an ISSUE begins (a `newsletters` draft row is created). Both must exist
before the first §5 delivery cycle.

**Subscription channels** (all converge on `subscribeToNewsletter` — upsert by
`lower(email)`, random `unsubscribe_token`, auto CRM-person link on an unambiguous
email match so engagement is attributable, `lib/data/newsletter/index.ts:71-123,85-92`):

| # | Channel | Entry | Evidence (opened this run) |
|---|---|---|---|
| 1 | Public footer signup (organic/direct/internal — every page carrying the site footer) | `NewsletterSignup` posts email + hidden `source='site-footer'` to `subscribeNewsletterAction` (no auth) | `components/site/NewsletterSignup.tsx:24,29-55`; mounted at `components/site/SiteFooter.tsx:33`; `app/actions/newsletter.ts:39-46` |
| 2 | Signed-in account toggle (`/account/notifications`) | `setMyNewsletterMembership(true)` — consent gate FIRST (`canUserResubscribe`; a hard bounce/complaint/hard-stop is never re-enabled), `source='account-notifications'` | `app/actions/newsletter-membership-user.ts:41-84` |
| 3 | Admin add / CRM assign (internal) | `adminAddSubscriberAction` / `adminAssignCrmPersonAction` (`source='admin'`/`'crm-assign'`); per-lead CRM toggle `setNewsletterSubscription` (compliance gate first, `source='crm-toggle:<broker>'`) | `app/actions/newsletter.ts:120-138`; `app/actions/crm-membership.ts:136-166` |
| 4 | Bulk enroll (superuser) | pasted list ∪ CRM tag, cap 5,000; previously opted-out addresses NEVER reactivated (S-10); one batch activation RPC | `app/actions/newsletter.ts:188-222`; `lib/data/newsletter/queue.ts:191-212` |
| 5 | Cohort enrollment (superuser) | past-client ∪ engaged-180d ∪ westside-parcel cohorts; dry-run default; real run requires typed `ENROLL`; cap 20,000; suppression fail-closed per address; writes rows only, never sends | `lib/newsletter/cohort-enrollment.ts:110-252`; wrapper `app/actions/newsletter-enrollment.ts:1-40` |
| 6 | One-off send side effect | `enqueueNewsletterToEmails` mints a `source='one-off'` subscriber row per eligible recipient — the row exists to carry the unsubscribe token CAN-SPAM requires | `lib/newsletter/send-queue.ts:219-244` |

**Issue channels:**

- **Monthly auto-draft cron** — registered daily 13:15 UTC (`vercel.json:141-143`); the
  handler itself no-ops unless it is the 1st in America/Los_Angeles, is idempotent by
  the month's subject, drafts from live DAL data, and notifies Matt by email + the
  broker SMS rail (`app/api/cron/newsletter-monthly-draft/route.ts:39-45,67-94`).
- **Admin generate button** — same producer, superuser-gated
  (`app/actions/newsletter.ts:526-533`); manual compose/edit
  (`adminCreateNewsletterAction`, `app/actions/newsletter.ts:302-315`).

Preconditions: a syntactically valid email (`lib/data/newsletter/index.ts:79-80`);
channels 2–5 are consent/suppression-gated; channel 1 deliberately reactivates a prior
unsubscribe on re-signup (`lib/data/newsletter/index.ts:95-110` — see §6 and §10 defect
5). An issue cannot leave draft without Matt (§5.4–5.5).

## 3. Actors

- **Subscriber (buyer/seller/owner/dreamer/past client, any device)** — gives one email;
  afterwards their only in-process actions are opening/clicking (return) and stopping.
  Segments `general | buyer | seller | past-client` shape audience filters
  (`lib/data/newsletter/index.ts:15,228-261`). Device split from GA4 was NOT queried
  this session and is not stated (§0); the email surface is consumed mobile-first per
  Matt-locked product truth (`decisions.md` 2026-08-11).
- **Matt (superuser)** — the only role that can author recipient-facing HTML, enqueue,
  schedule, bulk-enroll, or one-off send (`requireSuperuser`,
  `app/actions/newsletter.ts:55-68`; `app/admin/(protected)/newsletters/actions.ts:25-29`).
  Per-issue approval is the §1-model approval stamp: nothing sends without his action on
  the review page (`app/api/cron/newsletter-monthly-draft/route.ts:12-15`).
- **Brokers (matt/rebecca/paul)** — every recipient is FROZEN to their assigned broker
  at enqueue; the issue goes out under that broker's name, headshot close card, and
  monitored reply-to (`lib/newsletter/send-queue.ts:56-59,103-114,159-171,453-489`).
  Non-superuser admins may preview and test-send only
  (`app/actions/newsletter.ts:434-486`).
- **Automated actors** — four crons (§0 cadence); the Resend webhook (delivery/open/
  click/bounce/complaint/native-unsubscribe ingestion,
  `app/api/webhooks/resend/route.ts:71-131`); the site tracking pixel/click routes
  (`app/api/track/e/open/route.ts:74-89`; `app/api/track/e/click/route.ts:58-69`).
- **Accountable for completion:** Matt for every issue's approval; the send cron for
  delivery of an approved issue; the recipient for their own exit (fully self-serve).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| The subscription — email, name, status (`active/unsubscribed/bounced/complained`), source, segment, CRM link, unsubscribe token | `public.newsletter_subscribers` (RLS on, no policies — service-role only) | `lib/data/newsletter/index.ts:5-31` |
| The issue — subject, body, audience, full status lifecycle (`draft/scheduled/sending/sent/failed/canceled`), send lock, pause flag, **§0 citations trace (jsonb, one entry per stat token)** | `public.newsletters` | `lib/data/newsletter/index.ts:33-59,320-338` |
| Per-recipient queue + delivery outcome — frozen broker + engagement tier, `queued/sending/skipped/sent/failed` + webhook outcomes, Resend message id | `public.newsletter_recipients` | `lib/data/newsletter/queue.ts:17-30,233-258,300-343`; `lib/data/newsletter/index.ts:358-405` |
| The tranche plan — (day_index, tier, cap, sent_count) per issue | `public.newsletter_send_schedule` | `lib/data/newsletter/queue.ts:20,260-298` |
| Engagement — deduped append-only ledger every newsletter stat derives from; recipient-scoped `dedupe_key` collapses pixel refires + webhook redeliveries | `public.newsletter_recipient_events` | `lib/data/newsletter/queue.ts:21,409-462,483` |
| Deliverability — Gmail Postmaster reputation/spam/auth per sending domain, unique (domain, metric_date) | `public.deliverability_metrics` | `app/api/cron/postmaster-sync/route.ts:1-24`; verdict `lib/data/deliverability/index.ts:48-59` |
| The opt-out, globally — token unsubscribe mirrors into `crm_suppressions` so EVERY marketing-email surface honors it, not just this list | `public.crm_suppressions` (via `addSuppression` / direct email-keyed row) | `lib/data/newsletter/index.ts:139-177` |
| **NOT a SoR** | The legacy per-recipient counters on `newsletter_recipients` (`recordNewsletterEvent`) — kept for back-compat; the ledger wins for admin stats | `app/api/webhooks/resend/route.ts:123-131`; `app/admin/(protected)/newsletters/[id]/page.tsx:31-32,256-258` |
| **NOT a SoR** | `email_events` (the unified CRM engagement store also receives newsletter opens/clicks, but per-issue stats derive from the ledger); the sent email itself | `app/api/track/e/open/route.ts:60-72`; `lib/data/newsletter/queue.ts:483-523` |

## 5. End-to-end path (inception → completion)

Steps 1–2 are the two inception planes; 3–6 are Matt's gate; 7–10 are one delivery
cycle; 11–12 are measurement and exit. Actor "system" = a cron run; device is n/a for
machine steps (the email lands mobile-first).

1. **Subscriber row minted** · visitor/admin/system · one of the six §2 channels calls
   `subscribeToNewsletter` — upsert by `lower(email)`, unambiguous-email CRM link
   resolution (an unlinked row would render UN-instrumented issues, found live
   2026-07-10), random unsubscribe token on insert · input: email (+segment/source) ·
   output: durable `active` subscriber row · `lib/data/newsletter/index.ts:71-123` ·
   failure: `persist_failed` to the caller, raw error server-side only (`:109,121`).
2. **Issue drafted** · system (cron, 1st Pacific) or Matt (button) ·
   `produceNewsletterDraft` pulls EVERY figure live through the DAL
   (`getMarketReportData`, `getRecentBlogPosts`, `getCommunityBySlug`,
   `getEventsForMonth`), omits any null figure rather than filling, writes the draft +
   the §0 `citations` trace; cron is idempotent by monthly subject and notifies Matt
   (email + cooldown-deduped SMS) · `lib/newsletter/produce-draft.ts:1-45`;
   `app/api/cron/newsletter-monthly-draft/route.ts:67-94`;
   `lib/data/newsletter/index.ts:329-338` · failure: 200-JSON `failed`, next tick or a
   manual `?force=1` retries.
3. **Review** · Matt · the review page renders the draft through the REAL send shell
   per chosen broker (`renderNewsletterPreview` — same `wrapNewsletterHtml` path the
   drain uses, placeholder unsubscribe URL), plus a real test send to his own inbox
   with production headers · `lib/newsletter/preview.ts:1-25`;
   `app/actions/newsletter.ts:434-486` · desktop/mobile.
4. **Pre-send gates** · system, blocking · R-1 brand voice hard-fail (CI's voice gate
   skips `app/admin/`, so the chokepoint runs here), R-2 every stat token in the body
   maps to a citations entry (defined grammar: currency, percent, day counts, MoS,
   labeled inventory counts, verdict pills), R-3 every internal link returns HTTP 2xx ·
   gates run on demand AND inside schedule/send actions ·
   `lib/newsletter/pre-send-gates.ts:1-26,84-136,168-206`;
   `app/admin/(protected)/newsletters/actions.ts:45-55,81-87`;
   `app/actions/newsletter.ts:360-363` · failure: the action returns the exact failure
   list; nothing enqueues.
5. **Approve = enqueue** · Matt → system · `adminSendNewsletterAction` (or
   `adminScheduleNewsletterAction` → later promotion) records the approver, then
   `enqueueNewsletter`: CAS lock draft/scheduled→sending (a concurrent approve gets
   null and aborts), paginated audience resolution honoring the segment filter
   (`'all'` = everyone; a segment — INCLUDING `general` — filters), deliverability
   verdict gate on a large send (>1,000: block on Gmail LOW/BAD or spam >0.30%),
   freeze each recipient's broker + engagement tier (T1 engaged in the last 2 sent
   issues / T2 never-sent / T3 cold), insert queued rows, write the tranche schedule
   (small = day 0; large = T1 day 0, T2 days 1–2, T3 days 3–6; first-ever send ramps
   warm-up caps 500→8,000/day) · `app/actions/newsletter.ts:349-377`;
   `lib/newsletter/send-queue.ts:128-188,291-313`;
   `lib/data/newsletter/queue.ts:34-54,77-103`;
   `lib/data/newsletter/index.ts:228-261` · failure: lock rolled back to draft so a
   failed enqueue never strands the issue (`lib/newsletter/send-queue.ts:183-187`).
6. **Scheduled promotion** (branch) · system · each send-cron tick first promotes any
   issue whose `scheduled_at` has arrived via the SAME `enqueueNewsletter` ·
   `app/api/cron/newsletter-send/route.ts:23-26`;
   `lib/newsletter/send-queue.ts:323-333`; `lib/data/newsletter/scheduled.ts:10-26`.
7. **Drain tick** · system, every 2 min · per sending issue: honor the pause flag,
   requeue claims stuck `'sending'` >15 min (a crashed run self-heals), then the
   circuit breaker — bounce >2% or complaint >0.1% over ≥50 sent auto-pauses the issue
   AND pages Matt on the SMS rail; resume is an explicit admin action ·
   `lib/newsletter/send-queue.ts:47-52,337-376`;
   `app/admin/(protected)/newsletters/actions.ts:110-125` ·
   `vercel.json:149-151`.
8. **Claim + per-recipient compliance** · system · for each schedule row whose tranche
   day arrived and cap remains, claim a batch atomically (queued→sending; concurrent
   ticks can never double-send), then per recipient: subscriber still `active` (an
   unsubscribe DURING the send skips the remaining rows), suppression re-check
   fail-closed at the chokepoint, and no unsubscribe token = no send (a non-compliant
   email is never sent) · `lib/newsletter/send-queue.ts:378-420`;
   `lib/data/newsletter/queue.ts:300-343`.
9. **Per-broker render + send** · system · the issue body is wrapped in the shell
   (masthead → Old Mill hero → body → the recipient's broker close card), every site
   link stamped `?agent=<frozen broker>` plus a broker-stamped 180-day tracking token
   keyed `newsletter:<id>`, RFC 8058 `List-Unsubscribe` (pointing at the POST API
   route, NOT the RSC page — the page would 405 a provider's one-click) +
   `List-Unsubscribe-Post` headers, From = `<Broker> · Ryan Realty
   <newsletter@news.ryan-realty.com>` (isolated bulk subdomain), replyTo = the
   broker's monitored inbox; outcome finalized per row (`sent`/`failed`), tranche
   counter bumped; ≤100 recipients per issue per tick ·
   `lib/newsletter/send-queue.ts:39-45,61-73,421-445,453-489`.
10. **Reconcile + finalize** · system, hourly · a tranched issue legitimately stays
    `'sending'` for days, so finalization is state-based, never time-based: when no
    queued/in-flight rows remain the issue flips to `sent` (or `failed` when nothing
    delivered); queued rows PAST their tranche day with nothing sent = a STALL, which
    pages Matt (cooldown-deduped) · `lib/newsletter/send-queue.ts:493-531`;
    `lib/data/newsletter/queue.ts:360-407`;
    `app/api/cron/newsletter-reconcile/route.ts:1-30`.
11. **Measurement** · system · three writers, one deduped ledger: the Resend webhook
    (delivered/open/click/bounce/complaint → ledger row + legacy counters + subscriber
    status mirror on bounce/complaint + crm_timeline), the site pixel, and the click
    redirect (both append the ledger when the token's emailKey is `newsletter:<id>`,
    non-blocking by contract); the recipient-scoped dedupe key makes replays
    non-inflating; admin stats read the ledger ·
    `app/api/webhooks/resend/route.ts:104-131`; `lib/newsletter/track-ledger.ts:1-59`;
    `app/api/track/e/open/route.ts:74-89`; `app/api/track/e/click/route.ts:58-69`;
    `lib/data/newsletter/queue.ts:425-462`; `lib/data/newsletter/index.ts:263-278`.
12. **Exit** · recipient · (a) RFC 8058 one-click: provider POSTs the API route —
    always 200 (never leak token validity, never 405 a bulk-sender scan), GET
    redirects to the confirm page; (b) the branded page unsubscribes only on an
    explicit button POST — a prefetch can never opt anyone out; (c) BOTH mirror a
    durable GLOBAL email suppression (person-keyed when linked, email-keyed
    otherwise) so every other marketing surface honors the opt-out; (d) the signed-in
    toggle at /account/notifications routes through the same token flip; (e) Resend's
    native unsubscribe and bounce/complaint webhooks move the row to a terminal
    status (never reactivated) · `app/api/newsletter/unsubscribe/route.ts:22-61`;
    `app/newsletter/unsubscribe/page.tsx:10-32`;
    `lib/data/newsletter/index.ts:126-178,266-278`;
    `app/actions/newsletter-membership-user.ts:48-57`;
    `app/api/webhooks/resend/route.ts:79-102` · mobile + desktop.

## 6. Decision points

- **Which channel mints the subscriber** (§2) — decides `source`, segment, and the
  consent posture: bulk/one-off/cohort paths NEVER resurrect an opt-out (S-10,
  `app/actions/newsletter.ts:204-218`; `lib/newsletter/send-queue.ts:219-233`;
  `lib/newsletter/cohort-enrollment.ts:185-215`), the account toggle re-subscribe is
  consent-gated to the address owner clearing only their own soft unsubscribe
  (`app/actions/newsletter-membership-user.ts:59-80`), while the PUBLIC footer
  re-subscribe reactivates unconditionally (`lib/data/newsletter/index.ts:66-70,95-110`
  — deliberate for the owner, but unverified; §10 defect 5).
- **Role gates** — `requireSuperuser` for anything that authors recipient-facing HTML
  or reaches the whole list; `requireAdmin` only for preview/test-send/single
  subscriber ops (`app/actions/newsletter.ts:55-68`).
- **R-1 voice canon (§2 brand)** — hard-fail at send AND schedule, because the CI
  voice gate skips `app/admin/` (`app/actions/newsletter.ts:360-363`;
  `app/admin/(protected)/newsletters/actions.ts:81-87`;
  `lib/email/voice-precheck.ts:57-65`).
- **R-2 §0 data trace** — a stat token without a citations entry blocks scheduling;
  the producer writes the trace at draft time and omits null figures rather than
  filling (`lib/newsletter/pre-send-gates.ts:84-136`;
  `lib/newsletter/produce-draft.ts:10-17`).
- **R-3 dead-link gate** — every internal link must 2xx before an issue can ship a
  dead destination (`lib/newsletter/pre-send-gates.ts:168-193`).
- **Audience filter** — `'all'` vs `segment:<x>`; a `general`-segment send filters
  (the old behavior leaked general sends to buyer/seller too)
  (`lib/data/newsletter/index.ts:241-244`).
- **Large-send threshold (1,000)** — triggers the Postmaster verdict gate
  (block/warn/warmup) and multi-day tiered tranching; a one-off runs the SAME gates so
  a pasted list cannot bypass deliverability machinery
  (`lib/newsletter/send-queue.ts:43-44,150-157,245-255`;
  `lib/data/deliverability/index.ts:48-59`).
- **Circuit breaker** — bounce >2% / complaint >0.1% over ≥50 sent → auto-pause +
  page Matt; resume is explicit (`lib/newsletter/send-queue.ts:337-376`;
  `app/admin/(protected)/newsletters/actions.ts:110-125`).
- **Suppression chokepoint, fail-closed, at drain time** — per claimed row immediately
  before Resend, so a stop recorded between enqueue and send still wins; no token = no
  send (`lib/newsletter/send-queue.ts:405-420`).
- **CAS lock** — draft→sending decided in one conditional UPDATE; the loser aborts
  (`lib/data/newsletter/queue.ts:34-54`).
- **Unsubscribe = global opt-out (NL-M1)** — the token flip mirrors into
  `crm_suppressions`, so it silences EVERY marketing-email surface, not one list
  (`lib/data/newsletter/index.ts:139-172`).
- **Opt-out record protection** — deleting a non-active subscriber row would erase the
  only record of a plain unsubscribe; requires an explicit acknowledgment; only drafts
  are deletable at the issue level
  (`app/admin/(protected)/newsletters/actions.ts:175-195`;
  `app/actions/newsletter.ts:329-338`).
- **ODS/IDX attribution** — n/a by construction today: the issue body carries market
  aggregates, blog links, a community, and events from the DAL, not IDX listing
  displays (`lib/newsletter/produce-draft.ts:23-35`). If a future issue embeds listing
  cards, G54 applies to that template change.
- **No-public-Coming-Soon** — n/a for the same reason: no listing-level rows render in
  the issue body today (same evidence).

## 7. Completion

Observable at three grains.

**Per issue, done when:** `status='sent'` — every recipient row terminal
(`sent/skipped/failed`, zero queued/sending) and ≥1 delivered; all-failed finalizes
`'failed'` (`lib/data/newsletter/queue.ts:391-407`). Artifacts: the `newsletters` row
with `citations`, `sent_by`, `send_finished_at`; the per-recipient outcome rows; the
tranche schedule with `sent_count=cap`; ledger engagement rows; per-broker breakdown
on the admin issue page (`app/admin/(protected)/newsletters/[id]/page.tsx:256-258`).

**Per delivery cycle (one drain tick over one issue), done when exactly one of:**
delivered ≤100 more recipients · skipped rows finalized (inactive/suppressed/tokenless)
· paused (breaker or manual) · nothing due (waiting on a future tranche day)
(`lib/newsletter/send-queue.ts:357-445`).

**Per subscription, terminal states:** `unsubscribed` (page POST, one-click POST,
account toggle, Resend native, admin remove) · `bounced` / `complained` (webhook
mirror; never reactivated) · row deleted (admin, opt-out-acknowledged)
(`lib/data/newsletter/index.ts:126-178,263-278`;
`app/api/webhooks/resend/route.ts:79-102`;
`app/admin/(protected)/newsletters/actions.ts:175-195`). The public footer or a
consent-gated toggle can re-open a subscription (§6).

## 8. Time & performance

- **Issue latency budget:** draft exists the morning of the 1st (Pacific)
  (`app/api/cron/newsletter-monthly-draft/route.ts:39-45,71-77`); delivery begins
  within one 2-minute tick of Matt's approval (or of `scheduled_at`); a small send
  completes at ~100 recipients per tick per issue — the drain cap
  (`lib/newsletter/send-queue.ts:46,390,440`) with the cron at `*/2 * * * *`
  (`vercel.json:149-151`); a LARGE send takes up to 7 days BY DESIGN (tier days 0–6,
  `lib/newsletter/send-queue.ts:301`), plus warm-up caps 500→8,000/day on a first-ever
  send (`:302`).
- **Engine budgets:** send route 60s, draft route 120s, reconcile 60s
  (`app/api/cron/newsletter-send/route.ts:18`;
  `app/api/cron/newsletter-monthly-draft/route.ts:33`;
  `app/api/cron/newsletter-reconcile/route.ts:17`); stale-claim recovery window 15 min
  (`lib/newsletter/send-queue.ts:48`); one-off cap 5,000; enroll caps 5,000/20,000
  (§2); tracking links live 180 days (`lib/newsletter/send-queue.ts:53-54`).
- **What "slow" means and who sees it:** a recipient in tier 3 of a large issue sees
  the email days after tier 1 — deliberate reputation protection, never a drop; a
  paused issue holds until Matt resumes (breaker) — subscribers simply wait; a crashed
  drain self-heals via requeue + the hourly reconciler, and a real stall pages Matt
  instead of silently sitting (`lib/newsletter/send-queue.ts:493-531`).
- **Time-to-answer on the visitor surfaces:** the footer form answers inline
  (submitting → "You are in." / a plain retry error,
  `components/site/NewsletterSignup.tsx:41-54,70-75`); `/newsletter/unsubscribe` is a
  one-question page — one H1, one sentence, one button — answered at first paint
  (`app/newsletter/unsubscribe/page.tsx:63-79`). Both are noindex/system surfaces
  (`app/newsletter/unsubscribe/page.tsx:21-24`), not P8 litmus spans. CWV for them was
  NOT measured this session and no number is stated (§0).
- **Deliverability clock:** Postmaster data arrives with Gmail's 2–3 day publication
  lag and only at meaningful volume; until then the verdict is `warmup` and the ramp —
  not a blast — is the protection (`app/api/cron/postmaster-sync/route.ts:16-19`;
  `lib/data/deliverability/index.ts:49`).

## 9. Variants

One issue store, one queue, one drain, one ledger; variants differ at audience
resolution or entry — none diverges in delivery, so no split:

- **Audience send vs one-off blast** — same CAS lock, gates, tranching, drain; the
  one-off resolves recipients from a pasted list ∪ CRM tag and mints `source='one-off'`
  rows instead of reading the active list (`lib/newsletter/send-queue.ts:128-188` vs
  `:202-283`).
- **Immediate vs scheduled** — schedule is gate-checked at set time and promoted by
  the send cron through the same enqueue (`app/admin/(protected)/newsletters/actions.ts:68-95`;
  `lib/newsletter/send-queue.ts:323-333`).
- **Segmented vs all** — `audience='segment:<x>'` filters the same active list
  (`lib/newsletter/send-queue.ts:138-141`).
- **Per-broker render** — one body, three sender identities; frozen per recipient,
  identical pipeline (`lib/newsletter/send-queue.ts:453-489`).
- **Single-contact CRM send** — a broker fires the current issue to ONE contact from
  the record card; bypasses the queue (deliberate: the choice of contact IS the
  approval) but reuses the same shell, suppression chokepoint, subscriber-row/token
  guarantee, from-address, and recipient tracking row
  (`app/actions/contact-newsletter.ts:1-45`).
- **Bulk market-report delivery** — a DIFFERENT product that rides THIS queue
  precisely because the queue owns the compliance rails; the individual
  market-report cadence sender does not (`lib/newsletter/market-report-bulk.ts:1-30`).
- **NOT this process:** `deliver-alerts` (listing alerts — own table, engine, cadence,
  unsubscribe surface); the CRM sequence engine; the individual market-report cadence
  (`crm_report_subscriptions`); transactional/CRM one-to-one email.

## 10. Current implementation map

- **Public routes/surfaces today:** the footer signup band on every page mounting
  `SiteFooter` (`components/site/SiteFooter.tsx:33`; 25 files under `app/` import that
  footer — counted this run); `/newsletter/unsubscribe` (branded POST-confirm page,
  noindex, `@no-parity`); `/api/newsletter/unsubscribe` (RFC 8058 POST + GET
  redirect); `/account/notifications` toggle (owned by `save-and-return.portal` as a
  surface; the write routes through this process's DAL,
  `app/actions/newsletter-membership-user.ts:11-14`).
- **Operator surfaces:** `/admin/newsletters/**` (list, compose, review/[id] with
  per-broker preview + gates panel, subscribers, enroll, analytics) — admin plane,
  outside public IA but the seat where §5.3–5.5 happen.
- **Design registers (of the surviving languages):** `NewsletterSignup` mixes shadcn
  `ui/*` controls and a `primitives` Body with a `kb-tool-skin` class and a raw `h3`
  (`components/site/NewsletterSignup.tsx:5-8,63,77`); the unsubscribe page mixes
  `ui/button` + `primitives` H1 + legacy flat `SiteFooter`
  (`app/newsletter/unsubscribe/page.tsx:6-8`) — the register-mixing class the P9
  ratchet kills. The email template is its own render path
  (`lib/email-templates/newsletter-shell.tsx`), outside the five site languages.
- **Actions/API/crons:** public `subscribeNewsletterAction`
  (`app/actions/newsletter.ts:39-46`); admin actions split across
  `app/actions/newsletter.ts` (subscribe/enroll/send/one-off/preview/draft-gen) and
  `app/admin/(protected)/newsletters/actions.ts` (gates/schedule/pause/subscriber
  mgmt); engine `lib/newsletter/send-queue.ts`; gates
  `lib/newsletter/pre-send-gates.ts`; producer `lib/newsletter/produce-draft.ts`;
  ledger hook `lib/newsletter/track-ledger.ts`; Postmaster
  `lib/newsletter/postmaster.ts`; DAL `lib/data/newsletter/*` (indexed at
  `docs/DAL_INDEX.md:2813-2855`); crons `vercel.json:141-151,165-166`; webhook
  `app/api/webhooks/resend/route.ts`.
- **Known defects / drift (all verified this run):**
  1. **page-inventory misfile** — `page-inventory.json` maps `/newsletter/unsubscribe`
     to `deliver-alerts` (verified in the file this run); the newsletter engine shares
     nothing with the alert engine. The sibling `deliver-alerts` PDS §10.4 flags the
     same row from its side. P5 re-maps it to THIS process.
  2. **No abuse guard on the public signup** — `subscribeNewsletterAction` has no
     honeypot, no rate limit, and no ownership verification
     (`app/actions/newsletter.ts:39-46`), while the sibling guest alert capture runs
     honeypot + per-IP fail-closed rate limiting for the same class of anonymous form.
     Anyone can enroll any address (list-bombing surface).
  3. **Public re-subscribe resurrects an opt-out** — the footer path reactivates a
     previously `unsubscribed` row with no confirmation to the address owner
     (`lib/data/newsletter/index.ts:66-70,95-110`). Every OTHER enrollment path
     enforces S-10 or a consent gate; the anonymous one does not. With defect 2, a
     third party can silently undo someone's unsubscribe (the global suppression from
     a TOKEN unsubscribe still blocks the send at the drain chokepoint — verified
     `lib/newsletter/send-queue.ts:405-411` — but an admin-set or webhook-set
     `unsubscribed` status with no suppression row is resurrectable).
  4. **Off-brand palette inside the issue body** — the producer hard-codes GREEN
     `#2e6f4e`, GOLD `#a5842c`, RED `#b4533a`, and Georgia serif
     (`lib/newsletter/produce-draft.ts:48-54`) against the locked two-color brand
     (§3 CLAUDE.md; gold is explicitly retired). No decisions.md grant for an email
     exception was found this run.
  5. **Dual engagement stores** — the legacy `newsletter_recipients` counters
     (`recordNewsletterEvent`) still run beside the ledger; the webhook comment itself
     calls them back-compat (`app/api/webhooks/resend/route.ts:123-125`;
     `lib/data/newsletter/index.ts:414-453`). Cleanup candidate, not a bug.
  6. **`kb-tool-skin` bleed** — the kb register's skin class rides the shared footer
     signup onto every page (`components/site/NewsletterSignup.tsx:77`), an import the
     P9 ratchet will count.
- **Duplicate/parallel paths that should die:** none in delivery — the 2026-07 queue
  rebuild killed the in-request 5,000-send loop (`lib/data/newsletter/queue.ts:10-16`),
  and the two would-be parallel senders (market-report bulk, CRM single send) already
  route through or mirror this engine's chokepoints (§9). Defect 5 is the one
  redundancy.

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** The north star makes market knowledge a first-class pillar;
this process is that pillar's push edition — the only recurring channel where the
machine, not the visitor, does the returning. The job (verify the month's market truth
→ one calm briefing → signed by the recipient's broker → every claim a door back into
the graph → one-step exit) derives the shape, and today's architecture already matches
it: one list, draft-first with a §0 trace, approve-then-drain, reputation-protected
delivery, deduped measurement, global opt-out. What the job does NOT require: a second
send loop per product (the queue is already the shared rail), a visitor-facing
newsletter destination for management (the account portal owns that), or any
per-channel subscriber table.

- **Ideal step count:** ONE visitor action to start (one field), ZERO actions per
  month thereafter, ONE action to stop from any issue. Today matches.
- **Device:** the email is the surface — mobile-first (390 is truth); the unsubscribe
  page stays a one-tap, one-question page; the footer form stays one field.
- **Correctness gaps to close (from §10):** the public signup needs the same
  abuse-guard class its sibling capture form already has, and the anonymous-resurrect
  hole needs a consent answer (confirm-to-reactivate or refuse-and-point-at-email);
  the issue palette needs to either conform to brand or get a recorded decisions.md
  grant. These are process-truth defects, not designs.
- **Data gaps blocking correctness (P4 ✗ statements, not designs — none queried this
  session, §0):**
  ✗ live `newsletter_subscribers` counts by status/source/segment (how big is the
  list, and which §2 channel actually feeds it);
  ✗ per-issue sent→delivered→open→click funnel from `newsletter_recipient_events`
  (the loop's real KPI) and its per-broker split;
  ✗ `deliverability_metrics` row presence/freshness for news.ryan-realty.com (is the
  verdict gate running on data or perpetually in `warmup`);
  ✗ share of active subscribers with `crm_person_id` null (engagement that can never
  attribute);
  ✗ footer-signup conversion by entry route (GA4) — does any public surface other
  than the footer deserve the ask.
- **Destination implication (proposal, not a lock):** **NO destination of its own.**
  The subscription ask lives inside other destinations (today the global footer); the
  issue is an off-site node of the exploration graph whose every link re-enters it;
  `/newsletter/unsubscribe` + the one-click API are SYSTEM sentinels in
  `page-inventory.json`; management lives in the account destination
  (`save-and-return.portal`). P5 re-maps `/newsletter/unsubscribe` to this process
  (§10 defect 1). One P5-open product question, flagged not designed: whether the
  market-knowledge destination should expose a public issue archive (the pillar's
  proof surface and an SEO asset) — that would be a page of the market-knowledge
  process consuming this process's artifacts, not a new destination for this one.

**Dual objective this process stamps on its pages (the email + the system pages):**

- `visitor_objective`: "Keep me current on the Central Oregon market with one verified
  briefing a month, from a person I could reply to — and let me stop it in one step."
- `machine_objective`: "Convert market curiosity into a durable, compliance-clean
  return channel: an identified email, a frozen broker relationship, and measured
  engagement on every issue."
- `exits`: issue market blocks → market-report/city nodes (`explore-market-knowledge`)
  · featured community → its place node (`evaluate-a-place`) · Worth Reading →
  `read-content` · events → local nodes · reply → the broker's monitored inbox
  (`contact-a-broker`, `lib/newsletter/send-queue.ts:488`) · every stamped link carries
  `?agent=` into `capture-and-attribute` (`lib/newsletter/send-queue.ts:474-483`) ·
  footer signup success → the visitor keeps exploring the page they were on
  (`components/site/NewsletterSignup.tsx:70-75`) · unsubscribe page → home
  (`app/newsletter/unsubscribe/page.tsx:53-55`).

## 12. Acceptance checks

Prove the lifecycle end-to-end. Persist; never delete.

1. **Cron wiring:** `grep -n -A1 'newsletter\|postmaster-sync' vercel.json` →
   `newsletter-monthly-draft 15 13 * * *`, `newsletter-reconcile 0 * * * *`,
   `newsletter-send */2 * * * *`, `postmaster-sync 30 12 * * *`; all four route files
   exist under `app/api/cron/`.
2. **Public subscribe:** submit the footer form on any page with a test address →
   inline "You are in." → `select email, status, source, segment, crm_person_id,
   unsubscribe_token from newsletter_subscribers where email='<e>';` → one `active`
   row, `source='site-footer'`, token non-null.
3. **Idempotent upsert:** submit the same email twice →
   `select count(*) from newsletter_subscribers where lower(email)='<e>';` → 1.
4. **S-10 on bulk paths:** set a row `status='unsubscribed'`, then bulk-enroll a list
   containing it → response counts it in `optedOut`, and the row is STILL
   `unsubscribed` (`app/actions/newsletter.ts:204-218`). Repeat via a one-off send →
   `all_opted_out`/excluded (`lib/newsletter/send-queue.ts:219-233`).
5. **Prefetch safety + one-click:**
   `curl -s -o /dev/null -w '%{http_code}' "https://ryan-realty.com/api/newsletter/unsubscribe?token=<t>"`
   (GET) → 302 and the row unchanged; `curl -s -X POST -o /dev/null -w '%{http_code}'
   "https://ryan-realty.com/api/newsletter/unsubscribe?token=<t>"` → 200 and
   `status='unsubscribed'`; an INVALID token also POSTs 200 (no validity leak).
6. **Global opt-out mirror:** after check 5,
   `select channel, reason, source, value from crm_suppressions where value='<e>' or person_id=<pid> order by created_at desc limit 3;`
   → an `email/unsubscribe/newsletter` row (`lib/data/newsletter/index.ts:139-172`).
7. **Draft idempotency:**
   `curl -s -H "Authorization: Bearer $CRON_SECRET" "https://ryan-realty.com/api/cron/newsletter-monthly-draft?force=1"`
   twice → first `action:'drafted'` (or `'exists'`), second `action:'exists'` with the
   same id; the draft row has a non-empty `citations` jsonb array.
8. **Gates block:** on a draft, add an uncited figure ("$999,000") to `body_html` →
   `adminScheduleNewsletterAction` returns `gates_failed` with an R-2 failure naming
   the token; break an internal link → an R-3 failure naming the URL; both shown on
   the review page's gate panel (`app/admin/(protected)/newsletters/actions.ts:45-95`).
9. **CAS lock:** fire `adminSendNewsletterAction` twice concurrently on one draft →
   exactly one `ok:true`; the other `already_sending`
   (`lib/data/newsletter/queue.ts:34-54`).
10. **Enqueue shape:** after approve —
    `select status, count(*) from newsletter_recipients where newsletter_id='<id>' group by 1;`
    → all `queued`, each row carrying `broker` and `tier`;
    `select day_index, tier, cap, sent_count from newsletter_send_schedule where newsletter_id='<id>' order by 1,2;`
    → day-0 rows for a small send; days 0–6 by tier for >1,000 recipients.
11. **Drain + mid-send unsubscribe:** unsubscribe one queued recipient before their
    tranche → after the next tick their row is `skipped`, others `sent`
    (`lib/newsletter/send-queue.ts:398-420`); the send response headers on a delivered
    copy contain `List-Unsubscribe: <…/api/newsletter/unsubscribe?token=…>` +
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; From is
    `<Broker> · Ryan Realty <newsletter@news.ryan-realty.com>`, replyTo the broker.
12. **Per-broker freeze:** a recipient whose CRM person is assigned `rebecca` gets
    links carrying `?agent=rebecca` and Rebecca's close card; an unassigned/unlinked
    recipient defaults to matt (`lib/newsletter/send-queue.ts:56-59,166,474-483`).
13. **Ledger dedupe:** replay one Resend `email.opened` webhook payload twice →
    `select count(*) from newsletter_recipient_events where newsletter_id='<id>' and email='<e>' and event='open';`
    → 1 (`lib/data/newsletter/queue.ts:425-462`); a site pixel open for the same
    recipient also collapses into that row's dedupe space.
14. **Breaker:** in staging, seed ≥50 sent with >2% bounced for a sending issue → next
    tick reports `paused:true`, `newsletters.send_paused=true`, and a
    `newsletter-breaker:<id>` alert queued (`lib/newsletter/send-queue.ts:360-376`);
    resume via `adminSetNewsletterPauseAction(id,false)` drains again.
15. **Reconcile honesty:** an issue with only future-tranche queued rows reports
    `action:'draining'`, never finalizes early; force-expire a tranche day with
    nothing sent → `action:'stalled'` + the stall alert; when all rows are terminal →
    `finalized:'sent'` and `status='sent'` (`lib/newsletter/send-queue.ts:501-531`).
16. **Postmaster feed:**
    `curl -s -H "Authorization: Bearer $CRON_SECRET" "https://ryan-realty.com/api/cron/postmaster-sync?days=7"`
    → 200 with per-domain reports (`ok|empty|failed`, never a throw);
    `select domain, metric_date, domain_reputation, spam_ratio from deliverability_metrics where domain='news.ryan-realty.com' order by metric_date desc limit 3;`
    → rows present, or the P4 gap (§11) stays open and the verdict gate is known to be
    running in `warmup`.
