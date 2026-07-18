# Admin Rebuild — Build Progress

Live log of what has shipped to `main`, verified. Newest first. Companion to the
spec package (`README.md`, `00-REASONING…`, `01-DECISIONS…`) and the per-feature
specs in `specs/`.

Verification bar for every entry: tsc + esbuild/`next build` clean, and the real
behavior exercised in the browser (authed as matt@ via a service-role magic link to
the local callback) or integration-tested against the real DB.

## Session 2026-07-17 (rebuild v3) — Phase 0 reconciliation + Pain #3/#4

**Baselines @ `18f2d890` (HEAD == origin/main at session start, after pull):**
- vitest: 254 files / **2,881 tests, exit 0** (chips added 4 files / 20 tests since v2).
- `npm run ci:gates`: **exit 0** ("All gates accounted for").
- Stashes: exactly the 2 pre-existing (SellerLPForm WIP, HideOnLP WIP) — inventoried
  v2, untouched. Per-commit assertion: count stays 2, nothing popped/created.
- Chip reconciliation: clobber-class fix (92fcf50a + 36cbb0b2 + b6df9669), multi-notify
  (450216c3), pre-push stamp hook (6fc8680f + npm run push), G50 ci:composer-discipline,
  G51 ci:resume-toggle — ALL LANDED. Spec-03 person-page fetch rebuild (task_c4fbba7e)
  NOT landed (crm/[id]/page.tsx still 717 lines, untouched since 450216c3) → Pain #4
  builds SendPanel against the current page; the fetch rebuild stays chipped.
- **Pain #3 measured baseline** (audit shell-ia.md §5.1/§14 + fresh verification):
  nav items superuser **56 / 5 menus**, broker 30, report_viewer 17; **8 coexisting
  nav systems**; ⌘K palette covers **4 of 56** destinations, is **double-mounted**
  (two ⌘K listeners → stacked dialogs); hardcoded independent route lists in shell
  components: **3** (buildAdminNav two-pass regroup, CrmMobileTabBar tab array,
  ConsoleCommandPalette NAV array). `lib/admin/nav.ts buildNav(ctx)` exists (9 unit
  tests) and is UNWIRED. None of the §B1 canonical tops exist as routes
  (`/admin/inbox`, `/admin/prospecting`, `/admin/transactions`, `/admin/performance`).

**D9 (Matt, micro-batch): locked 8 + Prospecting · ≈35-item superuser budget with
children dropdowns · redirect-bridge every legacy route · mobile tabs stay
Home/Inbox/People/Deals/Activity (annotated in the one config).**

**Pain #3 pre-registered thresholds (written BEFORE building, from the measured
baseline, tightened by D9):**
1. **One nav source:** desktop top bar + mobile sheet + bottom tab bar + ⌘K palette
   all render from `buildNav(ctx)` / the one DESTINATIONS config. Hardcoded
   independent route lists in shell components: 3 → **0** (grep-proven).
2. **Item count:** superuser 56 → **≤ 39** (D9 budget ≈35 + tolerance for the
   Prospecting children), broker 30 → **≤ 25**. Counted from the rendered nav.
3. **Zero role dead-ends:** every visible nav item, clicked as superuser AND as a
   scoped broker in an authed browser vs the real DB, lands on a 200 page (no
   access-denied bounce). Baseline: 6 audited dead-end classes.
4. **Palette:** 4/56 → **100% of capability-visible nav destinations + children**;
   exactly ONE ⌘K listener / ONE dialog (double-mount dead).
5. **Mobile == desktop:** the sheet renders the same capability-filtered sections as
   the desktop bar; tab bar = the D9.4 five, derived from the config.
6. **Legacy routes:** zero deletions; the 4 missing §B1 canonical tops become
   redirect-bridges to the live pages (old URLs keep working per D9.3).

## Session 2026-07-16 (rebuild v2) — Phase 0 reconciliation

**Baselines @ `707a52a5` (HEAD == origin/main at session start):**
- vitest: 247 files / **2,841 tests, exit 0**.
- `npm run ci:gates`: **exit 0** (133 gate files accounted for — wired, off-chain, or baselined backlog).
- **Litmus current state** (evidence: `audit-reports/send-center.md §1.7` + fresh code check):
  desktop ≈ 10–12 clicks across 4–5 page loads + a 30–60 s SYNCHRONOUS build
  (`startCmaForContactAction` runs `buildCma` in-action); approval only at
  `/admin/cmas/[slug]`. Mobile: **impossible** — `crm/[id]/mobile-detail.tsx` renders
  Info/Activity/Comms/Homes/Notes/Calendar tabs only, no CMA/send surface. No
  `?intent=` handling on `/admin/crm/[id]` (grep: 0 hits). No `sendDeliverable` /
  `buildDeliverable` action exists. The notification half EXISTS: `lib/crm/broker-alerts.ts`
  queues an SMS whose body links `ryan-realty.com/admin/crm/<personId>` (no intent param yet).
  `withSendIdempotency` (lib/crm/idempotency.ts) confirmed FAIL-OPEN on ledger errors
  (the 7108d338 fix holds — no fabricated `{ok:true}`).
- **Pre-existing git stashes (2) — inventoried, left untouched, NOT this session's:**
  `stash@{0}` "preserve concurrent-session WIP (SellerLPForm) during chrome-fix rebase":
  its SellerLPForm/actions `pagePath` hunks are ALREADY on main; its
  `KbHero.client.tsx` `formSlot` hunk is NOT landed (another session's consumer-facing
  WIP — owner's call, not dropped). `stash@{1}` HideOnLP WIP — superseded by the landed
  `chrome-routes` refactor. **This session creates no stashes; the per-commit assertion
  is: stash count stays exactly 2 (these two), nothing popped, nothing added.**

**Bucket classification (seeded Phase 0; refined in Phase 1):**
1. **DONE-AND-GATED** — composer double-send fix (`05ec175b`, G50 `ci:composer-discipline`
   + integration test); content-write guards (`979350ad` + `ci:admin-content-authz`);
   RC1 conversation model + inbox flip (4 commits, browser-verified, unit-tested);
   RC7 save→sign-in→resume (browser-verified + adversarial review, idempotent-add);
   public-bundle drop (`fd05b80e`, next-build-verified); group badge + delivery chips
   (`35c61e01`, `ad0f9fde`); foundation primitives (`ba03ff07`). Session-start chain: 133 gates green.
2. **DONE-BUT-UNVERIFIED** — deep-link `next` preservation (`d9e92c63`: page renders
   carrying next, but the full expired-session → login → land-on-lead path not E2E-proven);
   mobile sign-out sheet (Radix — harness couldn't open it).
3. **PLACEBO-OR-BROKEN** (audit-cited code traces, still open) — desktop people-list raw
   `sms:`/`tel:` links bypass the compliance chain (`PeopleListView.tsx:699-721`);
   `getGroupReplyParticipants` excludes broker-initiated groups (deferred to spec 02);
   send domain absent on mobile (`mobile-detail.tsx`); contact-point jsonb mirror has a
   non-mirroring third writer (`crm.ts:1228-1251`); `savePhoneNumbersAction`
   delete-then-insert without transaction (`crm-person-detail.ts:167-187`).
4. **SUPERSEDED-BY-DIRECTIVE** — a separate "Today home" (PROGRESS Next-#2 wording):
   Matt's "one home, not three" (2026-06-16) makes `/admin/broker-dashboard` THE home;
   `/admin` redirects to it. Do NOT build a Today home. Spec 01's `/admin` → Today
   route table entry is reconciled to this.
5. **INTENDED-BY-DESIGN / DO-NOT-CONSOLIDATE** — the `components/admin/**/mobile/*`
   tree (purpose-built phone UX); the single `ConsoleShell`; the one-home
   broker-dashboard; the parked e-sign code (dormant/unrouted/guarded per D1). No
   delete/merge/dedup action against these without an explicit Matt directive.

**Pain thresholds (set from baselines, written BEFORE building):**
- Pain #1 (litmus): from "≈10–12 clicks / 4–5 page loads / 30–60 s sync build desktop;
  impossible on mobile" → **≤ 3 taps and ≤ 30 s on a phone from notification to CMA
  kick-off** (pending Matt's budget confirmation in the Phase-0 micro-batch).
- Pain #2 (comms), thresholds written 2026-07-17 BEFORE the demonstration, from the
  audit baseline ("2–6 s dead air, no pending state, sent text stays in the box,
  double-taps produce real duplicate texts, group pixel-identical to 1:1"):
  1. **Double-tap Send → exactly ONE delivery**: one Twilio SID, one `sms_out`
     timeline row, one `crm_message` row (DB-verified, not UI-verified).
  2. **Sent-state resolves ≤ 5 s** from tap: button disables instantly, the box
     clears, the message renders in the thread — no stuck "sending", no re-tap
     ambiguity.
  3. **Group vs 1:1 labeled**: a group thread renders the "Group · N" badge in the
     inbox thread + person timeline; a 1:1 renders none.

## Shipped

### Adversarial audit of the shipped work (Pain #3 + #4) — 4 HIGH found, all FIXED + browser-verified

A 28-agent find→adversarially-verify workflow (4 lenses × the two shipped
commits, every finding refuted-by-default unless the failure scenario provably
held at HEAD; 4.07M tokens) ran against `0add5cd8` (one-nav) + `44cd8d5f`
(unified-send v1). 17 findings survived verification (4 HIGH, 4 MED, 9 LOW).

**HIGH — all FIXED (commits `3fbd32ce` + `2cb4bc8e`):**
1. **`/admin/financials` unguarded** — the one-nav capability map declares
   `financials.view` superuser-only, but the page + `getTcFinancials` +
   `addTcExpense`/`archiveTcExpense` never enforced it → a broker typing the URL
   read the full brokerage P&L and could add/archive expenses. **Fixed**:
   `requireAdminPage` + `checkAdminAction('financials.view')` in-body.
2. **`/admin/commissions` unguarded** — same class; worse, `updateTcCommission`
   admitted `role='broker'` with no row scope → a broker could read EVERY
   broker's GCI/compensation and edit any broker's split/fees. **Fixed**: page +
   action guards on `commissions.view`.
3. **`/admin/approval-queue` + its API unguarded** — `approvals.act` is
   superuser-only in the map, but the page + `POST …/action/route.ts` accepted
   any admin role → a broker (or report_viewer) could approve marketing-brain
   actions for public auto-publish, or kill/reshape the queue. **Fixed**:
   `requireAdminPage` + `requireAdminRoute('approvals.act')`.
   *(1–3 were PRE-EXISTING holes the one-nav commit's map surfaced — the map
   claimed "nav and access can never disagree"; these routes falsified it. Now
   true. Browser-proven both ways: Paul→access-denied on all 3 + API 403;
   Matt→all 3 load. 5 regression tests: `lib/crm/tc-money-authz.action.test.ts`.)*
4. **Newsletter chip one-tap unsubscribe** — a regression I introduced in
   `44cd8d5f`: dropping `newsletterSendAction` from the ContactQuickActions
   mount flipped the chip into the bare one-tap toggle, so an accidental tap
   opted a subscribed contact out with no confirmation. **Fixed**: confirm
   before the (one-way, compliance-sensitive) unsubscribe.

**MED — FIXED**: SendPanel's 5 flows shared one `useTransition` → a running
build relabeled every tab's button "Sending…"; now per-flow (`busy()`). Also
addressed in the v1 increments below: the CMA tab now shows in-flight drafts
(inc. 3), the newsletter send joined the A5 idempotency ledger (inc. 4).

**MED/LOW — logged, NOT yet fixed (handed to the spec-03 chip, non-blocking):**
report_viewer resolves to UNRESTRICTED CRM scope (latent — zero report_viewer
rows exist today; `lib/crm/scope.ts` admits every contact for a non-broker-mapped
admin); `getLatestNewsletterIssue` (News-tab subject) can differ from
`resolveCurrentNewsletter` (what actually sends); newsletter one-off can re-send
an already-delivered issue with no warning; `/admin/operations` echoes the
same map-vs-page gap (settings.system superuser-only in nav, page ungated —
lower blast radius, plumbing); the People mobile-tab lights on non-tab
`/admin/crm/*` routes; the inbox unread badge is still wired-to-nothing (spec 02
writer). None is a data-loss or disclosure hazard at the level of the four HIGH.

### Pain #4 — unified send, increments 2–4 (SHIPPED after v1)

- **inc. 2 — the SendPanel reaches phones** (`72c609e8`): the mobile contact
  detail had NO send domain (audited RC3 gap — a broker on a phone couldn't send
  anything). The SAME `ContactSendCenter` element is hoisted once and rendered at
  the top of the mobile Info tab. Browser-verified in the 390px frame: dialog
  opens with all 5 tabs, zero console errors. Also fixed a self-audit find: the
  c48ef5a2 baseline ratchet wrote the key at the JSON top level (a no-op the gate
  ignored) — corrected to `files`, 718 → 707, verified enforced.
- **inc. 3 — the CMA tab tells the whole story** (`43e56748`): non-final CMAs
  render as status rows ("Building — you get a text when ready" / "Draft — review
  it") with a working `/admin/cmas/[slug]` review link, so a broker whose draft
  is minutes from ready no longer sees "No finalized CMA yet". Verified live on a
  real draft.
- **inc. 4 — newsletter one-off joins the A5 ledger** (`5ad5b1f7`): it was the
  only deliverable send outside `crm_idempotency_keys`. Per-attempt key from the
  SendPanel → `withSendIdempotency`: duplicate submit = one email, failed send
  releases the key. Regression test locks it.

### Pain #3 — ONE nav, ONE IA (the shell pass) — DEMONSTRATED against the pre-registered thresholds

The capability-projected nav (`lib/admin/nav.ts` DESTINATIONS + `buildNav`) is now
THE source for every nav surface: desktop top bar, mobile hamburger sheet, phone
bottom tab bar, and the ⌘K palette. The 200-line two-pass `buildAdminNav` regroup
(the audited source of ≥4 dead-end regressions) is DELETED — `admin-nav.ts` is a
thin adapter (`toShellSections(buildNav(ctx))` + `buildAdminMobileTabs`) carrying
zero route literals. New gate **G52 `ci:admin-nav-source`** locks it: no consumer
`/admin` href lists, every DESTINATIONS href resolves to a live page on disk, one
palette mount.

**Threshold results (all 6 MET; authed browser vs real DB, dev server):**
1. **One source:** hardcoded route lists in shell components 3 → **0** (regroup
   deleted; CrmMobileTabBar takes a `tabs` prop; palette takes `sections`).
   Gate-proven (`ci:admin-nav-source` would fail the old shapes).
2. **Item count:** superuser 56/5 menus → **39/8 destinations** (unit-locked);
   broker 30 → **22**. Cut items stay reachable where live surfaces link them
   (FAB: New contact + Compose; dashboard panels: Alerts & reports; CRM-settings
   hub: Import; analytics ReportCatalog: Hot leads + Live visitors).
3. **Zero role dead-ends:** as matt@ all 39 hrefs → 200 on their own page; as
   paul@ (real broker session) all 22 → 200 INCLUDING the expireds detail row
   (`/admin/expired-listings/20260424002209630735000000` renders — audited
   dead-end class #2 killed by re-gating `expired-listings/layout.tsx` from
   superuser to any-admin-except-report_viewer per spec 01 §13.3; report_viewer
   still bounced, matching CMAs/BPO). No over-widening: paul@ navigating
   `/admin/listings` still lands on `/admin/access-denied`.
4. **Palette:** coverage 4/56 → **39/39 superuser, 22/22 broker** (fed the same
   sections); ⌘K opens exactly ONE dialog (was two stacked), toggle-close proven
   (`data-state="closed"`), zero "(brand admin)" labels.
5. **Mobile == desktop:** sheet renders the same projected sections; tab bar =
   the D9.4 five (Home/Inbox/People/Deals/Activity) derived from `tab`
   annotations in the one config — verified live (aria-current on Inbox), and a
   role lacking a surface loses the tab (report_viewer → Home only, unit-locked,
   with a per-count grid class so a short bar renders full-width).
6. **Legacy:** zero deletions; the 4 missing §B1 canonical tops
   (`/admin/inbox`, `/admin/prospecting`, `/admin/transactions`,
   `/admin/performance`) are live redirect bridges (browser-verified:
   `/admin/inbox` → renders "My Inbox").

**Capability-map corrections (nav must not lie):** `performance.view` +
`content.listings` → superuser-only until specs 06/08 build the scoped
broker pages (granting them now would render dead-ends into su-only
`/admin/analytics` and `/admin/listings`); `settings.templates` +
`settings.automations` → `['broker']` (pages are broker-accessible and both sat
in every role's old nav — the cutover strips no daily broker surface); new caps
`settings.profile` (['broker'], /admin/brokers), `settings.crm` (su),
`settings.system` (su). **Deliberate broker menu reductions per LOCKED
decisions, pages still URL-reachable (flag for Matt):** Newsletters + Ad links
(A1: content.marketing = su), Commissions + Financials (D4), Signing + Sign-off
(D1 e-sign park).

**Adversarial review (3 foreground skeptics: role-access / client-behavior /
gates-build) — 2 introduced regressions found, FIXED before commit:**
- HIGH(UX): top-bar `sectionActive` wasn't longest-match → People double-lit
  alongside Inbox/Settings on every `/admin/crm/*` route. Fixed with
  `bestShellNavHref` (shared, in the one nav source) + regression test
  (exactly-one-section-active over 7 routes); browser-proven on
  `/admin/crm/inbox` (lit == ["Inbox"]).
- MED(UX): `grid-cols-5` squished a 1-tab role's bar → per-count static class
  map. Also hardened the gate's href regex (backticks) per review note.
- Confirmed pre-existing, left + documented: a broker with NULL `broker_id`
  would dead-end on Brokers (no such user exists; both real brokers carry ids).

**Data-loss checklist (in writing):** (1) What data can this change write or
delete? None — the change is nav projection + one layout gate + redirect
bridges; zero mutations added. (2) Can any existing writer now write to the
wrong place? No — no writer touched; the expired-listings layout change affects
page RENDER access only (its mutating actions carry their own guards).
(3) Worst-case failure? A mis-projected nav hides an item (recoverable by URL;
nothing destructive). (4) Rollback? Single revert of the commit; no migration,
no data shape change.

**Baselines:** vitest 254 files/2,881 → 254/2,886 (5 net new: shell projection,
mobile tabs, single-active regression; nav tests rewritten for the new shape),
exit 0. Full `ci:gates` green including new G52 (chain output tailed to
scratchpad gates-after.log); `ci:crm-mobile-track`'s Reporting/Workflows/
Templates menu contract re-pointed at the one source (same contract, new file).
tsc + esbuild clean.

### Pain #4 — unified send v1: THE SendPanel + duplicates dead + sync-build entries closed — SHIPPED (spec-03 full pass handed off)

Scoped per the v3 brief: the spec-03 person-page fetch rebuild did NOT land (chip
task_c4fbba7e still open), so this builds against the current page and does NOT
start the fetch rebuild. **One send surface per concept now exists**:
`ContactSendCenter` is THE SendPanel — 5 tabs (CMA · Opinion · Report · News ·
Listings), suppression-blocked up front, every send routed to the existing
guarded actions. New in it: the **Newsletter tab** (subscribed state + latest
issue + one-off send via `sendNewsletterToContactAction`), the **CMA build
affordance** routed to the ASYNC kick-off sheet (`?intent=cma` → the litmus
`kickoffCmaCore` path — idempotent, version-chained, notify-on-ready), and the
**BPO build affordance** (deterministic builder, `resolveWritableBpoSlot`-guarded
so double-taps can't clobber).

**Killed on the page (the audited duplication):** the standalone
`ReportSubscriptionsPanel` mount (report management lives in ContactQuickActions'
sheet; report SEND lives in the SendPanel only — the sheet's send-now prop
unwired); the duplicate inline saved-search assign form (creation = SendPanel
Listings tab, SAME writer `createListingAlertForLead` verified — removal stays
with the list); ContactQuickActions' newsletter send-now (its sheet degrades to
the plain subscribe toggle = management only); and **the last synchronous
30–60 s CMA build entry** — `OwnedHomeCard`'s "Generate comp" form
(`startCmaForm`, the audited timeout-prone path) is now a "Build CMA" link into
the async sheet. `startCmaForm`/`assignSavedSearchForm` bindings dropped from
the page; person page 717 → **698 lines** (706 after the mobile send mount).
**Baseline-ratchet correction (self-audit):** the first ratchet edit wrote the
key at the JSON top level instead of inside `files` — a no-op the gate ignored
(commit c48ef5a2 claimed 718→698 but shipped a stray key). Fixed: stray key
removed, `files` entry properly ratcheted **718 → 707** and verified enforced
(current == baseline; any growth now fails).

**Adversarial review (read-only skeptic, 5 probes): all REFUTED** — no other
render sites of the changed components (mobile tree untouched); every
previously-possible operation still reachable (market-report send, subscription
management incl. frequency/active with send-now hidden, newsletter toggle+send,
saved-search create/remove); `.bind` type contracts verified against the action
signatures; BPO double-build safe via the version-chain slot; design-tokens
clean. Known nuance (deliberate, flagged): silent saved-search assign (no
immediate email) is gone until spec-03's `immediateSend` override — the Listings
tab always emails current matches.

**Browser-demonstrated (dev server, authed matt@, real DB):** person page
renders with the assign form + standalone report panel GONE; SendPanel opens
with the 5 tabs; News tab shows the real "The Bend Brief · July" sent issue
with an enabled send (not tapped — real email); `?intent=cma` auto-opens the
kick-off sheet pre-filled ("Brent Babin · 1694 NW Fields St, Bend" pulled from
their message, draft-first copy intact); zero console errors.

**Data-loss checklist:** (1) writes/deletes: none added — UI recomposition over
existing guarded actions; the only removals are duplicate FRONTENDS of actions
that remain wired elsewhere on the same page. (2) wrong-place writes: no writer
touched. (3) worst case: a send affordance hidden (recoverable; every action
verified reachable). (4) rollback: single revert, no migration.

**Handed off (spec 03 full pass):** the `sendDeliverable` unified action +
`build_state` columns + polling chips + inline preview/approve + mobile-tree
send domain + the deeper merge of the CMA/BPO glance-cards into the panel.

### THE LITMUS (Pain #1, D8) — notification → pre-filled CMA kick-off — DONE (prod-build browser-demonstrated)

**The first feature-build commit of the v2 session (litmus-first ordering held).**
Full evidence + tap-by-tap trace + timings: [`LITMUS.md`](LITMUS.md). Summary:
a NEW lead texting "What is my home at 20695 Town Dr in Bend worth?" through the
REAL signed Twilio webhook → person auto-created → broker-alert SMS body carries
`ryan-realty.com/admin/crm/<id>?intent=cma` (seller-intent detected) → tapping it
lands on the person page with the **CMA kick-off sheet auto-open, address
pre-filled from the message** → one tap kicks off the standard draft-first async
build (row in /admin/cmas) → the worker builds it (proven: $560K/9-comp draft)
and **texts the broker a canonical review link**. Measured on the production
`next build`: **2 taps, ≈17.5 s** (budget ≤3 taps/≤30 s — MET). Nothing is ever
auto-sent (§0/D8 hold; kick-off sends no lead email, no broker email, no GA4
conversion).

New pieces (wired the EXISTING pipeline, no re-implementation): `lib/crm/
seller-intent.ts` (intent + address extraction, 9 unit tests) · `?intent=cma`
handling + `CmaKickoffSheet` on `/admin/crm/[id]` (both trees, no Radix) ·
`app/actions/crm-cma-kickoff.ts` → `lib/crm/cma-kickoff.ts` (auth in-body;
idempotent; dedupes to open builds) · `createCmaRequest` gains
`crm-kickoff` source + notify gating · worker `notify_broker_sms` ready-text ·
deep-link query preservation (middleware `x-search`) · migration
`20260717120000_cma_open_action_unique` (applied to hosted).

**Adversarial review (3 skeptics, data-loss checklist answered in writing) —
findings FIXED before commit, then re-reviewed:**
- HIGH: kick-off could clobber an existing (possibly delivered) `cmas` row via
  upsert-by-slug → **existing-row guard**: never enqueues over an existing row,
  returns `alreadyBuilt` + review link; locked by int test ("never clobbers…").
- HIGH: aborted-POST retry could render a fabricated success while the sibling
  request later failed → `inFlight` marker + client poll loop with HONEST
  give-up (`cma-kickoff-client.ts`, 6 unit tests).
- MED: TOCTOU double-enqueue (two keys, one slug) → partial unique index on
  open `content:cma` rows (DB backstop, int-tested) + 23505 attach fallback.
- MED: silently-attached second kicker → timeline stamp + honest copy.
- LOW: ready-text linked the vercel.app alias (strips auth cookies) → canonical
  host; LP-subdomain branch now overwrites `x-search` (header hygiene); queue
  link → next/link (bfcache).
- Auth skeptic: unauth/non-admin/out-of-scope all blocked (verdict: no
  HIGH/MED); SMS-body cannot shape the alert URL or intent.

**Verification trace (data-side proof):** before tap: 0 `cmas`/0 action/0 idem
rows → after: exactly 1+1+1 + one timeline stamp; nothing else changed. Double-
tap + new-key + concurrent-insert all proven single-enqueue (int tests vs real
DB, self-cleaning). Fixture fully cleaned after demo (zero-residue check in
`tmp/litmus-cleanup.mjs`).

**Baselines vs session start:** vitest 247 files/2,841 → **250 files/2,861**
(20 new tests incl. the concurrent multi-notify cases), exit 0. `next build`
exit 0 ×4 (prerender intact — middleware/layout changes safe).

**Per-commit protocol artifacts (commit `450216c3`, pushed + verified on origin):**
- **Gate chain (auditable artifact):** the full `ci:gates` chain ran GREEN inside
  the new pre-push hook on the exact pushed tree — hook output:
  `✓ ci:gates OK` → `✓ next build OK` (scratchpad push.log; ran twice, green
  both times). Baseline maintenance in the commit: file-size re-baseline (the
  person page +8 for the litmus mount — justification below, payback chip
  task_c4fbba7e), email-send-gated line re-key 401→434 (same internal send).
- **Stash assertion:** `git stash list` before and after commit = exactly the 2
  PRE-EXISTING stashes (stash@{0} SellerLPForm WIP — its KbHero formSlot hunk
  is another session's unlanded work; stash@{1} HideOnLP, superseded). Nothing
  popped, nothing created, no held-back files.
- **Landed verification:** `git show origin/main` contains the verified hunks
  (clobber guard, seller-intent, sheet, worker notify — spot-checked);
  `origin/main == local HEAD == 450216c3`. Vercel production deploy
  `dpl_D41K6BwFj8Nccb7EMYpGaiYtM8Ew` triggered for the SHA.
- **Push transport incident:** the NEW pre-push hook (37cd928a, ~10 min of
  gates+build) outlives GitHub's ssh idle window — git connects BEFORE the
  hook, so the pack write died with SIGPIPE (exit 141) twice AFTER the hook
  passed. Pushed via the hook's own `SKIP_LOCAL_GATES=1` escape hatch,
  justified: the identical tree had just passed the full chain inside that
  same hook invocation. Hook redesign chipped (task_5166b360).
- **Concurrent-session provenance:** the commit deliberately includes the chip
  session's attach-multi-notify work (task_4907bb53: `cma_action_append_notify`
  RPC + list-shaped notify contract + worker fan-out + int-test cases) —
  waited for tree quiescence, applied their RPC migration to hosted, verified
  the JOINT tree (tsc + 2,861 vitest + gates + build). Two stray untracked
  scripts from a weekend-events session (`scripts/build_weekend_events_*`) were
  swept in by `git add -A` — additive, standalone, harmless.
- **File-size justification (ratchet growth, sanctioned path):** crm/[id]/
  page.tsx 710→718 (+8) for the litmus mount after extraction to
  `CmaKickoffMount.tsx`; the page's wholesale spec-03 rebuild is the queued
  structural payback (chip task_c4fbba7e re-ratchets it down).

### Pain #2 — comms (double-send / stuck-sending / group-vs-1:1) — DEMONSTRATED + one real defect found & fixed

Timed, click-counted, real-DB browser demonstration on the production build,
against the pre-registered thresholds (above). Real texts to Matt's own cell
(the established self-send pattern); fixtures cleaned to zero residue.

**Threshold 1 — double-tap → exactly ONE delivery: PASS (twice).** Two
SYNCHRONOUS clicks (faster than any human double-tap; React cannot re-render
between them): exactly 1 Twilio SID + 1 `sms_out` row + 1 `crm_message` + 1
idempotency key, delivery receipt `delivered` on the handset. Proven on both
the pre-fix tree (ledger held) and the fixed tree.

**The demonstration FOUND the real residual defect:** on the pre-fix tree the
same-tick double-tap dispatched TWO action POSTs which ABORT EACH OTHER in the
App Router — no duplicate send (ledger), but NEITHER response resolves: the
composer hung on "sending" forever with the sent text in the box — Matt's
exact stated pain. **Fixed at the canonical layer**: `composer-submit-guard.ts`
(form-level one-submission-at-a-time guard + success detector) wired into
`SmsComposer` + `EmailComposer`; a successful send now also CLEARS the box
(stale-`?error`-immune, inbox-success-redirect-aware — the first detector
iteration mis-read the inbox redirect; caught in re-verification, fixed,
8 unit tests). Adversarially reviewed (no confirmed hazards; the reviewer's
Q3 defensive fix implemented as the detector).

**Threshold 2 — sent-state resolves, never stalls: PASS on the inbox** (the
primary send surface): tap → ledger ≤5 s → box cleared + message rendered with
delivery chip, ~10–20 s total on the memory-pressured local prod server (audit
baseline for prod serverless: 2–6 s). **The person-page composer still cannot
resolve** — its action response inlines a re-render of the force-dynamic
40–55-query page and the client abandons the stream (single-POST proven, not
double-tap-related). That is the audited structural cause (spec 03 §5 fetch
rebuild, queued) — scoped precisely, handed off, NOT silently waved through.

**Threshold 3 — group vs 1:1 labeled: PASS.** Group thread renders
"Group · 4 people" / "Group · 3 people" badges live in the inbox; the 1:1
fixture thread renders none. Delivery chips (Delivered / Pending) render on
outbound bubbles.

### Task #8 — responsive shell + Today home + drop public bundle — DONE (all 3, browser-verified)

**Update: the public-bundle drop is now shipped safely** (`components/layout/PublicClientLayer.tsx`).
The interactive public CLIENT components (sign-in + install prompts, visitor + intent
trackers, OAuth/sign-up bridges, comparison tray) are consolidated behind route-aware
`next/dynamic` imports; on `/admin` the wrapper returns null BEFORE any import fires, so
those chunks never load on an admin page. Deliberately NOT touched: SiteHeader/SiteFooter
(async server components — zero client JS — and CSS-toggled by HideChrome, never
mount-toggled/dynamic'd, per the double-nav incident) and RootProvider (admin surfaces use
its contexts). Verified: `next build` passes (**prerender intact — the #1 risk cleared**);
the homepage fires the trackers (visitors/track + web-vitals + session fetch) with zero
console errors (public behavior byte-identical); `/admin/broker-dashboard` loads clean and
fires NO visitors/track (chunks gated off admin). No double-nav (server chrome untouched).

Original assessment (still accurate for the other two sub-items):
Investigated the whole task this session against the live code + gates + git history.
Two of the three sub-items were already delivered by prior work following Matt's own
LATER directives, and browser-verified production-grade this session:
- **Responsive shell — DONE + verified.** ONE `ConsoleShell` (single nav source for the
  desktop rail + mobile Sheet), locked by `ci:admin-mobile-shell` + `ci:admin-responsive`
  (whole admin is mobile-first, ratcheted). The 32 `components/admin/**/mobile/*` files
  are the INTENDED mobile-first CRM (iOS-style tab bar + sheets + swipe rows), not
  duplication to eliminate — collapsing them into one tree would DEGRADE the phone UX.
  Browser-verified authed as matt@: `/admin/broker-dashboard` renders clean on desktop
  (KPI cards, single header, no double-nav) AND reflows to a purpose-built mobile layout
  (hamburger, tabbed lead cards, bottom Home/Inbox/People/Deals/Activity bar, FAB).
- **Today home — DONE (superseded).** The original spec wanted a separate "Today" home,
  but Matt directed **"one home, not three" (2026-06-16)** — the three dashboards
  collapsed into `/admin/broker-dashboard` ("Good afternoon, Matt." + live pulse), and
  `/admin` is a thin redirect to it (`(protected)/page.tsx`). Building a separate Today
  home now would CONTRADICT that directive, so this is correctly done, not undone.
- **Drop the public JS bundle from admin — the one genuine remaining item; NOT rushed.**
  The root layout imports the public chrome (SiteHeader/Footer + RootProvider contexts +
  SignInPrompt/InstallPrompt/ComparisonTray/trackers). `HideChrome`/`HideOnLP` already
  UNMOUNT/CSS-hide them on admin and the trackers already skip admin
  (VisitTracker.tsx:229), so admin is fast + clean at RUNTIME — but the JS still ships in
  the shared client chunk. **The naive drops are actively dangerous:** SiteHeader is an
  async SERVER component (ships zero client JS) whose chrome MUST be CSS-toggled on a
  stable node — mount-toggling or `next/dynamic`-ing it reraces the "double nav" Matt
  reported 2026-07-11 (`reference_double_nav_chrome_gate` + the HideChrome §50-62 comment).
  So the only safe fix is the route-group refactor: a minimal root `app/layout.tsx`
  (html/body/fonts/globals/essential providers, NO public chrome, NO `headers()` — must
  stay static-prerenderable per SITE_SPEC §45-47) + an `app/(public)/layout.tsx` carrying
  the public chrome with the public pages moved under it; admin then inherits the minimal
  root and stops paying for the public bundle. That is a large, full-site-prerender-
  verified change — a dedicated pass, not a mega-session tail. It's a PERF optimization
  (unused-JS parse cost), not a usability blocker — the admin is verified usable + fast.

### RC7 — consumer save→sign-in→resume — DONE (browser-verified)
- **A logged-out save now completes itself after sign-in** (`lib/pending-save.ts` +
  `lib/hooks/useResumePendingSave.ts`). Before: an anonymous saver was bounced to
  `/login?next=<page>` and returned signed in but the listing was NOT saved — the
  save→account→lead-capture path silently dropped. Now every save control stashes the
  intended listing (`sessionStorage`, survives the OAuth round-trip) before the login
  bounce, and resumes it once on return. Applied to ALL seven live save entry points:
  `SaveListingButton` (search/map), `ListingActions` + `PriceCtaStrip` (detail),
  `ListingTile` (grids), `geo-page/ListingBarCard`, `activity/ActivityFeedCard`,
  `geo-page/ActivityFeedCard`. (`components/ActivityFeedCard.tsx` is dead + hides save
  when logged out — chip spawned to delete it.) The hook consumes the flag whenever it
  names this listing (even if the page already renders it saved from an ISR-cached prior
  save) so a stale intent never lingers. **Browser-verified end-to-end authed as matt@**:
  set the pending flag, loaded a listing detail (451 C St, Madras), the save auto-
  completed — DB row written, both detail-page buttons flipped to "Saved" — then cleaned
  up. The RC4 accretion (save-with-login-redirect duplicated across 7 components) is now
  behind one shared helper.

### RC1 — the inbox now READS the conversation model — DONE (browser-verified)
- **The inbox read path flipped off the person-collapsed timeline** (`getInboxQueue.ts`
  `buildInboxWorkingSet` rewritten; channel-parity + denorm migrations `20260716230000`
  + `20260716240000`). The old path re-derived person-collapsed conversations from a
  2000-row `crm_timeline` window every load — slow, and its `messageCount` "may
  undercount". It now reads the model: exact `message_count`, order-independent
  `needs_reply`, real group-ness, all precomputed. **The inbox is CONVERSATION-keyed**
  now — a contact's 1:1 and a group they're in are DISTINCT rows (verified live: two
  "Ernie Oster" rows, his 1:1 "No worries:)" and his group thread). Channel parity first
  (calls + voicemail projected into the model via `crm_message.meta`) so the flip drops
  nobody — measured 22 of 8,408 would-be-dropped were call-only, now covered. Latest-
  message display fields + `message_count` + `outbound_brokers` denormalized onto
  `crm_conversation` (single-query read, no per-row join). Working set bounded to ~120
  days of activity + any `needs_reply` thread, matching the old inbox's recency (the old
  window actually HID ~800 recent low-volume threads the model correctly surfaces).
  Triage status still overlays from the person-keyed `crm_conversation_state` (mark
  read/handled/closed unchanged). **Browser-verified end-to-end authed as matt@**: rows
  render with exact counts (Ernie Oster 457, Maria Hoffman 497), calls appear, group
  rows distinct, folder counts live (Inbox 905, Sent 910), ZERO console errors in a
  fresh tab. Gotcha logged: the dev server's stale in-memory client chunks masked the fix
  in the long-lived tab — a fresh tab showed it clean (the source was always correct).
  Follow-up (Matt's call): filter automated broadcasts (app market-reports, sequence
  drips — ~4% of the count) from the inbox via a `source` marker on the model.

### RC1 — the first-class Conversation model — data foundation (schema landed)
- **Conversation / participant / message tables live** (`20260716200000_conversation_model.sql`).
  The root of the owner's #1 messaging confusion: today a "conversation" is just
  `person_id`, so groups, multi-channel threads, and multiple phone numbers collapse
  onto the person and receipts fragment across an untyped blob. New entity:
  `crm_conversation` (1..N participants, typed `state`/clocks/`needs_reply`) +
  `crm_conversation_participant` (broker line is NOT a participant) +
  `crm_message` (one typed shape; `provider_sid` is THE receipt key; unique on
  `provider_sid` and `idempotency_key`). Two triggers: participant-sync maintains
  `participant_count` + `is_group=(cnt>1)`; message-insert advances the clocks,
  sets/clears `needs_reply`, reopens closed→unread on inbound, unions `channel_set`.
  RLS on all three. **ADDITIVE + zero live behavior** — nothing reads/writes them yet;
  `crm_timeline` stays the ledger. Backfill + dual-write + inbox rewire are the next
  steps. **Trigger verified end-to-end vs the real DB**: seeded 2 participants + 1
  inbound + 1 outbound → participant_count=2, is_group=true, needs_reply=false (cleared
  by the reply), channel_set={sms}, both clocks set, msg_count=2; test row deleted,
  tables back to 0/0/0. Snapshot + DAL index refreshed.
- **Outbound dual-write chokepoint live** (`lib/crm/record-message.ts`). ONE
  `recordConversationMessage()` resolves-or-creates the conversation (group → keyed
  on the Twilio Conversation SID; 1:1 → the canonical per-contact thread) and inserts
  one typed `crm_message`; `provider_sid` dedups a repeat. Wired into all three
  outbound send sites in `crm.ts` (1:1 SMS, native group MMS, email) as **non-fatal
  shadow-writes** — wrapped in try/catch so a conversation-model bug can never break
  a live send; `crm_timeline` stays the source of truth until the read path flips.
  This is the RC1 fix for "group send writes N person-collapsed rows": a group now
  becomes ONE conversation with N participants. Verified: helper integration-tested
  vs the real DB (1:1 reuse + needs_reply flip + SID dedup + group participant_count=3,
  then cleaned to 0/0/0); 3 call sites tsc + esbuild clean; 4 committed unit tests pin
  the resolution branching (dedup short-circuit, 1:1 reuse, group SID key, raw-vs-
  contact participant roles).
- **Inbound dual-write live** (twilio `inbound-sms` + `conversations-events`). Both
  inbound message paths now shadow-write through the same chokepoint, non-fatal: a 1:1
  inbound reuses the contact's thread; a group reply keys the conversation on the
  Twilio Conversation SID with every sms member a participant (contact or raw, paired
  by ten-digit match). Verified: the message-insert trigger's closed→unread reopen
  branch proven vs the real DB (closed thread + inbound → state=unread, needs_reply=
  true, clock set), cleaned to 0/0; conversations-events 7-test regression suite green
  with the shadow-write in place (proves the try/catch is truly non-fatal). Deferred to
  a focused follow-up: delivery-status → crm_message.delivery_state (an UPDATE keyed on
  provider_sid, forward-only; crm_message.delivery_state isn't read yet).
- **History backfilled** (`20260716210000_conversation_backfill.sql`). Projected the
  ~45k message-kind crm_timeline rows into the model: **8,385 1:1 conversations + 2 real
  Twilio group threads + 45,209 messages**, idempotent by `crm_message.timeline_id`
  (unique). Two-tier dedup — group member rows sharing a (conversationSid, messageSid)
  collapse to one message; a multi-recipient email stays faithful-per-person with the
  shared gmailId kept on the first row and nulled on the rest (the provider_sid unique
  index caught this). A corrective rollup recompute sets clocks/needs_reply/channel_set
  from the messages so inbox ordering is exact regardless of insert order. Verified vs
  the real DB: message counts match the timeline exactly (974/974, 488/488, 447/447 on
  the three busiest contacts), needs_reply correctly derived from the latest message
  direction, channel_set unions email+sms, 0 orphan messages, both group threads read
  is_group=true (participant_count 2 and 6). Migration file reconciled to the deployed
  functions and made replay-safe (every step not-exists-guarded). Next: the inbox read
  rewire — flip getInboxFolderQueue + the person thread off the person-collapsed
  timeline onto crm_conversation/crm_message.
- **Adversarial review + hardening** (`20260716220000_conversation_model_hardening.sql`).
  A dedicated adversarial review of the foundation found 3 real correctness bugs (all
  latent until the read path flips) — fixed and re-verified vs the real DB:
  1. **HIGH — duplicate 1:1 threads.** The 1:1 resolver did read-then-insert with no
     unique constraint, so concurrent inbound+outbound to a brand-new contact could
     create two 1:1 threads (the exact fragmentation RC1 kills). Added a partial unique
     index `(primary_person_id) where is_group=false and twilio_conversation_sid is null`
     + a create-race re-read in record-message.ts (mirrors the group branch). Verified:
     index present + unique; a 5th unit test locks the re-read.
  2. **MED — needs_reply reflected the last-INSERTED row, not the latest by created_at.**
     Crossing inbound/outbound inserted out of order could drop a waiting client from
     triage. Trigger rewritten order-independent (clocks use GREATEST; needs_reply + the
     closed→unread reopen only change when the inserted row is actually newest). Verified:
     a late older inbound after a newer outbound correctly leaves needs_reply=false.
  3. **MED — backfill replay could abort.** No live dual-write set timeline_id, so a
     replay after a live send would collide on the provider_sid unique index. Backfill
     now also guards on provider_sid (every live shadow-write carries one), so a replay
     skips instead of colliding. The other probes (channel_set NULL, group upsert dupes,
     RLS/service-client, provider_sid window) came back safe-by-design. Snapshot refreshed.

### Integrity + security (compliance-grade wrong numbers / unauthenticated writes) — DONE
- **Content-write security holes closed** (`979350ad`). 18 in-body `checkAdminAction`
  guards across blog / guides / site-pages / geo-places / brokerage — the RC5
  criticals (unauthenticated service-role writes → public-site stored-XSS/defacement;
  several wrote BEFORE their getSession). Verified: /admin/blog loads + editor intact
  (superuser short-circuit).
- **No more fabricated "$0 team volume"** (`73a76054`). /admin/reports/brokers read the
  empty broker_stats and rendered "$0"; now shows "—" + a "being reconnected" note.
  Verified live.
- **False-CRITICAL "pause your ads" alert fixed** (`1890f17e`). action-required Spend
  Alerts divided Meta spend by the dead `fub` qualified_seller_leads metric (always 0 →
  fired CRITICAL every $60 week). Now divides by real getLeadIntake inbound leads.
  Verified live: "$0.00 spent for 3 new leads", no false alarm.
- **cost-per-lead + ad-ROI repaired** (`d2b35ddb`). Both pages (named for the owner's
  core question) divided ad spend by the dead `fub` lead metrics → permanent "—"/0.
  Now use real getLeadIntake (cost-per-lead buckets byDay into weeks; ad-ROI uses the
  aggregate). Closed-deal figures (no live source) show "— ledger reconnecting", not a
  fake 0. Verified live: real per-week counts (5/9/3/15/2), "34 real inbound leads".

### Consumer funnel (RC7) — partial
- **Signed-in visitors can reach their account** (`e5cb7662`). The header/nav always
  said "Sign in" and the account menu (AuthDropdown) had 0 importers. New
  `lib/hooks/useSessionUser` (client /api/auth/me fetch) drives a new
  `HeaderAccount` (SiteHeader account menu) + KbNav's auth link → "My account" when
  signed in. Verified live: KbNav shows "MY ACCOUNT" for the authed session.
- **save→sign-in returns you to the page** (`be5a8eca`). All 11 save entry points sent
  `?returnUrl=` (or `/account?signin=1`) which login ignored (it honors `next`), so a
  save→sign-in dumped the visitor on /account with the listing lost. Standardized every
  save on `/login?next=<page>`. Verified live. (Auto-replay of the save = spec-10.)
- **Viewing history made real** (`3a567bbc`). /account/history read user_activities (no
  writer → always empty, Remove on nonexistent rows). Now VisitTracker writes
  user_events on a signed-in listing view; getRecentListingViews reads it. Verified
  live end-to-end: viewed 2 listings → both render in history.

### Person-page CMA flow — DONE (partial)
- **CMA "Review comp" dead-end fixed + build feedback** (`1ab7872c`). Repointed to
  /admin/cmas/[slug] (was the tokenized lead page → "Link not valid"); "Generate comp"
  + "Send to lead" now use `PendingButton` (reusable useFormStatus button,
  `components/admin/PendingButton.tsx`).

### Messaging pain trilogy (the owner's #1 stated pain) — DONE
- **Double-send killed** (`0d786a49`). SmsComposer + EmailComposer Send buttons use
  `useFormStatus` → disable + spinner the instant you tap (no more "nothing happened →
  tap again"). Per-attempt idempotency key + `withSendIdempotency` over
  `crm_idempotency_keys` = a duplicate submit no-ops; a failed send releases the key so
  a real retry re-sends. Verified: live suppressed send (compliance intact), release-on-
  failure live (empty ledger), dedup+release integration test vs real DB.
- **Group vs 1:1 unmistakable** (`35c61e01`). `lib/crm/group-message.ts` (pure,
  shared) → "Group · N people" badge on group texts in the person timeline + inbox +
  mobile feed. Verified live: person 57297 shows Group·4 (in) / Group·3 (out).
- **Delivery status in the inbox** (`ad0f9fde`). `lib/crm/sms-delivery.ts` (pure,
  shared) → delivery chip (Delivered / Sent / Queued / Undelivered(code) / Failed) on
  outbound inbox bubbles. Verified live: person 57295 shows "⚠ Undelivered (30005)".

### Foundation primitives (the load-bearing floor) — DONE (additive, not yet wired into the live shell)
- **Capability model + in-body guard** (`ba03ff07`). `lib/admin/capabilities.ts`
  (one cap→roles map, reconciled v1 per §A1 + Matt's decisions) + `lib/admin/
  require-admin.ts` (`requireAdminPage/Action/Route` + `checkAdminAction`). Kills RC5.
- **Idempotency ledger + mutation primitive** (`ba03ff07`). `crm_idempotency_keys`
  table (migration applied) + `lib/crm/idempotency.ts` + `mutation-result.ts` +
  `useIdempotentAction`. The RC2 substrate.
- **Capability-projected nav** (`5bad2db5`). `lib/admin/nav.ts` `buildNav(ctx)` — the
  8-destination IA as a projection of the capability map (nav can't show a dead-end).
  9 unit tests.

### Shell / IA pass — IN PROGRESS (bounded HIGH defects landing)
- **Broker dead-ends killed** (`ef95e240`). /admin/listings + /admin/crm/import were
  shown to brokers but their pages redirect non-superusers → gated the nav to match.
  Verified: superuser nav intact, brokers no longer see them. (crm/calendar, templates,
  reporting use isSuperuser for DATA scoping not gating — left unchanged.)
- **Sign-out added** (`486bc01d`). Audited "no sign-out anywhere in the admin" — the
  avatar was a bare image. Desktop: account DropdownMenu (name/email, My settings, View
  site, Sign out). Mobile: sign-out footer in the hamburger sheet. Verified live (desktop
  menu opens showing Sign out; mobile sheet is Radix so harness can't open it but real
  users can).
- **Deep-link destination preserved through sign-in** (`d9e92c63`). Layout hardcoded
  next=/admin + AdminLoginForm hardcoded ADMIN_NEXT → a deep link with an expired session
  dumped you on the dashboard. Now the funnel carries the real page end to end (layout
  x-pathname → auth-error → login page → form dest). Verified page renders carrying next.
- STILL in shell scope (larger/risky, deferred): the responsive single-tree consolidation
  (kill the mobile/desktop fork), the persistable session-refresh (middleware/server.ts
  cookie writes), dropping the public-site bundle from admin (route-group refactor), and
  the full nav→buildNav(capability) migration with canonical routes.

### Dedicated review pass — DONE (`7108d338`)
A 5-area adversarial multi-agent review of the session's 14 commits found + fixed
**2 confirmed HIGH bugs manual testing missed**: (1) withSendIdempotency reported a
fake `{ok:true}` on a transient ledger DB error → silent no-send reported as sent (now
fails OPEN); (2) /account/history rendered ZERO cards for real users (keyed by
ListingKey but views store MLS ListNumber — my live test passed only via a legacy URL;
now keys by both). Plus MEDIUM cost-per-lead "blended" honesty + LOW guards/consent/doc
fixes. Deferred to spec 02: group participant-count off-by-one (inbound counts broker
line), per-recipient group idempotency. **Lesson: manual browser verification misses
transient-error paths + URL-form edge cases — the adversarial review is not optional.**

### CMA upsert-by-slug clobber class — CLOSED at every writer (2026-07-17 follow-through session)
The D8 review's HIGH finding said the kick-off guard alone was not the class fix: the
seller-LP / expired / FSBO / Meta-webhook intakes (createCmaRequest) and every direct
buildCma caller still blind-upserted by slug, flipping a finalized/delivered CMA back
to draft, reassigning the client, and 404ing the client's live /cma/[slug] link. Fixed
at the chokepoints with a **version chain**: one address = one base slug + `--vN`
successors (the `--` is reserved by construction — slugifyAddress collapses hyphen
runs, so no address-derived slug can collide). New primitives: pure helpers in
`lib/cma/address-slug.ts` + probing resolvers in `lib/cma/versions.ts`
(resolveWritableCmaSlot for writers; latest / latest-BUILT / latest-CLIENT-READY for
readers). Writers (intake, dashboard builds, contact-card build, admin new-CMA) land
on the writable slot; the intake merge path refreshes contact fields only under a
status='draft' compare-and-patch; the build worker kills (never builds) an action
whose document finalized while queued. Readers that key CMAs by address (expired/FSBO
dashboards + outreach worklist + send rails) resolve the latest version; SMS rails
resolve latest CLIENT-READY (a texted draft link 404s); email rails resolve latest
BUILT (auto-finalizing an unbuilt placeholder would strand an empty protected row).
kickoffCmaCore ported to the chain (attach/guard/stub logic at the writable end —
its int suite green unchanged). Own adversarial review (2 independent agents) found
11 findings incl. 2 HIGH regressions in the first draft (draft-link SMS, stale attach
payload reverting the newest requester) — all fixed before commit; int tests
`lib/cma-request.int.test.ts` (never-clobber, merge-not-reset, archived-protected,
newest-requester payload) + `lib/cma/address-slug.test.ts` pin the contract.
**Lesson confirmed again: the adversarial review pays for itself — both HIGHs were
invisible to the happy-path tests.**

Follow-through (same day, second commit): the BPO half of the class is closed —
`resolveWritableBpoSlot` (generic version-chain core in `lib/cma/versions.ts`,
statuses draft|final) now guards `buildBpoAdminAction` + `startBpoForContactAction`,
so a 'final' BPO's live /bpo/[slug] link survives every later build for the same
address; `rebuildBpoAction` (explicit slug) keeps deliberate in-place rebuilds. And
the documented attach residual (N1) is closed for real: `cma_action_merge_contact`
(migration 20260717150000, APPLIED to hosted) merges only the four contact keys
under the same row lock as the notify append, so a concurrent kicker's entry can
never be lost to the intake's contact refresh. Int suites:
`lib/cma/versions.int.test.ts` (BPO slot + RPC notify-survival) + the existing two.

Third commit (Matt decision, same day): the kick-off sheet's alreadyBuilt state now
ASKS — review the existing document or "Build a fresh CMA" — with the confirmation
re-invoking `buildNewVersion: true` under its own idempotency key (double-tap-safe),
opening the next `--vN` draft; a built open draft is rebuilt in place instead of
wasting a version. tsc caught a real onClick-event-as-boolean bug in the first sheet
draft (the original Build button would have silently opted in) — fixed. Verified in
a real authed browser session against the dev server: guard ask → fresh tap →
`--v2` draft + pending action with the notify seed, original byte-untouched; probe
rows self-cleaned.

## Next (in priority order)
1. "Send a CMA in seconds" — collapse the CMA build+send to one fast path on the
   person workspace (the owner's explicit litmus test).
2. The responsive shell + Today home + capability nav wired live (kills bloat +
   mobile≠desktop). Higher blast radius — needs the destination routes to exist or
   redirect-bridge; browser-verified.
3. Public-site bundle off admin — the CORRECT fix is a route-group refactor (root
   layout must stay static for public prerender; naive `headers()` there regresses the
   whole site). Deferred to a dedicated careful pass, NOT the naive spec version.
4. Then per doc 01 §C: metric layer, transactions (no e-sign), prospecting/settings/
   content, consumer funnel, delete pass.

## Notes / gotchas learned
- Turbopack dev overlay can show a sticky false-positive parse error on an unvisited
  import chain (newsletter.ts→crm.ts) after rapid HMR edits to a large `use server`
  file. tsc + esbuild + `next build` are the truth; the page rendering is the truth.
- Local admin auth: mint a service-role magic link → land on `/auth/callback` (see
  `tmp/mint-magic.mjs`, gitignored). Preview mutations fire as matt@ for real — prefer
  read paths / knowingly-reverted single actions.
- Pre-commit runs full vitest (~2.5 min); pre-push runs `next build` (~2 min). Use
  Bash timeout ≥300000 for git commit/push. Concurrent sibling sessions push to main —
  always `git pull --rebase` before push.
