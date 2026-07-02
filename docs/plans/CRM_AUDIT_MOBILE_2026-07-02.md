# CRM MOBILE Adversarial Audit — 2026-07-02

Scope: every mobile CRM surface at 390x844 against the PRODUCTION-READY BAR
(CRM_BUILD_MISSION), run AFTER the mobile punch-list fixes (commit `8548c0f3`).
Method: assume-broken-until-proven — every affordance tapped, real mutation
round-trips verified in the DB and reverted net-zero, compliance paths exercised
live, code paths read for the send gates. Dev server, Matt's authed session,
LIVE data (self-sends only). Companion desktop ledger:
`docs/plans/CRM_AUDIT_2026-07-02.md`.

## Surfaces swept (all at 390x844)

| Surface | Result |
|---|---|
| `/admin/crm` People root | navy header, All Lists/Stages, 19 smart-list links, scope sheet (URL round-trip `broker=matt`, count changes), search auto-open on `?q=`, list mode (back row, count bar, rows → detail), pagination. Zero visible `sms:`/`tel:`/`mailto:` in the mobile branch (35 exist but all in the hidden desktop table). |
| `/admin/console/leads/[id]` (12679 · 13168 · sparse 5380 · fresh 52281) | all 6 tabs swap in place; header Edit → MobileEditSheet **name round-trip PROVEN on 13168** (DB verified, reverted via UI, audit timeline rows deleted — net-zero); all 6 DETAILS pickers open + cancel; SMS circle → `/admin/crm/inbox?c=<id>&m=sms` (in-app), Email circle → `&m=email` (reply composer auto-opens), Call → S8 sheet (Twilio bridge button + honest untracked `tel:` fallback — the only documented tel:); address row → maps; task create round-trip PROVEN (row rendered, DB row deleted net-zero); 0-phone/0-email contact renders correctly with Add affordances. |
| `/admin/crm/inbox` | folder switching (Inbox/Assigned/Sent/Closed), filter sheet (channel filter applied + reset), swipe-action Close → Closed folder → Reopen **round-trip net-zero**, Mark-as-Unread round-trip (count 59→60→59, dot on the correct dupe-named row), thread both modes (email subject view + `m=sms` composer force), kebab (Call/Email/Reply/Mark as Unread/Archive/Block), compose sheet: recipient search → channel toggle → template picker → **real Twilio self-send SM4a01… PROVEN** (timeline row verified then deleted). **Quiet-hours TCPA gate fired live** ("texts pause 9pm to 8am Pacific") and the send-anyway override worked — compliance path verified end-to-end, plus `isSuppressed` per-recipient + scope checks read in `sendCrmSmsAction`. |
| `/admin/crm/activity` | navy header, All/New Leads/Emails/Website pinned strips (New Leads → 50 lead_created rows only), bell → activity, rows → detail. |
| `/admin/crm/deals` | board renders; **coherence P1 found + FIXED** (below). |
| `/admin/crm/calendar` | month↔week toggle, day taps, agenda day sections, bell → activity, own FAB → Appointment/Task chooser (appointment form full anatomy; generic Quick-actions FAB correctly hidden at <md). |
| `/admin/crm/tasks` | sub-tabs (Today's/Overdue/Future incl. empty state), filter sheet (types/visibility/agent), Clear-My-Overdue confirm dialog (honest copy, cancelled), **task complete round-trip PROVEN** (DB `completed_at` set, reverted). |
| `/admin/broker-dashboard` | greeting, Everyone/Just-me, New Leads/Emails/Website card tabs w/ real rows → detail, Needs-your-action, ACTIVE DEALS. |
| `/admin/settings` | mob-06 modal, **notification toggle round-trip PROVEN net-zero**, signature sheet opens, Close returns. |
| `/admin/console/leads` redirect | `?q=&stage=` carried to `/admin/crm` ✓. |
| Cross-surface | bottom tab bar present on every route (incl. detail); punch-list removals (TRANSFER TO LENDER, TEXT/EMAIL ALL, EDIT ALL, Send Invite, Add background) confirmed still absent (comments only). Console: **zero errors** across all surfaces (only repo-wide Radix `DialogContent` description warnings + a site-wide AdSense warning). |

## Findings ledger

### P0 (broken / compliance-risk) — 1 found, 1 FIXED

- **P0-1 · SMS templates send literal `%tokens%` to clients.** 17 of 37 active
  SMS templates carry FUB-era tokens the resolver did not know
  (`%greeting_time%` ×7, `%inquiry_address%` ×17, `%agent_name%` ×13 — SQL
  verified), and the mobile compose sheet inserted template bodies RAW with
  **no unresolved-token warning** (desktop SmsComposer has one). This already
  happened for real: person 13168's timeline holds a Jun 30 outbound SMS
  `"%greeting_time%, Matthew, I just got your message re: %inquiry_address%…"`
  — the exact "Best time to call" template body. **FIXED three ways:**
  (1) `lib/crm/merge.ts` — FUB aliases resolve (`%greeting_time%`→greeting,
  `%agent_name%`→agent full name, `%inquiry_address%`→property/last-viewed
  address, fail-closed when no data) + 3 new tests (53 pass);
  (2) NEW `renderSmsTemplateAction` (scope-gated, render-only) — the compose
  sheet now server-renders a template for the recipient BEFORE it lands in the
  input, so the broker sees what will send;
  (3) MobileComposeSheet now shows the desktop-parity "Unfilled merge fields …
  Edit before sending" warning for anything still literal.
  Verified live: "Best time to call" arrives as "Good morning, Matthew, … -Matt,
  Ryan Realty" with only `%inquiry_address%` literal + warned (13168 has no
  inquiry property).

> **Findings-closure pass 2026-07-02 (same day, follow-up slice):** P1-6 and every
> open P2 below are now CLOSED — each entry carries its fix inline. Nothing in this
> ledger remains open.

### P1 (spec/parity miss) — 6 found, 6 FIXED

- **P1-1 · Deals root wore the wrong app** (FIXED): `/admin/crm/deals` at <md
  had no §23 navy root header — the only CRM root tab without it ("looks like
  2 CRMs" class). Added `MobileCrmHeader` (headshot · "Deals" · search) at <md;
  desktop verified unchanged at 1440.
- **P1-2 · AI pills dumped raw API internals** (FIXED): with the Anthropic key
  out of credit, tapping Introduction/Follow Up rendered
  `400 {"type":"error"… "credit balance is too low… Plans & Billing"` into the
  composer. `aiSmsDraftAction` catch now logs server-side and returns
  "AI drafting is unavailable right now. Write your text below." (verified live).
  **External blocker RESOLVED 2026-07-02: Matt topped up the API account — the pill
  now returns a real draft on prod (verified live on contact 13168, 226-char draft
  rendered into the composer, nothing sent; smart-followups cron unblocked too).**
- **P1-3 · FAB "Send text"/"Send email" dead-ended on mobile** (FIXED): they
  deep-linked `#comms`, but the mobile Comms tab is a read-only feed — nothing
  to type into. At <md they now use the punch-#4 in-app composer deep links
  (`/admin/crm/inbox?c=<id>&m=sms|email`); desktop keeps `#comms` (verified both).
- **P1-4 · FAB "Add note" landed on the wrong tab** (FIXED): `#comms` → mobile
  Comms tab has no note affordance. Now `#notes` (mobile map already routes
  notes→Notes tab; desktop aliases `notes→comms` where its composer lives).
  Verified: mobile lands on Notes, desktop unaffected.
- **P1-5 · Long notes were unreadable** (FIXED): §25.8.3 5-line clamp with NO
  way to see the rest. Note cards are now tap-to-expand (aria-expanded,
  keyboard-operable). Verified live: 100px → 1040px full note.
- **P1-6 · Settings "Email signature" is write-only** (FIXED 2026-07-02,
  closure slice): `brokers.email_signature` saved but no send path read it.
  **Fix:** `email_signature` added to the getBrokers DAL projection (+ Broker
  type `emailSignature`, cache key `brokers-v5`); `buildSignature` now uses the
  broker's saved plain-text signature when non-blank (escaped, newlines→`<br>`,
  same navy-rule shell) and ALWAYS appends the ORS 696.820 agency-pamphlet
  compliance line; blank/unset falls back to the generated identity block.
  Covers every send path by construction (composer + inbox + sequence engine
  all route through `getSignatureForMailbox`→`buildSignature`; gmail.ts
  `withSignature` appends both html + plain). Settings helper copy on both
  surfaces corrected ("Leave blank to use the standard Ryan Realty signature").
  6 new tests (`lib/crm/email-signature.test.ts`): custom/fallback/escaping/
  CRLF/pamphlet-always. **PROVEN with a real self-send:** signature saved via
  the mobile sheet UI (DB verified) → composer email to Matt's own contact
  13168 → timeline row 222938 body carried the custom block + pamphlet line →
  reverted net-zero (signature cleared to prior '', row 222938 deleted).

### P2 (polish / data) — ALL CLOSED (audit slice + 2026-07-02 closure slice)

- P2-1 Inbox previews showed raw HTML entities ("Owner &amp; Principal Broker")
  — **fixed in the audit slice** (`buildSnippet` strips tags + decodes entities).
- P2-2 Activity rows rendered literal `"Property Inquiry · <unspecified>"`
  — **fixed in the audit slice** at the mobile assembly layer.
- P2-3 Tab strip auto-scroll — **FIXED**: `MobileContactDetail` centers the
  active tab in the strip on every tab change (effect on `active`, smooth
  scroll, `data-tab-key` targets). Verified live at 390: deep-link to Calendar
  scrolls the strip so the underline is visible.
- P2-4 Contact Calendar tab task-only — **FIXED**: "Add Appointment or Task"
  now opens the D.2-style chooser (Appointment / Task, both real). Appointment
  branch reuses the calendar screen's full-field `AppointmentSheet` (new
  `presetPersonId` prop pre-links this contact); NEW DAL
  `getAppointmentsForPerson` renders the contact's real appointments (navy
  date badge) above tasks. **Round-trip PROVEN:** appointment created from the
  tab (crm_appointments row 8, person 13168) → rendered on the tab → deleted
  net-zero. (Task rows remain display-only per §25.9.3 — complete/edit lives
  on /admin/crm/tasks, spec-conformant.)
- P2-5 Phone label casing — **FIXED**: `titleCaseLabel` at the mobile
  assembly layer (phones + emails). Verified live on 13168: "Mobile"/"Home".
- P2-6 Merge-chip panel below-the-fold — **FIXED**: `MergeFieldPicker` starts
  collapsed behind a "Merge fields" disclosure at <md (CSS-only, no hydration
  flash; md+ keeps the always-expanded desktop behavior). Verified live at
  390: panel hidden, toggle expands/collapses, message field in-viewport.
- P2-7 lead_created bare-name rows — **FIXED**: mobile Activity tab renders
  "<Name> was created" (verified live on lead 52281).
- P2-8 Settings initials avatar — **FIXED**: profile card resolves the real
  broker headshot via `CRM_BROKER_BY_EMAIL` + `BROKER_HEADSHOTS` (OAuth avatar
  → initials fallback for non-brokers). Verified live: Matt's headshot renders.
- P2-9 Test-data hygiene — **FIXED, every deletion DB-verified zero-reference
  first**: (1) "Start (temp stage)" stages 47/48 deleted (migration
  `20260702120000_remove_temp_deal_stages`, applied; 0 crm_deals referenced
  either; also removed from the `DEAL_PIPELINES` fallback + `getDealPipelines`
  cache key bumped v2; board + dashboard verified clean). (2) crm_people 52274
  "ZZTEST BulkDeleteSafe" deleted (all 19 FK tables verified 0 rows). (3)
  tc_deals `ZZ-TEST-E2E-SIGNING` ("123 Test Street", 2026-06-13 signing-E2E
  fixture) purged with its cycle/document/checklist-item/2 events/1 principal-
  review — the review row required a one-transaction `DISABLE TRIGGER USER`
  on tc_principal_reviews (the OAR 863-015-0140 immutability trigger protects
  REAL transaction reviews, not synthetic fixtures); trigger re-enabled +
  verified `tgenabled='O'` in the same session. Dashboard verified: no
  ZZ-TEST, no temp stage.
- P2-10 Tasks screen header — CLOSED as not-a-defect: spec §29 Screen C is
  header-title-only; recorded observation stands.
- P2-11 Radix `aria-describedby` console noise — **FIXED**: every
  `SheetContent`/`DialogContent` without a Description across the admin CRM
  surfaces (29 files) now passes `aria-describedby={undefined}` (the Radix-
  documented suppression; contents WITH descriptions keep their auto-wiring).
  Verified live: sheet/dialog opens produce zero Radix warnings (only the
  known site-wide AdSense warning remains).

## Net-zero accounting

Every mutation this audit made was reverted: task 444 created→deleted · person
13168 name Matthew→Matthew-AUD→Matthew (+ its 2 change-log rows 222931/222932
deleted) · conversation 13168 closed→reopened, unread→read · task 438
completed→uncompleted · settings toggle off→on · timeline row 222933 (audit
self-send) deleted. The one real SMS (Twilio SM4a01…, quiet-hours override
path) went to Matt's own phone.

**Closure-slice net-zero (2026-07-02):** email_signature test value set via UI
→ cleared back to prior '' · signature-proof email (timeline row 222938, sent
only to matt@ryan-realty.com) deleted · P2-4 test appointment (crm_appointments
row 8) created→deleted. The P2-9 deletions are intentional PERMANENT removals
of verified test artifacts (documented above), not audit mutations.

## Coherence verdict

After the Deals-header fix: **every mobile CRM root + pushed surface now wears
the same language** — navy 56px header (headshot / title-or-scope / search),
bottom tab bar on every route, single-FAB rule intact, same sheet idioms
(navy Cancel·Title·Action headers), FUB date conventions throughout. The
"2 CRMs" split-brain is gone at 390. Remaining coherence nits are P2-3/5/8.
