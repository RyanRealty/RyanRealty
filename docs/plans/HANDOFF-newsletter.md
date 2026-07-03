# New-session prompt — NEWSLETTER

Paste this into a fresh Claude Code session to continue the newsletter build exactly where we left off.

---

You are continuing the **Ryan Realty monthly newsletter** build. Do not restart from scratch — the
spec and design are done and approved. Read these first, in order, before doing anything:

1. `docs/NEWSLETTER_SYSTEM_SPEC.md` — the complete, approved spec (v1.1). Covers the full lifecycle,
   the **per-broker "full identity swap"** branding, admin UX (§9), **§6.5 scale/deliverability** (the
   engagement-tiered tranche model), **§6.6/§6.7 mail infrastructure + Postmaster**, **§7 the LOCKED
   design + §8 content sources**, the 30-case edge matrix (§11), the **20 mechanical gates G-NL-1..20 +
   5 runtime gates** (§12), and the **phased build plan (§13)**.
2. `docs/NEWSLETTER_CONVERSION_RESEARCH.md` — the cited evidence base.
3. Memory: `project_newsletter_mail_infra.md` — mail-infra + access notes.
4. The **canonical design** (approved by Matt after many iterations):
   `design_system/ryan-realty/ui_kits/newsletter/email.html` (email-safe, table-based — this is what
   `newsletter-shell.ts` must render to) and `.../index.html` (the interactive design-intent twin).

## State (what is DONE)
- **Spec + design approved.** The design looks like ryan-realty.com (cream/navy editorial: hero,
  eyebrow + rule + faint watermark section headers, big serif, live data woven into sentences).
  Section order (LOCKED): **The Market** (per-city buyer/seller meter → `/cities/[slug]/market-report`)
  → **For Sellers** → **For Buyers** → **Worth Reading** (housing `/blog/*` links) → **Community**
  (`/communities/[slug]`) → **This Month in Central Oregon** (events) → **Broker close** (→ `/contact`)
  → footer. Voice = brand voice (`marketing_brain_skills/brand-voice/VOICE.md`), every number in
  context, every section informs. Georgia stands in for Amboqia in email; production may bake
  hero/section headlines as Amboqia **images**.
- **Mail infrastructure is LIVE:** `news.ryan-realty.com` created + verified + sending; root DMARC
  reporting on; all 3 domains registered in Google Postmaster Tools; Postmaster API enabled + the
  `viewer@ryanrealty` service account granted `postmaster.readonly`. **Newsletter From =
  `newsletter@news.ryan-realty.com`**; transactional stays on `mail.ryan-realty.com`. Resend is on Pro.
- **Test-send tool:** `scripts/_send-newsletter-test.mjs` sends `email.html` to matt@ from the real
  per-broker identity (use a distinct subject each run so Gmail doesn't thread).
- **Locked decisions:** full per-broker identity swap · brain drafts → Matt approves in admin →
  send · **Matt manually enrolls** subscribers · unsubscribe-only (no preference center) · monthly,
  **drafted on the 1st, sent from the ~3rd, delivered in engagement-tiered tranches over ~5–7 days**.

## Content dependency (important)
The newsletter is a **curator** over the content library, it does not author destination pages. It
links only to already-live pages (a pre-send gate verifies 200 + schema). The **one content gap is
events** (`/central-oregon/events/*` doesn't exist yet) — that is owned by the separate **content-engine**
initiative (`docs/plans/HANDOFF-content-engine.md`). Housing/community/school links point at pages that
already exist (`/blog`, `/communities`, `/schools`, `/parks`, `/guides`).

## Build progress log (newest first)

**2026-07-03 (later) — CORRECTIONS from Matt: event pages EXIST + manual auto-draft producer being built.**
- **Event pages exist + resolve** (200): `app/central-oregon/events/page.tsx` + `[slug]/page.tsx`, data
  `data/co-events.ts`, DAL `lib/data/events/getEvents.ts` (`getEventsForMonth`). The earlier "404" was a
  stale WAF/curl read. **R-3 is UNBLOCKED** — the "This Month" links resolve.
- **Manual auto-draft producer** (curation): a "Generate draft from live data" admin button →
  `adminGenerateNewsletterDraftAction` pulls LIVE data (getMarketReportData per city → §0-verdicted
  buyer/seller meters, getEventsForMonth, recent blog posts, a community + live count), assembles the
  section body_html + a `citations` entry per stat, and writes a DRAFT to `newsletters` for Matt to
  review/approve. §0 enforced: every number from the DAL, never invented. (Supersedes the earlier
  "producer-freeze blocks curation" note — a MANUAL-run draft generator is not a new autonomous producer.)

**2026-07-03 — Phase 6 (scheduling) shipped; curation-automation noted as constrained.**
- **scheduled_at honored** (§4.2 UC-R5): the admin "Schedule" button sets status='scheduled' +
  scheduled_at; `enqueueDueScheduled` (called by the send cron each tick, before the drain) promotes
  every due one via enqueueNewsletter (CAS-locks scheduled→sending). DAL: `getDueScheduledNewsletterIds`.
  Verified live: the due-query finds a past-scheduled issue, not a future one.
- **Curation automation (monthly auto-draft producer + R-2 citations + R-3 events freshness) NOT built —
  constrained, by design:** (1) the marketing-brain producer layer is FROZEN (G45, maintenance-only), so
  new autonomous content producers aren't added — the live agent/Matt authors each issue in the compose
  form (Phase 7) with live-traced data, which is the sanctioned path. (2) R-3 (every linked event page
  returns 200 + Event schema) is BLOCKED on the separate content-engine — `/central-oregon/events/*` 404s
  today. So a real SEND is gated on those event pages existing, regardless of newsletter code. The
  scheduling + send machinery is complete; the monthly-curate cron is a thin follow-up once the event
  pipeline lands (docs/plans/HANDOFF-content-engine.md).

**2026-07-03 — Phase 8 (per-broker analytics console) shipped.**
- `lib/data/newsletter/brokerAnalytics.ts`: `getBrokerNewsletterAnalytics(slug)` (recipients/delivered/
  opened/clicked/CTR/CTOR, scoped `.eq('broker',slug)` on recipients + the deduped ledger) +
  `getBrokerWarmList(slug)` (that broker's clickers, for follow-up). `/admin/newsletters/analytics` page:
  a restricted broker sees ONLY their own slug (resolved from the session via getCrmAccess/scopeBroker,
  never a client param); a superuser gets a broker filter. KPI strip + warm-list table linking to the CRM card.
- **G-NL-12 scope invariant gated**: `ci:newsletter-scope` asserts every analytics query carries the
  broker filter in-chain AND a restricted broker's slug comes from the session, not the client —
  red-demo'd (removing a filter fails; hardcoding isSuperuser fails). 4 scope unit tests. tsc clean.

**2026-07-03 — Phase 5b (scale-safety, partial) shipped.**
- Pre-send REPUTATION GATE (G-NL-20): `deliverability_metrics` table (Postmaster snapshots) + DAL
  (`getLatestDeliverability`, `deliverabilityVerdict`) + integrated into `enqueueNewsletter` — a LARGE
  send (>1000) is refused on Gmail LOW/BAD reputation or spam>0.30%, with no-data→warmup fallback (safe
  without the ingestion cron — defaults to the ramp, never a blind blast). 5 verdict unit tests. The
  circuit-breaker (bounce>2%/complaint>0.1% auto-pause) + warm-up ramp + engagement tiering were already
  built in Phase 3. Hygiene: dedup via unique(lower(email)) + per-row suppression at drain already hold.
- **REMAINING for the first LARGE send (external/follow-up):** the Postmaster ingestion cron
  (`/api/cron/postmaster-sync` → Google DWD → deliverability_metrics) that POPULATES the gate's data —
  deferred because it needs Google service-account wiring and only produces data after real volume
  flows; until then no-data→warmup is the safe default. Email-verification provider for hygiene (MX
  check) also a follow-up. Admin deliverability tile (§6.7) not built.

**2026-07-03 — Phase 7 (admin UX) shipped.**
- Compose form: added a plain-text body field (posts body_text; auto-gen at send if blank); a
  **Preview-as-broker** tab — an iframe rendering the draft through the REAL shell
  (adminPreviewNewsletterAction → wrapNewsletterHtml + senderBroker) with a Matt/Rebecca/Paul Select
  that visibly swaps the close block; a **"Send test to me"** button (adminTestSendNewsletterAction —
  one email to the admin's own inbox, [TEST] subject, news. domain, never touches the list/queue).
- Send confirm is now a design-system **Dialog** (not window.confirm) showing audience size + broker
  split via adminNewsletterAudiencePreviewAction (mirrors enqueue's resolution, no enqueue).
- Detail stats **lead with Click rate + CTOR**, then Open rate (MPP-inflated caption), then
  delivered/bounced — all from getNewsletterStatsFromLedger; + a per-broker breakdown Table
  (getNewsletterBrokerBreakdown). All shadcn `@/components/ui/*`, tabular-nums.
- Gate G-NL-9 tightened: the no-sync-loop check is scoped to adminSendNewsletterAction's body so the
  legitimate single test-send doesn't trip it. tsc clean; NewsletterComposeForm token-clean.
- NOTE: interactive browser click-through of the auth-gated admin flow not yet run (the render it
  displays is screenshot-verified; actions are tsc-clean + mirror tested code). Do a live walkthrough
  with Matt's admin session when convenient.

**2026-07-03 — Phase 5 (event integrity) shipped.**
- Engagement LEDGER (`newsletter_recipient_events`) is now written by the Resend webhook via
  `recordLedgerEvent` with a RECIPIENT-scoped dedupe_key (`nl:<id>:sub:<subscriber|email>:<event>:<url>`,
  A3) — verified against the live DB that a webhook replay collapses to one row and a distinct-URL click
  stays separate. `getNewsletterStatsFromLedger` derives deduped open/click counts from the ledger
  (not the inflatable recipient counters). `email.unsubscribed` added to EVENT_MAP + handled (flip
  subscriber → unsubscribed + timeline, T-8); `setSubscriberStatusByEmail` extended (+stamps
  bounced_at/complained_at). Broker stamped on ledger + email_events + timeline (H1 complete).
- Tests: classify `email.unsubscribed` (no false-suppress); live-DB ledger dedup. Gate:
  `ci:newsletter-events` (G-NL-10/13); `ci:newsletter-broker` G-NL-5b updated for the
  getRecipientByMessageId refactor. MPP: opens are caveated at the dashboard (clicks lead, R-5) —
  a Phase 7/8 presentation rule, no schema column.

**2026-07-03 — Phase 4 (per-broker identity swap + shell rebuild) shipped.**
- `lib/email-templates/newsletter-shell.ts` rebuilt to the approved 640px editorial
  `email.html` frame: navy masthead (wordmark + issue line) → Old Mill hero → producer-authored
  section body → **per-broker close** (headshot + first-person copy + dotted phone + "TALK TO {first}",
  owner vs broker voice) → CAN-SPAM footer. **Visually verified** by rendering the full mockup sections
  through the frame with Rebecca as sender and screenshotting (`out/newsletter-full-preview.png`) — the
  close correctly shows Rebecca's headshot/name/broker-voice/phone, not Matt's; all images resolve.
- Render wires `senderBroker` (name/firstName/phone dotted/title/absolute-HTTPS headshot/isOwner) from
  `getCrmBrokers`. H1 completed: the Resend webhook resolves broker via
  `newsletter_recipients(resend_message_id)` and stamps it on `email_events.broker` + `crm_timeline.broker`,
  so opens/clicks carry broker on BOTH engagement sources (pixel token + webhook).
- Tests: 10 send-queue unit (added shell-frame parity: masthead/hero/640px/per-broker close/owner-voice).
- Gates: G-NL-7 format extended with frame-parity checks (wordmark/hero/broker-close); new
  `ci:newsletter-broker` (G-NL-5 recipient-broker on both paths + G-NL-8 absolute-HTTPS headshots),
  red→green demonstrated.

**2026-07-03 — Phase 3 (send reliability queue) shipped.**
- Replaced the synchronous ≤5,000-send in-request loop with a QUEUE (spec §6):
  `lib/data/newsletter/queue.ts` (data ops) + `lib/newsletter/send-queue.ts` (orchestration).
  Approve = `enqueueNewsletter()`: wins a CAS lock (`claimNewsletterForSending`, S-1), freezes each
  recipient's broker + engagement tier (2 batch reads), writes queued rows + the tranche schedule,
  returns immediately. The drain cron (`/api/cron/newsletter-send`, every 2 min) claims batches
  atomically (queued→sending, concurrency-safe), re-checks suppression + active per row (S-8), renders
  per-broker (From-name/reply swap + broker-frozen link attribution + broker-stamped token), sends, and
  finalizes. Reconcile cron (`/api/cron/newsletter-reconcile`, hourly) finalizes only when 0 queued/
  in-flight remain and flags true stalls (S-15). Circuit-breaker auto-pauses on bounce>2%/complaint>0.1%
  (`send_paused` flag). NEWSLETTER_FROM flipped `mail.`→`news.` (A4). recordRecipientSend onConflict fixed
  via a plain `(newsletter_id,email)` unique (A5). One-click contact send brought to parity: voice gate
  (G-NL-4), no-reactivation of opt-outs preserving segment (S-10), tracking-on-failure (S-11), news. domain.
- Migrations (applied + verified): `20260703110000` plain email unique (A5), `110100` recipients status
  +sending (atomic claim), `110200` newsletters.send_paused (breaker).
- **Real tests:** 8 unit tests (render per-broker From/reply swap, broker-in-token verified via
  round-trip, ?agent attribution, tiering, warm-up caps, text fallback) + a live-DB state-machine test
  (CAS lock rejects 2nd approver, atomic claim, finalize, cascade — self-cleaning). tsc 0 errors.
- Gates: compliance gate repointed to the queue render path; new G-NL-4/6/9/15 (voice on every send
  path, drain suppression+active recheck + one-click no-reactivate, CAS + no-sync-loop + reconciler,
  cron registration).

**2026-07-03 — Phase 2 (compliance + format hardening) shipped.**
- Tracking token hardened (`lib/email-tracking.ts`): prod hard-fail `assertTrackingSecret()` (refuses
  the insecure dev-fallback secret in production), optional TTL (`exp`) + nonce (`n` via `randomBytes`)
  on sign + enforced on verify (backward compatible — no-TTL tokens still verify), and a `broker` field
  (Phase 4 prep). 12 unit tests (round-trip, tamper, TTL expiry, broker) — a dropped `SITE_URL` const
  was caught by the test, fixed.
- `crm_timeline` open/click inserts now de-duped (T-4): upsert with a recipient-scoped `dedupe_key` +
  `onConflict` + `ignoreDuplicates` so a pixel firing repeatedly collapses to one timeline row.
- Plain-text multipart guaranteed (G-NL-3): the send derives text via `htmlToPlainText(body_html)` when
  the admin left it blank — no more near-empty text part.
- Gates built + wired + demonstrated red→green: `ci:newsletter-compliance` (G-NL-1/2/3),
  `ci:newsletter-format` (G-NL-7 static), `ci:email-tracking` (G-NL-11 + G-NL-10). Caught + fixed a
  comment-blindness defect where a gate passed on a token that only appeared in a doc comment — added
  `scripts/lib/strip-js-comments.mjs` so gates check CODE, not comments. Verified the tracking gate goes
  red on a realistic dedup-removal.

**2026-07-03 — Phase 0 + Phase 1 shipped.**
- **Phase 0 (verify + adversarial audit) DONE.** Verified spec vs live DB/code/DNS/routes. Ran an
  adversarial "assume everything is broken" pass → spec bumped to **v1.2** with 7 corrections (A1–A7).
  Key finds: (A1) `newsletter_recipients_status_check` excluded `queued` → queue would be DOA;
  (A2) `unique(lower(email))` already existed (spec was stale); (A3) spec's `dedupe_key` formula was
  broken (our pixel has no message_id) → recipient-scoped; (A4) live `NEWSLETTER_FROM` points at
  `mail.` not `news.`; (A5) `recordRecipientSend` onConflict targets raw email not the functional
  index; (A6) broker close is Matt-only, must template per broker; (A7) mockup is 640px + all numbers
  are samples. Brokers use SHORT slug (`matt`), Matt=superuser + Paul/Rebecca=broker (M4 ✓), all
  headshots resolve HTTPS, `/central-oregon/events/*` 404s (content-engine dep = the real send blocker).
- **Phase 1 (schema) DONE + APPLIED + COMMITTED.** 5 migrations applied to hosted Supabase
  (`20260703100000..100400`): `newsletter_recipient_events` ledger (+broker, recipient-scoped
  dedupe_key), `newsletter_send_schedule`, `newsletters` (+send_started/finished_at, lock_token,
  citations, status CHECK widened), `newsletter_recipients` (+broker, tier, status CHECK widened for
  queued/skipped), subscribers (+bounced_at/complained_at). Live schema verified. First gate built:
  **`scripts/check-newsletter-schema.mjs` (G-NL-14)** — proven red on the A1 bug, green on the fix,
  wired into `ci:gates`, catalogued in MECHANICAL_GATES.md. Snapshot refreshed.

## What's next
Execute the remaining **§13 phase plan** (each: build → wire its gates → real-browser/e2e test →
commit): **Phase 2** compliance+format hardening (postal, multipart, shell static lint, tracking-token
TTL + prod hard-fail, dedup timeline) → **Phase 3** send queue (CAS lock, tier drain cron, reconciler,
circuit-breaker, one-click parity, `NEWSLETTER_FROM` `mail.`→`news.` flip gated on a test-send, fix the
onConflict target) → **Phase 4** per-broker identity swap + shell rebuilt to the 640px `email.html`
(mockup-parity, per-broker close) → **Phase 5** event integrity (ledger-derived counts, recipient-scoped
dedupe, `email.unsubscribed`, MPP) → **Phase 5b** scale readiness (hygiene, warm-up ramp, circuit-breaker,
Postmaster gate) → **Phase 6** curation producer + scheduling → **Phase 7** admin UX → **Phase 8**
per-broker analytics. External send-blockers (do NOT gate the build): event pages 404; `news.` verify
test-send. No bulk send to the real list without Matt's per-issue approval + Phase 5b gates green.

## Constraints (non-negotiable)
Draft-first (nothing sends without Matt's per-issue approval) · brand voice (VOICE.md, gate) · §0 data
accuracy (every figure live + traced) · design-system components only · fair housing · direct to `main`,
push after approval. **No production send to the real list until the §6.5 warm-up/hygiene/circuit-breaker
gates (Phase 5b) are green.**
