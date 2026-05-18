# Phase 2.6 log: Bend market bible

**Status:** Complete
**Started:** 2026-05-16
**Finished:** 2026-05-16
**Deliverable:** `/Users/matthewryan/RyanRealty/marketing_brain_skills/research/bend-market-bible.md`

---

## Verification gate results

| Check | Result |
|-------|--------|
| Word count | 9,518 (threshold: 6,000) |
| Numbered appendix citations | 55 (threshold: 30) |
| [Source: inline tags | 78 |
| Em-dash grep (U+2014) | 0 hits |
| En-dash grep (U+2013) | 0 hits |
| Banned-word scan | CLEAN |
| Skeleton output | No. All 10 required sections present. |

All verification gates passed.

---

## Files read

- `/Users/matthewryan/RyanRealty/marketing_brain_skills/brand-voice/voice_guidelines.md` (first 100 lines, §6.1 ban, banned words)
- `/Users/matthewryan/RyanRealty/marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md` (first 100 lines, scope and guardrails)
- `/Users/matthewryan/RyanRealty/supabase/migrations/20260514210000_neighborhoods_add_boundary_provenance.sql` (neighborhood boundary provenance schema)
- `/Users/matthewryan/RyanRealty/supabase/migrations/20260515170000_resort_communities_neighborhood_aliases.sql` (all 14 resort community slugs and subdivision name aliases)

---

## WebSearch queries executed (14)

1. Deschutes County Oregon population 2024 2025 Census ACS migration
2. City of Bend Oregon ADU accessory dwelling unit rules 2025 Development Code
3. Bend Oregon short term rental STR ordinance 2024 2025 permit cap zones
4. St Charles Health System Bend Oregon employees 2024 largest employer
5. Bend-La Pine Schools enrollment 2024 2025 employee count
6. Visit Bend Oregon annual visitors lodging tax revenue 2023 2024 statistics
7. Central Oregon Association REALTORS COCAR MLS 2025 median home price Bend
8. Beacon Appraisal Group Beacon Report Central Oregon market report 2025
9. Oregon wildfire SB 762 defensible space requirements homeowner 2024 2025
10. Bend Oregon top employers 2025 Les Schwab OSU-Cascades Mt Bachelor RingCentral
11. Oregon property disclosure statement real estate requirements 2024 ORS
12. Deschutes County in-migration source states California Washington 2024 ACS Census
13. NW Crossing / Tetherow / Broken Top / Awbrey Butte / Sunriver / Tumalo / La Pine / Vandevert Ranch / Northpointe / Old Bend / Larkspur / Sundance / Mountain Village / Tillicum Village home prices (multiple searches)
14. Bend-La Pine Schools boundary map / OSU-Cascades enrollment / Deschutes water rights / Bend media / STR AirDNA / Bend housing market 2026 (multiple searches)

---

## WebFetch calls executed (3)

1. `https://beaconappraisers.com/market-overviews/` - Beacon Report archive and metrics
2. `https://www.edcoinfo.com/blog/edco-releases-largest-employers-list-for-central-oregon` - Full EDCO employer list 2025
3. `https://www.qualityinfo.org/-/deschutes-county-migration-insights-from-internal-revenue-service-data` - IRS migration data by county

Note: Census QuickFacts returned HTTP 403 (auth-required). Census data sourced via web search results that cited the QuickFacts data directly.

---

## Coverage confirmation

All 10 required sections delivered:
1. 16 neighborhoods: all 16 present with price range, home types, lot norms, amenities, schools, HOA, buyer profile, producer implications
2. Top 30 employers: 30 rows in employer table with headcount, sources, and employer-to-neighborhood pipeline notes
3. Schools: BLS, Three Rivers SD, private schools, boundary note, value effect
4. Regulatory environment: Oregon disclosure law, ADU policy, STR ordinance, water rights, wildfire/SB 762, HOA CC&R highlights
5. COCAR and MLS rules: Clear Cooperation, office exclusive, market stats reporting
6. Migration patterns: IRS data by county, ACS income, buyer persona implications
7. Tourism and STR: Visit Bend spending figures, AirDNA STR data, supply impact
8. Local press and influencers: Bend Bulletin, Source Weekly, Central Oregon Daily, Cascade Business News, Bend Magazine, content patterns
9. Beacon Report: what it is, metrics, access URL, brain integration instructions
10. Top brokerage offices: 11-row table with address, agent count, notes

---

## Blockers

None. All required sections completed. Census QuickFacts direct URL returned 403; data sourced via search result citations from the same QuickFacts URL (public data, no login required from search index). RingCentral Bend headcount not confirmed; marked [unverified] in employer table. Several employer headcounts in rows 18-30 are unverified and marked accordingly.

---

## Token cost estimate

Approximately 120,000 input tokens (web search results, file reads) and 15,000 output tokens (document composition). Estimated cost at Sonnet 4.6 rates: under $2.00.
