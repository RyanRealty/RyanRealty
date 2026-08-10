# dim_office entity resolution — methodology

**Status:** I3 foundation + I1 brand-merged rollup (2026-08-10)  
**Table:** `public.analytics_dim_office`  
**Seed source:** `data/analytics/office-brand-aliases.json`  
**Bootstrap:** `scripts/analytics/bootstrap-dim-office.mjs`  
**Merged share DAL:** `lib/data/analytics/getCoOfficeShareMerged.ts`

---

## Purpose

MLS `ListOfficeName` / `buyer_office_name` strings fragment the same brokerage
(e.g. `Cascade Hasson SIR` vs `Cascade Hasson Sotheby's International Realty`).
`analytics_dim_office` is the entity layer that maps raw strings → one office
row so competitive share can roll up truthfully.

**This document does not invent share numbers.** The mart remains string-level
(`office_id` may be null on rows). Alias groups define *who merges with whom*;
I1 rollup **sums real mart sides/volume** after joining names → dim — never
fabricates market share.

---

## Two levels (do not confuse)

| Level | Field | Meaning | Example |
|-------|--------|---------|---------|
| **Office entity** | `canonical_name` + `aliases[]` | One local office; all known MLS strings for that office | `Cascade Hasson SIR` ↔ Sotheby's long form |
| **Brand family** | `brand_family` | Franchise / brand umbrella across offices | All `RE/MAX *` rows → `RE/MAX` |

- **Aliases merge for entity resolution** (one `office_id`).
- **Brand family is advisory** for strategy rank — independent franchise
  offices remain separate legal entities (e.g. `RE/MAX Key Properties` ≠
  `RE/MAX Out West Realty` operationally). Brand-level share is an explicit
  rollup query (`getCoOfficeShareMerged`), not implied by seeding alone.

---

## What goes in an alias group

**Include (true merge):**

1. Rebrands / dual marketing names of the same local firm  
2. Abbreviations (`Keller Williams Realty C.O.` → Central Oregon)  
3. LLC / punctuation / truncation variants of the same string  
4. Documented Ryan Realty legal-name variants  

**Do not include:**

1. Unrelated offices that share a word (`NAI Cascade` ≠ Cascade Hasson)  
2. Guessed share percentages or ranks  
3. Public marketing claims about competitor production (I6 = Matt lock)  
4. Name-only agent joins (agents use MLS id / email — separate dim)

---

## Bootstrap algorithm

1. Load curated groups + brand rules from
   `data/analytics/office-brand-aliases.json`.
2. Pull distinct `office_name` from
   `analytics_mart_office_share_annual` (CO geo, all years/sides).
3. For each curated group: upsert one `analytics_dim_office` row with
   `canonical_name`, `brand_family`, `is_ryan_realty`, and
   `aliases = unique(declared aliases ∪ observed mart strings in group)`.
4. Delete standalone dim rows whose `canonical_name` is only an *alias* of
   another group (absorbed entities).
5. For remaining mart names not in any group: upsert self-alias rows;
   set `brand_family` from regex rules when matched.
6. Never write volume, units, or share into dim — dims are identity only.

Re-run after new mart years or when MLS office strings change:

```bash
node scripts/analytics/bootstrap-dim-office.mjs
```

---

## Admin / product use

| Surface | Policy |
|---------|--------|
| `/admin/analytics/competition` | Default **brand family** ranks (`view=brand`); toggle **office entity** (`view=entity`) and **raw string** (`view=raw`). Agent drill stays exact office string. |
| Public site | **No competitor office naming** until I6 Matt lock |
| Brand rollup | `getCoOfficeShareMerged` — sum mart rows after dim join; methodology `office_share_merged_v1` |

---

## I1 — Brand-merged / entity-merged competitive share

**Code:** `lib/data/analytics/getCoOfficeShareMerged.ts`  
**Surface:** `/admin/analytics/competition?view=brand|entity|raw` (default `brand`)  
**Export:** `/admin/analytics/competition/export?kind=offices&view=brand|entity|raw`  
**Status:** **[~]** — strategy-grade brand merge shipped; mart `office_id` still null (join is name→dim); brand_family merge is **advisory** not legal-entity share.

### Methodology (`office_share_merged_v1`)

1. **Load** full `analytics_mart_office_share_annual` rows for year/side (region `central-oregon`, `type_scope=all`). Live closed-listings aggregate only if mart empty.
2. **Join** each `office_name` → `analytics_dim_office`:
   - Prefer mart `office_id` when set (future rebuild path).
   - Else exact case-insensitive match on `canonical_name` ∪ `aliases`.
   - Else normalized key (strip punctuation). No fuzzy edit-distance.
3. **Group:**
   - `mergeMode=brand_family`: key = dim `brand_family`, else `brand_family_rules` regex from JSON catalog, else singleton (canonical or raw string).
   - `mergeMode=office_entity`: key = dim `office_id` (alias group), else raw-string singleton.
4. **Aggregate:** sum **real** `sides_count` and `total_volume` from matched mart rows only. Never invent sides/volume.
5. **Share %:** group volume (or units) ÷ market total from `analytics_mart_market_annual` (same year, region, type_scope=all). If market mart missing, fall back to sum of full office mart for that side — still no invented figures.
6. **Rank** by total volume descending. Members list = raw MLS office strings rolled into the group.
7. **Admin only.** Not for public competitor claims (I6).

### Honesty / residual

| Residual | Detail |
|----------|--------|
| Mart `office_id` null | Rebuild still writes string grain only; join is post-hoc name→dim |
| Brand family advisory | Franchise umbrellas merge for **strategy** ranking; independent offices remain separate legal entities |
| Incomplete dim labels | Unmatched / unbranded strings stay singletons — ranks do not invent families |
| Agent drill | Still exact office string (`?office=`), not brand-wide agents |

### Rebuild note

`scripts/analytics/rebuild-analytics-marts.mjs` continues to populate
`analytics_mart_office_share_annual` at **string grain** (`office_id` left null).
Optional future: resolve `office_id` at rebuild time via the same alias map.
Until then, I1 merge is entirely in the DAL.

---

## I4 — Ryan Realty brand share (list + buy)

**Code:** `lib/data/analytics/getRyanBrandShare.ts`  
**Surface:** `/admin/analytics/competition` (amber “Ryan Realty brand share” panel)

### Methodology (`ryan_brand_alias_rollup_v1`)

1. **Alias set** (identity only — never invents volume):
   - Prefer `analytics_dim_office` rows with `is_ryan_realty = true` (`canonical_name` ∪ `aliases`).
   - Else curated group(s) from `data/analytics/office-brand-aliases.json` with `is_ryan_realty: true`.
   - Fallback only if both missing: fixed legal-name list + `/ryan\s*realty/i` family regex.
2. **Match rule:** exact case-insensitive MLS office string **or** normalized key (strip punctuation). No fuzzy edit-distance.
3. **List side:** sum `analytics_mart_office_share_annual` rows for `side=list` whose `office_name` matches the alias set (live aggregate fallback over `ListOfficeName` if mart empty).
4. **Buy side:** same for `side=buy` / `buyer_office_name`.
5. **Share %:** Ryan total volume (or units) ÷ market total for the year from `analytics_mart_market_annual` (region `central-oregon`, `type_scope=all`), same closed CTE + CO service-area as all analytics.
6. **Does not invent numbers.** If no matched strings, share is **0%** with empty matched list — never a placeholder share.
7. **Admin only.** Not for public competitor claims (I6). Strategy-grade for our own list/buy truth.

### Known caveats

- Mart rows are still **string-level** (`office_id` may be null). Alias rollup sums matching strings after the fact (same join pattern as I1).
- Buy-side fill depends on MLS `buyer_office_name`; missing buy office ≠ non-Ryan buy.
- Dual-office closes count once on each side when both names match (standard sides math).


---

## Review cadence

- Revisit groups when EDA or mart shows a new high-volume string variant.
- Prefer evidence (co-occurrence, known rebrand, MLS truncation) over fuzzy
  string distance alone.
- Ryan Realty aliases are strategy-sensitive (I4); keep `is_ryan_realty` true
  only for our legal/DBA forms.
