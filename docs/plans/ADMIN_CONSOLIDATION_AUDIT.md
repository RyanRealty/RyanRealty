# Admin consolidation audit — Phase 0 findings (SETTLED IA)

**Session:** 2026-07-07 (Cursor). Parent goal: `ADMIN_CONSOLIDATION_MASTER_GOAL.md`.
**Method:** (1) authenticated Playwright sweep of all 42 top-level admin routes as Matt at
1400x900 — screenshots + console errors in `out/admin-audit/`; (2) code-level audit of every
route (jobs, DAL reads, nav reachability, overlap) via three parallel audit agents; (3) full
data-model map of the three subscription models (agent report: `out/admin-audit/agent-*.md`).

## The organizing principle

The broker's job: **manage my leads and understand what's going on with them.** Everything
about a lead reachable from one place. Acid test per screen: a busy broker who has never seen
the page accomplishes the task in under a minute.

## Browser sweep results

All routes render 200 with real data except:

| Route | Finding | Severity |
|---|---|---|
| `/admin/users` | Broken read: `profiles.email does not exist` — KPIs all 0 | P0 |
| `/admin/email`, `/admin/visitors` | 404 at top level (only sub-routes exist) | P2 |
| `/admin/producers` | "0 producers" — dead catalog (frozen producer layer), orphan | P2 |
| `/admin/guides` | 0 guides ever created; orphan (not in nav) | P2 |
| `/admin/analytics` | React duplicate-key console error | P2 |
| `/admin/analytics/action-required` | In nav as "Hot leads" for brokers but layout gates ALL analytics to superuser → access denied | P1 |
| `/admin/sync` | In nav for all roles but layout is superuser-only → access denied for brokers | P1 |

## Settled IA — six areas (the shared contract)

Nav menus become: **Home · People · Listings · Marketing · Money · Site & Settings**

### 1. Home
`/admin` → broker-dashboard (already the anchor: KPIs, needs-action, recent activity, deals,
calendar). Add: alerts/report delivery attention items (WS4) + Hot leads properly gated.

### 2. People (the lead hub — the center of gravity)
Contacts (`/admin/crm`), person page (`/admin/console/leads/[id]`), inbox, tasks, calendar,
activity, approvals, sequences, **Alerts & reports** (renamed subscriptions hub), compose,
CRM reporting, CRM settings. Person page gains the full story: **listing alerts + market
report subscriptions with editable criteria + delivery status** (today it has neither).

### 3. Listings
Listings browser (+ detail editor), expired listings, CMAs. `/admin/search` and
`/admin/query-builder` fold into the listings browser (advanced filters + CSV export already
exist there or move there).

### 4. Marketing (what goes out + did it land)
Newsletters, blog (nav restored), email campaigns (nav restored), approval queue (superuser),
performance hub (merge `reports` + `analytics` into one launchpad; live visitors inside),
broker ad links.

### 5. Money
Transactions (`deals`), signing, sign-off queue, commissions, financials, forms. Unchanged
grouping — already correct; keep "Pipeline" (CRM) vs "Transactions" (TC) naming.

### 6. Site & Settings
My settings, team profiles (`brokers`), users & access (FIXED), site content (site-pages +
blog CMS pieces stay in Marketing; hero/logo here), **one media library** (media + photos +
stock-photos + banners as tabs), geography (geo + resort-communities merged), system health
(sync + spark-status merged; operations + optimization merged), audit log.

## Page-by-page disposition

| Route | Disposition | Rationale |
|---|---|---|
| broker-dashboard | **Keep** — Home | The daily anchor; complete |
| crm/* | **Keep** — People core | Recently rebuilt, gated by ci:crm-screen-parity |
| people | **Merge → person page** | Duplicate mental model; visitor intel moves to contact detail; redirect `/admin/people/[fubId]` → lead page |
| email/compose | **Keep** (People) | Already in nav |
| email/campaigns | **Keep, nav under Marketing** | Was orphan |
| listings | **Keep** — Listings | Complete |
| expired-listings | **Keep** (Listings) | Seller prospecting |
| cmas | **Keep** (Listings) | Strong broker tool |
| search | **Merge → ⌘K + listings** | Narrow duplicate; cut nav entry, redirect to /admin/listings |
| query-builder | **Merge → listings** | CSV export joins listings browser; redirect |
| newsletters | **Keep** (Marketing) | Complete workflow |
| blog | **Keep, nav restored** (Marketing) | Was orphan |
| guides | **Cut from nav → fold into blog/content**; keep route reachable from Marketing hub | 0 rows ever; monetization owns public /guides |
| approval-queue | **Keep** (Marketing, superuser) | Distinct job |
| analytics | **Merge with reports → one Performance hub** (Marketing) | Heavy overlap; fix action-required gate |
| reports | **Merge with analytics** (Marketing) | Same job, two launchpads |
| visitors/live | **Keep inside Performance hub** | Session detail sub-route stays |
| fub-attribution | **Merge → CRM settings (lead routing)** | Setup tool, not a report |
| broker-links | **Keep** (Marketing tools) | Small, useful |
| deals, signing, sign-off, commissions, financials, forms | **Keep** (Money) | Correct grouping today |
| media, photos, stock-photos, banners | **Merge → one Media library** (Site & Settings) | Four pages, one job |
| site-pages | **Keep** (Site & Settings) | Site branding/copy |
| geo + resort-communities | **Merge → Geography** (Site & Settings) | One taxonomy surface |
| sync + spark-status | **Merge → System health** (superuser-only nav) | Spark panel inside sync |
| operations + optimization | **Merge** — optimization becomes a panel in operations | Thin standalone |
| producers | **Cut** (delete page; registry lives in repo files) | Frozen layer, 0 rows, orphan |
| users | **Keep + FIX P0 bug** (Site & Settings) | Access control distinct from broker profiles |
| brokers | **Keep** (Site & Settings) | Team/own profile |
| settings | **Keep** (Site & Settings / account menu) | Daily notifications |
| audit-log | **Keep** (Site & Settings, superuser) | Compliance |
| console/leads/[id] | **Keep as canonical person page** | crm/[id] redirects here; fine |

## Data model finding (WS1 contract)

Three parallel subscription models today:

| Model | Table | Identity | Rows (prod) |
|---|---|---|---|
| Signed-in alerts | `saved_searches` | user_id | ~0 |
| Guest/broker alerts | `guest_search_alerts` | email (+crm_person_id) | ~1 |
| Market reports | `crm_report_subscriptions` | person_id (unique) | small |

Both alert tables already store the SAME normalized filter JSON (`lib/search-filters.ts`).
Near-zero prod rows make unification cheap NOW. **Decision: one canonical `listing_alerts`
table** (email NOT NULL + optional user_id + crm_person_id, unique (email, filters_hash),
`is_active`, frequency instant/daily/weekly, origin/assigned_by/source provenance,
unsubscribe_token). Old tables migrate losslessly then rename to `*_legacy`. Market reports
stay a separate product (areas[], not filters) but get the same editable-criteria treatment
and live in the same broker-facing "Alerts & reports" surface.

Full consumer inventory + 14 foot-guns: `out/admin-audit/agent-f49b4acb*.md`.

## Severity-ranked punch list

- **P0** `/admin/users` broken query (`profiles.email`).
- **P1** Person page has alerts + report panels (ContactListingAlertsPanel, ReportSubscriptionsPanel) but NO delivery history and NO editable criteria — view-only lead hub (the gap WS2 + WS4 close).
- **P1** Nav gate bugs: Hot leads + Sync shown to brokers who get access-denied.
- **P1** Three subscription models for one broker concept (WS1).
- **P1** Market report email has no charts, no trend context (WS3).
- **P2** No help system anywhere in the admin (WS5): no tours, no KB, sparse tooltips.
- **P2** `/admin/email` + `/admin/visitors` top-level 404s; orphan routes (blog, campaigns, guides, producers).
- **P2** Media sprawl (4 pages), reports/analytics dual launchpads, sync/spark + ops/optimization splits.
- **P2** `/admin/analytics` duplicate React key.
- **P2** types/database.ts drift: `saved_searches` Row type missing `unsubscribe_token`, `crm_person_id`.
