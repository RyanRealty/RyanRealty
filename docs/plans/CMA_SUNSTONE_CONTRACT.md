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

## Matcher cuts still required (not yet all in the facts path)

Do not rebuild a letter until these are in `lib/pricing/match.ts` **and** the listings fallback:

1. Delete `PRICING_QUALITY_STOP`. Floor 3, target 5–8, max ~10. Do not quit because three same-subdivision sales exist.
2. Townhouse ≠ condo ≠ SFR on the **facts** path (`productTypeCompatible`, not collapsed `attached`).
3. Never cross US-97 / Bend Parkway / Deschutes. Neighbor-pair table specified 2026-07-28 in `docs/plans/PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md` §A5 — **never built**. GIS same-polygon is not enough.
4. Zoning of record is a hard cut when both sides have a zone.
5. GLA bracketing when the pool allows (one smaller, one larger).
6. Whole baths already match. Keep it. 648 SE Douglas is 3 bed / 1 bath, not 2–4 bed.
7. Keep rural/urban 1-acre split, resort symmetry, water/sewer when known.

---

## Gold house

Live letter: **648 SE Douglas, Bend**.  
Sunstone PDF = page checklist, not the subject, unless Matt names Sunstone as the overlay proof.

---

## What “done” is

Matt can open the rebuilt PDF and tick all 16 chapters against `56628-sunstone-rpr.pdf`, and the priced set is not capped at 3.

R-068 stays **PARTIAL** until that PDF exists. Do not stamp VERIFIED on “beats RPR / no AVM.”
