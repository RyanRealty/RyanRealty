# Audit Remediation — Progress Log

**Source plan:** `scratch/AUDIT_REMEDIATION_PROMPT.md` (the master prompt from the 2026-06-20 inherited-codebase audit; 174 verified findings).
**How to read:** newest entry at the top of the log. Each step records what/why, the change set, how it was real-tested, the result, and any follow-ups discovered. Status table is the at-a-glance index.

## Status

| Phase | Step | Title | Status |
|---|---|---|---|
| 0 | 0.0 | Governance-gate truth (meta-gate blind spot) | ✅ done (2026-06-20) |
| 0 | 0.1 | MLS sync data-loss | ⏳ next |
| 0 | 0.2 | Auth/access holes | ⬜ todo |
| 0 | 0.3 | CRM compliance fail-safe | ⬜ todo |
| 0 | 0.4 | Market-classification helper | ⬜ todo |
| 1 | 1.1–1.6 | Consolidate duplication | ⬜ todo |
| 2 | 2.1–2.2 | Make the DAL boundary real | ⬜ todo |
| 3 | 3.1–3.5 | Governance + tests + env | ⬜ todo |

## Discovered (cross-step follow-ups, not yet scheduled)

- **Orphaned gate-file backlog (24).** The audit said 4 documented gates ran nowhere; the real number is **28 `scripts/check-*.mjs` that run nowhere**. 4 resolved in 0.0; **24 remain**, tracked in `scripts/gates-wired-baseline.json` (the meta-gate now prints them every run and blocks NEW ones). Triage each: wire into `ci:gates`/a workflow, or delete. This is its own mini-project (each gate must be run + decided).
- **`ci:gates` was already RED on `main`** before this work: `ci:process-canon` (G44) fails because `docs/plans/PAGE_REVIEW_REDESIGN_RUNBOOK.md` is committed but not registered in `docs/DEVELOPMENT_PROCESS.md`. Quick win: register it (status row) or remove the rogue doc. Not fixed here (it's someone's plan doc; needs an owner decision), but it means the static chain is not currently green for reasons unrelated to this step.
- **8 competing homepage mockup contracts** (`homepage`, `-film`, `-magazine`, `-terminal`, `-v4/5/6`, `-v7-cinematic`) all map to `app/page.tsx`; the live KB homepage satisfies none of the component-bearing ones. One was baselined in 0.0 to wire `mockup-parity`; the contract sprawl itself is a Phase-1.5 (design-system consolidation / dead-prototype) cleanup.

---

## Log

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
