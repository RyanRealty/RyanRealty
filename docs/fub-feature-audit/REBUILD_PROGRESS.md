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
- [ ] **Desktop top nav as a FUB-style horizontal bar** (currently a grouped left rail; FUB uses a dark horizontal top bar with dropdowns). → P2.
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
- [ ] Dashboard (01) — 5 KPI tiles w/ sparklines + deltas, Everyone/date filters, Recent Activity table.
- [ ] People (02) — smart-list sidebar (Collections), list table (Name+source, Lead Score, Agent, Last Visit, Phone, Email, Last Activity), mass-action toolbar, Columns, Filters panel.
- [ ] Person record (03, 53) — 3-column workspace (contact data | timeline+composers | engagement/management).
- [ ] Inbox (04) — 4-pane (folders | conversation list | reading pane | contact context).
- [ ] Tasks (05) — Today/Overdue/Future + type filters.
- [ ] Calendar (06) — day/week/month grid + create-appointment.
- [ ] Deals (07, 43) — Buyers/Sellers Kanban, column count+value, deal cards, deal record modal.
- [ ] Reporting (08, 32–42) — report catalog + each report view.
- [ ] Admin (09–31, 44–52) — overview catalog + each settings panel.

### P3 — Final review pass
- [ ] One dedicated end-to-end review over every screen vs its reference.
- [ ] Production-grade checks: no overflow, gates green, e2e works, a real user can use it.

## Log (newest first)
- 2026-06-26: Started P0. Reviewed FUB refs (dashboard/people/person-record/inbox/deals/reporting/admin). Logo asset confirmed. Tracker created.
