# Plan dispositions — intent, landed, fell off, status now

**Purpose:** Stop past plans from inhibiting progress or causing regression by making every major plan **disambiguated**.  
**Rule:** Only **CANON** and **ACTIVE** may drive new work. Everything else is context, conflict, or archive.  
**Evidence level:** Seeded 2026-08-08 from DEVELOPMENT_PROCESS registration table, package state files, live probes, and code-shape audits. Cells marked **SEED** need deeper re-verify before VERIFIED.

Status vocabulary:

| Status | May drive work? |
|--------|-----------------|
| CANON | Yes — process/product law |
| ACTIVE | Yes — current program with living ledger |
| PARTIAL | Only to *close* documented gaps; not open new scope |
| SUPERSEDED | No — follow the named replacement |
| PAUSED | No until resume conditions met |
| RECORD | No — history |
| OPEN_INPUT | Feed into ACTIVE/CANON backlog only |
| CONFLICT | No Ship in disputed zone until resolved |
| GO_GATED | No until Matt/explicit go |

---

## Process / OS

| ID | Doc | Intent | What landed | What fell off | Status now |
|----|-----|--------|-------------|---------------|------------|
| P-001 | `docs/DEVELOPMENT_PROCESS.md` THE LOOP v1.1.0 | One cycle for all work; five loops; gates; scoreboard | Canon + G44; loop skills; ledgers named | Fleet Sense not forced every session; task-registry empty while real work lives elsewhere | **CANON** |
| P-002 | `docs/plans/CROSS_AGENT_HANDOFF.md` | Continuity Claude↔Cursor/Grok | File actively used | Often **subject-shaped** (admin) not fleet-shaped | **ACTIVE** (continuity) |
| P-003 | `task-registry.json` / orchestrate | Prioritized task queue | 49/49 complete (2026-07-27) | No longer the real backlog | **SUPERSEDED** as backlog by ADMIN_PRODUCT + plans + handoff |
| P-004 | `master-plan.md`, `continuous-improvement.md` | Phase ownership / progress reports | Kept as ownership ref | Process authority moved to DEVELOPMENT_PROCESS | **SUPERSEDED** (process) |
| P-005 | `AGENTIC_GRAPH_ENGINEERING_2026-07-30.md` | Workflows + graph-of-loops + verifiers | Plan written; doctrine solid | **No execution** until Matt go; workflows not built as daily driver | **GO_GATED** / live plan only |
| P-006 | This package `ENTERPRISE_MAP/` | Whole-system baseline + dispositions + cited advancement | Inventories started | Matrix/adversary/synthesis incomplete; not G44-registered yet | **ACTIVE** (this effort) |

---

## Admin product

| ID | Doc | Intent | What landed | What fell off | Status now |
|----|-----|--------|-------------|---------------|------------|
| A-001 | `ADMIN_PRODUCT/` | Process-first admin OS; IA lock; v2; correctness | Phase 11 shell 143/143; token gate ~111/170; locks; 21 process specs | 11F islands (inbox in flight); dark mode unreachable; P12 correctness | **ACTIVE** — Claude session on **crm/inbox** |
| A-002 | `ADMIN_REBUILD/` | Specs + audits for rebuild | Specs, FULL-AUDIT, progress logs | Overlapped by ADMIN_PRODUCT execution | **ACTIVE** package / largely **feeding** A-001 |
| A-003 | `ADMIN_CONSOLIDATION_*` | Collapse ~40 pages to workflows | Intent absorbed into Product OS | Standalone consolidation goal may lag IA lock | **PARTIAL** → prefer A-001 |

---

## CRM / nurture

| ID | Doc | Intent | What landed | What fell off | Status now |
|----|-----|--------|-------------|---------------|------------|
| C-001 | `CRM_BUILD_MISSION.md` | FUB-parity in-house CRM | Native `crm_people` (~23k), sequences, inbox, Twilio/Gmail, large DAL | Multi-broker productization; some fail-open classes historically; FUB-named residue | **PARTIAL** / mission still live as north star |
| C-002 | `crm-completion-spec` / `crm-golive-execution` | Go-live completion | Large surface shipped Jun 2026 | Measurement of sends weaker than suppression gates (PROGRAM) | **PARTIAL** / RECORD mix — re-verify before driving |
| C-003 | `CRM_AUDIT_*` / `EMAIL_SEND_AUDIT` | Adversarial defect ledgers | Audits exist | Not all findings proven closed | **OPEN_INPUT** / PARTIAL |
| C-004 | `docs/CRM_REPLACEMENT_BLUEPRINT.md` | Replace FUB | Cutover 2026-06-24 | Doc may lag; env FUB keys still present | **SUPERSEDED** as SoR (native CRM); blueprint = RECORD with drift risk |
| C-005 | `LIFECYCLE_WORKFLOWS_MASTER_GOAL` | Expired→CMA, newsletter, saved search, market reports | Pieces exist | Newsletter first cohort **blocked Matt** (PROGRAM W9.1); lifecycle uneven | **PARTIAL** |
| C-006 | `SAVED_SEARCH_MASTER_GOAL` | Best-in-class alerts/subs | Product paths exist | LP promise vs enroll classes historically | **PARTIAL** |
| C-007 | `BROKER_SMS_AGENT_2026-07-31` | Broker SMS agent on marketing line | Plan + `lib/agent` | Full DoD / approval path incomplete | **PARTIAL** |
| C-008 | `twilio-cutover-2026-06-24` | Twilio as comms | Multi-line Twilio live | Residual cutover backlog items | **PARTIAL** |

---

## Public site / growth / experience

| ID | Doc | Intent | What landed | What fell off | Status now |
|----|-----|--------|-------------|---------------|------------|
| G-001 | `SITE_SPEC.md` / `EXECUTION_PLAN.md` | Best CO site; machine acceptance; LCP | Strong site; DAL boundary; many LHCI wins | DNS `ryan-realty.com` cutover ops; some acceptance still open | **PARTIAL** + ops OPEN |
| G-002 | `EXPERIENCE_SYSTEM.md` | Six archetypes; serial family rollout | Families built; later **serial rollout declared dead** | Review-gated sequencing inhibited motion; mixed archetype completion | **CANON** for archetypes; rollout method **SUPERSEDED** by batch/review model in-file |
| G-003 | `KB_SITE_CONVERSION_GOAL` / KB roadmaps | Geo depth as KB | Deep geo system | Convergence ongoing | **PARTIAL** |
| G-004 | `WESTSIDE_BACKLOG` | West-side lead dominance | Ranked backlog from data | Content/authority/crawl items open | **ACTIVE** backlog |
| G-005 | `SEARCH_OPTIMIZATION_PLAN` | Flexmls parity-plus | Strong search/map core | Full parity not claimed complete | **PARTIAL** |
| G-006 | `SEARCH_FILTER_COMPLETENESS` | Spark-field-complete filters | Plan | Completeness gate / full surface | **PARTIAL** / plan-heavy |
| G-007 | `PROSPECT_TO_CMA_AND_SITE_IA` | Prospecting→CMA + IA density | Partial | Track items open | **PARTIAL** |
| G-008 | `VOICE-CANON-2026-08-05` | Single Buffett voice | Canon + CI constructions | Full rewrite surface may remain | **ACTIVE** / PARTIAL rewrite |
| G-009 | `PAGE_REVIEW_REDESIGN_RUNBOOK` | Review procedure | Runbook | Not a completion state | **CANON** (procedure) |
| G-010 | `MOBILE_GRIND/` | Defect-class mobile remediations | Many classes fixed | C-21 polygons **BLOCKED_MATT** | **ACTIVE** / PARTIAL |

---

## Data / sync

| ID | Doc | Intent | What landed | What fell off | Status now |
|----|-----|--------|-------------|---------------|------------|
| D-001 | `DATABASE_FOR_AI_AGENTS` + DAL + caches | Accurate fast market truth | pulse 45, cache ~13k, DAL enforced, ~595k listings | v4 meth defined, rows mostly **v3**; ad-hoc risk | **CANON** for access rules |
| D-002 | `data-architecture-plan.md` | Long-form data arch | Much implemented | Process-superseded; technical debt remains | **SUPERSEDED** (process) / PARTIAL tech |
| D-003 | `F7-sync-contention` | Fix MV full rewrite / search slowness | Diagnosis + proposed SQL | **Not applied** — maintenance window + Matt | **OPEN** / blocked ops |
| D-004 | `DELTA_SYNC_UNIFICATION_HANDOFF` | Unified delta path | Recorded DONE path | Confirm no residue | **RECORD** (verify) |
| D-005 | `COMING_SOON_SQL_FOLLOWUP` | Coming Soon lockdown residue | Partial | SQL leftovers | **OPEN_INPUT** |

---

## Marketing / demand / brain

| ID | Doc | Intent | What landed | What fell off | Status now |
|----|-----|--------|-------------|---------------|------------|
| M-001 | Marketing brain + REGISTRY | Action-row content/ops machine | Crons, approval queue, 651 actions | **ready ~396**, **measured ~0**, many NO_SCRIPT; video decommissioned from registry | **PARTIAL** — learning loop weak |
| M-002 | `FACEBOOK_SELLER_GROWTH_PIPELINE` + ads suite | Seller Meta machine | Webhooks, CAPI, LPs, audiences, snapshots | Campaign ops Matt-gated; some docs FUB-stale | **PARTIAL** / ACTIVE ops |
| M-003 | `PAID_ADS_*` | Creative + launch | Plans | Not a substitute for live campaign health | **ACTIVE** program docs |
| M-004 | Newsletter specs | Outbound newsletter system | Code + crons | First real cohort send **blocked Matt** | **PARTIAL** / GO_GATED ops |
| M-005 | Video CLAUDE §4 + Remotion trees | Video product | Engineering assets | Brain-callable video **removed** | **PARTIAL** / SKELETON as product |

---

## Transaction

| ID | Doc | Intent | What landed | What fell off | Status now |
|----|-----|--------|-------------|---------------|------------|
| T-001 | `TC_SYSTEM.md` | Vault SoR vs SkySlope | tc_* model, admin closings, sign path, SkySlope still integrated | Full SkySlope replacement; build-out paused | **PARTIAL** |
| T-002 | `TC_BUILDOUT_HANDOFF` | Resume TC build | Handoff | **Paused 2026-06-24** | **PAUSED** |
| T-003 | `TC_ARCHITECTURE_REVIEW` | Architecture backlog | Review | Untransactional transitions etc. | **PARTIAL** backlog |

---

## Valuation

| ID | Doc | Intent | What landed | What fell off | Status now |
|----|-----|--------|-------------|---------------|------------|
| V-001 | CMA/BPO pipeline plans | Production-grade valuations | Engines, 266 CMAs, public deliverables, PAGE_CONTRACT | Production bar items open | **PARTIAL** |

---

## Program 2026-07-21 (platform completion)

| ID | Doc | Intent | What landed | What fell off | Status now |
|----|-----|--------|-------------|---------------|------------|
| R-001 | `PROGRAM_2026-07-21/` | Close 19-domain defects; primitives; finish work | Most completion ledger **done**; 19 audits; diagnosis “60–80%” still culturally true | W9.1 newsletter Matt; W13.1 partial; Tier-1 defects need **re-verify on current main** | **PARTIAL** / ledger nearly closed |
| R-002 | Nine primitives (P0–P8) | Only-path foundations with gates | Some gates exist (cron-registered, etc.) | Not all primitives fully only-path | **PARTIAL** |

---

## Money path / misc

| ID | Doc | Intent | What landed | What fell off | Status now |
|----|-----|--------|-------------|---------------|------------|
| $001 | `money-path-contract-plan-2026-06-04` | Money-path contract | Open input | Not fully absorbed as single contract | **OPEN_INPUT** |
| $002 | `DSCR_DEAL_FINDER` | DSCR admin tool | Feature live | Email list draft-first | **ACTIVE** / small |

---

## Cross-cutting conflict notes (SEED)

| Conflict | Plans | Resolution needed |
|----------|-------|-------------------|
| What is the backlog? | task-registry vs ADMIN_PRODUCT vs WESTSIDE vs PROGRAM residual | **ACTIVE** subjects in handoff + this map; task-registry not authoritative |
| Experience rollout method | Serial families vs later “serial is dead” | Follow EXPERIENCE_SYSTEM current text; old serial queue not binding |
| CRM SoR docs | FUB-era docs vs native CRM | Native `crm_people`; FUB docs RECORD; env keys LEGACY |
| Search perf | Ship features vs F7 unapplied | F7 is OPEN blocked; don’t pretend search is “done” on perf |
| Content learning | Brain produces ready drafts | measured=0 → PARTIAL until measure path closes |

---

## How dispositions unblock “move everything forward”

1. **ACTIVE/CANON only** for new Ship scope.  
2. **PARTIAL** work = close documented fall-off (only path, gate, measure), not open parallel futures.  
3. **PAUSED/GO_GATED** stay parked until conditions met — not silent guilt.  
4. **SUPERSEDED/RECORD** may be read for intent; agents must not re-execute them.  
5. When a new plan is written, it must **name what it supersedes** and flip that row.

This file is the plan-plane of the enterprise graph. It will be revised as matrix evidence lands.
