# CRM Streamline — Execution Log (2026-07-03)

Live progress record for the coordinated streamline execution. Specs: `CRM_STREAMLINE_PLAN_V2_2026-07-03.md`
+ the two audit-findings docs. Reversible at every phase.

## Phases

| # | Phase | State | Reversal |
|---|---|---|---|
| 1 | Tag migration (segments + field capture) | ✅ done + verified | `_tag-streamline-restore.mjs --apply` |
| 2 | Smart-list rebuild (canonical AST views) | ✅ done + verified | `20260625180500` seed re-apply |
| 3 | Stage remap (create target stages + map) | ✅ done + verified | `_stage-migration-restore.mjs --apply` |
| 4 | Automation — go-forward auto-tagging | ✅ done + wired; demote sweep = documented next | revert commit |
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

## Phase 3 — Stage remap ✅
- `_stage-migration.mjs` (backup-first, reversible) remapped 18,183 contacts. Backup:
  `out/stage-migration-backup-stage-v2-2026-07-03.json`. Restore: `_stage-migration-restore.mjs --apply`.
- Config migration `20260703150000_crm_stages_canonical.sql` applied: added Engaged, repositioned targets,
  deactivated the 9 emptied legacy stages. `CRM_STAGES` constant + Engaged.
- Live verified: Nurture 15,838 · Sphere 2,343 · Active Client 12 · Past Client 32 · Trash 2 (=18,227).
  8 active stages in order: Nurture · Engaged · Active Client · Pending · Closed · Past Client · Sphere · Trash.
- Smart lists unaffected (they key on tags): Sellers still 7,524 etc.

## Phase 4 — Automation
- ✅ **Go-forward auto-tagging** (`lib/crm/tag-canonical.ts`, 8 tests): `canonicalTagsToAdd()` is pure +
  ADDITIVE (never removes, never touches compliance). Wired into `enrichNativeLead` + the reuse path in
  `ensureNativeLead.ts` so every new/re-touched LP lead gains its segment/realtor/occupancy tags and lands
  in the right smart list. Closes the gap where the new lists key on segment:*/realtor:* the old path didn't emit.
- Also fixed: "Out Of Area Home Owners" mis-filed under the Neighborhoods collection (bare word "area") →
  now in Pipeline (`saved-view-grouping.ts`).
- ⏭️ **Stage-transition automation (promote on inbound reply / demote on 30d no-two-way)** — documented as the
  next increment. Nothing sits in Engaged yet (it is entered by a live signal), so the demote has nothing to act
  on until promotion wiring lands; and a scheduled book-mutation needs Matt's explicit ops go. Two-way source must
  be computed from crm_timeline inbound rows (NOT last_activity_at — see audit P1-3), not built here.

## Phase 5 — End-to-end browser verification (production /admin/crm)
- ✅ Sidebar renders all 12 canonical lists with correct live counts (Sellers 8K, Buyers 54, Expired 926,
  FSBO 6, Local Realtors 2K, Migration Realtors 59, Vendors 0, Active 12, Past 32, Pending 0, Compliance 3K,
  Out Of Area 1K).
- 🐛→✅ **Found + fixed in-browser:** clicking a list showed "18,227 people" (unfiltered). Root cause:
  `listCrmPeople` (app/actions/crm.ts:186-188) resolves a view via the LEGACY `filter` bag, while the count
  path uses `ast`; the canonical rebuild set only `ast`. Backfilled `filter` on all 12 views
  (`20260703140500_crm_saved_views_filter_backfill.sql`, applied to hosted). Re-verified live: Sellers now
  "Showing 7,524 people" with the `segment:seller` filter chip and a correctly filtered list.
- ⚠️ **Tech debt:** unify `listCrmPeople` onto the `ast` compiler (buildCrmPeopleQuery) so `filter`/`ast`
  can't drift. Safe today (all 12 canonical views are single-condition, fully captured by the filter bag).

## Phase 3B — Desktop Stages strip ✅ (built)
- `getCrmStageCounts` DAL (scoped per-stage counts via buildCrmPeopleQuery, mirrors getCrmSavedViews).
- PeopleSidebar renders a "Stages" strip above Collections: the 8 active stages as chips w/ live counts,
  linking to ?stage=<key> (active-state highlight). Wired from `app/admin/(protected)/crm/page.tsx`.
- 0 TS errors; 450 CRM data tests green. Browser-verify on production after Vercel deploy.
