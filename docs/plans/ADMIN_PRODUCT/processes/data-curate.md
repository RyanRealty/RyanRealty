# Process: data-curate — Listing + geography data correction

## 0. Meta
- Status: deepened
- Cadence: rare (defect-driven)
- Verdict: MERGE→sync-ops (proposed; P3 decides) — it is the human remediation arm of sync health
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
When synced data is wrong or incomplete (bad listing field, unassigned neighborhood, missing resort-community flag), a broker fixes it once and the fix sticks.

## 2. Inception (what starts it)
- Trigger type: broker action (spotting an error; occasionally prompted by a health alarm or consumer report)
- Concrete: `/admin/listings` browse/search/CSV-export (`getAdminListingsPage`, `searchAdminRemarksPage`); `/admin/listings/[listingKey]` editor (`getAdminListingEditableData`); `/admin/geo` tree browse/assign (`listGeoPlaces`); `/admin/geo/resort-communities` flags (`listSubdivisionsWithFlags` — registry SoT `data/resort-communities.json`); area-guide upload.
- Entry evidence: routes + DAL per P1 inventory; `crm-geo-resolve` cron as the automated sibling (backfills person geo — `route.ts:50,73`).

## 3. Actors
- Human: Matt/broker (accountable for the correction).
- Automated: next sync/MV refresh propagates; geo-resolve cron.

## 4. Systems of record
- `listings` (with editable-overlay semantics — verify in P4 whether edits survive re-sync or live in a separate overlay), geo tables, `data/resort-communities.json` (registry canon per §7).
- NOT SoR: the MLS for locally-corrected fields (the whole point) — but overwrite behavior must be proven.

## 5. End-to-end path
1. **Error spotted** · human · via browse/search or report · desktop
2. **Edit** · human · listing editor / geo assign / flag toggle · failure: unclear survival across next delta sync (P4 question — highest-risk unknown here)
3. **Propagate** · system · MV refresh (hourly) carries it to search/tiles · n/a
4. **Verify** · human · public page shows the fix · rarely done

## 6. Decision points
- Sync-owned field vs locally-owned field? → overwrite semantics (P4 to prove).
- Geography change? → affects market stats scoping (cache keys — memory: market cache geo keys) — a wrong assign corrupts stats downstream (§0 adjacency).

## 7. Completion
- Done-when: fix visible on public surfaces and stable across the next sync cycle.
- Terminal states: fixed-stable · reverted-by-sync (defect class).

## 8. Time & SLA
- None; propagation ≤1h (MV cadence).

## 9. Variants
- Listing field · geo assignment · resort-community flag · area-guide media.

## 10. Current implementation map
- Routes: 5 pages + 1 redirect.
- Known defects: (a) edit-survival across sync unproven; (b) no audit trail of manual corrections surfaced; (c) geography edits' stat impact invisible at edit time.
- Duplicate paths: none.

## 11. Target shape (process-level, not pixels)
- Should exist as sync-ops' remediation arm: correction UI reached FROM the health/ops destination; every manual override recorded + sync-proof; stat-impact warning on geo changes.
- UI destination implication: folds into the ops destination; not standalone.

## 12. Acceptance checks
- [ ] Edit a listing field → next delta sync does NOT revert it (or the overlay model is documented and holds).
- [ ] Assign a neighborhood → tile/search MVs reflect it ≤1h; market stat scoping unchanged unless intended.
- [ ] Toggle a resort-community flag → registry JSON + DB agree (G-gate parity).
