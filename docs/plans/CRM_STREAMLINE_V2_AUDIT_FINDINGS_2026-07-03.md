# CRM Streamline **v2** — Second Adversarial Audit (2026-07-03)

> **Verdict: CONDITIONAL — do not build v2 as written.** The v2 *structure* is sound (the P0 fixes from
> the first audit — pre-image backup, field-write-before-drop, segment emission, stage-remap ordering,
> demote off real two-way activity — are the right shape and are **not** re-litigated here). But when I
> ran v2's rules over live data, **every headline count in v2 is wrong**, and one premise — "neighborhood
> is single-valued, move it to a single-select field" — is **false for 73% of tagged contacts** and would
> silently destroy data if built. Fix the eight items below (mostly: replace the estimated counts with
> the live ones in this doc, and kill the single-select-neighborhood idea) before any script is written.
>
> Read-only. Nothing mutated. Evidence = the **real** `deriveFromAddresses()` run over all 18,226 live
> contacts + live SQL. This audit was run against my own v2 plan; I looked for reasons it's wrong.

Author: Claude (Opus session, 2026-07-03). Audits [`CRM_STREAMLINE_PLAN_V2_2026-07-03.md`](CRM_STREAMLINE_PLAN_V2_2026-07-03.md).

---

## Findings: 3 P1 (wrong result / would-corrupt-if-built) · 5 P2

### V2-1 · **CORRECTED after a code review (2026-07-03)** — single-value IS right; the tags are pollution; the authoritative field already exists. **Never migrate tag→field by picking one tag.**

> **Retraction.** My first pass claimed the `neighborhood:` tags are an intentional multi-area farm
> semantic and that a single field would lose data. That was wrong. Reading the assignment code
> (`scripts/geocode-all-untagged.mjs`, `scripts/westside-bend-build-fub-import.mjs`) and the boundary
> model shows single-value is the *correct* design and the authoritative value already exists in a field.

- **How neighborhoods are actually defined (code):** a neighborhood is an authoritative polygon in
  `boundaries` (`geo_type='neighborhood'`, **28** polygons, City-of-Bend-GIS sourced). A property's
  neighborhood is resolved by geocoding its street address → `lookup_address_geo(lat,lng)` RPC →
  point-in-polygon → **exactly one `neighborhood_slug`** (`geocode-all-untagged.mjs:78-88`). That path
  **skips any contact already carrying a `neighborhood:` tag** and writes an authoritative row to
  `fub_person_geo` (2,242 rows, 1,466 with a neighborhood). Model = **one property → one neighborhood.**
- **The single-value field already exists and is populated:** `customNeighborhood` is set on **7,408**
  contacts, one clean value each (sample: "Widgi Creek", "Southern Crossing", "Awbrey Butte"), and it
  matches `fub_person_geo.neighborhood_slug` where both exist (id 11232 → both `summit-west`).
- **Why the tags are multi-valued (pollution, not semantics):** (a) `westside-bend-build-fub-import.mjs:161-162`
  writes **both** `neighborhood_slug` **and** `planned_community_slug` under the `neighborhood:` prefix
  (2 tags per import row — a planned community mis-modeled as a neighborhood); (b) the 5–6-tag contacts are
  the documented westside parcel mis-match corruption — sampled id 2454 has **6 neighborhood tags but 0
  property addresses / 1 total address** (a one-address contact can't be in six neighborhoods). Genuine
  multi-property owners exist but are rare (id 8122 has 7 property addresses).
- **So the corrected guidance:** v2 is **right** to make neighborhood a single-value field. The real trap
  is the **source**: v1 §8.2's "move the existing tag values into the field" would pick one of up to six
  polluted tags → wrong value. Instead — **keep the already-populated `customNeighborhood` field, drop the
  tags entirely**, and for the **2,643** contacts that carry a tag but have an empty field, geocode the
  primary property address (the `lookup_address_geo` mechanism already exists) or leave blank. Convert the
  field to a select over the 28 canonical neighborhood labels. Note the field-key mismatch (definition key
  `neighborhood` vs stored key `customNeighborhood` — same class as the display bug fixed in `f99a45df`;
  standardize on one). Subdivision (955 multi) / city (311 multi) get the same treatment: field is
  authoritative, tags are the polluted layer to drop — not the source to migrate from.
- **Net severity:** this is **not** a data-loss risk under the corrected approach (field already holds the
  truth); it flips to a **P1 "don't build it v1 §8.2's way"** — migrating *from* the tags would corrupt the
  field for thousands. Downgraded from "premise wrong" to "source wrong."
- **Fix:** either (a) keep neighborhood/subdivision/city as a **multi-value** field (text[]/multiselect) preserving all values, or (b) recognize these are farm/interest markers and keep them as tags (don't move them at all). Do **not** collapse to single-select. If a true "property neighborhood" field is wanted, derive it fresh by point-in-polygon and name it distinctly — don't overload the farm tags into it.

### V2-2 · P1 — Out Of Area Home Owners = **957**, not 1,743. v2 carried over v1's unverified number.
- **v2 claim:** §5 list table "~1,743 target"; §1 "≤ 2,006 derivable."
- **Contradicting evidence:** running the real `deriveFromAddresses()` over all 18,226 contacts and applying v2's own rule (absentee AND location non-local) yields **957** — `location:out-of-state` **626** + `location:out-of-area` **331**. Occupancy derived: occupied 7,351 · absentee 2,615 · unknown 8,260. Of the 2,615 absentee, only 957 resolve to a non-local mailing; the rest are local-investor or blank-state.
- **Blast radius:** the Out-Of-Area list ships at ~**957**, ~45% below the promised 1,743. The 1,743 (v1's "1,412+331") never matched this derivation and was carried into v2 unverified — exactly the "never trust a single figure" lesson from the prior session.
- **Fix:** state the list as **~957** (626 out-of-state + 331 in-state-out-of-area). If Matt wants closer to 1,743, the gap is address coverage (39% of the book has no address), not the rule — that's an enrichment task, not a filter tweak.

### V2-3 · P1 — `segment:seller` union = **9,586**, not ~7,524, and it's over-broad.
- **v2 claim:** §1/§8.1 "union of `audience:seller` + stage `Seller Prospect` (~7,524)."
- **Contradicting evidence:** live union = **9,586** (Seller Prospect 7,524 + audience:seller 3,511 − overlap **1,449**). Only **1,449 of 3,511** `audience:seller` contacts are stage Seller Prospect; the other **2,062** sit on other stages (Lead, etc.). Tagging all of them `segment:seller` inflates the Sellers list to 9,586 and sweeps in 2,062 non-farm contacts.
- **Fix:** correct the count to **9,586** and decide intent: (a) union = 9,586 (broadest), (b) stage-only = 7,524 (the farm), or (c) tag-only = 3,511. Recommend **(b) 7,524** — the farm is the seller book; `audience:seller` on a non-Seller-Prospect stage is a mailing-list flag, not a pipeline seller. This also removes the definitional confusion.

### V2-4 · P2 — `segment:expired` ships at **~925**, not ~650 (but the additive fold is safe).
- **Evidence:** any contact with an `*expired*` tag = **925**; v2's v1-set alone already = **921**. So the additive fold (adding `source:expired-listing-*`, `seller:expired-untouched`) only moves 921 → 925 — **safe, +4**, because those contacts already carry `Expired`. But the base is ~921, not the "~650" v2's list table and the prior handoff both state. Fix: set the Expired list expectation to **~925** and reconcile with Matt (his "~650" undercounts by ~40%).

### V2-5 · P2 — `realtor:migration` = **59**, not ~100 (local ≈ 2,347). Two things v2 got right here.
- **Evidence:** realtor identity union (`industry:realtor` OR bare `Realtor` OR stage `Real Estate Agent`) = **2,406**. Migration subset (any `<City> realtor` tag OR `migration broker`) = **59**, so local ≈ **2,347**. v2 said ~100 migration / ~2,240 local. Fix the counts to 59 / 2,347. **Correct in v2:** every `<City> realtor` tag sits on a realtor-identity contact (**0** orphans), so the derivation has no stragglers; the realtor union (2,406) is close to the 2,341 target.

### V2-6 · P2 — The classifier can't see `stage`, so "segment:seller from stage Seller Prospect" is unbuildable as specified.
- **Evidence:** `rewritePersonTags(tags, addresses, custom)` has no `stage` parameter. v2 §1 emits `segment:seller` partly from the current stage, but the function can't read it. Without a signature change (add `stage`), the seller segment silently falls back to `audience:seller`-only (3,511) — re-opening the P0-4 hole the whole v2 exists to close. Fix: specify the signature change (`rewritePersonTags(tags, addresses, custom, stage)`) and thread it through the runner.

### V2-7 · P2 — Segments overlap; the lists aren't a partition. 450 contacts are both Seller and Expired.
- **Evidence:** **450** contacts are in the seller union AND carry `Expired`/`Expired Listings`. Under v2 they land in both the Sellers and Expired lists, and (if both drive sequences) could double-enroll. Not necessarily wrong — an expired IS a seller lead — but v2 never states the segments are non-exclusive. Fix: declare the overlap policy (lists are workflow views, not a partition) and make sure enrollment logic de-dupes a contact across segment-driven sequences.

### V2-8 · P2 — `deriveFromAddresses` picks "mailing = first non-Property address" — but phone entries live in the addresses array.
- **Evidence:** live `addresses[].type` distribution: **null 7,641**, home 3,512, Property 3,093, **mobile 12**, **landline 7**, mailing 2. The derivation's `addresses.find(a => a.type !== 'Property')` will select a `mobile`/`landline` (a phone mis-stored as an address) or a null-type entry as the "mailing" and read `state`/`city` off it → garbage location. Small population (19 phone-typed) but a real correctness bug, and the derivation leans on 7,641 untyped addresses. Fix: select the mailing address by a real address shape (has `street`+`state`, type ∈ {home, mailing, null}), explicitly excluding phone types.

---

## What v2 got right (not re-litigated)
- The **reversibility** redesign (pre-image backup before first write, write-once backup, resumable) — structurally correct.
- **Field-write-before-tag-drop** — the right fix for the v1 data-loss P0 (once V2-1's multi-value issue is handled).
- **Stage-remap ordering** after segment emission — correct; and the additive **expired fold is safe** (+4).
- **Demote off a computed two-way signal**, not `last_activity_at` — correct.
- **Compliance** — unchanged and still intact (7 gate tags SACRED; `do_not_text` addition is right).

---

## Corrected numbers to bake into v2 (single source of truth)

| List / segment | v2 said | **Live-verified** |
|---|---|---|
| Out Of Area Home Owners | ~1,743 | **957** (626 OOS + 331 OOA) |
| Sellers (`segment:seller`) | ~7,524 | union **9,586** · stage-only **7,524** · tag-only 3,511 (pick one) |
| Expired (`segment:expired`) | ~650 | **~925** |
| Buyers (`segment:buyer`) | ~95 | verify at build (Buyer 53 + audience:buyer 42, dedup) |
| Local Realtors | ~2,240 | **~2,347** |
| Migration Realtors | ~100 | **59** |
| absentee / occupied (derived) | — | 2,615 / 7,351 (unknown 8,260) |
| neighborhood single-value field | needs building | **already exists** — `customNeighborhood` populated on 7,408; tags are the polluted layer |
| multi-`neighborhood:`-tag contacts | (assumed 0) | **7,294** — pollution (planned-community double-write + westside mis-match), not a real multi-area model |

## Recommendation (updated after the code review)
v2's plumbing is right, and — corrected — its single-value neighborhood field is right too. The fixes:
(1) **Neighborhood/subdivision/city:** keep the already-populated `customNeighborhood`/`customSubdivision`
fields, **drop the tags**, and geocode-backfill the ~2,643 tagged-but-empty via `lookup_address_geo`. Do
**NOT** populate the field by picking one of the multiple tags (that corrupts thousands). Standardize the
field key (`neighborhood` vs `customNeighborhood`). (2) replace every count with the live figures above
(Out-Of-Area 957, seller union 9,586, expired ~925, migration realtors 59); (3) pick the seller definition
(recommend stage-only 7,524); (4) add `stage` to the classifier signature; (5) harden the mailing-address
selection; (6) declare the segment-overlap/enrollment-dedup policy. Then dry-run and reconcile each list to
a live query before apply.
