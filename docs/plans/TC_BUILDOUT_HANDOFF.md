---
name: TC_BUILDOUT_HANDOFF
description: Resume point for the Vault TC (transaction-coordination) build-out. PAUSED 2026-06-24 at Matt's request. Read this + TC_ARCHITECTURE_REVIEW.md + git log to pick up cold.
metadata:
  type: project
---

# TC Build-Out — Pause / Resume Handoff

**STATUS: PAUSED 2026-06-24** at Matt's request. Do NOT auto-continue the loop;
resume only when Matt explicitly restarts it (`/loop …`) or picks increments by hand.

This is the resume point for the phased build-out of the Vault TC system per
[`TC_ARCHITECTURE_REVIEW.md`](./TC_ARCHITECTURE_REVIEW.md) (the full plan: architecture,
ranked problems C1–C4/H1–H7/M/L, phased refactor strategy, target architecture + code).
It was running as an autonomous `/loop` shipping verified code-only increments, with
production migrations gated on Matt.

## Done (all on `main`, tree green, 1337 tests)

| Increment | What | Commit |
|---|---|---|
| **C4** | Canonical signing field types — `skyslope-field-map` emits `'date_signed'`; `MappedFieldType = SignFieldType` (drift is now a compile error); boundary normalize in `tc-envelopes.ts`; parity tests. **LIVE** — unbreaks OREF date-field template envelope creation. | `7f011bd0` |
| **§5.1 FSM** | `lib/tc/deal-state.ts` — typed envelope FSM (`canTransition`/`assertEnvelopeTransition`/`isTerminalEnvelopeStatus`) + `claimTransition` CAS (the C2 double-seal-race primitive). 8 tests. | `6d6e7ecc` |
| **gate** | `lib/tc/` added to the DAL-boundary write-path allowlist (`check-dal-boundary.mjs`). | `a51c0899` |
| **H4 a** | `banking-days.test.ts` — 13 tests, OAR 863-015-0140 7-banking-day deadline math (holidays + Sat→Fri/Sun→Mon observance). | `2df0776b` |
| **H4 b** | `seal-pdf.ts` — extracted pure `fieldRectToPdf` (the top-left→bottom-left y-flip that places signatures) + 7 tests. | `185a77f5` |
| **H4 c** | `lib/tc/commission-math.ts` — extracted `computeCommissionNets` (gci − fees, split %, brokerage keeps rounded remainder, no penny leak) + 7 tests; `tc-commissions.ts` now calls it. **H4 COMPLETE.** | `f118d335` |
| **H5** | `lib/tc/signing-schema.ts` — zod for the public `/sign` boundary (discriminated-union per field kind, ~750KB PNG cap, bounded text, 200-field cap). 9 tests. NOT wired into `submitSigning` yet (Phase 3). | `ae666409` |

## ⛔ Ready-but-MATT-GATED (need production migration authority)

Three migration files exist in `supabase/migrations/` but are **NOT applied** — the
auto-mode classifier hard-blocks autonomous production DDL even with verbal
authorization (it wants a Supabase/Bash permission rule, or Matt applies them):

- `20260623130000_tc_envelope_fields_type_parity.sql` — drop the dead `'strike'` from the CHECK (DB↔TS parity; table is empty so zero-risk).
- `20260623131000_tc_events_immutable_trigger.sql` — **H1**: a `BEFORE UPDATE OR DELETE` trigger making `tc_events` append-only for the service role (legal audit immutability, ORS 696.280).
- `20260623132000_tc_recipient_token_index.sql` — **M2**: unique partial index on `tc_envelope_recipients.auth_token_hash` (the public signing hot path).

**To unblock:** Matt applies these (Supabase SQL editor / `supabase db push`) OR adds a
permission rule so the agent can apply migrations. Then `git add` + commit the 3 files
(they're untracked until applied, to respect production parity).

## NEXT code-only increments (no migrations needed)

Build modules + tests; do NOT rewire live actions; do NOT touch the seal/signing core
(C1/C2/C3). Process: `git add` new files BEFORE `npm run ci:gates`; commit only on
ci:gates exit 0; tests must live under `lib/**` (the vitest glob excludes `app/**`).

1. **§5.3** `lib/data/tc/_client.ts` (one `getServiceSupabase`) + a cached batched
   deal-detail reader. Read `docs/DATABASE_SCHEMA_SNAPSHOT.md` for exact
   `tc_deals`/`tc_cycles`/`tc_documents`/`tc_checklist_items`/`tc_envelopes`/
   `tc_envelope_recipients` columns + keys, then: load deal by key → load cycles →
   batch child tables in `.in('cycle_id', cycleIds)` (no per-cycle N+1) → wrap in
   `unstable_cache` with a `tc-deal:<key>` tag (H6/M3). `lib/data` is the canonical
   read home (`lib/tc` is allowlisted for writes). Thin reader; don't wire into the page yet.
2. **§5.4 _auth (H7)** — consolidate the ~13 inline `requireBroker`/`requireBrokerRole`
   copies into one `requireBrokerRole` + `requirePrincipal` (+ deal-ownership scoping). Module + tests.
3. **L4** export `clamp01` once (dup in `skyslope-field-map.ts` + `tc-envelopes.ts`).
   **L5** one `signerRoleToRecipientRole` map (replace the `startsWith` prefix-match).
   **M8** one doc-recognition vocabulary in `lib/tc/required-documents.ts` the dashboard
   `StepTracker` derives from — extract + test the pure matcher.

## Phase 1+ (AFTER migration authority — the structural integrity work)

- Add a `'sealing'` status to the `tc_envelopes.status` CHECK + `signing.ts` `EnvelopeStatus`
  + the `deal-state.ts` transition table (migration).
- Postgres RPCs (migration, review §5.2): `submit_recipient_signing` (atomic field-writes +
  completion + ordering-gate re-check + event — closes **C1/H3**); `claim_envelope_seal`
  (CAS into `sealing` — closes **C2**). The `claimTransition`/FSM in `deal-state.ts` is the
  TS-side primitive already built for this.
- Rewire `submitSigning` to call the RPCs + the `signing-schema.ts` zod + enqueue the seal
  off-request (**Phase 2, C3**); a reconciliation cron re-seals stranded envelopes.
- **Phase 3**: wire `signing-schema` + `_auth` into the live actions; decline-doesn't-strand
  (H2); rate-limit `/sign` (M7).
- **Phase 4**: extract reads to `lib/data/tc` (H6); DB↔TS parity gate; consolidate vocab.
- **Phase 5**: cache hot reads (M1) + remaining tests.
- A **concurrency test** (two simultaneous final submissions → exactly one executed doc /
  one completion email per party / one event) gates Phase 1.

## How to resume

1. Read [`TC_ARCHITECTURE_REVIEW.md`](./TC_ARCHITECTURE_REVIEW.md) (the plan) + this file.
2. `git log --oneline | grep -i tc` to see what's landed.
3. If Matt has granted migration authority: apply the 3 ready migrations + commit them, then start Phase 1.
4. Otherwise continue the NEXT code-only increments above. Re-arm the `/loop` with the
   build-out prompt, or pick increments by hand.

## Separate open item (NOT part of TC)

**LISTING PAGE** — Matt says it "doesn't look right," but the Playwright screenshot tool is
bot-walled on the `/homes-for-sale/listing/*` route (a "couldn't verify the security"
interstitial blocks the listing photos + the Google map in headless), so the "dark hero /
blank map" observed were **screenshot artifacts**, and the map config is actually correct
(bootstrap mounted, CSP allows maps). The hero-scrim lighten shipped (`e7e618cd`) but is
unverified. **BLOCKED on Matt's one-line answer** about what is actually wrong on his real browser.
