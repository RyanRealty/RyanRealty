# CRM rebuild → FUB parity — living progress tracker

> Goal (Matt 2026-06-26): the CRM (mobile + desktop) must match the Follow Up Boss
> UI captured in `FUB_FEATURE_AUDIT.md` (53 desktop screenshots) and the ~20 mobile
> screenshots Matt emailed ("Ui 1"/"Ui 2"). Bar = production-grade, every dimension
> 100%, a real user can walk in and use it. Test the real thing after every step,
> auto-review, commit, update this tracker.

## North-star structure changes (Matt directive)
- **Top-level menu = Dashboard · CRM · Deals · Admin · Reports** (with submenus).
  CRM functions (People/Contacts, Inbox, Tasks, Calendar) grouped under **CRM**.
- **Horizontal Ryan Realty logo** at top-left (navy, `public/images/brand/logo-horizontal-navy-transparent.png`); **remove the "RR Console" wordmark.**
- Match FUB desktop layouts screen-by-screen; keep mobile FUB-parity.

## Reference assets
- Desktop: `docs/fub-feature-audit/screenshots/01..53-*.png` (catalog in `FUB_FEATURE_AUDIT.md`).
- Mobile: Matt's emailed shots (mirrored to `tmp/ui-screenshots/` during the build).

## Phase checklist

### P0 — Shell / navigation (backbone)
- [x] Restructure `buildAdminNav` → 5 groups: **Dashboard · CRM · Deals · Reports · Admin** (filter-based remap; all role gates preserved). Verified in rail at 1440px.
- [x] Horizontal logo in `ConsoleShell` (rail + mobile header); removed "RR Console" wordmark.
- [x] Mobile bottom tab bar = daily drivers (Home/Inbox/People/Deals/Tasks) — FUB keeps mobile tabs = daily drivers, distinct from the desktop top menu. Left as-is.
- [x] **Desktop top nav = FUB-style dark navy horizontal bar** (`ConsoleTopNav`): white logo + Dashboard · CRM▾ · Deals · Reports▾ · Admin▾ + search + View site + avatar. Replaced the left rail at lg+. Mobile keeps header + sheet + bottom tab bar. Shell gate updated to lock the new architecture. Verified 1440 + 375.
- [x] Test: real browser desktop (1440) + gates green (mobile-shell, nav-reachability 19/19, responsive 0, tokens baseline). Committed.

### P1 — Mobile FUB parity (must be 100% before desktop sign-off)
- [ ] People — All Lists / Stages, smart-list counts, FUB rows. (done-ish, re-verify vs shots)
- [ ] Inbox — segments + conversation rows + thread. (done-ish)
- [ ] Deals — stage groups + price rows. (done-ish)
- [ ] Tasks — Today/Overdue/Upcoming/Done agenda. (done-ish)
- [ ] Contact detail — FUB tabs (Info · Comms · Homes · Notes), dark header, action circles.
- [ ] Calendar — month grid + agenda.
- [ ] Dashboard — KPI tiles + recent-activity feed.
- [ ] Each verified at 390px against the matching mobile shot.

### P2 — Desktop FUB parity (per FUB_FEATURE_AUDIT.md)
- [x] Dashboard (01) — 5 KPI tiles w/ sparklines + deltas, Everyone/date filters, Recent Activity feed. Verified 1440.
- [x] People (02) — Collections smart-list sidebar, list table (Name+source, Agent, Last Visit, Phone w/ call+text, Email, Last Activity), mass-action toolbar, right Filters panel. Verified 1440. (polish: hide leftover KPI tiles + secondary-nav strip on desktop too.)
- [x] Person record (03) — desktop 3-column workspace via LeadTabs (left identity/details/memberships | middle composers+timeline | right tasks/watching/workflow). Mobile tabs intact. Verified 1440.
- [x] Inbox (04) — 4-pane on desktop (folders rail | conversation list | reading pane | contact panel). Verified 1440.
- [x] Tasks (05) — desktop FUB underline tabs (Today/Overdue/Upcoming/Completed) + type-chip filters + clean task-row table. Verified 1440.
- [x] Admin config subpages (20/21/22) — Stages, Tags, Custom Fields, Segments, Areas restyled to FUB tables (Name/Used/Status/Actions) via the shared ConfigTableEditor/TagTaxonomyEditor/CustomFieldEditor. Verified Tags 1440.
- [ ] Calendar (06) — day/week/month grid + create-appointment. (no /admin/calendar route yet — dashboard MonthCalendar exists)
- [x] Deals (07) — desktop Kanban: colored stage columns, "N deals · $value" headers, deal cards (address/price/close/avatar). Verified 1440. (deal-record modal + Sellers tab styling still to refine.)
- [x] Reporting (08) — grouped report catalog (Market data / Broker activity / Lead sources / Marketing) cards. Verified 1440. (individual report views 32–42 still to style.)
- [ ] Admin (09–31, 44–52) — overview catalog + each settings panel.

### P3 — Final review pass
- [ ] One dedicated end-to-end review over every screen vs its reference.
- [ ] Production-grade checks: no overflow, gates green, e2e works, a real user can use it.

## Remaining (long tail — for the next pass; same pattern: ref PNG → rebuild → browser-verify at 1440+375 → gates → commit)
- Individual report detail views (FUB 32–42) — style each report page under /admin/reports/* + /admin/analytics/*.
- Deal-record modal (FUB deal detail) — clicking a deal card; ours links to the contact.
- Mobile contact-detail tab labels — audit deliberately mapped our Overview/Comms/Tasks/Watching/Workflow to FUB Info/Comms/Homes/Notes; revisit only if Matt wants exact labels.
- **FUB admin panels that are FEATURES we don't have** (these are build-new, not restyle): Lead Flow router, Groups, Ponds, Action Plans, Automations visual builder, Email/Text Template library + editor, Team mgmt, Import wizard, Phone Numbers, Company settings, API keys, Integrations marketplace, Business Registration, Billing, Email Domain Auth, My Settings/Devices/Power-Ups. Flag each as feature-gap vs styling-gap before building.
- Calendar (FUB 06) — no /admin/calendar route exists; dashboard MonthCalendar is the closest. Build the route if Matt wants the full calendar.

## Log (newest first)
- 2026-06-26 (cont.): Shipped P0 shell (5-group menu Dashboard/CRM/Deals/Reports/Admin, horizontal logo, FUB navy top nav) + P2 desktop parity for Dashboard, People, Reports, Inbox, Deals, Person record (3-col), Admin settings catalog, Tasks, and config subpages (stages/tags/custom-fields/segments/areas). Each browser-verified at 1440 + mobile, gates green, committed + pushed (commits 9acac609 → 604f5932). Pattern: ref PNG → subagent rebuild → my in-browser review (caught + fixed a Deals server/client crash + a console-kit regression) → gates → commit.
- 2026-06-26: Started P0. Reviewed FUB refs. Logo asset confirmed. Tracker created.
