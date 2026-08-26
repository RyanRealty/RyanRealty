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

- 2026-08-26 — opened. Prior art: `238c2f31` (23 false children removed, gate added),
  `f8939a02` (handoff). Audit method and findings live in the registry's own
  `verification` blocks and in `docs/DATABASE_FOR_AI_AGENTS.md` §3a.
