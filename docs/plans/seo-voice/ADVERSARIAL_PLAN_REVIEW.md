# Adversarial plan review → fixes

**Date:** 2026-08-10  
**Method:** Attack EXECUTION_QUEUE + GOAL_10X + MARKET_ANALYTICS + EDA for kill-shots, then fix.

---

## Kill-shots found → fix

| # | Attack | Severity | Fix (locked) |
|---|--------|----------|--------------|
| K1 | **DONE is infinite** (“every family V”, full A01–A24) — never “complete” | Critical | **MVP DONE** vs **stretch**: queue BLOCK A1–A9 + B1–B2 + B8 seed = shippable program MVP; rest is continue-queue not blocker |
| K2 | **Two schedules** (G0–G10 weeks language + queue) confuses agents | High | `EXECUTION_QUEUE.md` sole schedule; GOAL phases = labels only |
| K3 | **SFR cache vs all-type CO EDA** disagree if mixed | Critical | Public CO size from **analytics marts (CO filter)**; pulse/cache stay SFR-labeled; never mix |
| K4 | **City allowlist gaps** (e.g. Crooked River Ranch spelling) undercount | High | Use same `SERVICE_AREA` as site; document; EDA re-run after city list changes |
| K5 | **List-only competitive share** misstates “deals” | High | A5 must include **list + buy** marts; UI side toggle; dual ~20% labeled |
| K6 | **Ryan 0.03%** may be alias/buy-side incomplete | High | A4 seed Ryan aliases + buy-side before strategy claims |
| K7 | **Migration without apply path** = paper plan | High | Ship SQL in repo + `scripts/analytics/rebuild-*.mjs` that works with service role **even before** migration if using views via raw SQL optional; prefer migration |
| K8 | **No parity gate** → silent wrong numbers | Critical | A7: vitest or script assert 2024 CO count/volume within 0.5% of EDA |
| K9 | **Admin competitive without auth route pattern** | Med | Follow existing `/admin` auth patterns only |
| K10 | **Family grind B7 unbounded** blocks analytics | High | B7 is stretch; don’t block A* |
| K11 | **Grok restyle / engagement** dropped from queue | Med | Queue C0 AI restyle deferred; C1–C2 after B8 — listed so not forgotten |
| K12 | **Uncommitted plan docs** lost on crash | High | Commit plan pack when shipping first code unit |
| K13 | **Context loss on interrupt** | High | SESSION_INTENT_SSOT + EXECUTION_QUEUE + VERIFY_LOG only spine |
| K14 | **Inventory/MoS history** promised without snapshots | Med | Explicit out of MVP; sales-only history first |
| K15 | **Unique search AST full platform** too big for first ship | High | MVP = marts + admin ranks + public size module; search AST = post-MVP A11 |

---

## MVP DONE (adversarial-safe)

Must ship for “plan executed” claim on analytics + 10× foundation:

- [ ] A1 reusable EDA script  
- [ ] A2 indexes (migration)  
- [ ] A3 closed CO fact projection  
- [ ] A4 dim bootstrap (minimal)  
- [ ] A5 office share 2024 CO list+buy  
- [ ] A6 annual market mart CO all+sfr  
- [ ] A7 DAL + parity vs EDA  
- [ ] A8 admin competition MVP  
- [ ] A9 public CO market size strip  
- [ ] B1 baseline VERIFY  
- [ ] B2 F00 chrome smoke  
- [ ] B8 alert path inventory (measure friction; fix if broken)  
- [ ] Plan docs committed  

**Stretch (continue after MVP):** full family grind, feature cubes, unique search, inventory snapshots, Grok restyle, full report factory.

---

## Conflicts resolved

| Conflict | Resolution |
|----------|------------|
| “All features verify” vs “not multi-week” | MVP first; verify continues in queue without calendar |
| “Full A01–A24” vs ship | Canon remains catalog; MVP implements size + composition + competitive |
| Research-first vs execute | EDA CO 2024 done → enough to build marts; more EDA parallel |

---

*Review closed. Execute EXECUTION_QUEUE from A1.*
