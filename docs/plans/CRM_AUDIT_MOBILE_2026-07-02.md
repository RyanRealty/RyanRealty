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

### P1 (spec/parity miss) — 6 found, 5 FIXED, 1 OPEN

- **P1-1 · Deals root wore the wrong app** (FIXED): `/admin/crm/deals` at <md
  had no §23 navy root header — the only CRM root tab without it ("looks like
  2 CRMs" class). Added `MobileCrmHeader` (headshot · "Deals" · search) at <md;
  desktop verified unchanged at 1440.
- **P1-2 · AI pills dumped raw API internals** (FIXED): with the Anthropic key
  out of credit, tapping Introduction/Follow Up rendered
  `400 {"type":"error"… "credit balance is too low… Plans & Billing"` into the
  composer. `aiSmsDraftAction` catch now logs server-side and returns
  "AI drafting is unavailable right now. Write your text below." (verified live).
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
- **P1-6 · Settings "Email signature" is write-only** (OPEN — not quick):
  `brokers.email_signature` is saved by the mobile settings sheet (and desktop
  MySettingsForm) but NO send path reads it — every CRM email builds its
  signature from `buildSignature(broker)` (lib/crm/email-signature.ts). The
  helper text ("Appended to emails you send from the CRM compose screen") is
  false. Fix: have `buildSignature` append the broker's custom plain-text block
  (escape + `<br>`), which needs the `email_signature` column added to the
  getBrokers DAL projection + type + tests — an every-outbound-email surface,
  deliberately not rushed inside an audit slice. Desktop shares this finding.

### P2 (polish / data) — logged, not blocking

- P2-1 Inbox previews showed raw HTML entities ("Owner &amp; Principal Broker")
  — **fixed in passing** (`buildSnippet` now strips tags on HTML bodies +
  decodes common entities; verified live).
- P2-2 Activity rows rendered literal `"Property Inquiry · <unspecified>"`
  (FUB import artifact in stored titles) — **fixed in passing** at the mobile
  assembly layer (strip `· <unspecified>`); desktop center column still renders
  the stored title verbatim (desktop ledger's call).
- P2-3 Contact-detail tab strip does not auto-scroll the active tab into view
  (Calendar active = indicator off-screen at 390).
- P2-4 Contact Calendar tab: "Add Appointment or Task" opens a task-only sheet
  (no appointment branch on the contact detail; the calendar screen has both);
  created task rows are display-only (complete/edit lives on /admin/crm/tasks).
- P2-5 Phone label casing renders raw FUB data ("mobile" vs "Mobile") on the
  Info tab; the Edit sheet normalizes, the display row doesn't.
- P2-6 Email reply composer opens with the merge-chip panel expanded, pushing
  the message field below the fold at 390.
- P2-7 lead_created activity rows render as a bare name ("Brent Babin") — FUB
  shows a "created" phrasing.
- P2-8 Mobile settings profile card uses initials, not the broker headshot the
  navy headers use.
- P2-9 Data hygiene visible on real surfaces: "Start (temp stage)" pipeline
  stage on Deals; ZZZTEST/ZZ-TEST-E2E rows on the dashboard's recent lists.
- P2-10 Tasks screen navy header has neither headshot nor back affordance
  (unlike every root header); reachable-only-via-nav — spec §29 Screen C is
  header-title-only, so recorded as observation.
- P2-11 Repo-wide Radix `DialogContent` missing `aria-describedby` warnings on
  every sheet open (console noise, a11y polish).

## Net-zero accounting

Every mutation this audit made was reverted: task 444 created→deleted · person
13168 name Matthew→Matthew-AUD→Matthew (+ its 2 change-log rows 222931/222932
deleted) · conversation 13168 closed→reopened, unread→read · task 438
completed→uncompleted · settings toggle off→on · timeline row 222933 (audit
self-send) deleted. The one real SMS (Twilio SM4a01…, quiet-hours override
path) went to Matt's own phone.

## Coherence verdict

After the Deals-header fix: **every mobile CRM root + pushed surface now wears
the same language** — navy 56px header (headshot / title-or-scope / search),
bottom tab bar on every route, single-FAB rule intact, same sheet idioms
(navy Cancel·Title·Action headers), FUB date conventions throughout. The
"2 CRMs" split-brain is gone at 390. Remaining coherence nits are P2-3/5/8.
