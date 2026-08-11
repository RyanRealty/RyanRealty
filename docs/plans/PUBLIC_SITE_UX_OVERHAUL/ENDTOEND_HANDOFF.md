# /endtoend handoff — Public Site UX Overhaul

**As of:** 2026-08-11  
**Phase:** `P8_ROLL` (residual)  
**Stop reason:** Not credentials — **scope honesty**. Truth + System foundation is complete. Full production rebuild of 97 routes is multi-session P8 grind; litmus cannot pass until spines ship on prod.

---

## Mission goal (from ENDTOEND_MISSION.md)

Replace Frankenstein public UX with one system under navy/cream + Amboqia/Geist; every page/section dispositioned; journeys convert; competitive lead.

## What completed this run

| Phase | Result |
|---|---|
| P0 BOOT | Package registered; competitors frozen; ledgers; baseline doc |
| P1 Inventory | 131 pages; 406 raw / 111 canonical sections |
| **P2 Audit** | **0 unaudited pages; 0 unaudited canonical sections**; journeys A/B/C; matrix; ranked backlog |
| **P3** | Conversion map; **process WORKING lock** |
| **P4** | IA Option 1; **IA WORKING lock** |
| **P5** | PUBLIC_UI + section map + 4 reference screens; **visual WORKING lock** |
| **P6** | `components/site/v2` primitives (tokens, Button, Hero, StatsBand, Section) |
| P7 Litmus | **Not locked** — A/C fail, B partial on current prod |
| P8 Roll | **Residual** — 97 rebuild routes; next unit homepage |

## Journey results (current prod)

| Journey | Result |
|---|---|
| A Buyer | **FAIL** — find works; dual CTAs, long home stack, portal parity gap |
| B Seller | **PARTIAL** — valuation spine strong; fee matrix wall / density |
| C Brokerage | **FAIL** — story exists; not competitively strong as brand surface |

## Artifacts

- `inventory/PAGE_LEDGER.json` — 131 audited  
- `inventory/SECTION_LEDGER_CANONICAL.json` — 111 audited  
- `audit/journeys/journey-{a,b,c}.md`  
- `audit/competitive/2026-08-11/MATRIX_SUMMARY.md`  
- `audit/RANKED_BACKLOG.md`  
- `conversion/CONVERSION_MAP.md`  
- `ia/IA_PROPOSAL.md`, `ia/CUT_LIST.md`  
- `design/PUBLIC_UI.md`, `design/SECTION_LIBRARY_MAP.md`  
- `components/site/v2/*`  
- `design_system/public-v2/screens/*`  

## Working locks (veto-able)

See `decisions.md` — process, IA, visual applied for execution. Litmus not applied.

## Next units (in order)

1. **P8 homepage** — recompose `/` with v2 library per PUBLIC_UI + home.html reference (max effort; before/after screenshots; competitive side-by-side).  
2. **Chrome** — ensure single public nav identity on search/listing (kill hybrid register).  
3. **Search + listing + sell** spines → re-time Journey A/B → litmus lock.  
4. **About/team** → Journey C.  
5. Drain remaining 90+ rebuild routes by family; competitive screenshots each ship; section ratchet.  
6. P9 depth / P10 harden.

## What “done” still requires

- Production spines migrated (not just primitives in repo)  
- Litmus A/B/C pass on prod at 390+1280  
- Competitive screenshots per shipped family  
- PAGE_LEDGER statuses → `shipped`/`verified`  
- Legacy section types → 0 on migrated routes  

## Explicit non-claims

- Did **not** restyle all 131 routes in production this run.  
- Did **not** capture live competitor HTML (bot walls) — battery + protocol remain; screenshots at family ship.  
- Did **not** lock litmus.  
