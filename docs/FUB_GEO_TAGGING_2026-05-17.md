# FUB Lead Geo-Tagging Pipeline

**Status:** Built 2026-05-17. Phase 1 in execution, Phase 2 awaiting Phase 1 completion.
**Spec source:** Matt's directive — "have a bunch of lists of the neighbors of certain neighborhoods that we can target directly by their neighborhood... drive them to these landing pages."

---

## Goal

Every FUB lead should be filterable by:
- **City** (`city:bend`, `city:redmond`, `city:sunriver`, etc.)
- **Bend neighborhood** (`neighborhood:northwest-crossing`, `neighborhood:bend-river-west`, etc.)
- **Subdivision** (`subdivision:crosswater-ph-3`, `subdivision:awbrey-glen`, etc.)
- **Geo scope** (`geo:local` / `geo:out-of-area` / `geo:out-of-state`)
- **Owner type** (`owner:occupied` vs `owner:absentee`)

So we can build smart lists like "Awbrey Glen owners" and run ad campaigns targeting that exact pool.

---

## What we discovered in the data

**Address field reality:**
- FUB person `addresses[0]` = mailing address (where they receive mail). 3,963 of 13,156 leads have one.
- `customOpenHouseAddress` = duplicated copy of the same mailing address (3,593 leads).
- There's NO separate property-they-own address. For absentee owners (1,808 leads — own in Bend, mail elsewhere), we know they own SOMETHING in our area (via the import's `Bend` + subdivision tags), but the specific street address isn't stored.

**Existing tag inventory (pre-cleanup):**
- 6,154 `Bend`, 1,381 `Redmond`, 259 `Sisters`, 443 `Sunriver`, etc. (Title Case city tags)
- 471 `NWX` (Northwest Crossing), 448 `RiverWest` (kebab-case neighborhood tags)
- 27 `crosswater-ph-3`, 19 `oregon-water-wonderland`, etc. (sparse subdivision tags)
- 1,808 `absentee`, 3,266 `owner-occupied`
- 630 `out-of-state`, 461 `in-state-out-of-area`

The original KTS import had encoded most geography in tags, not in dedicated fields. Our job: make this canonically-namespaced + filterable, then enrich the gaps with geocoding.

---

## Three-phase plan

### Phase 1 — Tag normalization (FREE, immediate)

Script: `.tmp_env/fub-setup/16-normalize-geo-tags.mjs`

Maps existing legacy tags to canonical namespaced equivalents. Affects 8,695 leads, adds 22,330 canonical tags. ~15 minutes wall clock, $0.

Mapping:

| Legacy | Adds canonical |
|---|---|
| `Bend`, `Redmond`, `Sisters`, `Sunriver`, etc. | `city:<slug>` |
| `NWX` | `neighborhood:northwest-crossing` + `city:bend` |
| `RiverWest` | `neighborhood:bend-river-west` + `city:bend` |
| `Crosswater`, `crosswater` | `neighborhood:crosswater` |
| `Tetherow` | `neighborhood:tetherow` + `city:bend` |
| `Old Bend` | `neighborhood:bend-old-bend` + `city:bend` |
| `Black Butte Ranch` | `neighborhood:black-butte-ranch` |
| `crosswater-ph-3` | `subdivision:crosswater-ph-3` + `neighborhood:crosswater` |
| `oregon-water-wonderland`, `canoe-camp`, etc. | `subdivision:<slug>` |
| `absentee` | `owner:absentee` |
| `owner-occupied` | `owner:occupied` |
| `out-of-state` | `geo:out-of-state` |
| `in-state-out-of-area` | `geo:out-of-area` |
| `high-equity` | `equity:high` |
| `recent-purchase` | `tenure:recent` |
| `long-term` | `tenure:long-term` |

Legacy tags are LEFT IN PLACE for safety. A follow-up pass can strip them after Matt verifies the canonical tags work in his filters.

### Phase 2 — Geocode owner-occupied leads (~$16)

Script: `.tmp_env/fub-setup/17-geocode-leads.mjs`

For the 2,257 leads tagged `owner-occupied` with a strict full address (street + city + state):
1. Geocode via Google Geocoding API ($0.005 each)
2. PostGIS point-in-polygon lookup via `public.lookup_address_geo(lat, lng)` against `public.boundaries` (3,213 subdivisions + 28 neighborhoods + 10 cities)
3. Upsert result to `public.fub_person_geo`
4. Push tags back to FUB: `city:<slug>`, `neighborhood:<slug>`, `subdivision:<slug>`, `geo:<scope>`

The strict pass skips 1,009 leads with partial addresses (no street, missing state, etc.). Those are written to `.tmp_env/fub-setup/partials-for-manual-review.csv` for Matt to triage.

Expected runtime: ~15 minutes. Expected cost: ~$11 in geocoding.

### Phase 3 — Wire LP form to geocode on submission

Every new seller LP submission now flows through `lib/lead-geocode.ts` automatically:

```typescript
// In app/lp/seller-home-value/actions.ts:
void geocodeAndTagLead({
  fubPersonId,
  address: parsed.full,
  sourceType: 'lp-form',
  state: parsed.state,
}).then((res) => {
  if (res.ok) addPersonTags(fubPersonId, res.tags)
})
```

Fire-and-forget. Never blocks the form submission. Adds the neighborhood/subdivision/city tags within ~500ms of the FUB person being created.

Cost: $0.005 per submission.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ ad → /lp/seller-home-value → submitSellerLPForm()               │
│   ├─ Create/find FUB person                                     │
│   ├─ Apply audience:seller, seller:{tier}, source:seller-lp     │
│   ├─ Round-robin broker assignment                              │
│   ├─ Write 4 custom fields                                      │
│   └─ Fire geocodeAndTagLead({...})  ← NEW, fire-and-forget      │
│         ├─ Google Geocoding API → lat/lng                       │
│         ├─ Supabase RPC lookup_address_geo(lat,lng)             │
│         │     └─ point-in-polygon vs public.boundaries          │
│         │         ├─ city polygon (10)                          │
│         │         ├─ neighborhood polygon (28)                  │
│         │         └─ subdivision polygon (3,213)                │
│         ├─ Upsert public.fub_person_geo                         │
│         └─ Apply FUB tags: city:bend, neighborhood:nwx, etc.    │
└─────────────────────────────────────────────────────────────────┘

Smart list filter in FUB UI:
  "Awbrey Glen owners — last 90d activity"
  filter: tag=subdivision:awbrey-glen + lastActivity > 90d
```

---

## Files

### Code
- `lib/lead-geocode.ts` — reusable geocode + spatial lookup helper
- `app/lp/seller-home-value/actions.ts` — LP form wired to call it
- `supabase/migrations/20260517190000_marketing_assignments.sql` — earlier migration
- (Supabase) `public.fub_person_geo` table — per-lead spatial intel
- (Supabase) `public.lookup_address_geo(lat, lng)` RPC — point-in-polygon

### Scripts (in `.tmp_env/fub-setup/`)
- `16-normalize-geo-tags.mjs` — Phase 1 tag canonicalization
- `17-geocode-leads.mjs` — Phase 2 batch geocoding

### Docs
- `docs/FUB_SELLER_WORKFLOW_2026-05-17.md` — overall seller workflow
- `docs/FUB_GEO_TAGGING_2026-05-17.md` — this doc
- `docs/FUB_UI_SETUP_RUNBOOK.md` — Matt's UI steps

---

## Smart lists Matt can build in FUB UI

Once Phase 1 completes (~15 min from start), these become instantly filterable:

| Smart list | Filter | Use for |
|---|---|---|
| Awbrey Glen owners | tag = `neighborhood:awbrey-glen` OR `subdivision:awbrey-glen-*` | Targeted FB ad to AG residents |
| Tetherow owners | tag = `neighborhood:tetherow` OR `subdivision:tetherow-*` | Tetherow listing prospects |
| NWX owners — absentee | tag = `neighborhood:northwest-crossing` AND `owner:absentee` | High-equity rental owners considering selling |
| Sunriver out-of-state owners | tag = `neighborhood:sunriver` AND `geo:out-of-state` | Vacation home owners |
| All Bend owners — high equity | tag = `city:bend` AND `equity:high` | Refi / move-up candidates |
| Old Bend long-term residents | tag = `neighborhood:bend-old-bend` AND `tenure:long-term` | Mature seller prospects |
| Crosswater owners | tag = `neighborhood:crosswater` | Crosswater listings + buyer matches |

Each list is a one-click filter in the FUB UI. Each can be exported to CSV for Facebook custom-audience uploads.

---

## Limitations + future enhancements

1. **Absentee owners need property lookup** — the 1,808 absentee leads have a mailing address (where they LIVE) but not their Bend property address. Phase 2 only geocodes owner-occupied. A future Phase 4 would cross-reference Deschutes County DIAL records by owner name + city to find their property address.

2. **Partial addresses (1,009 leads)** — strict mode skips these. CSV at `.tmp_env/fub-setup/partials-for-manual-review.csv`. Matt can clean up manually or we can build a lenient second pass.

3. **Cron refresh** — `public.fub_person_geo` is built once. A future improvement: weekly cron to re-geocode any leads whose address changed since last run.

4. **Cost ceiling** — Google Geocoding is $5/1K requests. At current volume (~3K leads + ~10 new LP submissions/week), monthly cost is ~$0.20 ongoing after the one-time backfill.

---

*Built 2026-05-17 to support neighborhood-targeted ad campaigns and ultra-precise smart-list segmentation.*
