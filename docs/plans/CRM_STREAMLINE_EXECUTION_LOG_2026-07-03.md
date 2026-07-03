# CRM Streamline — Execution Log (2026-07-03)

Live progress record for the coordinated streamline execution. Specs: `CRM_STREAMLINE_PLAN_V2_2026-07-03.md`
+ the two audit-findings docs. Reversible at every phase.

## Phases

| # | Phase | State | Reversal |
|---|---|---|---|
| 1 | Tag migration (segments + field capture) | ✅ done + verified | `_tag-streamline-restore.mjs --apply` |
| 2 | Smart-list rebuild (canonical AST views) | ✅ done + verified | `20260625180500` seed re-apply |
| 3 | Stage remap (create target stages + map) | ⬜ | `_stage-migration-restore.mjs --apply` |
| 4 | Automation (deriveCanonicalTags + demote sweep) | ⬜ | feature-flag / revert commit |
| 5 | End-to-end browser verification (/admin/crm) | ⬜ | — |
| 6 | Final review pass | ⬜ | — |

## Matt's decisions (2026-07-03)
- Sellers = **stage-only** (Seller Prospect → `segment:seller`, 7,524).
- Neighborhood/subdivision = single-value **fields** (`customNeighborhood`/`customSubdivision`); tags are
  pollution → dropped; single-tag+empty captured, multi+empty flagged for geocode (never guessed).
- Feeder-realtor rule = data-driven (`<City> realtor` tag or `migration broker`).

## Phase 1 — Tag migration
- runId `v2-2026-07-03`. Backup written FIRST: `out/streamline-backup-v2-2026-07-03.json` (18,154 rows, tags+stage+custom).
- Preflight gate clean: 0 sacred dropped, 0 field overwrite.
- Dry-run reconciliation (vs audited live): segment:seller 7,524 ✅, segment:expired 926, segment:out-of-area 1,121,
  realtor:local 2,347 / realtor:migration 59 (union 2,406 ✅), segment:buyer 54, segment:fsbo 6.
- Field captures: 4,686 (neighborhood 2,077 + subdivision 2,609), empty-only. Geocode backlog: nbhd 566, subdiv 375.
- Status: **applying** (18,154 contacts). Verify below when complete.

### Phase 1 verification (post-apply) — ✅
- Progress: 18,154 / 18,154 changed rows written (complete).
- Live book: segment:seller **7,524** · expired 926 · out-of-area 1,121 · buyer 54 · realtor:local 2,347 · migration 59.
- Compliance intact: compliance:hard-stop **3,229** (unchanged), do-not-call preserved.
- Completeness: dropped patterns import:/city:/subdivision:/expired-mls:/bare-realtor all **0**; industry:realtor
  re-emitted for exactly 2,406 realtors; neighborhood tags 0, field populated 9,485 (7,408+2,077 captured).
- Avg tags/contact 14 → **2.8**.

## Phase 2 — Smart-list rebuild ✅
- `lib/crm/saved-view-seeds.ts` → 12 canonical lists; migration `20260703140000_crm_saved_views_canonical.sql`
  (delete system set + insert canonical); `saved-view-seeds.test.ts` updated (10 tests green). Applied to hosted.
- Live sidebar counts verified: Sellers 7,524 · Buyers 54 · Expired 926 · FSBO 6 · Out Of Area 1,121 ·
  Local Realtors 2,347 · Migration Realtors 59 · Vendors 0 · Active 12 · Past 32 · Pending 0 · Compliance 3,229.
- Retired: Leads/Hot Prospects/Nurture/Sphere/Seller Prospects/Closed/Realtors/Stay In Touch/Email+IDX Activity/
  Expired Pipeline/FSBO Pipeline (stage nav moves to the Stages strip in Phase 3).
