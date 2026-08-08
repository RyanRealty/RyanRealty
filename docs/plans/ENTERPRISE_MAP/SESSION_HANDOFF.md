# SESSION HANDOFF — Enterprise Map (automatic bootstrap)

**Read this first** in any new Claude Code or Grok session continuing the enterprise map.  
**Do not ask Matt whether to continue.** Execute until closed or blocked on Matt-only gates.  
**Do not touch** `app/admin/**/crm/inbox/**` or in-flight admin v2 files while a Claude inbox session may be dirty — check `git status` first.

---

## Mission

Build and close the **Enterprise Map** so the whole Ryan Realty system (product + integrations + factory + plan dispositions) can move forward without shortcuts, plan-ghosts, or single-subject amnesia.

**Package root:** `docs/plans/ENTERPRISE_MAP/`

**Done (map v1 closed)** when:

1. Inventories A–N stable and regenerated if code moved  
2. Matrix cells CAP/INT/FAC are VERIFIED or explicit UNKNOWN with dual-check  
3. Adversary SHORTCUTS has zero open HIGH (or Matt-accepted residual)  
4. `synthesis/ADVANCEMENT_PLAN.md` promoted to v1 (citations only)  
5. Package registered in `docs/DEVELOPMENT_PROCESS.md` (G44)  
6. Committed **alone** (not mixed with admin inbox) and handoff Fleet block points here  

**Not done:** claiming completeness from chat; editing admin inbox; applying F7 without Matt/window; newsletter send; ad spend.

---

## Concurrent work

| Who | What | Rule |
|-----|------|------|
| Claude (often) | Admin Product crm/inbox 11F | Path-own admin; don’t merge commits |
| Map session | ENTERPRISE_MAP only until inbox clean | |

If `git status` shows dirty inbox files → **only** write under `docs/plans/ENTERPRISE_MAP/`.

---

## What’s already built (do not restart from zero)

| Artifact | Purpose |
|----------|---------|
| `00-STATUS.md` | Phase status |
| `01-PLAN-DISPOSITIONS.md` | Plan intent / fell-off / CANON\|ACTIVE\|… |
| `02-UNIVERSE.md` | Plane counts |
| `03-COORDINATION.md` | Parallel rules |
| `inventories/*` | Generated closed lists + live probes |
| `matrix/CAPABILITIES.md` | CAP-001…035 |
| `matrix/INTEGRATIONS.md` | INT-001…036 |
| `matrix/FACTORY.md` | FAC-* |
| `matrix/CRONS-CLASSIFICATION.md` | Dark cron truth |
| `matrix/EVIDENCE-LOG.md` | **Verified facts** — append only |
| `synthesis/ADVANCEMENT_PLAN.md` | v0 streams S0–S6 |
| `adversary/SHORTCUTS.md` | Open gaps |
| `SESSION_HANDOFF.md` | This file |

---

## Verified highlights (see EVIDENCE-LOG)

- Methodology served: **v3** (12920 cache); v4 rows **0**  
- CRM stages: **Nurture 20371 / Sphere 2338 / …** — total 22977; most CRM_STAGES unused  
- Admin pages: **143** import v2, **27** do not  
- Brain: ready **396**, measured **0**  
- Expired: via **sync-delta**, not scheduled detect-expired cron  
- google-ads snapshot: **orphan** vs snapshot-channels PLATFORMS  
- tc_deals: **33**  

---

## Continue execution order (no permission asks)

1. ~~Call-graph PROBE crons~~ → CRONS-CLASSIFICATION + EVIDENCE-LOG  
2. ~~Wire google-ads fan-out~~ → `snapshot-channels` PLATFORMS includes google-ads (2026-08-08)  
3. **CAP-015 measured=0** — measurement-loop only candidates already published; ready backlog 396 never reaches measured without approve→execute. Document + fix approval/publish drain, not only measurement cron.  
4. **daily-broker-digest vs broker-agent-digest** — prove parity; delete or redirect.  
5. **weekly-pipeline-digest** — register schedule or stop claiming Mon send in templates.  
6. **Re-verify PROGRAM Tier-1** on current main → EVIDENCE-LOG.  
7. **Token-gate path list** vs 143 import / 27 without.  
8. **Dual-model adversary** on ENTERPRISE_MAP.  
9. **When inbox not dirty:** G44-register ENTERPRISE_MAP/; commit map + snapshot-channels fix (can be one docs+wiring commit if admin clean); Fleet block in handoff.  
10. **Never ask Matt to continue** — only surface Matt-gated items.

---

## Matt-only blockers (stop and surface — do not invent approval)

- F7 MV migration maintenance window  
- Newsletter first cohort send  
- Ad spend / publish / outbound to real people  
- DNS cutover timing  
- Unpausing TC_BUILDOUT  
- GO on agentic graph workflows if executing P-005 waves  

Everything else: execute.

---

## Constitution (never drop)

100% coverage · no top-N theater · unknown labeled not invisible · stats engine only for public numbers · plan dispositions against ghosts · product+integrations+factory · multi-tool disk SoR · fix class not instance · anti-stranding.

---

## Context survival

If context is low: write progress into `matrix/EVIDENCE-LOG.md` + update `00-STATUS.md` + this handoff’s “Continue execution order” checkboxes, then stop cleanly. Next session starts here.
