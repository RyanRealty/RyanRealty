# CMA client document — Sunstone contract

**This file is the only client-document spec.** A session that clones Tumalo, Robin, 3480, or a 15-page engine dump is off-contract. The producer SKILL must point here. Gate: `ci:cma-exemplar`.

**Layout exemplar (open every page):** `docs/plans/cma-exemplars/56628-sunstone-rpr.pdf`  
(56628 Sunstone Loop, Bend — 30-page RPR packet Matt attached 2026-08-14 and again 2026-08-17.)

**Numbers:** `lib/pricing/` only. Do not copy RPR refined value, RVM, or AVM. Do not use ZIP as the market grain.

**Do not clone** `public/cmas/cma-19496-tumalo-reservoir/` or `public/cmas/cma-21042-robin/` as the client layout. Those are engine / history artifacts.

**Forbidden agent paraphrase:** “fold data density, not RPR’s look.” That sentence is how this packet was ignored. The chapters below **are** the look. Our engine still owns the number.

**Do not start a parallel CMA universe.** One renderer, one matcher, this TOC.

---

## Cover numbers (Matt 2026-08-19)

Seller cover prints **list range** and **recommended list** only.  
Expected sale / predicted close / refined value stay off the seller document (admin may still compute them).

---

## Chapters (every seller CMA, print + immersive)

Tick these against the Sunstone PDF. Missing = not done.

| # | Chapter | RPR pages | Source |
|---|---|---|---|
| 1 | Cover: house photo, list range, recommended list, presented-by | 1–2 | `lib/pricing/` |
| 2 | Subject snapshot: aerial/map, beds/baths/sqft/lot/year, status | 4 | MLS + GIS |
| 3 | Property facts table (type, subtype, baths split, garage, stories, fireplaces, lot) | 5 | MLS |
| 4 | Legal / owner / flood (parcel, taxlot, owner, time owned, vesting, flood) | 6 | County / DIAL / FEMA |
| 5 | Photos: current set, then historical | 6–8 | Spark, newest listing |
| 6 | Status grid: selected vs active / pending / expired / closed (low, median, high, $/sf, DOM) in the **real market area**, never ZIP | 3 | MLS, our grain |
| 7 | 90-day similar sold band (same beds **and** whole baths) | 3 | MLS + matcher |
| 8 | Market KPIs: months of supply, sold-to-list, median DOM, median sold | 9 | cache / pulse |
| 9 | Trend charts with labeled axes: new list, active, pending, sold, MOS | 10–16 | cache |
| 10 | Comp map: subject + every priced sale, distance + direction | 18 | MLS coords |
| 11 | Comp matrix: subject column + **every** priced sale | 19–22 | priced set |
| 12 | One page per priced sale | 23–27 | priced set |
| 13 | Search story: subdivision drawn; if we left it, show the next ring and say why | — | matcher trace, seller language |
| 14 | Permits / ownership history (full ownership, not only current) | — | DIAL |
| 15 | Seller net (filled from our net sheet) | 29 | `lib/pricing/seller-net` |
| 16 | Disclosure + signature | 30 / our letter | existing |

**Refuse on the seller document:** RPR $2.42M refined value, RVM stars, ZIP-wide $59k–$5M columns, Method 1/2/3, “how we would market,” confidence pills.

Admin-only: judge, audit, GIS traces, methods.

---

## Matcher cuts — RECONCILED 2026-08-27 (see `CMA_STATE_OF_THE_WORLD.md`)

This list was written 2026-08-19 and went stale: most items were then built without this file
being updated, and later sessions kept re-planning finished work. Verified state:

1. `PRICING_QUALITY_STOP` — DELETED from the code. Floor 3, target 8, max 10 (`lib/pricing/ladder.ts`).
2. Townhouse ≠ condo ≠ SFR on the facts path — BUILT (`productCompatible`, unknown fails closed).
3. Never cross US-97 / Bend Parkway / Deschutes — the rule BINDS and is BUILT (`lib/pricing/divides.ts`, applied in `applesOk` on every rung).
4. Zoning hard cut — code exists, **INERT**: `sale.zoning` is never populated. Open as defect D4.
5. GLA bracketing — BUILT (post-ladder bracket swap, `lib/pricing/match.ts`).
6. Whole baths — BUILT, holds on every rung.
7. Rural/urban 1-acre split, resort symmetry, water/sewer — BUILT, hard on every rung.

The remaining real defects, ranked with evidence, live in `CMA_STATE_OF_THE_WORLD.md` (D1–D8).

---

## Gold house

Live letter: **648 SE Douglas, Bend**.  
Sunstone PDF = page checklist, not the subject, unless Matt names Sunstone as the overlay proof.

---

## What “done” is

Matt can open the rebuilt PDF and tick all 16 chapters against `56628-sunstone-rpr.pdf`, and the priced set is not capped at 3.

R-068 stays **PARTIAL** until that PDF exists. Do not stamp VERIFIED on “beats RPR / no AVM.”
