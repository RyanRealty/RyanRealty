# All open items (comprehensive — no severity filter)

**Rule:** Comprehensive means **every** item is listed. Severity is a column, not a gate.  
**Status codes:** OPEN · PARTIAL · BLOCKED_MATT · BLOCKED_ENV · PARKED · DONE · ACTIVE  
**Updated:** 2026-08-08T21:08Z  

Map v1 stamped in `synthesis/ADVANCEMENT_PLAN.md`. Product residual remains tracked here until DONE/PARKED/BLOCKED_MATT.

---

## 0. Map process

| ID | Item | Status | Notes |
|----|------|--------|-------|
| MAP-001 | Inventory A routes | DONE | 296 paths @ 2026-08-08T21:00Z |
| MAP-002 | Inventory B admin | DONE | 170 |
| MAP-003 | Inventory C crons | DONE | disk 80 / vercel 61 / dark 19 |
| MAP-004 | Inventory D env | DONE | 117 keys |
| MAP-005 | Inventory E workflows | DONE | 10 |
| MAP-006 | Inventory F plans | DONE | pkgs 5 top 43 |
| MAP-007 | Inventory G DAL | DONE | 44 |
| MAP-008 | Inventory H ci:* | DONE | 271 / scripts 389 |
| MAP-009 | Inventory I lib | DONE | 36 |
| MAP-010 | Inventory J app | DONE | 72 |
| MAP-011 | Inventory K migrations | DONE | 461 |
| MAP-012 | Inventory L skills | PARTIAL | 19 under .claude/skills (producer skills live under marketing_brain_skills) |
| MAP-013 | Inventory M live DB | DONE | M-live-db-counts.json refreshed |
| MAP-014 | Inventory N producers | DONE | 24 dirs + 85 REGISTRY rows + script matrix |
| MAP-015 | Inventory O dark cron refs | DONE | O-dark-cron-refcount.txt |
| MAP-016 | Inventory P probes | DONE | P-db-probes + program reverify |
| MAP-017 | Inventory Q admin v2 | DONE | 143 with / 27 without (redirects) |
| MAP-018 | Inventory R CAP proofs | DONE | R-cap-path-proofs.json full object |
| MAP-019 | Dual-check protocol | DONE | DUAL-CHECK-PROTOCOL.md |
| MAP-020 | Dual-model adversary | PARTIAL | adversary/DUAL-PASS.md (this close pass) |
| MAP-021 | ADVANCEMENT_PLAN v1 | DONE | synthesis/ADVANCEMENT_PLAN.md v1 |
| MAP-022 | Fleet start ritual in rules | DONE | Claude.md + Agents.md |
| MAP-023 | task-registry not backlog SoR | DONE | dispositions + DEVELOPMENT_PROCESS point at map |
| MAP-024 | CROSS_AGENT_HANDOFF fleet | DONE | fleet block updated |
| MAP-025 | Session continuity | DONE | handoff + rename practice |

---

## 1. CAP residual (execution after map)

Every CAP has a matrix row. Below = **ship residual only** (not re-list full matrix).

| ID | Residual | Status |
|----|----------|--------|
| CAP-001 | ~~DNS cutover~~ DONE 2026-08-16 (ryan-realty.com live) | DONE |
| CAP-002 | Search filter/opt plans residual; **F7 MV DONE prod 2026-07-29** (T-017) | ACTIVE |
| CAP-003 | Showcase polish continuous | ACTIVE |
| CAP-004 | EXPERIENCE archetype completion | ACTIVE |
| CAP-005 | Shareable monthly report artifact | ACTIVE |
| CAP-006 | Hosted ClosePrice apply; v4 adoption decision | BLOCKED_ENV + ACTIVE |
| CAP-007 | Delta freshness Sense continuous | ACTIVE |
| CAP-008 | LP enroll re-verify live | ACTIVE |
| CAP-009 | Stage model; multi-broker product | ACTIVE |
| CAP-010 | Measurement parity for all send classes | ACTIVE |
| CAP-011 | 11F inbox completion | ACTIVE (parallel) |
| CAP-012 | TC cutover HOLD until TMS tested | HOLD (Matt 2026-08-16) |
| CAP-013 | CMA production pipeline | ACTIVE |
| CAP-014 | FSBO hygiene continuous | ACTIVE |
| CAP-015 | Publish identity + ready drain; measured status class | PARTIAL — status flip **shipped** |
| CAP-016 | NO_SCRIPT residual | ACTIVE |
| CAP-017 | Video rebuild is xAI-only (G32). R-045 stays LOCKED | ACTIVE (G32) |
| CAP-018 | Ads spend PARKED for v1; audience wiring continues | PARKED (Matt 2026-08-16) |
| CAP-019 | ~~Reconnect expired OAuth~~ **SCRUBBED 2026-08-15** — tokens auto-refresh via daily heartbeat (verified live); LinkedIn PARKED (no provider refresh token). Residual: publish cadence productization | ACTIVE |
| CAP-020 | Newsletter redesign G31; look-approve then Matt-manual send | ACTIVE (G31) + M1 look-approve |
| CAP-021–023 | Broker/portal productization | ACTIVE |
| CAP-024 | Shell maintain | KEEP |
| CAP-025 | Remaining 11F islands | ACTIVE |
| CAP-026–027 | Design residue | ACTIVE |
| CAP-028 | Voice rewrite residual | ACTIVE |
| CAP-029 | AEO continuous | KEEP |
| CAP-030 | Westside every backlog item | G7 DONE 2026-08-16 — residual crawl/depth on G22; paid/expired Matt-gated |
| CAP-031 | Snapshot health + google-ads env | ACTIVE |
| CAP-032 | Process OS enforce | KEEP |
| CAP-033 | Grok memory assist only | KEEP |
| CAP-034–035 | DSCR + SMS agent DoD | ACTIVE |

---

## 2. INT residual

| ID | Residual | Status |
|----|----------|--------|
| INT-001 | CLI link for migrations | BLOCKED_ENV |
| INT-002 | Spark freshness Sense | ACTIVE |
| INT-004–008 | Deeper health probes | ACTIVE |
| INT-009–013 | ~~Token reconnect~~ **DONE 2026-08-15** — GBP/TikTok/YouTube/X auto-refresh verified live (heartbeat + on-demand); INT-010 LinkedIn **PARKED** (refresh_token NULL from provider) | DONE / PARKED |
| INT-014–016 | Threads/Nextdoor/Pinterest | **PARKED** |
| INT-017 | SkySlope mirror freshness (ops path LIVE 2026-08-16; rows still 2026-06-10 until first successful cron) | FRESHNESS RESIDUAL |
| INT-018 | FUB residue cleanup optional | LEGACY |
| INT-021–036 | **DONE 2026-08-16** — unknown = 0. Green: 021/023/031/032/036. Park: 026/029/033. SoR `integration-health-probes.json` | DONE |
| INT-037 | Tooling keys bucket | DONE disposition |

---

## 3. FAC residual

| ID | Residual | Status |
|----|----------|--------|
| FAC-002/003/005 | CI cost study | ACTIVE |
| FAC-006 | Build minute policy | ACTIVE |
| FAC-007 | Env parity audit | ACTIVE |
| FAC-008/009 | Hosted apply path | BLOCKED_ENV |
| FAC-010–011 | Multi-agent discipline | KEEP |
| FAC-012 | Rules → map | DONE |
| FAC-013–017 | Skills drift / e2e cadence | ACTIVE |

---

## 4. Plan dispositions

See **01-PLAN-DISPOSITIONS.md** (50 rows). Deep-read pass complete; nested specs PARTIAL where noted.

---

## 5. Cron residual

See **matrix/CRONS-CLASSIFICATION.md**. google-ads fan-out DONE; digests scheduled; dark list dispositioned.

---

## 6. PROGRAM residual

| Item | Status |
|------|--------|
| D7 ClosePrice file | DONE |
| D7 hosted apply | BLOCKED_ENV |
| Bytespider | DONE |
| Buyer LP alerts code | DONE_CODE (live submit proof OPEN) |
| google-ads fan-out | DONE |
| Sold homes nav | DONE (`/homes-for-sale?status=Sold`) |
| FUB residue | LEGACY_RESIDUE |
| Entity-scope people tools | DONE (requirePersonInScope shipped) |
| Sitemap/llms/robots | DONE present |

---

## 7. Streams S0–S6

Tracked in ADVANCEMENT_PLAN.md §2. All streams remain visible.

---

## 8. Matt-gated (never drop)

| Item |
|------|
| ~~F7 MV window~~ **SCRUBBED** — applied prod 2026-07-29 (T-017 / F7-sync-contention.md); residual latency ≠ unapplied F7 |
| Newsletter look-approve after G31 (enroll/send Matt-manual) |
| Ad spend PARKED for v1 · outbound / public publish approvals |
| ~~OAuth reconnect logins~~ **SCRUBBED 2026-08-15** — auto-refresh verified; LinkedIn parked. M6 reviewed 2026-08-16: KEEP set connected; Threads/Pin/Nextdoor empty; no reconnect ask |
| ~~DNS cutover~~ **DONE 2026-08-16** |
| TC cutover HOLD until TMS tested |
| Agentic graph Wave GO |

---

## 9. Definition of comprehensive map done

1–9 in ADVANCEMENT_PLAN §5. Map **v1 stamped**. Product residual continues under streams with owners — not omitted.

---

## Bottom line

**Map control system: v1.**  
**Product universe: still advancing** — every residual above remains listed until DONE/PARKED/BLOCKED_MATT.
