# dim_office entity resolution — methodology

**Status:** I3 foundation (2026-08-10)  
**Table:** `public.analytics_dim_office`  
**Seed source:** `data/analytics/office-brand-aliases.json`  
**Bootstrap:** `scripts/analytics/bootstrap-dim-office.mjs`

---

## Purpose

MLS `ListOfficeName` / `buyer_office_name` strings fragment the same brokerage
(e.g. `Cascade Hasson SIR` vs `Cascade Hasson Sotheby's International Realty`).
`analytics_dim_office` is the entity layer that maps raw strings → one office
row so competitive share can later roll up truthfully.

**This document does not invent or publish share numbers.** Share figures stay
string-level in `analytics_mart_office_share_annual` until a mart rebuild joins
through `office_id`. Alias groups only define *who merges with whom*.

---

## Two levels (do not confuse)

| Level | Field | Meaning | Example |
|-------|--------|---------|---------|
| **Office entity** | `canonical_name` + `aliases[]` | One local office; all known MLS strings for that office | `Cascade Hasson SIR` ↔ Sotheby's long form |
| **Brand family** | `brand_family` | Franchise / brand umbrella across offices | All `RE/MAX *` rows → `RE/MAX` |

- **Aliases merge for entity resolution** (one `office_id`).
- **Brand family labels only** — does *not* auto-merge independent franchise
  offices (e.g. `RE/MAX Key Properties` stays separate from
  `RE/MAX Out West Realty`). Brand-level share is a future rollup query, not
  implied by seeding.

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
| `/admin/analytics/competition` | May show raw office strings + brand labels; office → agent drill is string-level until mart uses `office_id` |
| Public site | **No competitor office naming** until I6 Matt lock |
| Future brand rollup | Sum mart rows whose dim `brand_family` matches; label methodology explicitly |

---

## Review cadence

- Revisit groups when EDA or mart shows a new high-volume string variant.
- Prefer evidence (co-occurrence, known rebrand, MLS truncation) over fuzzy
  string distance alone.
- Ryan Realty aliases are strategy-sensitive (I4); keep `is_ryan_realty` true
  only for our legal/DBA forms.
