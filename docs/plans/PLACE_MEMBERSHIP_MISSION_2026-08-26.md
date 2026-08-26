# Place membership mission — 2026-08-26

**Status:** live. Opened by Matt 2026-08-26 (`/endtoend`) off the resort membership
audit shipped in `238c2f31` / `f8939a02`.

The audit proved the registry was asserting membership it could not support and put a
gate behind it (`ci:resort-membership-evidence`). It also left five things undone. This
doc is the goal of record; the closing review pass is measured against it.

---

## The goal, in one paragraph

Every place name the MLS uses resolves to a real page with a real boundary, every
community the site claims exists is evidenced, and no made-up URL can mint an indexable
page. A visitor who searches "Sunrise Village Bend" lands on a Sunrise Village page with
its own polygon and its 232 sales of history; a visitor who searches "Petrosa" lands on
a Petrosa community page; and `/communities/bend-anything-at-all` does not exist.

---

## W1 — MLS alias → county plat map

**Problem.** Recorded plats are PHASED and worded differently from the MLS name, so
`slugify(MLS SubdivisionName)` misses them: Sunrise Village → `sunrise-village-river-bluff`
/ `-outback` / `-west-knoll-section` / `-east-knoll-section`; Westbrook Meadows →
`westbrook-meadows-p-u-d-*`; Braeburn → `braeburn-phase-i..iv`. `boundaries` holds 3,213
subdivision rows, so this is a NAME-MAPPING job, not data acquisition
(`docs/plans/MOBILE_GRIND/STATE.json` item C-21, corrected 2026-08-06).

**Explicitly forbidden:** the fuzzy prefix rule. C-21 records that it over-matched
"Triple" to `triple-ridge-*` when the MLS truncation means Triple KNOT, and under-matches
the MLS abbreviations (Bbr, Oww, DrrhTrs, Mtn High, Inn Of The 7th). Every mapping is
verified, not inferred.

**Done when:** a committed, gated map exists; each entry is verified by listing
coordinates falling inside the mapped plats' union; the 7 names below serve a real page
with a boundary instead of a soft-404; and the mapping generalises past those 7.

Soft-404 today: Sunrise Village (232 lifetime closed), Westbrook Meadows (218),
1st On The Hillsites (119), Cline Falls Oasis (42), Cline Falls Mob Park (9),
Pace Estate (7), Campbell Road (5).

### W1 — evidence gathered, and the design it forces

`mls_subdivision_plat_coverage()` is applied (migration 20260826120000) and works.
Membership is decided by GEOMETRY — where the homes carrying an MLS name physically
are — which sidesteps the forbidden prefix rule and also surfaces noise a name rule
cannot see: 5 listings tagged "Cline Falls Oasis" sit inside the Coppermill plat, and
2 tagged "Sunrise Village" sit in Bachelor Sunrise.

Measured 2026-08-26 (points inside / sampled):

| MLS name | recorded plat(s) | shape |
|---|---|---|
| 1st On The Hillsites | `first-on-the-hill-sites` 18/18 | 1:1 |
| Pace Estate | `pace-estates` 3/3 | 1:1 |
| Westbrook Meadows | `westbrook-meadows-p-u-d-phases-1-and-2` 11, `-phase-3` 6 | 1:many |
| Sunrise Village | `sunrise-village-{river-bluff, -blocks-2-3-and-5-15-replat, outback, west-knoll-section, east-knoll-section}` | 1:many |
| Cline Falls Oasis | `cline-falls-oasis-subdivision` 7, `cline-falls-oasis-2-subdivision` 8 (+ Coppermill 5 = noise) | 1:many |
| Campbell Road | `first-on-the-hill-sites` 3, `campbell-road-subdivision` 2 | AMBIGUOUS |
| Cline Falls Mob Park | `city-of-cline-falls` 1/1, only 3 unique coords | THIN |

"1st On The Hillsites" is settled twice over, by geometry and by county record: the
plat is FIRST ON THE HILLSITE, filed 1965-04-08, CSNUM 07198, which the assessor and
the GIS layer spell "FIRST ON THE HILL SITES" — three words, which is why every
substring probe for "Hillsites" returned nothing. Original CC&Rs at Deed vol. 143
pg. 18 (April 1965), developer North Century Seven, Inc.; First Amendment instrument
2021-33262. Note CENTURY HEIGHTS (CS 16944) is nested wholly INSIDE it, so a parcel
can sit in both — join on the CS 07198 polygon, never on the assessor string, which
undercounts by every parcel re-platted since 1965.

**THE DESIGN DECISION, and why the obvious answer is wrong.** The obvious move for a
1:1 case is to 308 `/subdivisions/1st-on-the-hillsites` to the county-named page.
Verified 2026-08-26 that this is WRONG: `/subdivisions/first-on-the-hill-sites`
renders with a polygon and ZERO listings, because `getPlatPublicInventory` matches
`slugify(subdivision_name) === plat.slug` and every listing is tagged
"1st On The Hillsites". Redirecting sends a visitor to an empty page — worse than
today's soft-404.

So the canonical URL is where the CONTENT is: the MLS slug, which carries the
listings and the sold history. The plan:

1. Create a `boundaries` row (geo_type='subdivision') at `slugify(MLS name)` whose
   polygon is the ST_Union of its verified member plats, `source` naming every CSNUM
   in the union — the same pattern the resort communities already use. This makes all
   7 pages render a real boundary AND their listings, with no app change, and makes
   them indexable (polygon + >= 10 lifetime closed sales).
2. Where a county-named page would then duplicate it (the 1:1 cases), 308 the
   county slug to the MLS slug — the thin page yields to the one with inventory.
   Middleware, not page body (`scripts/check-streamed-redirect.mjs`).
3. Commit the reviewed map to `data/subdivision-alias-plats.json` with the per-plat
   hit counts as evidence, and gate it the way the registry is gated.
4. Campbell Road and Cline Falls Mob Park do NOT ship on this pass. Campbell Road's
   listings sit mostly inside First On The Hill Sites (Campbell Rd is a street
   through that 1965 plat, and 27 of its accounts front W Campbell Rd), so a union
   under "Campbell Road" would draw a second polygon over the same ground. Cline
   Falls Mob Park has 3 unique coordinates. Both need a decision, not a default.

## W2 — Missing master-planned communities

Sizeable communities with no registry entry and no page, by active SFR:
Easton 21, Petrosa 19, Ironhorse 16, Stevens Ranch 15, Stone Creek 13,
Ochoco Pointe 11, Sisters Woodlands 10.

**Done when:** each is in `data/resort-communities.json` with membership evidenced to the
standard `ci:resort-membership-evidence` enforces (a measurement per alias, or written
evidence naming another query shape), carries a boundary, and renders a page a buyer can
use. `is_resort` set honestly — a master-planned subdivision is not a golf resort.

## W3 — `/communities` junk-slug hole

`/communities/<city>-<anything>` returns HTTP 200, `index, follow`, with a
self-referential canonical, for ANY name. Control proving it is pre-existing and
unbounded: `/communities/bend-some-ordinary-plat` — never in the registry, in
`boundaries`, or in the MLS.

**Constraint:** the redirect must come from middleware. A page-body `redirect()` cannot
emit a real 3xx under Next 16 streaming because `app/loading.tsx` flushes a 200 first;
`scripts/check-streamed-redirect.mjs` enforces this. The resolver stays synchronous and
DB-free.

**Done when:** an unknown slug cannot return an indexable 200; a compound slug whose
subdivision half is a real plat lands on that plat's page; and a gate stops a new
indexable community URL appearing without a registry or `boundaries` row behind it.

## W4 — Boundary polygons

- `three-rivers` covers 2,503 of the CDP's 4,819 acres (51.9%). Widen it, then re-test
  the 8 aliases that currently fail containment while sitting closer to the centre
  (1.1–2.8 km) than the 3 that pass (3.05–4.12 km).
- `widgi-creek` is the county INN OF 7TH MOUNTAIN unincorporated-community polygon,
  shared with the separate `inn-of-the-7th-mountain` entry. Give Widgi its own plat union.
- `rivers-edge` and `mountain-high` have no `geo_type='neighborhood'` polygon at all.

**Done when:** each community's polygon is its own, sourced and attributed in
`boundaries.source`, and the membership gate's numbers are re-measured against it.

## W5 — Pronghorn → Juniper Preserve

Matt 2026-08-26: rename, keeping Pronghorn as an MLS alias and an SEO/redirect path.
**Verify the rebrand against a primary source first** — §0 applies to a name as much as
to a number.

**Done when:** the site says Juniper Preserve, MLS-tagged "Pronghorn" listings still
resolve, `/communities/pronghorn` 308s to the new slug, and the CMA resort guard still
recognises both.

## R1 — Research: "1st On The Hillsites"

174 MLS listings on Century Dr and Campbell Rd, Bend 97702 (~44.026, -121.352), matching
no recorded Deschutes plat under that name or phase-suffixed. Establish what it is before
mapping it. Feeds W1.

---

## Bar

Repo canon outranks this doc (CLAUDE.md §0 accuracy, §1 approval, brand voice, gates).
Every number that reaches a page carries a verification trace. No stat ships that cannot
be traced to a named source. Partial progress is not done.

## Log

- 2026-08-26 — W1 SHIPPED (5 of 7): union boundaries for sunrise-village,
  westbrook-meadows, cline-falls-oasis, 1st-on-the-hillsites, pace-estate. Verified
  rendered: the first four are now index,follow with a real city, a boundary, a map
  and sales history; pace-estate correctly stays noindex at 7 lifetime closed sales
  (threshold 10). Campbell Road + Cline Falls Mob Park held for a decision.
- 2026-08-26 — W5 SHIPPED (`b41c3130`): Juniper Preserve rename, `former_labels`, the
  community-lists-itself bug in 4 renderers, and the withheld-abbreviation fallback.
- 2026-08-26 — opened. Prior art: `238c2f31` (23 false children removed, gate added),
  `f8939a02` (handoff). Audit method and findings live in the registry's own
  `verification` blocks and in `docs/DATABASE_FOR_AI_AGENTS.md` §3a.
