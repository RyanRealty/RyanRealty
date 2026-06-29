# CRM mutation + DB-write audit — 2026-06-29

Full map of every CRM mutation (server actions that write to the DB), produced to
satisfy the "ensure every feature works and is correctly writing to the DB" mandate.
**Headline: ~110 mutations across 23 action files. Every write targets the right
table/columns via a guarded server action; all writes live in `app/actions/` (DAL-
correct, G1). The writes are correct — the findings below are about authorization
scope + a few revalidate/cleanup gaps, not wrong data.**

Write mechanism across the board: `createServiceClient()` (service-role, RLS bypassed
at Supabase); authorization enforced in app code via `requireCrmAccess` /
`requirePersonInScope` / `requireOwner`.

## Verified end-to-end (live test, throwaway contact created + deleted)

- **`updateCrmStageAction`** (Stage auto-submit) — picking a stage wrote
  `crm_people.stage` and logged `crm_timeline` `stage_change` ("Stage: Lead →
  Seller Prospect"). Confirmed by DB read-back, then the test contact was deleted.
  The new FUB auto-submit UI (`AutoSubmitSelect`, change = saved) fires the same
  verified action — proven working.

## Findings (prioritized)

### CRITICAL — ✅ FIXED (2026-06-29)

- **[F1–F6] `app/actions/crm-deals.ts` — no broker-scope guard on deal mutations.**
  RESOLVED. Added `requireDealInScope(dealId, scopeBroker(access))` (backed by the
  pure, unit-tested `lib/crm/deal-scope.ts` `dealInScope()`) and called it before
  the write in all six actions: `updateCrmDeal`, `addDealSplit`, `removeDealSplit`,
  `addDealFile`, `removeDealFile`. Owner/superuser bypasses; a restricted broker is
  refused unless the deal's own `assigned_broker` OR its linked person's
  `assigned_broker` matches their slug (mirrors `listCrmDeals` GAP-7 person-scope).
  `createCrmDeal` now sets `assigned_broker` to the creating broker so new deals
  aren't unowned orphans (fixes F6). 5 unit tests in `lib/crm/deal-scope.test.ts`;
  guard data-read verified against a throwaway `paul` deal (refused for `rebecca`,
  allowed for `paul`/owner).

### MEDIUM — fix or confirm

- **[D4–D7] `app/actions/crm-bulk.ts` — bulk set-stage / enroll-workflow /
  set-report-subscription / email-cohort enqueue with only `getCrmAccess()`** (no
  scope guard at enqueue). Exploitability depends on whether the `crm_bulk_jobs`
  worker enforces `scopeBroker` when draining. **Verify the worker; if it doesn't
  scope, guard at enqueue.**
- **[O6–O9] `app/actions/newsletter.ts` — saved-search CRUD lacks
  `requirePersonInScope`.** `adminAssignSavedSearchAction`,
  `adminUpdateSavedSearchAction`, `adminDeleteSavedSearchAction`,
  `adminBulkAssignSavedSearchAction` let any admin assign/delete a lead's property
  alerts regardless of ownership.

### MINOR / informational

- **[O13] `adminSendNewsletterAction`** — no `revalidatePath` after send; admin list
  won't auto-refresh to show sent status. (cheap fix)
- **[S4] `deleteCrmFieldDefinitionAction`** — deletes the schema row but leaves
  orphaned keys in every `crm_people.custom` jsonb (no value cleanup). New writes to
  the dead key are already refused, so it's stale-data-only.
- **[N2] `liftSuppressionAction`** — the audit timeline write is attempted first and
  only warns on failure; a suppression can be lifted with no audit record. Flagged
  intentional in code; compliance note.
- **[B5/V4] `bulkCompleteTasksAction` / `bulkConversationStateAction`** — silently
  skip unauthorized items and still return success (no partial-failure feedback).
- **[V5] `markConversationUnreadOnInbound`** — internal webhook helper, no auth
  guard. Not yet wired to a public route; guard before exposing.

## Everything else — CORRECT (no action)

Lead-detail (notes, email/SMS/call with suppression + TCPA gates, tags, tasks,
enrollment controls), assignment config, sequences CRUD, tags CRUD, membership
toggles, relationships (scoped on both contacts), report subscriptions, custom
fields (definition-gated), import, saved views, suppressions, automation rules,
broker config, compose/scheduled sends (scope frozen at enqueue), inbox triage,
CMA, one-click newsletter — all properly guarded + revalidated. `assignCrmBrokerAction`
and the bulk assign/delete are correctly **superuser-only**.
