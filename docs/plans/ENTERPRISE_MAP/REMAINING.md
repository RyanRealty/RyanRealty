# What’s left vs what was asked (honest)

**Full itemized backlog (no severity filter):** **[`ALL-OPEN-ITEMS.md`](./ALL-OPEN-ITEMS.md)** — that file is comprehensive. This page is the short frame.

**Asked for:** comprehensive understanding of everything (product + integrations + factory + plan intent/fall-off) → a plan to move the whole system forward → no shortcuts / no leaving things off.

**What we have:** a real package on `main` that **starts** that job — not the finished closed plan.

---

## Done (not nothing)

| Deliverable | Where |
|-------------|--------|
| Operating law + streams S0–S6 | `synthesis/ADVANCEMENT_PLAN.md` **v0.1** |
| Inventories (routes, admin, crons, env, plans, CI, live DB…) | `inventories/` |
| Plan dispositions (ghost plans) | `01-PLAN-DISPOSITIONS.md` |
| CAP / INT / FAC seed matrices + evidence log | `matrix/` |
| Auto handoff | `SESSION_HANDOFF.md` |
| G44 registration + fleet pointer | DEVELOPMENT_PROCESS + CROSS_AGENT_HANDOFF |
| Ship: google-ads fan-out, digest schedules, ClosePrice migration **file**, Bytespider middleware align | code on main / this commit |

---

## Not done (still required for “what you asked”)

### A. Close the map to v1 (baseline completeness)

| ID | Gap | Severity |
|----|-----|----------|
| R-MAP-1 | **Every CAP cell** path-probed VERIFIED or dual-check UNKNOWN | HIGH |
| R-MAP-2 | **Every INT** health: token expiry, last success, not just “key exists” | HIGH |
| R-MAP-3 | **Dual-model adversary PASS** (second agent assumes first lied) | HIGH |
| R-MAP-4 | Promote ADVANCEMENT_PLAN **v0.1 → v1** only after R-MAP-1–3 | HIGH |
| R-MAP-5 | Full re-read of every ACTIVE plan body into dispositions (not seed only) | MED |
| R-MAP-6 | Factory cost metrics (CI minutes, Vercel build burn) | LOW |

### B. Ship classes already diagnosed (execution, not more planning)

| ID | Class | Status |
|----|-------|--------|
| R-SHIP-1 | ClosePrice on **hosted** Supabase | Migration in git; **apply blocked** (no supabase link here) |
| R-SHIP-2 | CAP-015 brain: ready queue (~396, mostly content:cma) almost no `publish_payload`; measured path broken as a **class** | Diagnosed; **fix not shipped** |
| R-SHIP-3 | Bytespider robots vs middleware | **Fixed** this turn (remove from BAD_BOT_RE) |
| R-SHIP-4 | entity-scope baseline debt (`people/[id]/tools` etc.) | Main person page **has** requirePersonInScope; tools still baselined debt |
| R-SHIP-5 | F7 search MV | **Matt + maintenance window** |
| R-SHIP-6 | Newsletter first send / ad spend / DNS | **Matt gates** |
| R-SHIP-7 | Admin 11F remaining islands after inbox | Parallel Claude + re-census on land |
| R-SHIP-8 | CAP-009 stage model (almost all Nurture) | Diagnosed; product decision + writers |
| R-SHIP-9 | Methodology v3 vs v4 definition drift | Documented; cache writer adoption still open |

### C. What “done” meant in your ask (gap)

| You wanted | Where we are |
|------------|----------------|
| 100% comprehensive universe | Inventories large but matrix not fully verified |
| No shortcuts | Still SEED cells + self-adversary only |
| Plan to move everything forward | **v0.1 exists** — not v1 closed |
| Past plans don’t inhibit | Dispositions **started** — not every plan body deep-read |
| Factory optimized | Listed, not measured/optimized |
| Expert every integration | Keys inventoried; health mostly UNKNOWN |

---

## Bottom line

**No — we have not done everything you asked.**  
We have a **working draft plan + map scaffolding + several real fixes**.  
**Left:** verify every cell, dual adversary, v1 plan stamp, hosted migration apply, CAP-015 class fix, remaining PROGRAM/admin/growth/TC ships under streams S0–S6.

Continue order: `SESSION_HANDOFF.md` + this file.
