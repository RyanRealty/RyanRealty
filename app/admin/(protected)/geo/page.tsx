import Link from 'next/link'
import { listGeoPlaces } from '@/app/actions/geo-places'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import DashboardSummaryStrip from '@/components/admin/DashboardSummaryStrip'
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

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Geography &amp; neighborhoods</h1>
        <p className="text-sm text-muted-foreground">
          Country → State → City → Neighborhood (optional) → Community. Create neighborhoods and assign communities. No auto-inference from SPARK.
        </p>
        <p className="text-sm text-muted-foreground">
          <Link href="/admin" className="underline hover:no-underline">← Admin</Link>
          {' · '}
          <Link href="/admin/geo/area-guide-upload" className="underline hover:no-underline">Area Guide media upload</Link>
        </p>
      </header>

      <DashboardSummaryStrip
        stats={[
          { label: 'Cities', value: String(citiesFromGeo.length) },
          { label: `Neighborhoods${selectedCityName ? ` in ${selectedCityName}` : ''}`, value: cityId ? String(neighborhoods.length) : '—' },
          { label: 'Communities (scope)', value: String(communities.length) },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Seed from listings</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ensures country (US), state (Oregon), and cities from current listing cities.
          </p>
        </CardHeader>
        <CardContent>
          <EnsureGeoButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cities</CardTitle>
          <p className="text-xs text-muted-foreground">Tap a city to scope neighborhoods and communities below.</p>
        </CardHeader>
        <CardContent>
          {citiesFromGeo.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No cities in geo_places. Run &quot;Seed from listings&quot; above.
            </div>
          ) : (
            <>
              <ul className="flex flex-wrap gap-2">
                {citiesFromGeo.slice(0, CITY_CAP).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/admin/geo?city=${encodeURIComponent(c.id)}`}
                      className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm ${c.id === cityId ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'}`}
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
              {citiesFromGeo.length > CITY_CAP ? (
                <p className="mt-3 text-xs text-muted-foreground tabular-nums">Showing {CITY_CAP} of {citiesFromGeo.length} cities.</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {cityId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Neighborhoods in {selectedCityName}</CardTitle>
            </CardHeader>
            <CardContent>
              {neighborhoods.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  No neighborhoods yet. Create one below.
                </div>
              ) : (
                <>
                  <ul className="flex flex-wrap gap-2">
                    {neighborhoods.slice(0, LIST_CAP).map((n) => (
                      <li key={n.id}>
                        <Badge variant="secondary">{n.name}</Badge>
                      </li>
                    ))}
                  </ul>
                  {neighborhoods.length > LIST_CAP ? (
                    <p className="mt-3 text-xs text-muted-foreground tabular-nums">Showing {LIST_CAP} of {neighborhoods.length} neighborhoods.</p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <NeighborhoodForm cities={citiesFromGeo} selectedCityId={cityId} />
          <AssignCommunity cities={citiesFromGeo} neighborhoods={neighborhoods} communities={communities} />
        </>
      )}
    </main>
  )
}
