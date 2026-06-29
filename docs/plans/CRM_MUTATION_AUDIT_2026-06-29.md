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

### MEDIUM

- **[D4–D7] `app/actions/crm-bulk.ts` — VERIFIED SAFE (false positive).** The
  enqueue FREEZES `broker_scope = scopeBroker(access)` onto the job, and the worker
  (`app/api/cron/crm-bulk-worker/route.ts`) enforces it at drain: ast-mode resolves
  ids under the frozen scope via `buildCrmPeopleQuery`, and ids-mode runs a
  **defensive per-chunk scope re-clamp** (lines 90–122) that re-intersects each
  chunk with the same scope query and skips out-of-scope ids. A restricted broker
  cannot mutate contacts outside their scope through the bulk path. No fix needed.
- **[O6–O9] `app/actions/newsletter.ts` — saved-search CRUD per-person scope — ✅
  FIXED (2026-06-29).** (Correction: these write to `guest_search_alerts`, not
  `saved_searches` — the alert links to a lead by `email` + `fub_person_id`.)
  Added a `leadOutOfScope()` guard to `adminAssignSavedSearchAction`,
  `adminUpdateSavedSearchAction`, `adminDeleteSavedSearchAction` and a per-id
  `requirePersonInScope` to `adminBulkAssignSavedSearchAction`: a restricted broker
  is refused (or silently skipped, bulk) when the lead resolves to a different
  broker; owner/superuser and unresolvable/new leads pass. The ownership read is
  the DAL `lib/data/crm/leadAssignedBroker.ts` (`resolveLeadAssignedBroker` by
  fub_legacy_id or email-jsonb containment, + `getGuestAlertLead`), keeping the
  action free of raw reads. Email-containment resolution verified against a live
  lead; owner path is a provable no-op. Two guard models reconciled (requireAdmin
  gate kept, getCrmAccess scope added).

### MINOR / informational

- **[O13] `adminSendNewsletterAction` — ✅ FIXED.** Added
  `revalidatePath('/admin/newsletters')` after the send so the admin list reflects
  the sent/failed status without a manual reload.
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
