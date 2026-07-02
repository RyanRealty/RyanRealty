# CRM PRODUCTION SIGN-OFF — 2026-07-02

**VERDICT: PRODUCTION READY.** Independent final verification pass against the
PRODUCTION-READY BAR (CRM_BUILD_MISSION §"PRODUCTION-READY BAR"), run on the LIVE
production site (ryan-realty.com) after the findings-closure slice. Every check
below was re-run in this session — nothing inherited from prior claims without
fresh evidence. **The awaiting-Matt list is EMPTY** — the three open items were
resolved by Matt the same day (Geist headers decision · API credits purchased ·
lead backend already native).

---

## 1. What was verified (evidence per claim)

### HEAD health (all fresh runs, this session, HEAD = `1fe7ae49`)
| Check | Result | Evidence |
|---|---|---|
| Registry | **18 done, all proven** · 0 wip · 1 todo (`_meta` only) | `node scripts/check-crm-screen-parity.mjs` ✓ |
| Gates | **`npm run ci:gates` exit 0** — 103 checked/103 wired/0 orphaned; 109 gate files, 0 run nowhere | full-chain run |
| Tests | **vitest 2431/2431** (214 files) | `npx vitest run` |
| Types | **tsc --noEmit clean** (exit 0) | full run |

### Prod deploy current
Latest Vercel production deployment `dpl_9kL16s4pjMF8N2Lrqpd7mH9uHH1b` is **READY**
on commit `1fe7ae49` = origin/main HEAD; the findings-closure commit `1b8a236d`
deployed immediately before it (both READY, target=production, verified via the
Vercel API). Every audit-fix commit in the inventory below is deployed.

### Live prod smoke — 18/18 surfaces, both form factors
Fresh authed session (service-role `generateLink` → `verifyOtp`, independent of
Matt's browser), Playwright against `https://ryan-realty.com`, READ-ONLY (navigation
+ client-side tab taps only, zero mutations, zero sends). Evidence:
`out/crm-signoff/` (gitignored) — `results.json` + 18 screenshots + the smoke script.

- **Desktop 1440×900 — all 10 screens loaded with real data, ZERO console errors,
  2.9–5.7s:** people list · person detail (13168) · inbox · deals · automations ·
  templates · company settings · calendar · tasks · reporting/agent-activity.
- **Mobile 390×844 — all 8 surfaces loaded:** People root (navy header, real list
  counts, All Lists/Stages) · lead detail — **all 6 tabs swapped in place
  (info/comms/activity/homes/notes/calendar), bottom tab bar present** · inbox ·
  deals · calendar · tasks · dashboard · settings.
- **The only console entries anywhere:** transient 429s on `/api/web-vitals`,
  `/api/auth/me`, `/api/identity/me` — traced to OUR OWN Upstash per-IP rate
  limiter in `middleware.ts` tripped by the harness loading 8 pages in ~30s from
  one IP. Intentional protection, not reproducible on an isolated page load
  (re-probe: zero 4xx), pages rendered fully. Not a defect.
- **AI drafting verified live post-credit-top-up:** the mobile compose AI pill
  ("Introduction") on contact 13168 rendered a real 226-char draft into the
  composer (screenshot `out/crm-signoff/ai-pill-result.png`); nothing sent. The
  production `ANTHROPIC_API_KEY` probe returned a real `claude-opus-4-8`
  completion. Smart-followups cron unblocked.

### Ledgers — zero open findings
- Desktop `CRM_AUDIT_2026-07-02.md`: 9 findings — 8 fixed (commits named per
  entry), P2-9 **resolved by Matt's decision** (Geist headers, no change needed).
- Mobile `CRM_AUDIT_MOBILE_2026-07-02.md`: 18 findings — all fixed
  ("Nothing in this ledger remains open"); external AI-key blocker resolved.
- Fixing commits for the in-slice mobile fixes: audit slice `e60563dd`
  (P0-1, P1-1..P1-5, P2-1, P2-2), closure slice `1b8a236d` (P1-6, P2-3..P2-11
  incl. applied migration `20260702120000_remove_temp_deal_stages`).

### Compliance (code-read at HEAD, no sends)
- **Suppression fail-closed:** `lib/crm/suppressions.ts` `isSuppressed` returns
  `suppressed: true` when the compliance table is unreadable; tag mapping
  (`compliance:hard-stop`/do-not-text/do-not-call incl. TCPA text-as-call) checked
  on every call. Present on: composer email (`app/actions/crm.ts:547`), composer +
  bulk SMS (`crm.ts:911,948`), sequence engine (`crm-sequence-engine/route.ts:141,
  247,354`), market-report-send, cma-deliver/request/drafts, email-cohort bulk,
  expired-outreach, newsletter + saved-search alerts. `ci:email-send-gated` keeps
  the gate co-located with `sendEmail` (green in this session's gates run).
- **Quiet hours (TCPA):** `inSmsQuietHours` gates the composer send
  (`crm.ts:879`, explicit override only) and the sequence engine
  (`route.ts:326`, queues to `nextSendWindow`).
- **Block-list:** `isNumberBlocked` enforced at both Twilio inbound webhooks
  (`app/api/twilio/inbound-sms/route.ts:58`, `voice/route.ts:78`).
- **Broker scope at the data layer:** `scopeBroker(access)` clamps
  `buildCrmPeopleQuery`, `getInboxQueue`, `getTaskQueue`, `getCrmSavedViews`,
  `getEmailReporting`, `getWorkflowAnalytics`, deals board — superuser=null,
  broker=own slug; a restricted broker cannot widen past their book.
- **Matt's sender:** SQL read of `brokers` — `matthew-ryan.twilio_number` =
  **+15417033095** ✓ (Paul +15415023436, Rebecca +15412503380), matching the
  2026-07-02 telephony fix + applied migration `20260702090000`.

### Data invariants (UI vs direct SQL, count-exact discipline)
| UI number (prod screenshot) | Direct SQL | Match |
|---|---|---|
| People list "Showing 18,209 people" | `count(*) FROM crm_people` = 18,209 | ✓ exact |
| Deals Buyers board: Closed **7 / $5,250,000**, Lost **2 / $1,925,000** | buyers pipeline closed n=7 sum=5,250,000; lost n=2 sum=1,925,000 | ✓ exact |
| Tasks "Overdue **167**" (scope Me) | 398 raw matt-overdue, but per the getTaskQueue DAL definition (open · due < start-of-today · ≥31-day stale floor per Matt 2026-06-15 · broker=matt) = **167** | ✓ exact per documented definition |
| Test artifacts | ZZTEST people = 0 · temp stages (incl. ids 47/48) = 0 · ZZ-TEST tc_deals = 0 | ✓ clean |

### Lead backend (was on the awaiting-Matt list — ALREADY DONE)
`lib/crm/lead-router.ts` defaults to `'native'` (`process.env.CRM_LEAD_BACKEND ??
'native'`), and `vercel env ls production` shows **no CRM_LEAD_BACKEND override** —
production runs native (in-house CRM only, FUB writes neutralized) since the
2026-06-24 cutover. The handoff/memory item calling this "Matt owns the flip" was
stale; recorded here as done.

---

## 2. Fixed-findings inventory (both ledgers, one line each)

### Desktop (`CRM_AUDIT_2026-07-02.md`)
- **P0-1** User-created smart lists never filtered (showed all 18K — `ast`-only write) — fixed `b02e7c90`
- **P0-2** Create Note silently dead for every imported contact (gated on decommissioned FUB API) — fixed `b02e7c90`
- **P0-3** Phone/email jsonb mirrors dropped `isPrimary` → wrong send target possible — fixed `8548c0f3` + `b02e7c90`
- **P1-4** Email Templates list had no delete affordance — fixed `90ced1de`
- **P1-5** Contact Attempts report missing Marketing + Deals sub-tabs — fixed `90ced1de`
- **P1-6** Agent Goals "Set goal" link 404'd — honest "Not set" placeholder — fixed `90ced1de`
- **P2-7** Reporting hub H1 20px vs 24px idiom — fixed `1b8a236d`
- **P2-8** 13× duplicated REPORTING_TABS → ONE shared `ReportingTabStrip` (+11 inert "How Reporting works" badges made real) — fixed `1b8a236d`
- **P2-9** CRM headers Geist vs Amboqia — **resolved by Matt's decision 2026-07-02: Geist stays**

### Mobile (`CRM_AUDIT_MOBILE_2026-07-02.md`)
- **P0-1** SMS templates sent literal `%tokens%` (FUB-era names in 17/37 templates; happened for real Jun 30) — merge aliases + `renderSmsTemplateAction` pre-render + unresolved-token warning — fixed `e60563dd`
- **P1-1** Deals root missing the §23 navy mobile header ("2 CRMs") — fixed `e60563dd`
- **P1-2** AI pills dumped raw Anthropic billing errors — graceful degradation — fixed `e60563dd` (and the external credit blocker resolved 2026-07-02, verified live)
- **P1-3** FAB Send text/email dead-ended on the read-only mobile Comms tab — in-app composer deep links — fixed `e60563dd`
- **P1-4** FAB Add note landed on the wrong tab — `#notes` — fixed `e60563dd`
- **P1-5** Long notes unreadable (5-line clamp, no reveal) — tap-to-expand — fixed `e60563dd`
- **P1-6** Settings email signature write-only (no send path read it) — wired through `getBrokers`/`buildSignature` + ORS 696.820 pamphlet line always, proven with a real self-send — fixed `1b8a236d`
- **P2-1** Inbox previews showed raw HTML entities — fixed `e60563dd`
- **P2-2** Activity rows rendered literal `<unspecified>` — fixed `e60563dd`
- **P2-3** Tab strip didn't auto-scroll to the active tab — fixed `1b8a236d`
- **P2-4** Contact Calendar tab was task-only — real Appointment branch + `getAppointmentsForPerson` — fixed `1b8a236d`
- **P2-5** Phone/email label casing — Title Case — fixed `1b8a236d`
- **P2-6** Merge-chip panel pushed the message field below the fold — collapsed disclosure at <md — fixed `1b8a236d`
- **P2-7** lead_created bare-name rows — "<Name> was created" — fixed `1b8a236d`
- **P2-8** Settings avatar was initials — real broker headshot — fixed `1b8a236d`
- **P2-9** Test-data hygiene — temp stages 47/48 (migration applied) + ZZTEST person 52274 + tc_deals ZZ-TEST fixture purged, all zero-reference-verified — fixed `1b8a236d`
- **P2-10** Tasks screen header — closed as not-a-defect (spec-conformant)
- **P2-11** Radix `aria-describedby` console noise (29 files) — fixed `1b8a236d`

Also in the production-ready arc (outside the two ledgers): **telephony fix**
(`13a82e84` + migration `20260702090000`) — Matt's live sender is the ported
primary +15417033095; Paul's unowned-number latent bug fixed; sequence engine
sends from the assigned broker's own line. Live-verified delivered post-deploy.

---

## 3. Explicitly-open items awaiting Matt

**None.** All three prior items were resolved 2026-07-02:
1. ~~Amboqia-vs-Geist CRM headers~~ → Matt decided: **Geist**. No change needed.
2. ~~ANTHROPIC_API_KEY credit~~ → topped up; **verified live** (real draft on prod).
3. ~~CRM_LEAD_BACKEND flip~~ → **already native in prod** (default, no env override).

---

## 4. Known deferrals (collected from the mission PROGRESS blocks)

Explicitly-logged deferrals across all slices — documented scope decisions, not
defects. Grouped; the slice entries in `CRM_BUILD_MISSION.md` carry full context.

**Mission-level "do NOT build unless told":** Deals reporting beyond pipeline · Billing · public API · iOS app (responsive web is the product).

**People / person detail:** mobile add-relationship + custom-field editing (desktop covers both) · mobile lender-transfer (no such feature) · per-automation/per-metric filtered People views (`?metric` ignored by the list) · §17 export column-checkbox dialog (the ?cols picker already picks columns).

**Deals:** FUB-iOS full mobile Deals screen (stacked board shipped instead) · physical drag-reorder of pipelines/stage columns (explicit up/down controls shipped; dnd-kit not installed) · multi-user deal TEAM junction (§20.5; single assigned_broker fits the 3-broker shop) · deal-scoped custom fields (§14).

**Automations:** §12.3 Library page (no library content exists) · per-step Recipient/Delivery persistence + engine-level delivery windows (§12.9.5) · §12.5 legacy Action Plans page (no legacy tables) · step drag-reorder on canvas (§12.5.7; remove/re-add covers authoring).

**Templates:** `crm_template_folders` M2M (single-folder `category` covers usage) · per-template Replies/Opt-Outs/Score metrics (no honest data source; renders "–"/"Pending") · destructive bulk ops (Move-to-folder shipped) · created_at backfill for the 113 FUB-seeded rows (no source data).

**Calendar / tasks:** §2.13 Google/MS365 two-way calendar sync (schema + lib preserved; OAuth engine is its own delivery) · §2.11 SMS reminder Power-Up · §1.13 task-due notification channels (bell/push/SMS/email; C.13 AC-12 with it) · §1.17 behavioral-trigger dedup (automation-engine work) · §1.18 Hot Sheet email · task assignee select on create (always assigns caller; reassign on desktop) · create-task reminder toggle (no notification infra) · multi-team-member appointment invitees (§2.6; guest_person_ids array is the backend) · month-grid slide animation.

**Inbox / comms:** 26-H group-thread VIEW (group send is live; needs an is_group thread model) · S9 manual Log-Call form (bridge auto-logs) · S10 first-touch SMS reminder banner + per-message delivery-status sub-labels (sms_status not stored per row) · CC/BCC on mobile email (send path kept sacred) · real-time badge/websocket updates (poll model).

**Reporting:** §11.5 Initially/Currently Assigned = newLeads approximation (no assignment-history table) · personal-vs-automated split = `source!='sequence'` approximation · §11.16 leaderboards (spec defers) · §11.17 weekly insights email (Monday digest cron covers recipients) · Marketing First-Touch attribution disabled (per-lead first-source stamping deferred with UTM-on-lead §11.15 AC-1) · Marketing export (0 attributable leads today) · deals-by-source reporting (§21 defers) · Agent Goals commission-goal persistence (no crm_goals table; honest "Not set" per desktop P1-6).

**Settings / company:** per-user call-recording overrides (no per-broker column) · after-hours TEXT queuing on the settings side (§1.5; the send-path quiet-hours gate IS live) · fallback-number dialing on no-forward (voicemail is the deliberate default) · FUB's 18-tab admin sub-nav (in-house settings hub IA won).

**Email tracking (decision, logged):** internal broker-recipient emails, TC signing emails, and template self-test intentionally NOT tracked; `cma/[slug]/email` multi-recipient tracking deferred (needs a per-recipient send loop).

**Mobile platform-native class:** pull-to-refresh (browser-native conflict; M3/M5/M8 + dashboard feed) · swipe gestures are touch-only (mouse parity via controls) · dashboard feed swipe-left quick-actions (spec marks [INFERRED]).

---

## 5. Verification session provenance

Run 2026-07-02 by the final production-readiness verifier. Method: docs-first
(mission bar → both ledgers → handoff), then fresh HEAD health (parity/gates/
vitest/tsc), Vercel API deploy check, read-only live-prod smoke through a minted
independent session at both form factors, compliance code-read, SQL invariant
audit (`-- audit:` tagged, per the DAL-bypass gate), and the coordinator-relayed
same-day resolutions (Geist decision · API credit verified live · lead backend
confirmed native). Zero mutations were made to production data in this pass; the
one AI-pill test rendered a draft into a composer input and closed the sheet.
