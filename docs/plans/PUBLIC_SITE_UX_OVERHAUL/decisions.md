# Decisions — Public Site UX Overhaul

Only **written** entries here count as locks.

---

## 2026-08-11 — Brand lock (Matt)

**LOCKED:** Brand **colors** and **fonts** only.

- Colors: navy `#102742`, cream `#faf8f4` (and derived token family).
- Fonts: Amboqia (display), Geist (body/UI).

**Not locked:** IA, nav, sections, kits, motion, routes, CTAs, templates.

---

## 2026-08-11 — Program mode (Matt)

**LOCKED:** Thorough reimagine. Comprehensive coverage:

- **Every public page** analyzed (page ledger).
- **Every section pattern** analyzed (section ledger).
- **Every analysis competitive** (locals + portal bar on find/sell).
- Goal: remove Frankenstein, disorganization, and poor design — replace with one system.

Prior Experience/KB programs = evidence only, not destination.

---

## 2026-08-11 — Method (agent recommendation, adopted)

**LOCKED as plan of record:** Three tracks — Truth (inventory + competitive audit) · System (IA + visual + section library) · Roll (library-only rebuild until ledgers empty).

2026 UX bar (B01–B14) is the ceiling; local win is necessary but not sufficient.

---

## Competitor battery — FROZEN 2026-08-11 (BOOT)

Replace only if SERP leaders for “Bend real estate” clearly change; record the change here.

| Tier | Names | Surfaces to capture |
|---|---|---|
| Local | **Cascade Hasson**, **Stellar Realty NW**, **Duren Realty** | Home, search/listings, single listing (or closest), sell/valuation, about/team |
| Portal | **Zillow**, **Redfin** | Search/map, listing detail, sell/Zestimate (or equivalent) |
| Product ref (pattern only) | Optional during P5 | Map interaction, decision UI clarity — never copy brand |

**Rule:** Every page disposition and every section disposition must name at least one competitor reference (local for brokerage pages; local + portal for find/sell).

---

## 2026-08-11 — Working locks for /endtoend execution

Matt ordered full remainder + `/endtoend`. The following are **working locks** so Truth→System→Roll can proceed. **Veto anytime** by writing `VETO` under the lock with the replacement. Brand lock remains the only permanent sacred constraint.

### Process lock (P3) — WORKING

**Adopted:** `conversion/CONVERSION_MAP.md`  
North-star events E1–E6; one primary CTA per template; CTA grammar; instrumentation gaps listed.

### IA lock (P4) — WORKING

**Adopted:** Option 1 Journey-first — Buy · Areas · Market · Sell · About  
Source: `ia/IA_PROPOSAL.md`  
Mobile tabs: Buy · Areas · Sell · Saved · More  

### Visual + section library lock (P5) — WORKING

**Adopted:** `design/PUBLIC_UI.md` + `design/SECTION_LIBRARY_MAP.md`  
Primitives: `components/site/v2/*`  
Reference screens: `design_system/public-v2/screens/{home,search,sell,about}.html`  
Listing screen: follow PUBLIC_UI listing rules at family build (screen HTML may lag).

### Litmus lock (P7) — NOT GRANTED

Journeys A/C fail, B partial on current production. Litmus passes only after spine migration ships on prod. Do not claim litmus lock until re-timed on production.

---

## Pending / residual

| Lock | Status |
|---|---|
| Litmus (P7) | blocked on P8 spine ship + prod re-time |
| Full roll (P8–P10) | in progress / residual — 97 rebuild routes |
