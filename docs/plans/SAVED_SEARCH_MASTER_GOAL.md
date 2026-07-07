# /goal — Best-in-class saved search + subscription system

**Owner:** Cursor agent session, 2026-07-06. **Status: in flight.**

## End state (definition of done)

1. Users can build, edit, pause, and manage saved searches with full filter fidelity (every key in `FILTER_KEYS` from `lib/search-filters.ts`), and receive branded HTML listing-alert emails on their chosen cadence.
2. Users can self-subscribe to market report emails per area from their account.
2b. **Every saved-search and market-report email carries open + click tracking (Matt directive 2026-07-06: standard practice for all CRM email).** Every send path routes through `attributeOutbound` (`lib/crm/attributed-links.ts`): broker attribution (`?agent=` per assigned lead) first, then `instrumentEmailHtml` (signed open pixel + click-wrapped links → `crm_timeline` `email_open`/`email_click` rows). This requires resolving the recipient to a `crm_people.id` and their assigned broker on every send. Market reports already comply; saved-search alerts (currently plain text, no person linkage) must be upgraded to HTML + tracked. Unsubscribe/compliance links stay unwrapped per `isComplianceLink`.
3. Admin can subscribe any CRM contact to a saved search **with real filters** (not `{}`), and to market reports, individually and in bulk from `/admin/crm`.
4. Admin has a unified Subscriptions hub to search, filter, and bulk-manage (pause/resume/frequency/delete) all listing alerts and market report subscriptions in one place.
5. `npm run build`, `npm run test`, `npm run ci:gates` pass. Browser-verified end to end (user flow + admin bulk flow) with screenshots. Pushed to `main`, hosted Supabase migrated, `npm run deploy:verify` green.

## Existing system (do not rebuild)

- `saved_searches` (signed-in) + `guest_search_alerts` (guest/broker) tables; claim-on-sign-in; unsubscribe tokens; daily cron `app/api/cron/saved-search-alerts` (14:00 UTC).
- `crm_report_subscriptions` (person_id unique, areas[], frequency) + daily cron `app/api/cron/crm-market-report-send` (16:00 UTC) + HTML email in `lib/crm/market-report-email.ts`.
- CRM bulk-job framework: `components/admin/crm/BulkActions.tsx` → handlers in `lib/crm/bulk-handlers/` → `/api/cron/crm-bulk-worker`.
- Filter model: `lib/search-filters.ts` (`FILTER_KEYS`, `normalizeSavedSearchFilters`, `savedFiltersToAdvanced`, `buildSearchUrlFromFilters`, `getFiltersSummary`).

## Workstreams

| WS | Scope | Owns (files) | Depends on |
|----|-------|--------------|------------|
| W1 Foundation | Migration (origin/assigned_by on saved_searches), admin subscriptions DAL + actions, bulk handler `crm:assign-saved-search` with real filters, fix legacy bulk assign | `supabase/migrations/2026070613*`, `lib/data/crm/subscriptionsAdmin.ts` (new), `app/actions/subscriptions-admin.ts` (new), `lib/crm/bulk-handlers/assign-saved-search.ts` (new) + handler registry, `app/actions/newsletter.ts` | — |
| W2 Email + delivery | Branded HTML listing-alert email **with open/click tracking via `attributeOutbound`** (resolve `crm_person_id` + assigned broker per recipient; backfill person linkage by email when missing), cron hardening (DB-side paused filter, more listings, 4x/day cadence so "instant" ≈ 6h is honest) | `lib/crm/listing-alert-email.ts` (new), `app/actions/saved-search-alerts.ts`, `vercel.json` | — |
| W3 User UI | Full filter capture on save, filter edit dialog in account, market report self-subscribe | `components/SaveSearchButton.tsx`, `components/search/SearchAlertCapture.tsx`, `app/account/saved-searches/*`, `components/dashboard/DashboardNotificationPrefs.tsx`, `app/actions/market-report-optin.ts` (new), `lib/data/crm/reportSubscriptionSelf.ts` (new) | — |
| W4 Admin UI | Unified Subscriptions hub, BulkActions saved-search modal with filter builder + skip feedback | `app/admin/(protected)/crm/subscriptions/*` (new), `components/admin/crm/subscriptions/*` (new), `components/admin/crm/BulkActions.tsx`, `app/components/admin/admin-nav.ts` | W1 |
| W5 Integration + ship | Build, tests, browser E2E, screenshots, commit, push, hosted migration, deploy:verify | orchestrator | W1–W4 |

## Hard constraints (every workstream)

- Email tracking: every outbound subscription email (listing alert, market report) routes its HTML through `attributeOutbound` with a real `crm_people.id` and the assigned broker's slug. No plain-text sends, no unwrapped links except compliance links.
- Design system: shadcn/ui from `@/components/ui/` only, semantic tokens only, `cn()` only.
- DAL boundary: no raw `.from()` outside `lib/data/`. Server actions return `{ data, error }`, never throw.
- Brand voice in all user-facing copy: no em-dashes, no semicolons, no banned words, sentence case headings.
- File ownership above is exclusive — do not edit another workstream's files.
- Verification per WS: `npx tsc --noEmit` clean on touched files + lint clean. Full build runs at W5.
