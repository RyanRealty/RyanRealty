# Mobile CRM — the FUB-parity bar (match it, then beat it)

Matt directive 2026-06-16: "We should be able to do at least this good." The bar
is Follow Up Boss mobile. Reference screenshots are the two emails Matt sent
himself ("Fub screenshots", "Fun screenshots 2", 2026-06-16, ~20 screens). This
doc is the durable contract so the mobile build matches a saved target instead
of drifting (same lesson as `docs/CONSOLE_KIT.md`). Build each surface, then
screenshot it next to the FUB reference, then show Matt — pixels, not claims.

## Why we can BEAT it, not just match it

FUB has no live web-intent. Its "Website" feed is a thin activity list. We have
`fetchLiveVisitors` / `fetchLiveSummary` — real engagement scores + intent tags
(the 890 "mortgage_curious" lead, hot/active badges). FUB's information
architecture + our live-intent signal = a better broker phone app. Every place
FUB shows a flat list, we show who's hot right now.

## The FUB mobile patterns to match

1. **Lead detail is TABBED, not one long scroll.** Dark header (avatar + name +
   status) then horizontal tabs. FUB: Info · Comms · Homes · Notes · Calendar ·
   Automations. Each tab is one focused phone screen. OUR mapping →
   **Overview · Activity · Watching · Comms · Tasks · Workflow** (Overview =
   identity + next best action + plugged-in; the rest are the existing console
   sections, split into tabs on mobile, kept as one scroll on desktop).
2. **Inbox is segmented** — Inbox / Assigned / Sent / Closed + unread count.
   We have `/admin/crm/inbox`; add the segments.
3. **People has two segments: All Lists / Stages.** All Lists = smart lists with
   LIVE counts (FUB: "All Recent Online Activity 20", "All Expireds 657").
   Stages = stage buckets with counts (Seller Prospect 7.5k, Lead). Maps onto
   our stage filter chips + (future) saved/smart lists.
4. **Home = a segmented activity feed** (FUB "Everyone": New Leads / Emails /
   Website). Ours is the broker dashboard "Right now" pulse — make it
   filterable the same way, but lead with engagement score (our edge).
5. **Filters = a bottom sheet** (Status, types, Apply).
6. Month **Calendar**, friendly **empty states**.
7. **The global "+" quick-action menu (FAB) — Matt flagged this as "very
   powerful".** A floating "+" reachable from anywhere that expands to fast
   creates: New contact · New appointment · New task · New deal · Log a call ·
   Send text · Send email · Add note. This is the broker's one-tap create hub —
   it's what makes the phone app feel fast. OURS BEATS IT: the menu is
   context-aware (on a lead it pre-fills that lead; it can also "Enroll in
   workflow" and "Start a CMA" — actions FUB doesn't have) and it surfaces the
   single best next action at the top from our recommendation engine.

## Build order (each a gated, screenshot-verified unit)

1. **Tabbed mobile lead detail** — the highest-value pattern. A client tab bar
   on `app/admin/console/leads/[id]`: tabs reorganize the existing
   ConsoleSection panels on mobile (`< lg`), single-scroll on desktop. No data
   changes — pure presentation. Tab set: Overview / Activity / Watching / Comms
   / Tasks / Workflow. Add to a `ui_kits/lead-command-center` parity note.
2. **Global "+" quick-action FAB** (Matt: "very powerful") — context-aware
   create hub, present on every console surface. Top item = our recommended
   next action; then New contact / appointment / task / deal / note / log call /
   text / email, plus Enroll-in-workflow and Start-CMA when on a lead.
3. **Segmented activity feed** on the dashboard (New / Emails / Website + our
   hot/active engagement column).
3. **Segmented inbox** (Inbox / Assigned / Sent / Closed).
4. **People: All Lists / Stages** with live counts.
5. Filters bottom-sheet, calendar, empty states.

## Shipped (2026-06-26) — the missing app shell

Matt resent ~19 FUB screens ("Ui 1"/"Ui 2") and flagged mobile as still clunky.
Root cause: the 2026-06-16 pass shipped the tabbed detail + FAB + segments but
**never a bottom tab bar**, so navigation lived in a horizontal-scroll strip +
hamburger. Fixed:

- ✅ **Bottom tab bar** — `CrmMobileTabBar` in `ConsoleShell` (phone-only,
  `lg:hidden`): Home · Inbox · People · Deals · Tasks, longest-prefix active
  match (lead detail + /admin/people light the People tab). The "+" FAB lifts to
  `bottom-20` above it. Shell gate (`check-admin-mobile-shell`) still holds — the
  rail + Sheet + AdminNavList are untouched.
- ✅ **Shared FUB mobile kit** — `components/admin/crm/mobile/CrmMobileKit.tsx`:
  `CrmAvatar` (12 deterministic colorful fills), `CrmList`/`CrmListRow`,
  `CrmSegmented`, `CrmSectionLabel`, `CrmDetailRow`, `CrmActionCircle`. One place
  for the FUB look so screens can't drift. Token-pure except the brand-external
  avatar/action colors (tracked in `.design-token-lint-ignore`).
- ✅ **People list** — FUB rows (avatar · name · source · date · chevron),
  tap-to-open; bulk-select is now an opt-in "Select" mode (the always-on
  checkboxes are gone), action bar lifts above the tab bar.
- ✅ **Deals** — desktop kanban → vertical stage groups on a phone
  (`CrmSectionLabel` per stage), each deal a `CrmListRow` with the price meta.
- ✅ **Tasks** — FUB agenda: `CrmSegmented` view switch + date-grouped
  `CrmList`, one-tap complete in the row trailing.
- ✅ **Inbox** — mobile conversation list rebuilt on `CrmListRow`; underline
  scope sub-tabs; thread goes full-width on a phone.

All verified at 390px via `verify-admin-mobile.mjs` (zero overflow, no errors);
`admin-responsive` baseline held at 0, `design-tokens` back at baseline.

## Shipped (2026-06-16)

- ✅ **#1 Tabbed mobile lead detail** — `LeadTabs` (Overview · Comms · Tasks ·
  Watching · Workflow · Activity), single-scroll on desktop. Parity-gated
  (`lead-command-center/parity.json` now requires `LeadTabs`).
- ✅ **#2 Context-aware "+" FAB** — `ConsoleQuickAction` in `ConsoleShell`, on
  every console + protected surface. Pre-targets the lead, surfaces the
  recommended next action, adds Enroll-in-workflow + Start-a-CMA; deep-links
  switch tabs.
- ✅ **#3 Segmented activity feed** — `DashboardActivityFeed` on the broker
  dashboard: New leads / Emails / Website, led by the live engagement score.
- ✅ **Segmented inbox** — `InboxSegments` on `/admin/crm/inbox`: Inbox /
  Assigned / Sent with live counts. **Closed + unread badge deliberately
  omitted** — `crm_timeline` has no read/closed state; an always-empty tab is
  worse than no tab. They land with a conversation-status column.
- ✅ **People — Stages + All Lists** — the leads list gains a Stages / All lists
  toggle. Stages: per-stage counts (FUB "Seller Prospect 7.5k") + book total.
  All lists: the existing `crm_saved_views` store (Leads, Hot Prospects, Sellers,
  Buyers, Expired Pipeline, FSBO, Compliance Blocked, …) with a live broker-scoped
  count each; a chip applies the view via `?view=<id>`.
- ✅ **Filter bottom-sheet** — `InboxSegments` filter sheet: Emails / Texts /
  Calls type filter + active-count badge. (Status All/Unread omitted — no
  read-state on the timeline.)

- ✅ **"Online now" live list** (our edge) — All Lists leads with a live
  "Online now N" chip (identified people with an active session this moment),
  linking to the live-visitor surface. The list FUB can't show.
- ✅ **Month calendar** — `MonthCalendar` on the broker dashboard: a 7-col month
  grid with item-dots, today highlighted, the selected day's items below
  (defaults to today). Replaces the old 14-day list.
- ✅ **Friendly empty states** — context-aware empties across the surfaces
  (leads list reads search/list/stage/book; inbox per-segment + filter; calendar
  per-day; watching / saved searches / tasks).

**The contract is built.** Every FUB mobile pattern matched, several beaten with
live web-intent (Website segment leads by engagement, "Online now" list, the
context-aware "+"). Remaining ideas are genuinely new scope, not parity:

- A `Closed` inbox tab + unread badge — needs a conversation read/closed state on
  `crm_timeline` (a schema add), so they aren't faked.
- A recent-online-activity *saved view* (vs the live chip) — needs a
  session→person join baked into the saved-view store.

## How we keep it from drifting

- This doc is the saved target (the FUB screenshots are the visual reference).
- Mobile views must use the console kit (`ConsoleSection` etc.) — gated by
  `ci:console-kit`.
- Every surface: build → screenshot at 390px next to the FUB reference → show
  Matt → only then "done." A green `/verify` is never design sign-off.
