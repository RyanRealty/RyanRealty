# Criteria editors

Reusable, broker-friendly criteria editors for listing alerts and market
report subscriptions. Each reads like a sentence with compact inline
controls, shows a live plain-English restatement, and (for alerts) a live
count of matching listings.

Everything exports from `components/admin/crm/criteria` (this folder's
`index.ts`). Nothing in here fetches on the server or writes anywhere — the
host dialog owns loading and persistence.

## Files

| File | What it is |
|---|---|
| `AlertCriteriaEditor.tsx` | Client component. Edits the saved-search filters JSON (`lib/search-filters` model). |
| `ReportCriteriaEditor.tsx` | Client component. Edits `{ areas, frequency }` for a market report subscription. |
| `criteria-sentence.ts` | Pure sentence helpers (no React, no I/O). Unit tests in `criteria-sentence.test.ts`. |
| `app/actions/criteria-count.ts` | Server action `countMatchingListings(filters)` behind the live count. |

## AlertCriteriaEditor

```tsx
import { AlertCriteriaEditor } from '@/components/admin/crm/criteria'
```

Renders: "Email me [once a day] with [residential listings] in [Bend] priced
[under $800K] with [3+] beds and [any] baths", a "More filters" disclosure
(sqft, year built, lot size, amenity toggles), the canonical
`getFiltersSummary` line, and a live count ("142 listings match today")
debounced 500 ms through `countMatchingListings`.

### Props

| Prop | Type | Notes |
|---|---|---|
| `value` | `SavedSearchFilters` | The filters JSON from `saved_searches.filters` / `guest_search_alerts.filters`. Required. |
| `onChange` | `(filters: SavedSearchFilters) => void` | Fires with a fresh object on every edit. Keys the editor does not expose (keywords, polygon, statusFilter, extra `cities`, ...) are preserved untouched and acknowledged in the sentence as "plus N more filters". Required. |
| `frequency` | `'instant' \| 'daily' \| 'weekly'` | Optional. When set, the sentence includes the cadence bracket. |
| `onFrequencyChange` | `(f) => void` | Optional. With `frequency`, makes the cadence bracket a Select; without it the cadence renders as plain text. Omit both to keep cadence in the host dialog. |
| `cityOptions` | `readonly string[]` | Proper-case city names. Defaults to `SERVICE_AREA_CITIES_PROPER` (Central Oregon service area). |
| `neighborhoodOptions` | `readonly GeoOption[]` | Defaults to `listNeighborhoodOptions()` (13 Bend districts + resort community registry), built client-side from static data. |
| `disabled` | `boolean` | Disables every control. |
| `className` | `string` | Layout classes for the wrapper. |

The place picker is ONE grouped select (cities group + neighborhoods and
communities group). Picking a city writes `city`; picking a neighborhood or
community writes `neighborhoodSlug` (the canonical `boundaries.geo_slug`
convention: `bend-*` districts, bare registry slugs for resort communities)
and clears `city`/`subdivision` — matching how `lib/search-filters`
summarizes, hashes, and builds URLs.

### Integration: AlertSubscriptionsTab edit dialog (`AlertEditDialog`)

Replace the stacked city/price/beds/baths/property-type fields with the
editor; keep the name input and the save wiring exactly as they are:

```tsx
const [draftFilters, setDraftFilters] = useState<SavedSearchFilters>(row.filters ?? {})
const [draftFrequency, setDraftFrequency] = useState<AlertFrequency>(
  row.frequency.trim().toLowerCase() === 'weekly' ? 'weekly' : 'daily',
)

<AlertCriteriaEditor
  value={draftFilters}
  onChange={setDraftFilters}
  frequency={draftFrequency}
  onFrequencyChange={setDraftFrequency}
/>

// on save — unchanged action, the editor already preserved unexposed keys:
await updateAlertSubscriptionAction(row.kind, row.id, {
  name: draftName.trim() || undefined,
  frequency: draftFrequency === 'instant' ? 'daily' : draftFrequency, // if the row model only stores daily/weekly
  filters: draftFilters,
})
```

Note: the guest/user alert tables store `daily`/`weekly` today. If the host
dialog should not offer instant, pass `frequency={draftFrequency}` where the
state type is narrowed to `'daily' | 'weekly'` — the union is assignable.

### Integration: person page (contact 360)

Same pattern inside whatever dialog the person page opens for a saved search.
The editor is dialog-agnostic; give it `value`/`onChange` and persist through
the action you already use there.

## ReportCriteriaEditor

```tsx
import { ReportCriteriaEditor } from '@/components/admin/crm/criteria'
```

Renders: "Send a [monthly] market report for [Bend and Tetherow]" with a
searchable area multi-select, plus the live sentence below.

### Props

| Prop | Type | Notes |
|---|---|---|
| `areas` | `string[]` | Subscribed area slugs. Required. |
| `frequency` | `'weekly' \| 'monthly' \| 'quarterly'` | Required. |
| `areaOptions` | `readonly GeoOption[]` | The valid registry options, **props-passed** (see below). Required. |
| `onChange` | `(next: { areas, frequency }) => void` | Fires with the full next criteria on every edit. Required. |
| `disabled`, `className` | | As above. |

**Area options are props-passed, not self-loaded** (documented decision):
the parent loads them once and can share one load across many editors, and
the component stays free of fetch states. Load them either way:

- Server component / page: `const areaOptions = await listAvailableMarketReportAreas()` from `@/lib/data/crm/getContactReportSubscriptions`, pass down.
- Client dialog: `const res = await getSubscriptionEditOptionsAction()` (`app/actions/subscriptions-admin.ts`) → `res.data.areas` is `{ key, label }[]`; map to `{ slug: key, label }`.

Areas already on the subscription but missing from `areaOptions` stay
visible in the picker (labeled by slug) so a save never silently drops them —
same behavior the existing `ReportEditDialog` has.

### Integration: ReportEditDialog

```tsx
const [criteria, setCriteria] = useState({ areas: row.areas, frequency: normalizeFrequency(row.frequency) })

<ReportCriteriaEditor
  areas={criteria.areas}
  frequency={criteria.frequency}
  areaOptions={areaOptions} // from getSubscriptionEditOptionsAction, mapped { slug: a.key, label: a.label }
  onChange={setCriteria}
/>

// on save — unchanged:
await updateReportSubscriptionAction(row.personId, criteria)
```

Validate `criteria.areas.length > 0` before saving (the sentence already
says "No areas chosen yet" when empty).

## countMatchingListings (server action)

`app/actions/criteria-count.ts`

```ts
const res = await countMatchingListings(filters)
// { data: { count: number } | null; error: string | null } — never throws
```

Normalizes through `normalizeSavedSearchFilters`, then rides
`getCachedSearchListings(filters, 1, 1)` (the same `unstable_cache`d search
path the site uses, 5 minute revalidate) and returns the total. Safe to call
from any client component; the editor already debounces it 500 ms.

## Sentence helpers (`criteria-sentence.ts`)

Pure and unit-tested. Useful on their own for read-only surfaces (table
cells, email previews):

- `alertCriteriaSentence(filters, frequency)` → "Email me once a day with residential listings in Bend under $800K with 3+ beds."
- `reportCriteriaSentence(areas, frequency, options)` → "Send a monthly market report for Bend and Tetherow."
- `formatPriceShort`, `pricePhrase`, `placePhrase`, `propertyTypePhrase`, `joinWithAnd`, `summarizeAreaLabels`, `extraFilterCount`, `listNeighborhoodOptions`, `resolveAreaLabels`.
