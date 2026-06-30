# Follow Up Boss — Master CRM Feature & UI Specification

> **What this is.** A build-ready, vision-verified specification of every feature and UI surface in Follow Up Boss (FUB) as Ryan Realty uses it, reverse-engineered to build the in-house CRM to full parity. Every module, screen, panel, field, column, button, filter, modal, dynamic interaction, documented limit, and compliance rule is specified here, with inferences clearly marked.
>
> **Why it supersedes the old single-file spec.** The prior `docs/FUB_CRM_FEATURE_SPEC.md` was built from low-resolution OCR and is riddled with `[illegible]` gaps and misreads (e.g. "Laura" vs **Laurie**, "Dear Trail Rd" vs **62285 Deer Trail Rd**, automations "36" vs **38**, person id 27032 vs **27022**). This spec is built from high-resolution image tiles (every screenshot split into a full frame + 4 overlapping quadrants), 13 screen-recording GIFs for dynamic behavior, and a full sweep of FUB's official Help Center — and it corrects those errors throughout. **Where the two disagree, this folder wins.**

---

## Provenance — the four evidence streams

| Stream | Volume | What it gave us |
|---|---|---|
| **79 production screenshots** (`FUB SCREENS`, captured 2026-06-30) | 79 screens → 79 exhaustive per-screen analyses (995 lines for the densest) | Exact UI: every label, column, field, button, enum value, real sample data. Tiled to high-res so small text is legible (0 `[illegible]`). |
| **13 screen-recording GIFs** | 13 module walkthroughs → 13 interaction-flow analyses | DYNAMIC behavior static shots can't show: modals/flyouts opening, drag-to-restage, list re-filtering, loading/empty states, AND surfaces absent from the statics (Calendar Create-Appointment modal, Deal Detail modal, Team Inbox Manage, Billing). |
| **FUB official Help Center** (help.followupboss.com) | 17 feature areas + a full article inventory | Documented behavior, hard limits, A2P/10DLC compliance steps, the public REST API, roles/permissions matrix, pricing, mobile behavior — none of which a screenshot reveals. |
| **Live in-house code audit** | 18 feature areas | What is ALREADY built in `app/admin/(protected)/crm/**` + the `crm_*` schema, so the build targets the gap (see §21). |
| **60 mobile screenshots** (iPhone, captured 2026-06-30) | 60 distinct screens → 60 pixel-perfect analyses (§23–§30 + `mobile-screens/`) | The phone UI: FUB's native iOS app (parity target) + the in-house mobile web (current build). Exact regions/colors/elements + component trees; gaps (Tasks, flat People list) inferred from the desktop spec + mobile patterns, tagged `[INFERRED]`. |

---

## How to use this document

1. **Start with §01 (overview) and §02 (information architecture)** to understand the system shape and route map.
2. **§04 (data model) is the foundation** — build the schema first; every module hangs off it.
3. **§03 (app shell + shared patterns)** are built once and reused by every module — including the design-system mapping (FUB's blue/teal → Ryan Realty navy/cream).
4. **§05–§20 are the module specs.** Each follows the same shape: *purpose → URL/layout → every UI element → actions → states (incl. loading/empty) → data touched → acceptance criteria.* Build one module at a time; the acceptance criteria are the definition of done.
5. **§21 (gap map) is the build plan** — it maps every FUB feature to the existing in-house route/table/lib with a ✅/🟡/🔴 status and an ordered build priority. **Read this before starting any module so you build the gap, not the whole thing twice.**
6. **§22 (end-to-end workflows)** are the acceptance scenarios that must complete without manual glue.
7. **`screens/` (79 per-screen visual appendix files)** are the pixel-level reference for any single screen — the exhaustive raw analysis behind the synthesized module specs.

`(inferred)` = behavior not directly observed and not documented; confirm against the live FUB account before it gates a build decision. `(per FUB docs)` = sourced from the official Help Center.

---

## Table of contents

| § | File | Module / topic |
|---|---|---|
| 01 | [`01-product-overview-and-personas.md`](01-product-overview-and-personas.md) | What FUB is, the Ryan Realty account at a glance, personas, permission tiers |
| 02 | [`02-information-architecture-and-routes.md`](02-information-architecture-and-routes.md) | Global nav, every module sub-nav, full route map (FUB → in-house) |
| 03 | [`03-app-shell-and-shared-ui-patterns.md`](03-app-shell-and-shared-ui-patterns.md) | App shell, list/table/detail/modal/flyout patterns, loading states, **design-system mapping** |
| 04 | [`04-data-model-and-erd.md`](04-data-model-and-erd.md) | Every entity, field, type, enum, relationship; the ERD |
| 05 | [`05-people-list-and-bulk-actions.md`](05-people-list-and-bulk-actions.md) | People — contact list, columns, bulk actions, Add/Export |
| 06a | [`06a-smart-lists-collections-and-list-management.md`](06a-smart-lists-collections-and-list-management.md) | Smart lists, collections, Manage Lists, Save/Move modals |
| 06b | [`06b-smart-list-filters-columns-and-grouping.md`](06b-smart-list-filters-columns-and-grouping.md) | The filter/AST engine, column chooser, group-by |
| 07a | [`07a-person-detail-sidebar-and-inline-edit.md`](07a-person-detail-sidebar-and-inline-edit.md) | Person detail — left sidebar & inline editing |
| 07b | [`07b-person-detail-timeline-and-engagement.md`](07b-person-detail-timeline-and-engagement.md) | Person detail — activity timeline & engagement cards |
| 07c | [`07c-person-detail-compose-modals-and-right-rail.md`](07c-person-detail-compose-modals-and-right-rail.md) | Person detail — multi-channel compose, modals, right rail |
| 08 | [`08-inbox.md`](08-inbox.md) | Inbox — unified email/text/voicemail, folders, unknown-caller flow |
| 09 | [`09-tasks-and-calendar.md`](09-tasks-and-calendar.md) | Tasks & Calendar / Appointments |
| 10 | [`10-deals-pipelines.md`](10-deals-pipelines.md) | Deals — Buyer & Seller pipelines (Kanban), deal detail |
| 11 | [`11-reporting.md`](11-reporting.md) | Reporting & analytics — all 13 reports + leaderboard |
| 12 | [`12-action-plans-and-automations.md`](12-action-plans-and-automations.md) | Action Plans & Automations — the follow-up engine + visual builder |
| 13 | [`13-email-and-text-templates.md`](13-email-and-text-templates.md) | Email & text templates |
| 14 | [`14-admin-config-stages-tags-fields-leadflow.md`](14-admin-config-stages-tags-fields-leadflow.md) | Admin — overview hub, stages, tags, custom fields, lead flow, groups, ponds |
| 15 | [`15-admin-company-team-and-roles.md`](15-admin-company-team-and-roles.md) | Admin — company settings, team & roles/permissions |
| 16 | [`16-account-menu-and-user-settings.md`](16-account-menu-and-user-settings.md) | Account menu & user settings |
| 17 | [`17-communications-and-compliance.md`](17-communications-and-compliance.md) | Cross-cutting — communications layer & compliance (email/text/call, A2P/10DLC, suppression) |
| 18 | [`18-integrations-pixel-and-api.md`](18-integrations-pixel-and-api.md) | Integrations, Pixel & the public REST API |
| 19 | [`19-billing-and-subscription.md`](19-billing-and-subscription.md) | Billing & subscription (FUB's model — what we're replacing) |
| 20 | [`20-mobile-apps-and-notifications.md`](20-mobile-apps-and-notifications.md) | Mobile apps & notifications |
| 21 | [`21-gap-map-vs-inhouse-crm.md`](21-gap-map-vs-inhouse-crm.md) | **FUB → in-house gap map + build priority** (code-grounded) |
| 22 | [`22-end-to-end-workflows.md`](22-end-to-end-workflows.md) | End-to-end acceptance scenarios |
| **MOBILE** | | **Pixel-perfect mobile spec — build core-first; Deals/Billing/API deferred** |
| 23 | [`23-mobile-architecture-and-navigation.md`](23-mobile-architecture-and-navigation.md) | Mobile shell, nav bar, **bottom tab bar** (FUB + in-house variants), sheet pattern, color/type system, **coverage map** |
| 24 | [`24-mobile-activity-people-and-smartlists.md`](24-mobile-activity-people-and-smartlists.md) | Mobile Activity feed (New Leads/Emails/Website), People & Smart Lists |
| 25 | [`25-mobile-contact-detail.md`](25-mobile-contact-detail.md) | Mobile **Contact Detail** — every tab (Info/Comms/Homes/Notes/Calendar) & field |
| 26 | [`26-mobile-inbox-and-conversations.md`](26-mobile-inbox-and-conversations.md) | Mobile Inbox & email/SMS conversation threads |
| 27 | [`27-mobile-compose-email-text-call.md`](27-mobile-compose-email-text-call.md) | Mobile compose — email/text/call/AI |
| 28 | [`28-mobile-pickers-modals-and-action-sheets.md`](28-mobile-pickers-modals-and-action-sheets.md) | Mobile pickers & action sheets (Stage/Source/Assign/Time Frame/Automations) |
| 29 | [`29-mobile-calendar-and-tasks.md`](29-mobile-calendar-and-tasks.md) | Mobile Calendar & Tasks |
| 30 | [`30-mobile-inhouse-web-current-state.md`](30-mobile-inhouse-web-current-state.md) | In-house mobile web (current build) vs FUB mobile — gap table |
| — | [`screens/`](screens/) | Desktop per-screen visual appendix (79 files — pixel-level raw analysis) |
| — | [`mobile-screens/`](mobile-screens/) | Mobile per-screen appendix (60 files — pixel-perfect raw analysis, `[OBSERVED]`) |
| — | [`addenda-captures/`](addenda-captures/) | Gap-fill captures (2026-06-30): Agent Activity report, automation editor step panels, template editor + merge picker, calendar week/day + appointment modal, admin pages, contact-detail Log Call, filters/column-chooser |
| — | [`api-export/`](api-export/) | **Authoritative config/schema from the live FUB API** — stages, 64 custom fields, pipelines, users, 76 action plans + 1,070 steps, deal/event schema |
| — | [`CAPTURE-CHECKLIST.md`](CAPTURE-CHECKLIST.md) · [`VERIFICATION.md`](VERIFICATION.md) | Coverage-gap checklist · adversarial-verification audit trail |

---

## The headline numbers (Ryan Realty FUB account, observed 2026-06-30)

- **~18,235 contacts** across **16 lifecycle stages**
- **3 team members:** Matt Ryan (account owner; FUB `role`=**Broker**), Rebecca Peterson (FUB `role`=**Broker**), Paul Stevenson (FUB `role`=**Agent**) — *roles verified via /v1/users API export; the in-house role enum should be Broker/Agent, not the earlier Owner/Admin inference*
- **148 user custom lists** in collections (Pipeline, Neighborhoods, …), PLUS **12 built-in default smart lists** (Sphere, Past Clients, Buyers, Leads, …) — these are two distinct concepts in the data model (per the /v1/smartLists API export); build both
- **1,486 tags** · **64 custom fields** · **38 automations**
- **2 deal pipelines** (Buyers, Sellers) · ~**$5.8M** closed GCI tracked
- High inbound: **559 inbox items, 326 unread, 248 overdue tasks** at capture time

## Where the in-house build stands today (from §21)

- ✅ **Built:** communications (Gmail + Twilio, production-live), compliance/suppression (the strongest area), lead routing/assignment, admin config (stages/tags/fields/lead-flow/groups/ponds), the unified timeline.
- 🟡 **Partial:** person detail (~85%, at `/admin/console/leads/[id]`), people list (no column-chooser/group-by/collections), smart-list filters, inbox (no Assigned/Drafts/unknown-caller), tasks (no recurring), calendar (month-only, read-only GCal), deals (Kanban is display-only), sequences (list editor, no visual canvas), templates (flat categories).
- 🔴 **Missing:** the **Reporting suite** (all 13 reports) and **Company Settings**.
- ⚪ **N/A:** billing (owned tool, not SaaS — eliminating ~$2.1–2.5k/yr is a reason for the replacement).

**Recommended build order (§21):** Reporting → Company Settings → Deals drag-restage + per-pipeline stages → Automation visual editor → Inbox Assigned/unknown-caller → Person-detail collaborators/merge/plan-progress → Template folders/merge-inserter → mobile push.

---

*Generated 2026-06-30 from 79 screenshots + 13 GIFs + FUB Help Center + a live code audit. Companion: `docs/CRM_REPLACEMENT_BLUEPRINT.md`. The single-file `docs/FUB_CRM_FEATURE_SPEC.md` is the prior, lower-fidelity version this folder supersedes.*
