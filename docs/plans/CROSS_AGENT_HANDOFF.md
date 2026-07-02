> **Newest, complete, self-contained handoff: [`HANDOFF_2026-06-28.md`](./HANDOFF_2026-06-28.md)** — but read the blocks below FIRST; the top one is newest (2026-07-01, ground-up rebuild).

# CROSS-AGENT HANDOFF — CRM GROUND-UP REBUILD, screen-by-screen under ci:crm-screen-parity (2026-07-01)

## LEAD-DATA DISPLAY REGRESSION FIXED (2026-07-02) — custom fields were invisible; data was 100% intact
Matt saw "just names" — his expired/homeowner property detail, tenure, mailing/property address looked
gone. Data was fully intact; pure DISPLAY bug. ROOT CAUSE: `lib/crm/custom-field-display.ts`
`groupAndFormat()` only rendered custom keys that had a matching `crm_field_definitions` row, but the 41
defined keys are unprefixed (`yearBuilt`) while EVERY populated key is `custom`-prefixed
(`customYearBuilt`, `customSellerPropertyAddress`, `customPurchasePrice`, …) — zero overlap → all
enrichment data dropped from the desktop `CustomFieldsPanel`. FIX (display-only, no data touched):
fallback-render every populated undefined key in a trailing "Enrichment data" group (+ `humanizeCustomKey`),
drop empty typed rows (populated-only, FUB parity — was 41 em-dash rows), flip the sidebar Custom Fields
section to `defaultOpen`, and un-clamp the mobile background. Proven live on 18187 + homeowner 104,
desktop 1440 + mobile 390, zero console errors. Suite 2454 green · tsc clean · ci:gates exit 0. Also
registered the foreign `WESTSIDE_DATA_SWEEP_2026-07-02.md` plan doc (committed unregistered at 3bce73d0)
to unblock G44. Full detail: mission PROGRESS "LEAD-DATA DISPLAY REGRESSION FIXED". Follow-up (not a bug,
logged): system "Automated outreach packet generated" notes dominate long-running contacts' Notes — a
filter/group to surface real broker notes is a UX nicety, deferred.

## GROUP SMS FIX LANDED (2026-07-02, commit 74d22bf9) — inbound group texts were being DROPPED; now recorded
Matt's "are group SMS recorded?" question exposed a message-loss class: Programmable Messaging does
not support group MMS, so every inbound group text (incl. Mary Bowman + Yahson Terry's phone-era
group thread with Matt's ported 541.703.3095) was silently dropped since the 2026-06-24 port — no
webhook, no Twilio log, no CRM row. Fixed live: `sendGroupMms` rewritten to NATIVE group MMS
(Address-only members + broker line ProjectedAddress; own Twilio numbers are REJECTED as members,
50407) · NEW `/api/twilio/conversations-events` webhook records group messages to every member's
timeline · global Conversations webhook + autocreation on all 4 lines wired by
`scripts/setup-conversations-webhooks.mjs` (re-runnable) · IM-sid media via the MMS proxy. Verified
net-zero on prod end-to-end (delivered receipt to Matt's cell, signed-webhook row+task+unread,
403 on forged sig, dedupe on replay, 1:1 path unaffected, all test rows deleted). Full entry:
mission PROGRESS "GROUP SMS RECORDING SLICE".

**RESOLVED same day — YAHSON SPLIT + FUB GROUP-TEXT BACKFILL (Matt: "yahson is 909", son-in-law):**
Yahson Terry = crm_people **52283** (909.343.0531 + yahsonkt@hotmail.com + 107 provably-909 rows
moved from Mary #12967; `son-in-law`/`mother-in-law` reciprocal link, enum extended). And Matt's
"merge all past FUB group texts" directive ran: `scripts/crm-backfill-fub-group-texts.mjs`
(committed, idempotent, FUB read-only) enriched 763 imported group rows with group context and
mirrored 784 group messages across 18 FUB threads onto every mapped participant (Yahson +220,
James Merkle #1933 +3; 9 unmatched numbers report-only). 7 new route regression tests lock the
future path. OPEN FOLLOW-UP: the Jun-24→Jul-2 dropped-group-MMS window is unrecoverable from
Twilio — a Messages-app sweep on the mac mini is the offered recovery; threads plausibly active
in the gap: Mary/Yahson (groupTextId 6) + the Hogans (18). Full entry: mission PROGRESS
"YAHSON SPLIT + FUB GROUP-TEXT BACKFILL".

## 🏁 PRODUCTION SIGN-OFF LANDED (2026-07-02, commit 3bb76d69) — CRM verified PRODUCTION READY
Final independent verification pass: [`CRM_PRODUCTION_SIGNOFF_2026-07-02.md`](CRM_PRODUCTION_SIGNOFF_2026-07-02.md).
Fresh evidence for everything (parity 18/18 · gates exit 0 · vitest 2431 · tsc clean · Vercel
READY on HEAD · live-prod smoke 18/18 surfaces both form factors · compliance code-read ·
3 SQL-reconciled reporting numbers · zero test artifacts). **The formerly-open items are ALL
resolved: Matt chose GEIST for CRM headers (desktop P2-9 closed by decision) · API credits
topped up + AI drafting verified live on prod · CRM_LEAD_BACKEND is already 'native' in prod
(no env override — the "Matt owns the flip" line below is STALE). Awaiting-Matt list: empty.**

## FINDINGS-CLOSURE SLICE LANDED (2026-07-02) — both audit ledgers drained, zero open P0/P1
Every open finding in `CRM_AUDIT_2026-07-02.md` (desktop) + `CRM_AUDIT_MOBILE_2026-07-02.md`
closed, EXCEPT desktop P2-9 (CRM headers Geist vs Amboqia — Matt's brand call, flagged) and the
external ANTHROPIC_API_KEY credit. Headlines: **P1-6 email-signature wiring** (getBrokers now
projects `email_signature`, `buildSignature` honors it + always appends the ORS 696.820 pamphlet
line; proven with a real self-send, net-zero) · **shared `ReportingTabStrip`** replaces the 13×
duplicated REPORTING_TABS (+ the 11 inert "How Reporting works" badges now open the real dialog;
registry reporting-desktop requires ReportingTabStrip) · mobile P2 sweep (tab autoscroll, real
appointment branch on the contact Calendar tab via `AppointmentSheet presetPersonId` + NEW DAL
`getAppointmentsForPerson`, label casing, merge-panel collapsed at <md, "was created" phrasing,
broker headshot on settings, aria-describedby sweep on 29 files) · test-data purged from live
prod (temp stages 47/48 via applied migration `20260702120000`, ZZTEST person 52274, tc_deals
ZZ-TEST-E2E-SIGNING incl. a one-transaction immutability-trigger bypass, re-armed + verified).
GOTCHAS: HEAD was NOT gate-green when this slice started — inbox page + sequence-engine route had
crossed the 600-LOC budget (split `BROKER_OPTIONS` → inbox-url.ts; engine helpers →
`app/api/cron/crm-sequence-engine/helpers.ts`), dal-actions-reads was +2 over baseline, and the
email-send-gated baseline is LINE-KEYED (re-keyed inbox:402→:398 — any edit above that send moves
it again). `getDealPipelines` cache key is now `crm-deal-pipelines-v2`; `getBrokers` is
`brokers-v5`. Full entry: mission PROGRESS "FINDINGS-CLOSURE SLICE".

**HEAD:** `90ced1de` on `main` · mission: `docs/plans/CRM_BUILD_MISSION.md` (read its PROGRESS "GROUND-UP REBUILD" block) · registry: `docs/fub-crm-spec/crm-screens.json` — **REGISTRY COMPLETE: 18 done, all proven (all 10 desktop + all 8 mobile); only the _meta row is todo.** The mission's email open+click tracking task is also SHIPPED + PROVEN E2E (see the ✅ blocks in the mission doc).

## MOBILE ADVERSARIAL AUDIT LANDED (2026-07-02) — ledger `docs/plans/CRM_AUDIT_MOBILE_2026-07-02.md`
The production-ready-bar MOBILE pass (390x844, post-punch-list `8548c0f3`; 10 surfaces, ~120
affordances, every mutation DB-proven then reverted net-zero, zero console errors). **18 findings:
1 P0 + 6 P1 + 11 P2; the P0 and 5 of 6 P1s FIXED in-slice.** Headlines: SMS-template
literal-%token% class closed three ways (FUB-token aliases in `lib/crm/merge.ts` + NEW
`renderSmsTemplateAction` pre-renders templates in `MobileComposeSheet` + unresolved-token
warning — a template send had ALREADY gone out literal on Jun 30) · AI-pill raw billing-error
dump → graceful degradation (`aiSmsDraftAction`) · Deals root got the §23 navy `MobileCrmHeader`
(the last split-brain surface) · lead FAB Send text/email at <md → `?c=<id>&m=sms|email` in-app
composers, Add note → `#notes` (desktop aliases notes→comms in `LeadTabs`) · note cards
tap-to-expand · `buildSnippet` entity-decode · activity "<unspecified>" strip. **OPEN: P1-6
Settings "Email signature" is write-only** (`brokers.email_signature` saved by mobile+desktop
settings but no send path reads it — wire through `buildSignature` + getBrokers DAL; desktop
shares it) + P2 list in the ledger. Quiet-hours TCPA gate + override verified live on a real
self-send. Coherence verdict: one language on every mobile route now.

## TELEPHONY FIX LANDED (2026-07-02) — Matt's sender is now +15417033095 (541.703.3095)
Matt's ported primary business number is now his live Twilio line (`brokers.matthew-ryan
.twilio_number`, migration `20260702090000_broker_primary_number_fix`); the temp +15412245025 is
the retained legacy/spare line (`MARKETING_NUMBER` in `lib/crm/twilio.ts`, still CRM-webhooked,
do NOT release). Paul's row was also fixed (+15415013436 → +15415023436 — the old value wasn't
even owned by the account). Sequence engine now sends from the assigned broker's own line, not
the pooled MS. Cache keys bumped: `crm-broker-telephony-v2`, `broker-by-slug-v3`, `brokers-v4`.
Vercel env: TWILIO_NUMBER_MATT updated, TWILIO_NUMBER_MARKETING added. Live-verified delivered
from +15417033095. Full entry in the mission PROGRESS block ("TELEPHONY", 2026-07-02).

## DESKTOP ADVERSARIAL AUDIT LANDED (2026-07-02) — ledger `docs/plans/CRM_AUDIT_2026-07-02.md`
A separate agent ran an adversarial pass over all 10 desktop CRM screens (Matt's authed prod-data
session, ~120 elements, every mutation net-zero). **9 findings; 6 fixed (commits b02e7c90, 90ced1de,
+ phone-mirror in 8548c0f3), 3 open (all P2 coherence).** Fixed P0s: user-created smart lists never
filtered (Save List wrote only `ast`, not the `filter` bag the list reads); Create Note dead for
imported contacts (gated on decommissioned FUB API); phone/email jsonb mirror dropped `isPrimary`
(wrong send target). Fixed P1s: Email Templates had no delete button; Contact Attempts report missing
Marketing+Deals tabs; Agent Goals "Set goal" 404. Open P2s: reporting H1 size, duplicated
`REPORTING_TABS` (13×), CRM headers Geist-not-Amboqia. If you touch `app/actions/crm-saved-views.ts`,
`app/actions/crm.ts` (addCrmNoteAction), `app/actions/crm-person-detail.ts`,
`components/admin/crm/settings/templates/EmailTemplateList.tsx`, or the reporting pages, pull first.

## What this track is
Matt's directive: execute CRM_BUILD_MISSION as a ground-up rebuild, screen by screen through the
full DoD, gated by `ci:crm-screen-parity` (scripts/check-crm-screen-parity.mjs — a screen flips to
`done` ONLY with requiredComponents referenced by the route + a committed `_verify/<id>.png`). No
gap-fills. Standing commit+push authorization is in the mission doc.

## Shipped
- **MOBILE UX FIX PUNCH LIST #1–#6 = SHIPPED + VERIFIED** (2026-07-02, Matt phone feedback):
  full entry in the mission's "PROGRESS (punch list)" block. Headlines: bottom tab bar now on
  EVERY mobile route incl. lead detail (mob-02 suppression + pushed-detail.ts DELETED, Matt's
  directive supersedes; ci:crm-mobile-track M2 contracts rewritten w/ mustNot support) · header
  Edit works (NEW MobileEditSheet + updatePersonNameAction; proven net-zero round-trip on 13168) ·
  ONE CRM (legacy /admin/console/leads list → redirect to /admin/crm; NEW MobileCrmHeader navy
  header on People root + Activity; BrokerScopeSheet gains variant="header") · texting/email from
  the CRM (SMS/Email circles → /admin/crm/inbox?c=<id>&m=sms|email — NEW `m` channel override +
  initialReplyOpen; Call → S8 bridge sheet) · NEW Activity tab on the contact detail
  (MobileActivityTab) · dead-link sweep (FAB hash actions now switch mobile tabs; inert FUB
  affordances removed — see PROGRESS). GOTCHAS: Matt's screenshot B ("Andy Christensen",
  "My Agent status/Send Invite", Automations tab, RELATIONSHIPS-above-details) is the FUB-iOS
  mob-02 REFERENCE, not our page — no such code exists · file-size budget forced
  app/actions/crm-person-files.ts split out of crm-person-detail.ts · email-send-gated baseline
  re-keyed :396→:402 · dal-actions-reads re-baselined +1 (name-audit before-read) · a CONCURRENT
  session edits app/actions/crm-saved-views.ts (filter dual-write P0) — left unstaged.
- **mobile-dashboard + mobile-settings = done + proven** (commit `2b7dcfb2`, 2026-07-02): the FINAL
  two registry screens — M8 mob-44 (`/admin/broker-dashboard`: DashboardActivityFeed rebuilt to the
  §2a/§2b card anatomy — box-outline active sub-tab, 80pt/44pt rows, 4-row card w/ internal scroll,
  "Needs your action" in-viewport; Website tab verified showing real "Viewed the site" rows) and
  M9 mob-06 (`/admin/settings`: NEW `MobileSettingsScreen` full-screen z-50 modal — navy Close header,
  profile card, icon-circle feature rows w/ immediate-save toggles proven net-zero, signature sheet,
  support links; desktop MySettingsForm untouched). Proofs `_verify/mob-dashboard.png` +
  `_verify/mob-settings.png` (390x844, zero console errors). GOTCHAS: the z-50 fixed-overlay pattern
  (from MobileThread) is the cheapest way to satisfy "modal occludes tab bar + FAB" — tab bar is z-30,
  FAB z-40, no suppression edits needed · `getByRole('button', {name})` is case-INsensitive — 'Send
  email' matched the 'Send Email' header toggle and silently closed the composer (use exact: true) ·
  arbitrary px sizes on a PAGE trip ci:design-tokens (ignore-list is for pt-precise COMPONENTS; pages
  use the ladder).
- **Email open+click tracking task = SHIPPED + PROVEN E2E** (2026-07-02, same session): most send
  paths were already wired by intervening slices (composer/sequences/appointments `track`, cohort +
  newsletter + market-report + saved-search via `attributeOutbound`, cma-deliver, Resend webhook →
  email_events). Added: `isComplianceLink()` in lib/email-tracking.ts (unsubscribe rails + Oregon
  agency disclosure NEVER click-wrapped) + lib/email-tracking.test.ts, and tracking + 'sent' events
  on `app/api/cma-drafts/[id]/send`. E2E proof: composer send to Matt's own contact (13168) →
  delivered HTML pulled via Gmail service account (pixel + wrapped links confirmed) → pixel fired
  2× = ONE open row (idempotent) → real click = ONE click row + 302 → UI showed "3 opens · 1 clicks"
  (screenshot `_verify/email-tracking-engagement.png`) → test rows deleted (net-zero). NOT tracked by
  decision: internal broker-recipient alerts/digests, TC signing emails, template self-test;
  `cma/[slug]/email` multi-recipient deferred.
- **mobile-calendar-tasks + mobile-pickers = done + proven** (commits `8ded6cb5` + `a7746316`,
  2026-07-02): M6 §29 (`/admin/crm/calendar` <md Screen A in
  `components/admin/crm/calendar/mobile/`, `/admin/crm/tasks` <md Screen C in
  `components/admin/crm/tasks/mobile/`, shared `MobileTaskCreateSheet` +
  `task-type-icons` broker-badge palette; old MobileCalendar/TaskQueue DELETED,
  TaskActions type now lives in TasksView) and M7 §28 (DETAILS pickers on the mobile
  contact detail: NEW `MobileAssignToSheet`, Source picker w/ NEW DAL `getCrmSources`,
  Time frame picker → crm_people.timeframe, Automations enroll picker). Proofs
  `_verify/mob-calendar-tasks.png` + `_verify/mob-pickers.png` (390x844, zero console
  errors). Decisions + deferrals in the mission PROGRESS block. GOTCHAS for the next
  agent: the lead page's form wrappers now live in
  `app/admin/console/leads/[id]/form-actions.ts` ('use server' module — the page was
  over its file-size budget; split, never re-baseline) · CrmMobileTabBar lights NO tab
  on /admin/crm/calendar|tasks (explicit exclusion in activeHref) · ConsoleQuickAction
  is `hidden md:flex` on those routes (its FAB suppression is now viewport-conditional,
  a THIRD suppression mode next to the inbox full suppression) · the tasks page is OFF
  ci:console-kit (comment in check-console-kit.mjs) · scroll-to-section on the mobile
  calendar uses a `[data-datekey]` querySelector inside a useEffect keyed on
  selectedDate — a ref-map version silently failed; and `scrollIntoView` needs
  `scrollMarginTop` + the sticky headers sit at `top-14` under the shell header ·
  sticky bits: crm_ponds HAD a duplicate "Out Of State Home Owners" row (deduped
  2026-07-02, id 2 deleted after a 0-references check) · the §29 files + MobileAssignToSheet
  are on `.design-token-lint-ignore` (documented FUB-pt-precision class).
- **inbox-mobile + mobile-compose = done + proven** (commit `02e426f8`, 2026-07-02): the M3/M4
  REAL builds — §26 FUB-iOS inbox at <md (`components/admin/crm/inbox/mobile/`: MobileBranch →
  MobileInbox list w/ navy header + 4-tab pills + swipe rows + scope/filter sheets, MobileThread
  pushed overlay w/ email-detail / SMS-bubble modes + 26-G kebab + block + context drawer) and
  §27 compose (MobileComposeSheet FAB: contact search + group SMS ≤10 + template pickers +
  EmailComposer; NEW aiSmsDraftAction AI pill strip fills the input only; S8 call sheet →
  startCrmCallAction bridge). Every send through the existing gated actions. Proofs
  `_verify/mob-inbox.png` + `_verify/mob-compose.png` (390x844, zero console errors). Decisions
  + deferrals in the mission PROGRESS block. GOTCHAS for the next agent: the inbox page is OFF
  ci:console-kit (crm-screen-parity owns it — comment in check-console-kit.mjs) · the
  file-size gate forced a split: page 589 LOC + MobileBranch.tsx + mobile-data.ts; registry
  routes point at component files (allowed — person-detail-mobile precedent) ·
  ConsoleQuickAction now returns null on /admin/crm/inbox (single-FAB rule) · the ConsoleShell
  main adds px-4 pt-5 (sm:px-6 pt-7) — full-bleed mobile branches need the -mx-7/-mt-11
  cancellation in MobileBranch · email-send-gated baseline keys on file:LINE — editing the
  inbox page shifts the allowlisted @mention send, re-key it (336→396 this time) · the
  ANTHROPIC_API_KEY account is OUT OF CREDIT (AI drafts + crm-smart-followups degrade
  gracefully; top-up chip raised).
- **person-detail-mobile = done + proven** (prove-and-flip, same session as reporting-desktop):
  the previously-verified M1 build got its mechanical proof — `_verify/mob-contact-detail.png`
  captured at 390x844 (lead 12679 via `?view=mobile`, zero console errors), registry flipped with
  the 6 Mobile* tab components `mobile-detail.tsx` references.
- **reporting-desktop = done + proven** (commit `ff4fe3ec`) — the LAST desktop screen: §11 anchor
  (Agent Activity) closed to zero structural diffs (ShowMeSelector dropdown, REAL Closed-Deals
  alternate view via NEW `lib/data/crm/agentActivityClosedDeals.ts`, totals row, honest lead-type
  filter, filters for non-superusers, HowReportingWorks dialog in
  `components/admin/crm/reporting/`), plus shell fixes: NEW `/admin/crm/reporting/marketing`
  (§11.15, NEW DAL `getMarketingUtmReport`) + `/admin/crm/reporting/deals` (redirect — §21 defers
  deals reporting); hub card links fixed in reporting/page.tsx + reporting-constants.ts. Decisions
  + deferrals in the mission PROGRESS block. GOTCHAS: Radix DropdownMenu in preview_eval needs
  `new PointerEvent('pointerdown', {pointerType:'mouse', ...})` — without pointerType it silently
  won't open · BOTH deal pipelines have a stage named "Closed", so any audit SQL that joins
  crm_deals to crm_deal_stages BY NAME double-counts (use IN (SELECT name ...) or dedupe) ·
  getAgentActivityReport cache key is now v5 · the file-size gate treats a file crossing 600 LOC
  as a NEW breach — split (agentActivityClosedDeals.ts) rather than re-baseline.
- **tasks-calendar-desktop = done + proven** (commit `1c447866`): §09 rebuild of BOTH surfaces —
  `/admin/crm/calendar` (CalendarView / CalendarGrids / AppointmentModal in
  `components/admin/crm/calendar/`; old CalendarGrid+AppointmentSheet preserved there as the
  <md MobileCalendar branch until M6/§29) and `/admin/crm/tasks` (TasksView in
  `components/admin/crm/tasks/`; TaskQueue = the <md branch). Day/Week/Month grids w/ three
  real event sources (appointments navy · open tasks amber · deal closings green), §2.6
  16-field modal w/ REAL invitation emails (broker Gmail, suppression-checked, proven
  self-addressed then net-zero deleted), §1.2 two-panel tasks module (Overdue default landing,
  Filters ▾ 8-type + Show Completed, Me ▾, Clear My Overdue via NEW clearMyOverdueTasksAction,
  optimistic completion). Migration `20260702010000`-style: `20260702120000` (APPLIED to
  hosted) adds crm_appointments.timezone. NEW pure lib `lib/crm/calendar.ts` (+10 tests) +
  zonedDateKey/zonedMinutes in lib/format/date; DAL adds getCalendarExtras /
  getPersonNamesByIds / getCalendarContactOptions. Decisions + deferrals in the mission
  PROGRESS block. GOTCHAS: crm_task_types/crm_appointment_types/crm_appointment_outcomes have
  RLS-on with ZERO policies — anon reads return [] silently; their cached readers now use the
  service client (check any OTHER anon config-table reader you touch for the same failure) ·
  appointments store WALL-CLOCK times as UTC while tasks are true instants (conventions
  documented in lib/crm/calendar.ts — don't "fix" one to match the other) · appointments.ts is
  a documented NON_SENDER in check-email-quality (1:1 transactional invite) · the pull--rebase
  AFTER commit rewrote the SHA (commit, then rebase, then read the SHA you publish).
- **company-settings-desktop = done + proven** (commit `c2492625`): §15 full rebuild of
  `/admin/crm/settings/company` — every previously-deferred sub-flow is now REAL (office-hours
  editor w/ LIVE voicemail enforcement in the Twilio voice webhook via NEW `lib/crm/office-hours.ts`,
  spam-label + subdomain Change dialogs, weekly-recipient chips wired into the Monday
  weekly-pipeline-digest cron, production-goal click-to-edit, block-list sub-page
  `/settings/company/block-list` on crm_blocked_numbers + NEW DAL `getCrmBlockedNumbers`,
  Business Registration sub-page `/settings/company/registration` w/ LIVE Twilio A2P badge,
  Call Recording master switch wired into voice + outbound-bridge routes, fallback US-phone
  validation). Components in `components/admin/crm/settings/company/` (old CompanySettingsForm
  moved+rebuilt). No migration needed. Decisions + deferrals in the mission PROGRESS block.
  GOTCHAS: the recorded-notice `<Say>` strings must stay LITERAL in the twilio routes
  (ci:call-recording-consent greps them — never refactor into a template constant) · Legal
  Disclosure is a locked-on switch by design (compliance), don't "fix" it into a free toggle ·
  new files must be `git add`ed before ci:gates (ci:untracked-imports) · a Record prop named
  `format*` trips ci:rsc-fn-props (renamed to blockedOnById) · Intl.DateTimeFormat outside
  lib/format/ trips ci:date-format (zonedDayMinutes now lives in lib/format/date.ts) · tables
  need a md:hidden card fallback (ci:admin-responsive) · hand-rolled `rounded-xl border bg-card`
  shells trip ci:design-tokens — use `<Card>`.
- **templates-desktop = done + proven** (commit `251ae048`): §13 two-level rebuild of
  `/admin/crm/settings/templates` (TemplateFolderList / EmailTemplateList / TextTemplateList /
  EmailTemplateModal / TextTemplateModal / MergeFieldInserter / TemplatePerfScore / RichTextBody /
  EmojiPickerButton in `components/admin/crm/settings/templates/`; old TemplateEditor DELETED),
  URL model `?t=email|text&folder=all|my|used|cat:<name>&q=`. Migration `20260702010000` APPLIED
  to hosted (crm_templates.preview_text + featured + nullable created_at). PLUS the mission's
  "FIX: merge fields" SHIPPED: renderCrmMerge resolves ALL ~30 catalog tokens via NEW
  `lib/crm/merge-context.ts` (buildMergeContext), wired ON SEND into composer email/SMS, the
  sequence engine, bulk email-cohort, enroll + previews, self-test, lead-page prefill;
  `lib/crm/merge.test.ts` asserts every token resolves; PROVEN on a real delivered email read
  back from Matt's Gmail. Decisions + deferrals in the mission PROGRESS block. GOTCHAS: the
  resolver is now PURE — %greeting% resolves only from ctx.now (buildMergeContext stamps it;
  ambient new Date() in the resolver trips ci:hydration-safety) · greetingFor routes through
  lib/format/date (ci:date-format) · Radix Tabs/AlertDialog in the preview browser need real
  PointerEvent pointerdown sequences (memory `reference_preview_eval_radix_gotchas`) · Dialog
  width overrides need `sm:max-w-*` (the primitive's own `sm:max-w-lg` wins otherwise) ·
  Tooltip needs a local TooltipProvider on this surface.
- **automations-desktop = done + proven** (commit `1ceb536e`): §12 rebuild of
  `/admin/crm/sequences` — the §12.2 list (folder cards + 10-column table w/ Using-pill /
  Engaged "N+ P%" / Created By avatars / optimistic Status toggles) + the §12.4 three-column
  visual editor at `/sequences/[id]/edit` (palette w/ Triggers|Steps tabs + drag, dot-grid
  canvas w/ delay badges + zoom, right config panel w/ the full Send Email anatomy). NEW
  `crm_sequence_folders` + `crm_sequences.folder_id/created_by` (migration `20260702000000`
  APPLIED to hosted), DAL `lib/data/crm/getAutomationsAdmin.ts`, pure
  `lib/crm/automation-links.ts` (+tests), folder CRUD actions. Old WorkflowList/StepBuilder
  deleted. Decisions + deferrals in the mission PROGRESS block. GOTCHAS: preview-tab console
  buffer carries STALE HMR errors from other pages (e.g. a long-fixed ManagePipelines import)
  — always console-check via a fresh Playwright context; sb- cookies were readable directly
  via preview_eval `document.cookie` while on localhost:3000 (no catcher needed this time);
  scratchpad `shot-console.mjs` = screenshot + zero-console-error assert in one run.
- **deals-desktop = done + proven** (commit `7f987b20`): §10 full Kanban rebuild of
  `/admin/crm/deals` (DealsSubBar / DealsBoard / DealsDialogs / DealDetailModal / ManagePipelines
  in `components/admin/crm/deals/`), DB-backed pipeline config (NEW crm_pipelines +
  crm_deal_stages + crm_deal_people + crm_deals.actual_close_date — migrations
  20260701230000 + 20260701233000 APPLIED to hosted; the second HYDRATES crm_deals columns from
  the FUB `raw` jsonb, which the import had never done — close dates/commissions/brokers/people
  were all NULL in columns), DAL `getDealPipelines` + `listDealsBoard`, owner-only stage/pipeline
  CRUD in `app/actions/crm-deal-pipelines.ts`, §11 modal via ?deal= param. Decisions + deferrals
  in the mission PROGRESS block. GOTCHA: the deals page is OFF the console-kit list (handed to the
  stricter crm-screen-parity contract, comment in scripts/check-console-kit.mjs) and the four
  deals components are on `.design-token-lint-ignore` (documented §10 exception class).
- **inbox-desktop = done + proven** (2026-07-01): §08 FUB three-panel rebuild of
  `/admin/crm/inbox` (InboxFolderRail / InboxThreadList / ThreadHeader / InboxThreadView /
  InlineReply / NoteTray / ContactSidebar / AddPersonForm in `components/admin/crm/inbox/`),
  scope×folder DAL (`getInboxFolderQueue` + new `lib/data/crm/getInboxThread.ts`), unknown-caller
  link-to-existing merge action in `app/actions/crm-person-gaps.ts`. Decisions + deferrals in the
  mission PROGRESS block. Verified live in dev (three panels, auto-read decrement, inline compose,
  quick tags, unknown-caller Add Person on a real Call-lead thread, Drafts/Sent/Assigned states,
  mobile branch intact). NOTE: the preview tab's console buffer accumulates errors from OTHER
  pages (PeopleListView HMR + reporting Tooltip) — the inbox page itself emits none (Playwright
  fresh-context capture clean).
- **contacts-list-desktop = done + proven** (commit `8c4c15af`): §05 three-region rebuild of
  `/admin/crm` (PeopleSidebar / PeopleListView + Scope/Filter/Chooser/AddPerson/Export in
  `components/admin/crm/people-list/`), 6 new bulk kinds + bulk merge, export route ids/all/view
  support, DAL `lib/data/crm/getPeopleListSignals.ts`. Decisions + deferrals in the mission
  PROGRESS block. GATE-DEBT NOTE: the §07 slice had left 3 gates red at HEAD (hydration-safety
  ×4 in person-detail, stale lead-command-center parity.json, console-kit) — all swept in this
  commit. Run the FULL `npm run ci:gates` before every commit; the previous slice evidently
  didn't.
- **person-detail-desktop = done + proven** (commit `66e79095`): §07 three-column rebuild
  (PersonSidebar / PersonCenterColumn / PersonRightRail in `components/admin/crm/person-detail/`),
  actions `app/actions/crm-person-detail.ts`, DAL `lib/data/crm/getPersonDetailExtras.ts`,
  migration `20260701150000` (APPLIED to hosted). Decisions + deferrals logged in the mission
  PROGRESS block.

## How to verify + capture the _verify screenshot (reusable harness)
1. Dev server via preview tool (`next-dev`, port 3000); preview browser carries Matt's session.
2. Capture fresh sb- cookies from the preview browser (they ROTATE hourly — a stale capture decodes
   to "Invalid UTF-8 sequence" and 500s): run a localhost python catcher, then preview_eval
   `location.href='http://127.0.0.1:<port>/?d='+encodeURIComponent(JSON.stringify(all sb- cookies))`
   (CSP blocks fetch(); navigation works; document.cookie only visible while ON localhost:3000).
3. Playwright (absolute import `/Users/matthewryan/RyanRealty/node_modules/playwright/index.mjs`)
   at the reference viewport (1440x900 desktop / 390x844 mobile) → save PNG to
   `docs/fub-crm-spec/_verify/<id>.png`. Scripts from this session: scratchpad `shot.mjs`.
4. Registry entry: fill requiredComponents (names the ROUTE file references) + status done.
5. `npm run ci:gates` (design-token exceptions for dense admin surfaces go in
   `.design-token-lint-ignore` — established class) + `npx vitest run` + commit + push
   (pre-push runs a full prod build, takes ~5 min — use a background shell).

## NEXT (registry COMPLETE — 18/18 done, tracking task shipped)
1. The ground-up rebuild track is CLOSED: every registry screen is done + proven and the email
   open+click tracking task shipped E2E. No screen work remains.
2. Open threads across the wider mission (not this track): deferred items logged per-slice in the
   mission PROGRESS entries (e.g. M5 swipe-row actions / long-press multi-select / team-filter sheet,
   dashboard pull-to-refresh, `cma/[slug]/email` per-recipient tracking loop, mob-06 [INFERRED]
   swipe-down dismissal), the ANTHROPIC_API_KEY credit top-up (AI drafts degrade gracefully), and the
   CRM_LEAD_BACKEND lead-entry flip (Matt owns, per the Twilio cutover memory).

## Gotchas carried forward
- crm_timeline.starred / crm_people.timeframe+lender_name / crm_contact_points.status /
  crm_person_files + private `crm-files` storage bucket all exist now (migration applied).
- Don't commit the concurrent session's dirt (untracked docs/scripts at repo root).
- NEVER `rows.length` for counts (1000 cap) — count:'exact'.
- console-root: FUB teal accents map to `var(--console-info)`, never `bg-accent`.
- Do NOT spawn parallel sub-agents that commit; sequential continuation only.

# CROSS-AGENT HANDOFF — CRM MOBILE TRACK M1 + shell fixes + interactive lead detail (2026-07-01)

**HEAD:** `74e3b602` on `main` (pushed; deployed + verified on prod) · plan: `docs/plans/CRM_BUILD_MISSION.md` MOBILE DELIVERY TRACK

## Shipped this session (each slice deployed + verified in Matt's authed prod browser)

1. **M1 mobile contact detail** (`/admin/console/leads/[id]` at <md + `?view=mobile` 390px verification frame). §25 layout: navy header, Info·Comms·Homes·Notes·Calendar, all 10 Info sections, notes w/ broker headshots + cleaned FUB `<br/>` bodies, FUB date convention. Commits `36b06ebe`+`2492cc32`.
2. **Shell fixes (§23 M2 slice 1, `0cc81ea9`):** bottom tab bar suppressed on pushed detail (mob-02) via `components/console/pushed-detail.ts`; single FAB (removed M1's inert dup; ConsoleQuickAction drops to bottom-6 on detail); header wordmark centered (mob-44).
3. **Interactive lead detail + menu (`74e3b602`)** — Matt: "you just made a shell" / "menu points to wrong pages". DETAILS rows open real §23.8 picker sheets (Assigned-to, Stage, Tags editor §25.10 w/ add+remove — VERIFIED live round-trip, Collaborators toggle); Add phone/Add email sheets → NEW `addCrmContactPointAction` (crm_contact_points, validation, dedupe, timeline audit); SMS circle live. Menu: CRM group gains Reporting/Workflows/Templates/CRM settings (`app/components/admin/admin-nav.ts`) — all verified resolving.

## Key gotchas for the next agent

- **console-root tokens:** `--accent` is a near-white neutral inside `.console-root` — FUB teal/blue accents map to `var(--console-info)` (inline style, sanctioned), NEVER `bg-accent`/`text-accent-foreground`.
- **Verify at 390px:** automation browser can't resize <768. Use `?view=mobile` on the lead detail; phone-only chrome (tab bar, FAB) is route-conditional so DOM-checkable at any width. Radix sheets open fine via real clicks.
- **git:** NEVER chain `git stash push … && … && git stash pop` — a no-op push makes pop grab an ancient stash (happened this session; recovered via reset --hard, memory `feedback_never_chain_stash_pop`). A CONCURRENT session edits `docs/plans/CRM_BUILD_MISSION.md` — don't commit its dirt.
- Design-token gate: mobile FUB-parity components are ignore-listed (documented exception class in `.design-token-lint-ignore`).

## NEXT (mobile track, in order)

1. **M2 rest:** pull-to-refresh; §23.8 sheet swipe-down; hamburger sheet is desktop-nav-heavy — consider CRM-first mobile ordering.
2. **M3 mobile inbox** (§26), **M4 compose** (§27), **M5 home/people/activity** (§24 — what Matt sees as "old" on his phone), **M6 calendar/tasks** (§29), **M7 remaining pickers** (Source/Time frame/relationships, §25.10 tags full-screen, §25.11 address map, header Edit mode, per-tab FAB sheets).
3. Also open: email open/click tracking task (in CRM_BUILD_MISSION.md, other session may own it).

---

# CROSS-AGENT HANDOFF — IDX compliance + CRM mobile + Growth/SEO (2026-06-28)

**Date:** 2026-06-28 · **HEAD:** `467b44d1` on `main` (in sync with origin) · **Branch:** `main`

> This is the current authoritative handoff. The 2026-06-13 full-audit block below is history.

## Shipped this session (all on `main`, pushed, builds green)

1. **IDX seller opt-out compliance (the big one).** Our Spark feed is the full Member/replication feed, so it includes 43 active listings flagged `PermitInternetYN=false` (seller opted out of internet display) + 29 with `IDXParticipant=false`. They were rendering publicly (confirmed a live address in a page title/OG). Fix: migration `20260627150000` adds `permit_internet_yn`/`permit_address_internet_yn`/`idx_participant` to `listings` + backfills; `listing_tile_mv` + `similar_listings_mv` rebuilt with an opt-out filter; `getListingDetail` 404s opt-outs; `getMotivatedListings`/`getPriceDropTiles`/`getPropertyFactsByMls`/`getUpcomingOpenHouses` + the public `/api/pdf/listing` route filter them; `lib/listing-mapper.ts` persists the flags on every sync. **0 opt-outs in either MV; verified live.**
2. **CRM mobile usability.** Smart lists (controls were `opacity-0` hover-only + org lists rendered read-only — superuser now gets edit/delete/share; `SavedViewSidebar.tsx`), email templates + workflows (off-screen action controls → column-collapse + a `⋮` kebab on mobile), and the admin sweep (`/admin/crm/settings/brokers`, `/team`, `/import` tables). All verified at 375px.
3. **Per-broker SMS notification opt-in**, default OFF. `brokers.notify_sms` (migration `20260628140000`), gates `queueBrokerAlert` (lib/crm/broker-alerts.ts), toggle in `/admin/settings` (My Settings). Ops/health alerts to Matt are NOT gated.
4. **Rate limiter fail-open** (lib/rate-limit.ts) — Upstash hit its monthly quota and was 500ing CMA/listing PDFs, AI, semantic search.
5. **Buyer LP** — live "Active in Bend right now" homes rail (prove value before the ask; `app/lp/buyer-listing-alerts/page.tsx`).
6. **SEO content.** 4 resort-community pages deepened with sourced 350-word About sections (`lib/community-seo-content.ts`, rendered via `aboutParagraphs` + a `richContent.aboutProse` in-place override in `app/communities/[slug]/page.tsx`). New `/luxury-homes-bend` page (`app/luxury-homes-bend/page.tsx`, in sitemap).

## NEXT — start here

1. **The 393-subdivision SEO long tail (biggest lever).** Routes are `dynamicParams=true` (every subdivision HAS a page), but only ~33 curated communities/neighborhoods are in the sitemap with rich content. **393 subdivisions have 3+ active listings** (real demand) but thin auto-pages Google mostly never indexes. PLAN: rank subdivisions by `active_inventory × GSC impressions`, batch the top ~15–20 through the SAME pipeline that did the 4 communities — parallel `general-purpose` research agents → §0-sourced ~350-word drafts + source traces → review → add to `lib/community-seo-content.ts` + the sitemap. The §0 + brand-voice agent prompt is proven (see this session's 4-community agents: cite official sources, OMIT anything unverifiable, no em-dashes/semicolons/banned words).
2. **Measure** the 4 community pages + luxury page in GSC in 2–4 weeks. Query `marketing_channel_daily WHERE channel='gsc' AND scope='campaign'` for the target queries (Brasada was pos 9.8, Tetherow 12.8, Broken Top 13.4, Black Butte 18.0, luxury homes bend 10.9). Did they climb?
3. **#1 long-term traffic lever: turn on consistent content publishing.** The marketing engine is built but has shipped ~0 posts (producer freeze). Even 3 quality pieces/week compounds. Get 10 real posts through approve→publish→measure to justify unfreezing.

## Open / unverified

- **Upstash quota:** fail-open fix shipped, but rate-limiting is effectively OFF until the monthly quota resets or Matt upgrades the Upstash plan (billing decision).
- **Anonymous-session consumer path:** identity-stitching code (`identifyAuthenticatedSession`, OAuth callback, `rr_vid` stitch) is correct + deployed, but never end-to-end tested with a real non-admin Google sign-in (admins are correctly skipped; the preview had no consent cookie). 0 google-identified sessions in data is likely "no consumer sign-ins yet," not broken — confirm with one real consumer sign-in.
- **`/luxury-homes-bend`:** built + deployed but not yet visually verified on prod (the headless preview can't render its scroll sections). Curl-check it shows real luxury listings.
- Diagnostic: site traffic is ~190 sessions/30d, 66% direct — acquisition (organic search + social) is the gap; that's why (1) and (3) above matter most.

## Growth diagnostic data (for the next session)

- Traffic sources 30d: direct 126, google 33, gbp 16, facebook 12, rest ~3.
- SEO quick-win queries (page 2, real impressions, 0 clicks): the 4 communities above + "luxury homes bend oregon" (44 impr, pos 10.9) — the luxury page now targets the last one.

---

# CROSS-AGENT HANDOFF — Full Codebase Audit

**Date:** 2026-06-13
**HEAD:** `b67ce2ab8e8e91961cb646f1ceddc3b0a9dd0bd0`
**Branch:** `main`

> This document is the authoritative replacement for the four prior session handoffs (`HANDOFF-homepage-voice-2026-06-13.md`, `HANDOFF-cma-form-twilio-2026-06-13.md`, `HANDOFF_HEATH_LP_2026-06-13.md`, `HANDOFF_CRM_SESSION_2026-06-12.md`) and the `NEXT_SESSION_START_HERE` pointer. It synthesizes a full-universe audit (30-agent fan-out) of the platform. **Note: the working tree was a moving target during this audit** — files were being staged and changed by parallel sessions as agents read them, so treat the working-tree section as a snapshot, not a guarantee.

---

## 1. CURRENT STATE

- **HEAD:** `b67ce2ab` on `main`.
- **Working tree:** 46 entries dirty (20 tracked modifications + 26 untracked files), spread across three in-flight feature threads plus two locked-system documentation overhauls.
- **In-flight features:**
  - **Homepage V6/V7** — `app/page.tsx` rewritten to a "Linear" linear-stack design; new `components/site/HomepageV6*.tsx` island set; `app/globals.css` +1105 unreviewed lines; `next.config.ts` CSP adds `tile.googleapis.com` + `blob:`. **Architecture unresolved** (3D-tiles "OUT" vs CSP/JSDoc that wire live Google 3D Tiles; three competing `parity.json` specs). The rejected cinematic variant (`HomepageCine*`, 12 components) is orphaned and unreferenced.
  - **Trails** — new `app/trails/` index + detail pages, `components/site/Trail*.tsx`, `scripts/trails/*`, and a migration (`20260613040000_trails.sql`) already applied to prod but UNTRACKED in git. DAL exports are correct; the only blocker is a design-token regression in the new components.
  - **TC e-signature** — Phase 2b envelope composer + public signer + sealed PDF shipped 2026-06-12; one live end-to-end test still pending. Two files in this thread hardcode a `.vercel.app` fallback and fail the staging-host gate.
- **Locked-system docs in tree:** brand-voice v2 (`VOICE.md` Five Laws canonical) and the DAL/schema snapshot refresh.

---

## 2. SYSTEM STATUS

One line per system. Counts: ~58 LIVE-HEALTHY · ~22 LIVE-DEGRADED · ~13 BLOCKED (1 BLOCKER) · ~9 UNUSED · ~8 STALE-REMOVE · ~4 UNKNOWN.

### MLS / Listing Sync
- Spark API (SPARK_) — LIVE-HEALTHY; strong SFR-filter discipline, 200/page pagination.
- Production Supabase (`dwvlophlbvvygjfxcrhm`) — LIVE-HEALTHY; all 3 new tables applied.
- sync-delta / sync-full / sync-history-terminal crons — LIVE-HEALTHY.
- refresh-mvs cron + materialized views — LIVE-DEGRADED; no auto-retry/heartbeat, stale tiles up to 15 min if a refresh stalls.
- Schema snapshot + DAL index (G16) — LIVE-DEGRADED; **drifted after 3 new migrations, G16 gate FAILING** (`npm run ci:data-access -- --refresh`).

### CRM / Follow Up Boss
- FUB API + CRM mirror + auto-enroll + FUB delta sync + seller-workflow-pause — LIVE-HEALTHY.
- CRM contacts/inbox/detail/deal/broker dashboard — LIVE-HEALTHY (32 PASS / 3 WARN on e2e; GCal DWD live).
- CRM sequence engine — LIVE-DEGRADED; engine healthy but **all 4 sequences `status='paused'`**.
- CRM lead-identity header — **BLOCKED / not implemented** (Matt's #1: "no idea what lead I'm looking at"), ~20-30 LOC.
- FUB POST /v1/textMessages — LIVE-DEGRADED (FUB cannot POST texts; SMS moves to Twilio post-cutover).
- FUB outreach execution cron — LIVE-DEGRADED; redundant post-cutover.
- `fub_contacts_cache` table — BROKEN / absent in hosted DB; blocks facebook-seller-growth outreach.

### Transaction Coordination (TC)
- TC Phase 1/2a–2f (migration, write, req-docs, contacts, commissions, expenses) — LIVE-HEALTHY; reconciled to the cent ($384K GCI).
- TC Phase 2b e-signature — LIVE-HEALTHY; one live e2e test pending.
- TC Phase 3 field-mapper — UNKNOWN / not started; blocked on Matt's OREF blanks.
- SkySlope API — UNUSED; migration complete, 29 scripts prunable.
- tc_principal_reviews / broker_gcal_tokens tables — LIVE-HEALTHY; add to DAL index on refresh.

### Twilio / SMS
- Twilio account + Messaging Service + inbound webhooks + broker forwards — LIVE-HEALTHY; brand APPROVED; balance $10.86.
- **A2P 10DLC campaign — BLOCKED** (IN_PROGRESS carrier review ~2-3wk; error 30034 on all outbound; ticket #27497858; clears ~2026-06-26 to 07-03, auto-unblocks).
- All outbound SMS (sequence/drip/manual/direct) — BLOCKED; queues until A2P VERIFIED.
- iMessage fallback relay + LaunchAgent — LIVE-HEALTHY / UNKNOWN load status (`launchctl load` to confirm, else brokers miss instant alerts).

### Email
- Gmail DWD (3 mailboxes) + CRM Gmail sync + Oregon disclosure in CRM email — LIVE-HEALTHY.
- Resend (RESEND_) — LIVE-DEGRADED; `mail.ryan-realty.com` unverified, blocks email producers + digest tier.
- CMA signature page ORS 696.820 disclosure — BLOCKED / missing (compliance gap if CMA is first contact).

### Meta / Facebook
- Meta CAPI + Lead Ads webhook + organic/publishing + IG/page tokens — LIVE-HEALTHY.
- **Meta Graph Insights (ad spend) — BLOCKED**; `marketing-snapshot-meta-ads` NOT in vercel.json, zero `meta_ads` rows.
- Meta ad account — LIVE-DEGRADED; 3 PAUSED campaigns + 1 orphan adset active ($47/wk, never recorded).

### Google Suite
- GA4 server + client + consent + caching + AI-referrer + Ads pixels + GBP OAuth/health/digest + GCal DWD + Maps + service account — LIVE-HEALTHY.
- GA4 Data API (reporting) — LIVE-HEALTHY but needs `GOOGLE_GA4_PROPERTY_ID` + service-account creds set.
- GA4 AI Assistants channel group — UNKNOWN (GA4 Admin group not created).
- **GSC ingest — BLOCKED**; no client/cron/snapshots exist.
- **Google Ads API (server v18) — BLOCKED**; cron unscheduled + 3 creds unset, silent no-op.
- **GBP post publishing — BLOCKER**; no cron publishes posts (health check only detects staleness).
- `fetchGbpPostMetrics()` — BLOCKED stub (throws `fetcher_not_implemented`).

### Social Platforms
- Token-heartbeat + OAuth storage (7 tables) + publisher-sweep + publish routes + all 7 platforms (TikTok/LinkedIn/X/YouTube/Threads/Pinterest/Nextdoor) — LIVE-HEALTHY (no content has ever published).
- 11 marketing-snapshot crons — UNUSED; all on disk, none scheduled.

### AI / Producers
- **Anthropic API — NOT an operational blocker.** Real content is produced in-session by the live desktop/Claude Code agent on Matt's *subscription* tokens — not the metered API. The `sk-ant-api03` key wired into the Vercel crons is out of credits, but that only halts the headless autonomous layer (producer-runtime, audit-classifier, inbox-parser), which is frozen (G45) and has shipped zero posts. The 4 queued CMAs + market-report blog can be built in-session without refilling. Refill is needed ONLY to run those crons unattended (Vercel crons can't use desktop subscription tokens — the SDK needs an API key).
- Producer registry + freeze (G45) — LIVE-HEALTHY; frozen 2026-06-09, maintenance-only.
- ElevenLabs / OpenAI / xAI / Replicate — LIVE-HEALTHY. Fal.ai — UNUSED (balance exhausted). Synthesia — LIVE-DEGRADED (never called).
- CMA producer + skill — LIVE-HEALTHY (locked 2026-06-13).
- Action row 72c4ee55 (Laurie McAdam 62285 Deer Trail CMA) — LIVE-DEGRADED; status=`ready`, verified PASS-with-flags, **awaiting Matt's "ship it"**.

### Media / Content APIs
- Unsplash / Pexels / Shutterstock / Apify / detect-fsbo cron / asset library + dedup gate — LIVE-HEALTHY.
- Shutterstock 23 watermarked assets — LIVE-DEGRADED; unlicensed, mockup-only.
- SchoolDigger / NeverBounce / BatchData — UNUSED (provisioned, zero references).

### Infra / Config
- Vercel config / CSP / Sentry / lib/env validation — LIVE-HEALTHY.
- **Staging-host gate — BLOCKED**; 2 files hardcode `ryanrealty.vercel.app` (`tc-envelopes.ts:49`, `seal-envelope.ts:27`).
- Upstash — UNKNOWN (no lib/redis.ts but TikTok OAuth uses it). Inngest / Cursor / GCP_USER_REFRESH_TOKEN / misc env — STALE-REMOVE.

### Site / SEO / Brand / Funnel
- Nav + SEO infra + 4 main lead funnels + WP/Next blogs + measurement-loop wiring — LIVE-HEALTHY.
- Brand voice (VOICE.md, G2/G3) — LIVE-HEALTHY (19-violation baseline to burn down).
- Trails route — LIVE-HEALTHY (not yet in sitemap.ts).
- Heath LP — LIVE-DEGRADED (30-min enroll lag, no instant CMA/mirror, SEO URL misplaced).
- **Homepage V6 — LIVE-DEGRADED** (25 token regressions, 3D-tiles arch unresolved, HomepageCine* orphaned).
- Design system (shadcn/radix-nova) — LIVE-DEGRADED (353 vs 328 baseline token issues).
- Market-report cron — LIVE-DEGRADED (publish blocked by Anthropic credits).

### Dead / Orphaned Crons
- loop-health-check — LIVE-DEGRADED (scheduled but loops STOPPED 2026-06-11). weekly-cycle — UNUSED dead alias. 27 total unscheduled routes on disk; STALE-REMOVE.

---

## 3. FUNNEL HEALTH

Gold standard = `seller-home-value/actions.ts`: instant 0-min enroll, CMA link stamped on the CRM person before first-touch preview, full CAPI+GA4 dual fire, attribution captured at submit.

| Path | Lead Creation | CAPI | Attribution | Enroll Speed | Sequence | Overall |
|---|---|---|---|---|---|---|
| **Seller** | gold | $500 | high | 0-min | paused | 🟢 |
| **Expired** | mirrors gold | $500 | high | 0-min | paused + SMS step-0 blocked | 🟡 |
| **FSBO** | mirrors gold | $500 | high | 0-min | paused + SMS blocked | 🟡 |
| **Buyer** | mirrors gold | $300 | thin | 0-min | paused | 🟡 |
| **Heath** | off-standard | $500 | async-dep | 7.5–30 min | paused | 🟠 |

**Three cross-cutting funnel facts:**
1. **All 4 CRM sequences (plans 69/70/71/72) are `paused`, not `active`** — `enroll.ts` returns "sequence not active", so auto-enroll creates `awaiting_broker` rows that never run. This gates the **email** half of every path, not just SMS. Single highest-leverage unblock: `UPDATE crm_sequences SET status='active' WHERE fub_legacy_plan_id IN (69,70,71,72)`.
2. **All outbound SMS is A2P-blocked** (Twilio, external, ~2-3wk). Expired step-0 and FSBO/seller drips are SMS-first; they queue and auto-fire the first cycle after VERIFIED. Email steps fire fine.
3. **Ad-spend measurement is dead** — `marketing-snapshot-meta-ads` + `marketing-snapshot-google-ads` are unscheduled, so zero spend rows land and the attribution loop has no input. CAPI itself is healthy on every submit (seller/fsbo/expired/heath $500, buyer $300, shared dedup `event_id`).

**Heath deviates from gold standard** (Matt-aware): async `canonicallyTagLead()` instead of synchronous `autoEnrollByFubId()`; no `createCmaRequest()`, no instant mirror, no instant Matt alert; legacy `seller-intent` tag. Open items: golf/tax panel, SEO URL move to `/communities/tetherow/heath` + 301, templatize.

**Compliance:** CRM emails carry the ORS 696.820 pamphlet link; the CMA signature page does not (gap if a CMA is the first-contact doc).

---

## 4. GATE + CI HEALTH

**Four gates fail and block commits sitewide — fix these first:**

1. **`tsc --noEmit` baseline** — PASSES *only after* `rm -rf .next`. The earlier errors were stale `.next` manifest entries pointing at deleted google-calendar OAuth routes, not a code bug. Every downstream `ci:commit-compiles` depends on this clean baseline. (`ci:commit-compiles` / G46 PASSES at 26.5s after the purge.)
2. **G16 Data Access Discipline** — FAIL; schema snapshot + DAL index drifted after the 3 new June migrations (trails, tc_principal_reviews, broker_gcal_tokens). Fix: `npm run ci:data-access -- --refresh` and commit both generated files.
3. **`check-no-staging-host`** — FAIL; `app/actions/tc-envelopes.ts:49` and `lib/tc/seal-envelope.ts:27` hardcode `https://ryanrealty.vercel.app`. Fix: fallback to `https://ryan-realty.com`.
4. **`ci:design-tokens` (G2/G5)** — FAIL; +25 regression (328→353). New Trail* components use hardcoded hex (`#102742`, `#ff5a1f`, `#0b1a2e`, `#ffffff`), arbitrary Tailwind (`h-[64vh]`, `text-[11px]`, `min-h-[460px]`), and hand-rolled cards; also PDF sign flow, LP forms, broker-dashboard.

**Passing (notable):** brand-voice G2/G3 (PASS at 19-violation baseline), G1 DAL boundary, G17 column-quoting, G21 DAL-internal, G8 page-DAL (0 new violators), migration-drift, G6 mockup-parity (PASS but 3 competing parity specs — homepage-v6 / v7-cinematic / base — canonical unresolved), G7 dead-UI, CSP, G45 producer-freeze, G34 structured-data (24 surfaces), nav/canonical/SEO-routes, measurement-loop, G44 process-canon.

**Runtime/operational (not commit-blocking):** A2P 10DLC (external BLOCKING-PRODUCTION), Anthropic credits (external BLOCKING), CRM sequences paused (HIGH), meta-ads/google-ads snapshot crons unscheduled (HIGH/MEDIUM), Resend domain unverified (MEDIUM), CMA ORS disclosure (MEDIUM), GBP post automation missing (MEDIUM), crm-alert-relay LaunchAgent load UNKNOWN (MEDIUM), MV refresh no-retry (MEDIUM).

**Gaps with no gate:** no dead-link detector in CI; no CLAUDE.md prose lint (orphaned v1 spec at lines 272–275 + misdirected line 561); no migration-syntax `ci:schema` check before manual apply; no security-review gate for CSP `blob:` additions.

---

## 5. PRUNE LIST SUMMARY (top 15, highest confidence)

| Item | Type | Why | Conf |
|---|---|---|---|
| `components/site/HomepageCine*` (12 files: CineHero/Closer/Search/DealFlow/Collection/Tools/Sell/Proof/Standard/Guides/Places/Parallax) | orphaned components | Rejected cinematic variant; zero imports in any active route | high |
| 11 `app/api/cron/marketing-snapshot-*` (fub/ga4/gbp/google-ads/gsc/linkedin/meta-ads/meta-page/tiktok/x/youtube) | dead cron routes | Unscheduled; logic consolidated into snapshot-channels. **CONFLICT:** schedule meta-ads + google-ads to repair the measurement loop instead of deleting — resolve with Matt | high |
| Inngest integration (`lib/inngest.ts` + 2 admin send calls + INNGEST_* env) | dead-code module | Scaffolded; no events/subscribers defined; silent no-op | high |
| Synthesia integration (`app/actions/synthesia.ts`, `createSynthesiaVideo`) | dead-code feature | Integrated but never invoked from any route/producer | high |
| `app/api/cron/weekly-cycle` + `optimization-loop` + `sync-verify-full-history` | dead cron routes | Dead aliases / unscheduled, never invoked since freeze | high |
| 24 stale env vars (CURSOR_API_KEY, 3× ELEVENLABS_VOICE_ID*, SCHOOLDIGGER_*, GCP_USER_REFRESH_TOKEN, REMOTION_GOOGLE_MAPS_KEY, NEVERBOUNCE_API_KEY, META_FB_PAGE_NAME, NEXT_PUBLIC_FUB_*, NEXT_PUBLIC_GTM_CONTAINER_ID, TWILIO_PHONE_NUMBER) | env vars | Zero references / superseded / vendor-display-only | high |
| `app/api/maps/cma-228-soft-tail/route.ts` | dead route | Slug never registered in `lib/cma-map.ts`; returns null buffer; CMA never finalized | high |
| SkySlope legacy scripts (~29: `scripts/_skyslope-*`, `scripts/skyslope-*`) | infrastructure | TC migration complete; no new SkySlope work | high |
| 23 watermarked Shutterstock assets (`data/asset-library`, `out/asset-audit/catalog.json`) | assets | Unlicensed, visible watermarks; replace or remove before any deliverable | high |
| `scripts/build_cma_wrapper.py` | script stub | Copy-relabel stub; §0 wrong-property risk; never wired | high |
| `fetchGbpPostMetrics()` stub (`lib/google-business-profile.ts`) | code stub | Always throws `fetcher_not_implemented`; no consumer | high |
| `.claude/skills/skyslope-form-compliance-{v1-snapshot,workspace}/` | skill snapshots | Historical backups; real skill at `skyslope-form-compliance/` | high |
| Old session handoffs (`SESSION_HANDOFF_2026-06-01*.md`, 3× `site-consistency-audit-2026-06-*`, `ultracode-site-consistency-kickoff.md`) | docs | 12+ days old; superseded by THE LOOP + this doc; archive | high |
| CLAUDE.md lines 272–275 (gold #D4AF37/#C8A864, AzoSans, Cream #F2EBDD) + line 561 caption cross-ref | CLAUDE.md sections | Orphaned v1 spec contradicted by Design System v2 + captions lock (Amboqia) | high |
| `project_heath_lp_charts.md` "BROKEN" claim | project memory | Contradicted by commit d3a4549a (chart FIXED); update or delete | high |

**Conflicts the next session must resolve before acting:** (a) marketing-snapshot crons — schedule meta-ads/google-ads (repair loop) vs delete all 11 (consolidated); (b) 3D-tiles CSP — homepage 3D is "OUT" but it is wired to the V6 city-tiles island and the trails 3D viewer (`TrailViewer3D` is the legitimate consumer); (c) the 155 marketing/video/social sub-skills are "maintain, do not delete/expand" under the G45 freeze, not a true prune.

---

## 6. COMMIT SEQUENCE

Working tree = 44+ files across three feature threads + two locked-system doc overhauls. Dependency-ordered; each unit commits clean against `ci:gates`.

**Land first (autonomous, clears blockers):**
- **Unit 1 — Restore tsc + ci:commit-compiles (trail fix).** `lib/data/index.ts`, `docs/DAL_INDEX.md`, `docs/DATABASE_SCHEMA_SNAPSHOT.md`. The four trail exports (`getTrailsIndex/getTrailDetail/getTrailGeoJSON/getTrailHomes`, lines 541–548) already resolve to implemented files; `getTrailElevation.ts` stays unexported. `rm -rf .next && npx tsc --noEmit` to confirm clean, then `npm run ci:data-access -- --refresh` to clear G16 drift. **Must land first — every downstream unit depends on a clean tsc baseline.** SAFE-AUTONOMOUS. Risk LOW.
- **Unit 6 — Staging-host gate fix.** `app/actions/tc-envelopes.ts`, `lib/tc/seal-envelope.ts` → fallback `https://ryan-realty.com`. Land early to stop the gate blocking every commit. SAFE-AUTONOMOUS. Risk LOW.
- **Unit 2 — Track trails migration.** `supabase/migrations/20260613040000_trails.sql` (already applied to prod; table + GiST/GIN indexes + 3 RPCs the Unit 1 DAL calls). SAFE-AUTONOMOUS. Risk LOW.

**Then autonomous feature/docs:**
- **Unit 3 — Trails pages + components** (`app/trails/*`, `components/site/Trail*.tsx`, `scripts/trails/*`). BLOCKED on the +25 design-token regression — fix hex→tokens, hand-rolled→`<Card>`, arbitrary utils→ladder first. Optional `/trails` sitemap seed. SAFE-AUTONOMOUS once tokens fixed. Risk MEDIUM until fix.
- **Unit 4 — CMA map + Deer Trail routes** (`lib/cma-map.ts` cma-62285-deer entry, `app/api/maps/cma-62285-deer/route.ts`, `public/drafts/cma-62285-deer/`). Map infra only; CMA delivery is separate. SAFE-AUTONOMOUS. Risk LOW.
- **Unit 7 — Brand voice v2 → VOICE.md canonical** (`VOICE.md`, vocabulary, baseline, gate). Already locked/approved by Matt; records live state. Risk ZERO.
- **Unit 8 — Render-worker + script infra** (`scripts/render-worker.mjs`, `scripts/ultracode-audit.sh`). launchd plist stays unloaded by design; staged iMessage notify stays staged. SAFE-AUTONOMOUS. Risk LOW.
- **Unit 9 — Docs + handoffs** (this file, tools/skills inventory, brand-voice exemplars, experience/tools docs). Fix the stale `project_heath_lp_charts.md` claim here. SAFE-AUTONOMOUS. Risk LOW.

**Hold for Matt:**
- **Unit 0 (pre-flight, gates Unit 5 ONLY) — Resolve 3D-tiles + parity.json architecture.** Decide: (a) CSP for the trails viewer + a poster-first homepage island vs a full 3D hero, (b) is `homepage-v7-cinematic/parity.json` dead, (c) does G6 enforce all three parity surfaces or only v6. NEEDS-MATT.
- **Unit 5 — Homepage V6 rebuild + CSP** (`app/page.tsx`, `app/globals.css` +1105 unreviewed, `next.config.ts`, V6 parity + components). Depends on Unit 0. NEEDS-MATT (major surface + unresolved arch). Risk HIGH.
- **Unit 10 (separate session) — Schedule the 3 funnel-critical crons** (`vercel.json`: meta-ads, google-ads + 3 env vars, GSC ingestor not yet built). Do NOT bulk-revive all 27 dead crons. NEEDS-MATT (changes prod spend recording; a targeted exception to the loop-stop, not a loop restart). Risk MEDIUM.

---

## 7. EXTERNAL BLOCKERS

- **Twilio A2P 10DLC** — campaign `CMb1d8153a...` IN_PROGRESS under carrier review (~2-3 weeks; brand APPROVED; error 30034 on all outbound; ticket #27497858; expected clear ~2026-06-26 to 07-03). Auto-unblocks all SMS on VERIFIED. The only lever is the support ticket. The number to port/operate is **541.703.3095** (FUB-tracked bio number).
- **Anthropic API credits** — the metered `sk-ant-api03` key in the Vercel crons is exhausted, but this is NOT how Ryan Realty produces content. Real production runs through the live desktop/Claude Code agent on Matt's subscription tokens (no metered API). The exhausted key only stops the headless autonomous producer layer, which is frozen (G45) and unused. Refilling is OPTIONAL — the 4 queued CMAs + market-report blog get built in-session instead. The autonomous cron path stays dormant until credits are added or the crons are retired.
- **Apify** — currently under the **$200 cap**; graceful-degrades if hit. Cap resets ~the 18th; monitor.

---

## 8. SINGLE RECOMMENDED FIRST ACTION

**Run the Unit 1 tsc/trail fix and land it.** Purge the stale cache and confirm the baseline, then clear the G16 drift, then commit the three files together:

```
rm -rf .next && npx tsc --noEmit          # confirm clean (errors were stale .next manifest entries, not code)
npm run ci:commit-compiles                 # G46 PASS
npm run ci:data-access -- --refresh         # regenerate DAL_INDEX.md + DATABASE_SCHEMA_SNAPSHOT.md (clears G16)
# commit: lib/data/index.ts, docs/DAL_INDEX.md, docs/DATABASE_SCHEMA_SNAPSHOT.md
```

Nothing in the audit is more urgent for *unblocking the build*: every other commit's `ci:commit-compiles` depends on this clean tsc baseline, and G16 is failing right now. The genuine production blockers (Twilio A2P, Anthropic credits) are external and cannot be moved by code this session. Immediately after Unit 1, land Unit 6 (staging-host gate) so commits stop failing sitewide.
