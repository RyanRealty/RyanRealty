# Audit Remediation — Progress Log

**Source plan:** `scratch/AUDIT_REMEDIATION_PROMPT.md` (the master prompt from the 2026-06-20 inherited-codebase audit; 174 verified findings).
**How to read:** newest entry at the top of the log. Each step records what/why, the change set, how it was real-tested, the result, and any follow-ups discovered. Status table is the at-a-glance index.

## Status

| Phase | Step | Title | Status |
|---|---|---|---|
| 0 | 0.0 | Governance-gate truth (meta-gate blind spot) | ✅ done (2026-06-20) |
| 0 | 0.1 | MLS sync data-loss | ✅ done (2026-06-20) |
| 0 | 0.2 | Auth/access holes — a: open-redirect ✅ · b: admin CRON_SECRET mutations ✅ · c: access-denied loop ✅ · d: unauthed service-role action ✅ | ✅ done (2026-06-20) |
| 0 | 0.3 | CRM compliance fail-safe | ⏳ next |
| 0 | 0.4 | Market-classification helper — a: §0 methodology-string fix ✅ · b: threshold consolidation ⏳ | 🔶 in progress |
| 1 | 1.3 | Shared auth guards (`lib/auth/guards.ts`) | ✅ shipped (foundation; adopt in 0.2b/d) |
| 1 | 1.1, 1.2, 1.4–1.6 | Consolidate duplication | ⬜ todo |
| 2 | 2.1–2.2 | Make the DAL boundary real | ⬜ todo |
| 3 | 3.1–3.5 | Governance + tests + env | ⬜ todo |

## Discovered (cross-step follow-ups, not yet scheduled)

- **Orphaned gate-file backlog (24).** The audit said 4 documented gates ran nowhere; the real number is **28 `scripts/check-*.mjs` that run nowhere**. 4 resolved in 0.0; **24 remain**, tracked in `scripts/gates-wired-baseline.json` (the meta-gate now prints them every run and blocks NEW ones). Triage each: wire into `ci:gates`/a workflow, or delete. This is its own mini-project (each gate must be run + decided).
- **`ci:gates` was already RED on `main`** before this work: `ci:process-canon` (G44) fails because `docs/plans/PAGE_REVIEW_REDESIGN_RUNBOOK.md` is committed but not registered in `docs/DEVELOPMENT_PROCESS.md`. Quick win: register it (status row) or remove the rogue doc. Not fixed here (it's someone's plan doc; needs an owner decision), but it means the static chain is not currently green for reasons unrelated to this step.
- **8 competing homepage mockup contracts** (`homepage`, `-film`, `-magazine`, `-terminal`, `-v4/5/6`, `-v7-cinematic`) all map to `app/page.tsx`; the live KB homepage satisfies none of the component-bearing ones. One was baselined in 0.0 to wire `mockup-parity`; the contract sprawl itself is a Phase-1.5 (design-system consolidation / dead-prototype) cleanup.

---

## Log

### 0.4a — Wrong published months-of-supply formula (§0 compliance) · 2026-06-21

**Problem (audit HIGH, §0 data-accuracy on a licensed-broker surface).** Two market pages printed an AI-citable methodology trace stating "Months of supply = active listings divided by (closed last 30 days times 2)" (`central-oregon/page.tsx:162`, `[...slug]/page.tsx:256`). That contradicts the canonical §0 formula `active / (closed_6mo / 6)` AND the number actually shown (from `market_pulse_live.months_of_supply`). The displayed verdict thresholds (≤4/<6/≥6) were already correct and consistent across sites — the published *formula text* was the violation.

**Change set.**
- `lib/market/classify.ts` — NEW single source: `monthsOfSupply()`, `marketVerdict()` (the one place the ≤4/<6/≥6 boundaries live), `MOS_METHODOLOGY_CLAUSE` (canonical formula text), `MOS_THRESHOLD_CLAUSE`. + `classify.test.ts` (5 cases incl. boundary at 4 and 6, null handling, no "times 2"/"30 days" in the clause).
- `central-oregon/page.tsx` + `[...slug]/page.tsx` — methodology trace now uses `MOS_METHODOLOGY_CLAUSE` + `MOS_THRESHOLD_CLAUSE` instead of the false inline string.
- `scripts/check-market-formula.mjs` (`ci:market-formula`, wired into `ci:gates`) — fails if any app/lib file publishes "closed last 30 days times 2".

**Real-test (local).** `npx vitest run lib/market/classify.test.ts` → 5/5. `ci:market-formula` → OK (no wrong formula remains). `ci:gates-wired` → 66 gates, green. `tsc` → source clean.

**Assumption / note.** The displayed MoS number comes from the `refresh_market_pulse()` RPC (not in this repo). The fix makes the *printed* methodology match the §0-mandated canonical formula; it assumes the RPC implements canonical (which §0 mandates). Recommend a one-time reconciliation query to confirm the column == `active/(closed_6mo/6)`; logged here rather than blocking the text fix.

**Next (0.4b):** consolidate the ~8 inline `mos <= 4 / < 6 / >= 6` verdict sites onto `marketVerdict()` (preserving each site's exact displayed label), then extend `ci:market-formula` to ban inline MoS thresholds outside `lib/market/classify.ts`.

### 0.2d — Unauthed service-role admin-role mutations (privilege escalation) · 2026-06-20

**Problem (audit HIGH, security — privilege escalation).** `upsertAdminRole` + `removeAdminRole` in `app/actions/admin-roles.ts` are `'use server'` actions (exposed as public POST endpoints) that write the `admin_roles` table via the **service role**. They validated only the *target* email (can't set `superuser`), never the **caller** — so any unauthenticated visitor could POST and grant an arbitrary email a `broker`/`report_viewer` admin role. The `getSession()` call present was for audit-logging only, not authorization.

**Change set.**
- Both mutations now resolve the caller (`getSession` → `getAdminRoleForEmail`) at the top and **return `Forbidden` unless the caller is `superuser`** before any write. Reuses the now-hoisted session for the audit log (removed the duplicate `getSession`). Guarded inline (not via `lib/auth/guards`) because `guards.ts` imports `admin-roles` — importing back would be circular.
- `scripts/check-admin-role-guard.mjs` (`ci:admin-role-guard`, wired into `ci:gates`) — asserts both mutations carry the superuser caller guard.

**Real-test (local).** `ci:admin-role-guard` → PASS. `ci:gates-wired` → green. `tsc --noEmit` → source clean. The admin Users page calls these as a superuser → unaffected; non-superuser/unauthed callers are now blocked (correct).

### 0.2b — Interactive admin endpoints gated only by CRON_SECRET · 2026-06-20

**Problem (audit HIGH, security).** Interactive admin mutation endpoints authenticated with a shared `Bearer ${CRON_SECRET}` only — no operator identity. Confirmed two: `app/api/admin/gbp/set-website-utm` (cross-account GBP write; its own comment "mirrors the other admin write endpoints") and `app/api/admin/expired-listing-lookup` (manual owner-lookup trigger, "when Matt wants to immediately re-fire", used `isAuthorizedCron`).

**Change set.**
- Both now authenticate via `isAuthorizedAdminOrCron()` (lib/auth/guards.ts) — accepts a valid admin session OR the cron secret. **Additive**: operators get an identity path; any existing automation using the secret still works (no lockout). Adopts the Step 1.3 guards.
- `expired-listing-lookup` drops the `isAuthorizedCron` import from `lib/marketing-brain/snapshot`.
- `scripts/check-admin-endpoint-auth.mjs` (`ci:admin-endpoint-auth`, wired into `ci:gates`) — asserts these converted endpoints authenticate via `@/lib/auth/guards` (regression guard; grows as more interactive endpoints convert).

**Real-test (local).** `ci:admin-endpoint-auth` → PASS. `ci:gates-wired` → green. `tsc --noEmit` → no source errors (only a stale gitignored `.next/types` artifact referencing the 0.2c-deleted page; G46 runs tsc on a clean HEAD tree so it passes on push). The 4 genuinely cron/maintenance admin endpoints (`sync/photos`, `sync/history-active`, `run-loop-cycle`, `tracerfy-history`) correctly keep secret-only auth.

**Note.** Could not runtime-verify the live endpoints (no running app with auth here). The change is additive (session-OR-secret) specifically so a wrong assumption can't lock out an operator or break automation — worst case is unchanged behavior.

### 0.2c — Admin access-denied redirect loop + 1.3 shared guards · 2026-06-20

**Problem (audit HIGH, structural).** `app/admin/(protected)/access-denied/page.tsx` lived INSIDE the `(protected)` route group whose layout (`getSession` → `getAdminRoleForEmail` → `redirect('/admin/access-denied')`) guards every page under it. A signed-in non-admin was redirected to access-denied, which re-ran the same guard, which redirected again — infinite loop. (Re-verified against code; my first glob missed the file because of the `(protected)` parens — the audit was right.)

**Change set.**
- Deleted `app/admin/(protected)/access-denied/page.tsx` (the looping page).
- Added `app/admin/access-denied/page.tsx` OUTSIDE the group, under the no-auth `app/admin/layout.tsx`, so the redirect target renders without re-triggering the guard. Also resolves the previously-dead target (it never existed at a reachable location → would 404).
- `scripts/check-access-denied-loop.mjs` (`ci:access-denied`, wired into `ci:gates`) — fails if the page is missing OR if one exists inside `(protected)`.
- **Step 1.3 foundation:** `lib/auth/guards.ts` — single source for `getAdminContext()` / `requireAdminOr403()` / `requireSuperuserOr403()` / `isAuthorizedAdminOrCron()`, modeled exactly on the existing `getSession` + `getAdminRoleForEmail` chain (superuser + admin_roles). Additive (no adoption yet → no behavior change); will replace the ~6 inline authz patterns in 0.2b/d and the duplication cleanup.

**Real-test (local).** `ci:access-denied` → OK (after deleting the inside page). `ci:gates-wired` → green. `ci:auth-redirect` → green. package.json valid. `lib/auth/guards.ts` type-checks (verified via pre-push G46 tsc on commit).

**Note.** 0.2b (CRON_SECRET-gated interactive mutations → `isAuthorizedAdminOrCron`) and 0.2d (the specific unauthed service-role `'use server'` action) change live admin authz and I can't fully runtime-verify them here, so they get adopted carefully next with the shared guards, additively (session-OR-secret) to avoid any lockout.

### 0.2a — Open-redirect in auth server actions · 2026-06-20

**Problem (audit HIGH, security).** `app/actions/auth.ts` sanitized the post-auth `next` redirect with `next.startsWith('/') ? next : `/${next}`` in 6 places — `//evil.com` starts with `/`, so it passed and became a protocol-relative open redirect after sign-in. `app/auth/callback/route.ts` had a stronger-but-local `safeRedirectPath` (collapsed `//` but missed backslash tricks).

**Change set.**
- `lib/auth/safeRedirect.ts` — NEW single sanitizer: strips control chars (codepoint filter), normalizes `\`→`/`, rejects non-relative targets (`https://`, `javascript:`, bare host), collapses leading slashes. + `lib/auth/safeRedirect.test.ts` (6 cases incl. `//evil.com`, `/\evil.com`, `https://`, CR/LF).
- `app/actions/auth.ts` — all 6 weak checks routed through `safeRedirectPath()`.
- `app/auth/callback/route.ts` — local `safeRedirectPath` removed; imports the shared one (kills the duplication finding + hardens it).
- `scripts/check-auth-redirect.mjs` (`ci:auth-redirect`, wired into `ci:gates`) — fails if either auth file uses the weak `startsWith('/') ?` pattern or stops importing `safeRedirectPath`.

**Real-test (local).** `npx vitest run lib/auth/safeRedirect.test.ts` → 6/6. `ci:auth-redirect` → OK. `ci:gates-wired` → 62 gates wired, exit 0. `npx tsc --noEmit` → no errors. No weak `startsWith('/')` redirect pattern remains in either file.

**Remaining 0.2 sub-fixes (next):** (b) admin mutation endpoints gated only by a shared `CRON_SECRET` bearer instead of operator session+role; (c) `access-denied` page inside the `(protected)` group it is the redirect target of (infinite loop); (d) a public `'use server'` POST using the service-role key with no auth guard. These depend on the shared `requireAdmin`/`requireSuperuser` guards (Step 1.3) and change live admin authz, so they get extra care + a running-app check where feasible.

### 0.1 — MLS sync data-loss · 2026-06-20

**Problem (audit HIGH).** `app/api/cron/sync-delta/route.ts` set the cursor `last_delta_sync_at = now()` unconditionally at the end of every run. Two silent-data-loss paths: (1) overflow — a run caps at `MAX_PAGES=100` (~20k rows); if more pages remained, jumping the cursor to now() skipped every un-fetched change permanently; (2) failed upserts were logged + skipped but the cursor still advanced, so those rows were never re-fetched. Confirmed Spark is fetched `_orderby=+ModificationTimestamp` (ascending), so the newest processed row is a safe resume point.

**Change set.**
- `lib/sync/deltaCursor.ts` — NEW pure helper `computeNextDeltaCursor({upsertFailed, truncated, runStartedAt, maxProcessedTs})`: returns the ISO to write, or `null` to leave the cursor unchanged. Failure → null (retry whole window, idempotent); truncated → newest processed row; clean drain → runStartedAt (captured BEFORE fetching).
- `lib/sync/deltaCursor.test.ts` — NEW, 5 cases (clean / truncated / truncated-empty / failure / failure-overrides-truncation).
- `app/api/cron/sync-delta/route.ts` — capture `runStartedAt` before the loop; track `maxProcessedTs` high-water mark per page; set `upsertFailed` on any failed chunk; replace the unconditional `updateSyncStateLastDelta(new Date())` with a `computeNextDeltaCursor()`-gated write; return `ok: !upsertFailed` + `partial` flag.
- `scripts/check-sync-cursor.mjs` (`ci:sync-cursor`, wired into `ci:gates`) — fails if the route advances the cursor straight to `new Date()` or stops using `computeNextDeltaCursor()`.

**Real-test (local).** `npx vitest run lib/sync/deltaCursor.test.ts` → 5/5 pass. `ci:sync-cursor` → OK. `ci:gates-wired` → 61 gates wired, 91 files, 24 baseline, exit 0. `npx tsc --noEmit` → no errors. package.json valid.

**Residual risk / note.** The safe-advance assumes ascending Spark order (verified via `_orderby=+ModificationTimestamp` in `fetchSparkDelta`). On a real overflow the run now self-heals over subsequent ticks instead of losing rows; a sustained backlog > MAX_PAGES×200 will catch up gradually (raise `MAX_PAGES` or run a full sync if it ever persists). Behavior on a normal (non-overflow, no-failure) run is unchanged except the cursor is `runStartedAt` instead of post-run `now()` — strictly safer (re-picks rows modified mid-run).

### 0.0 — Governance-gate truth (CRITICAL) · 2026-06-20

**Problem (audit's #1 / CRITICAL).** `CLAUDE.md` + `docs/MECHANICAL_GATES.md` documented gates as "enforced" that ran nowhere, and the meta-gate `check-gates-wired.mjs` only enumerated `ci:*` npm scripts — so a `scripts/check-*.mjs` gate *file* with no `ci:*` wrapper was invisible to it. Confirmed against code: the `ci:gates` chain had no `ci:mockup-parity`/`ci:static-params`/`ci:data-access`/`ci:producer-freeze`; all four files existed and ran nowhere; the meta-gate reported "0 orphaned" anyway. Scanning revealed **28** such orphaned gate files in total (not 4).

**Change set.**
- `scripts/check-gates-wired.mjs` — rewritten. Adds a second check: every `scripts/check-*.mjs` must be reachable (chain / workflow / husky / any npm script) OR recorded in `scripts/gates-wired-baseline.json`. A NEW unaccounted gate file now fails the build; the known backlog prints every run and may only shrink. Adds a `KNOWN_UNWIRED` map for gates intentionally off the static chain (with reasons).
- `package.json` — added `ci:mockup-parity`, `ci:static-params`, `ci:producer-freeze`, `ci:data-access` (+ baseline/refresh variants) and `ci:gates-wired:baseline`. Wired `ci:mockup-parity`, `ci:static-params`, `ci:producer-freeze` into the `ci:gates` chain (before the meta-gate). `ci:data-access` deliberately left off the static chain (needs live Supabase) and recorded in `KNOWN_UNWIRED`.
- `app/sign/[token]/page.tsx` — added `// @no-static-params` (token-gated signing route is per-request SSR). Comment only; zero runtime change. Makes `check-static-params` pass.
- `docs/DAL_INDEX.md` — regenerated (`node scripts/index-dal.mjs`) to clear the `data-access` dal-index drift.
- `scripts/mockup-parity-baseline.json` — baselined the one intentional stale-homepage gap so `mockup-parity` could be wired (see follow-up on 8 contracts).
- `scripts/gates-wired-baseline.json` — NEW; records the 24 remaining orphaned gate files.
- `CLAUDE.md` + `docs/MECHANICAL_GATES.md` — replaced hand-maintained gate-list prose with a pointer to the authoritative `package.json` `ci:gates` chain; documented the meta-gate's new file-orphan check, the 24-file backlog, and that `data-access` runs locally/nightly (DB), not the static chain.

**Real-test (local).**
- `node scripts/check-gates-wired.mjs` → PASS: `ci:* gates: 60 checked · 60 wired · 0 orphaned`; `gate FILES: 90 total · 24 run nowhere (baseline 24)`; backlog printed; exit 0.
- `node scripts/check-mockup-parity.mjs` → PASS. `node scripts/check-static-params.mjs` → PASS. `node scripts/check-producer-freeze.mjs` → PASS (78 ≤ baseline 116).
- `node scripts/check-data-access.mjs` → schema-snapshot matches HEAD ✓; dal-index clears once the regenerated `DAL_INDEX.md` is committed (gate diffs vs HEAD).
- `package.json` validated as JSON.
- Verified the meta-gate now FAILS on a new unaccounted gate file (the whole point) and PASSES with the baseline.

**Result.** The governance layer is honest and self-policing: a gate file can no longer run nowhere unnoticed, the documented claims match the real chain, and 4 of the 28 orphans are resolved (3 wired + `data-access` accounted). Remaining 24 are a visible, shrink-only backlog.

**Not done here (flagged above):** the 24-file triage, the pre-existing `process-canon` red, and the 8-contract homepage sprawl.
