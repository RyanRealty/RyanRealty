# CRM Go-Live Execution Log — 2026-06-25

Authoritative progress log for taking the in-house CRM from "code on `main` that doesn't deploy"
to "production-grade, deployed, a real user can walk in and use it." Companion to
`docs/plans/crm-completion-spec-2026-06-25.md` (the build spec) — this file is the EXECUTION + verification record.

## The discovery that reframed everything

The completion spec declared **GO — 11/11 blockers closed, all gates green, 2143 tests pass.** That was
true for `tsc` + the `ci:gates` static chain, but **wrong about production**:

- **Every production deployment since Wave 3 is in Vercel `state: ERROR`.** The last 20 production
  deploys — including current `main` HEAD `88184fff` and every wave commit (Wave 3 `3687d343` →
  Wave 9 `88184fff`) — all failed at `npm run build`. So **no CRM wave ever reached production.**
  `ryan-realty.com` has been serving an older successful build the whole time.
- **Root cause:** four `"use server"` server-action modules exported things that are NOT async
  functions (types, consts, non-async helpers, `export type {}` re-exports). Next.js / Turbopack
  rejects that at build time. `tsc` does not enforce it and `ci:gates` never runs a real `next build`,
  so it passed every gate and silently broke every deploy.
  - `app/actions/crm-suppressions.ts` — `CrmSuppressionResult`, `SuppressionAuditRow`,
    `buildSuppressionAuditRow` (non-async), `checkComplianceLiftAllowed` (non-async)
  - `app/actions/crm-bulk.ts` — `BulkEnqueueResult`, `BulkActionSelection`, `BulkKind`,
    `EMAIL_SUPPRESS_TAGS` (const), `isProtectedBulkTag` (non-async), `buildBulkSelection` (non-async),
    `BulkPreflightResult`
  - `app/actions/crm-field-definitions.ts` — `CrmFieldDefinitionResult`, `export type { CrmFieldDefinitionInput }`
  - `app/actions/crm-templates.ts` — `CrmTemplateResult`, `export type { CrmTemplateInput }`
- **Browser walkthrough of stale prod confirmed the impact:** `/admin/crm` renders (contacts, smart-list
  saved views, filters) but the bulk bar shows only the 2 legacy actions (no Wave 3 bulk-ops dropdown,
  no select-all-matching). `/admin/crm/settings` 404s (redirects to legacy `/admin/console/leads/settings`).
  `/admin/crm/inbox` renders. Mixed = an old deploy, not current `main`.

## The fix (was already staged, uncommitted)

The working tree already contained the correct repair (helper files created 16:22, 2026-06-25, never
committed): the types + consts + non-async helpers were extracted into new plain modules
`lib/crm/bulk-helpers.ts` and `lib/crm/suppression-helpers.ts` (and `CrmFieldDefinitionResult` /
`CrmTemplateResult` moved into their validation modules), with the four `"use server"` files now
exporting ONLY async functions. Confirmed: all four action files export async-only.

## Phases

- [in progress] **Phase 1 — Green build.** Verify the staged fix compiles (`npm run build`), sweep for
  any OTHER build-breakers repo-wide, fix until exit 0.
- [ ] **Phase 2 — Deploy.** Commit ONLY the build-fix files (leave unrelated WIP: tc migrations,
  scripts/crm-a2p-resubmit.mjs, etc.), push to `main`, watch Vercel to READY, confirm prod serves current code.
- [ ] **Phase 3 — End-to-end walkthrough + harden.** Against the fresh deploy, walk every surface
  (contacts list/bulk/saved views, settings/*, record card, inbox, tasks, reports/emails), verify renders
  + key flows, fix what breaks. Throwaway test contact for any send; NO real sends to live contacts.
- [ ] **Phase 4 — Final review pass.** One dedicated multi-dimension review; done = production-grade.

## Guardrails for this run

- A real `next build` must pass before any commit (the gap that caused this whole situation).
- Suppression chokepoint on every send path stays intact; sends only ever to a throwaway test contact.
- Commit verified increments only; push to `main`; confirm each deploy reaches READY.

## Event log

- 2026-06-25 — Discovered all-ERROR prod deploys + root cause. Verified staged fix makes the 4 action
  files async-only. Kicked off real `next build` + read-only audit (use-server sweep / commit plan /
  surface completeness). Added safe dev commands to `.claude/settings.local.json` allowlist.
