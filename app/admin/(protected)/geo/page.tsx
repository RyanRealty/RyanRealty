// @no-parity — internal admin surface, no public mockup contract
//
// Geography & neighborhoods — migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: the superuser guard (it lives in this folder's
// layout.tsx, untouched), `export const dynamic = 'force-dynamic'`, the
// deliberate no-seed-on-render rule and the comment that explains it, every
// read (listGeoPlaces for state/city/neighborhood/community), the Oregon
// state lookup by slug, the cityId fallback to citiesFromGeo[0], the
// community scoping by parent_id, CITY_CAP and LIST_CAP and both "Showing N
// of M" notes, the `?city=` query-param name and its meaning, the /admin and
// /admin/geo/area-guide-upload hrefs, and the three EnsureGeoButton /
// NeighborhoodForm / AssignCommunity islands with the same props.
//
// Shape changed, data did not: the page no longer renders its own <main>
// (ConsoleShell owns that landmark — this page shipped two of them, measured
// in headless Chrome at 375 and 1280), the <h1> is gone because the geo tab
// strip names the page, the three shadcn stat cards became the family's
// typographic numbers strip with the same three values, the row of city
// link-chips became one compact control (acceptance bar rule 2 — a filter set
// is a dropdown, never a wall of pills), and the neighborhood badge row became
// the admin's one grid, which also shows each row's slug because the slug is
// the key these pages exist to manage.
import Link from 'next/link'
import { listGeoPlaces } from '@/app/actions/geo-places'
import {
  Button,
  ReportGrid,
  ReportNumbers,
  SectionHead,
  SelectField,
  VerdictLine,
  type ReportNumberItem,
} from '@/components/admin/v2'
import EnsureGeoButton from './EnsureGeoButton'
import NeighborhoodForm from './NeighborhoodForm'
import AssignCommunity from './AssignCommunity'

export const dynamic = 'force-dynamic'

const CITY_CAP = 12
const LIST_CAP = 12

export default async function AdminGeoPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>
}) {
  const params = await searchParams
  const selectedCityId = params.city ?? null
  // Seeding (country/state/cities/communities from listings) is a heavy
  // write-and-scan over the 589K-row listings table — dozens of full per-city
  // subdivision scans plus per-row round-trips. It must NOT run on every render
  // (that timed the page out). The "Ensure geo places from listings" button
  // below triggers it explicitly, then refreshes. This page only LISTS geo data.
  const oregonState =
    (await listGeoPlaces({ type: 'state' })).find((r) => r.slug === 'oregon') ?? null
  const stateId = oregonState?.id ?? null
  const citiesFromGeo = stateId ? await listGeoPlaces({ type: 'city', parentId: stateId }) : await listGeoPlaces({ type: 'city' })
  const cityId = selectedCityId && citiesFromGeo.some((c) => c.id === selectedCityId) ? selectedCityId : citiesFromGeo[0]?.id ?? null
  const neighborhoods = cityId ? await listGeoPlaces({ type: 'neighborhood', parentId: cityId }) : []
  const communityParentIds = cityId ? [cityId, ...neighborhoods.map((n) => n.id)] : []
  const allCommunities = await listGeoPlaces({ type: 'community' })
  const communities = communityParentIds.length > 0 ? allCommunities.filter((c) => c.parent_id && communityParentIds.includes(c.parent_id)) : allCommunities

  const selectedCityName = citiesFromGeo.find((c) => c.id === cityId)?.name

  // The city control offers the same CITY_CAP choices the chip row offered.
  // A city reached by URL beyond that cap is already the page's scope, so it is
  // added as an option — the control has to say which city it is scoped to.
  const cityChoices = citiesFromGeo.slice(0, CITY_CAP)
  const cityOptions =
    cityId && !cityChoices.some((c) => c.id === cityId)
      ? [...cityChoices, ...citiesFromGeo.filter((c) => c.id === cityId)]
      : cityChoices

  const numbers: ReportNumberItem[] = [
    { key: 'cities', label: 'Cities', value: String(citiesFromGeo.length) },
    {
      key: 'neighborhoods',
      label: `Neighborhoods${selectedCityName ? ` in ${selectedCityName}` : ''}`,
      value: cityId ? String(neighborhoods.length) : '—',
    },
    { key: 'communities', label: 'Communities (scope)', value: String(communities.length) },
  ]

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={citiesFromGeo.length === 0 ? 'attention' : 'ok'}>
          {citiesFromGeo.length === 0 ? (
            <>
              <b>No cities in geo_places.</b> Nothing below can be scoped until there is one.
            </>
          ) : cityId ? (
            <>
              <b>
                {selectedCityName}: {neighborhoods.length}{' '}
                {neighborhoods.length === 1 ? 'neighborhood' : 'neighborhoods'},{' '}
                {communities.length}{' '}
                {communities.length === 1 ? 'community' : 'communities'} in scope.
              </b>
            </>
          ) : (
            <>
              <b>
                {citiesFromGeo.length} {citiesFromGeo.length === 1 ? 'city' : 'cities'}.
              </b>{' '}
              Pick one to scope its neighborhoods and communities.
            </>
          )}
        </VerdictLine>
      </div>

      <nav
        aria-label="Breadcrumb"
        className="av2-wordrow"
        style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        <Link href="/admin" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          ← Admin
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          href="/admin/geo/area-guide-upload"
          style={{ color: 'var(--a-accent)', textDecoration: 'none' }}
        >
          Area Guide media upload
        </Link>
      </nav>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 16px' }}>
        Country → State → City → Neighborhood (optional) → Community. Create neighborhoods and
        assign communities. No auto-inference from SPARK.
      </p>

      <ReportNumbers items={numbers} />

      <SectionHead>Seed from listings</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 8px' }}>
        Ensures country (US), state (Oregon), and cities from current listing cities.
      </p>
      <EnsureGeoButton />

      <SectionHead>Cities</SectionHead>
      {citiesFromGeo.length === 0 ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
          No cities in geo_places. Run &quot;Seed from listings&quot; above.
        </p>
      ) : (
        <>
          <form method="get" action="/admin/geo" className="av2-inline-form">
            <SelectField
              label="City"
              name="city"
              defaultValue={cityId ?? ''}
              hint="Scopes the neighborhoods and communities below."
            >
              {cityOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <Button type="submit" variant="quiet">
              Scope to this city
            </Button>
          </form>
          {citiesFromGeo.length > CITY_CAP ? (
            <p
              style={{
                fontSize: 'var(--a-text-xs)',
                color: 'var(--a-text-2)',
                fontVariantNumeric: 'tabular-nums',
                margin: '10px 0 0',
              }}
            >
              Showing {CITY_CAP} of {citiesFromGeo.length} cities.
            </p>
          ) : null}
        </>
      )}

      {cityId && (
        <>
          <SectionHead>Neighborhoods in {selectedCityName}</SectionHead>
          <ReportGrid
            label={`Neighborhoods in ${selectedCityName}`}
            columns={[
              { key: 'name', label: 'Neighborhood' },
              { key: 'slug', label: 'Slug' },
            ]}
            template="minmax(160px, 1.4fr) minmax(140px, 1fr)"
            minWidth={340}
            rows={neighborhoods.slice(0, LIST_CAP).map((n) => ({
              key: n.id,
              cells: [
                n.name,
                <span key="slug" style={{ fontFamily: 'var(--a-font-mono)' }}>
                  {n.slug}
                </span>,
              ],
            }))}
            empty={<>No neighborhoods yet. Create one below.</>}
          />
          {neighborhoods.length > LIST_CAP ? (
            <p
              style={{
                fontSize: 'var(--a-text-xs)',
                color: 'var(--a-text-2)',
                fontVariantNumeric: 'tabular-nums',
                margin: '10px 0 0',
              }}
            >
              Showing {LIST_CAP} of {neighborhoods.length} neighborhoods.
            </p>
          ) : null}

          <NeighborhoodForm cities={citiesFromGeo} selectedCityId={cityId} />
          <AssignCommunity cities={citiesFromGeo} neighborhoods={neighborhoods} communities={communities} />
        </>
      )}
    </div>
  )
}
