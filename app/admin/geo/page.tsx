import Link from 'next/link'
import {
  listGeoPlaces,
  ensureGeoPlacesFromListings,
  type GeoPlaceRow,
} from '../../actions/geo-places'
import EnsureGeoButton from './EnsureGeoButton'
import NeighborhoodForm from './NeighborhoodForm'
import AssignCommunity from './AssignCommunity'

export const dynamic = 'force-dynamic'

export default async function AdminGeoPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>
}) {
  const params = await searchParams
  const selectedCityId = params.city ?? null
  const [oregonState, result] = await Promise.all([
    listGeoPlaces({ type: 'state' }).then((rows) => rows.find((r) => r.slug === 'oregon') ?? null),
    ensureGeoPlacesFromListings().catch(() => null),
  ])
  const stateId = oregonState?.id ?? null
  const citiesFromGeo = stateId ? await listGeoPlaces({ type: 'city', parentId: stateId }) : await listGeoPlaces({ type: 'city' })
  const cityId = selectedCityId && citiesFromGeo.some((c) => c.id === selectedCityId) ? selectedCityId : citiesFromGeo[0]?.id ?? null
  const neighborhoods = cityId ? await listGeoPlaces({ type: 'neighborhood', parentId: cityId }) : []
  const communityParentIds = cityId ? [cityId, ...neighborhoods.map((n) => n.id)] : []
  const allCommunities = await listGeoPlaces({ type: 'community' })
  const communities = communityParentIds.length > 0 ? allCommunities.filter((c) => c.parent_id && communityParentIds.includes(c.parent_id)) : allCommunities
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Geography &amp; Neighborhoods</h1>
      <p className="mt-2 text-zinc-600">
        Country → State → City → Neighborhood (optional) → Community. Create neighborhoods and assign communities. No auto-inference from SPARK.
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        <Link href="/admin" className="underline">← Admin</Link>
      </p>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="font-semibold text-zinc-900">Seed from listings</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Ensures country (US), state (Oregon), and cities from current listing cities.
        </p>
        <EnsureGeoButton />
        {result?.ok && <p className="mt-2 text-sm text-emerald-700">Cities ensured: {result.citiesEnsured}</p>}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold text-zinc-900">Cities</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {citiesFromGeo.length === 0 && (
            <li className="text-sm text-zinc-500">No cities in geo_places. Run &quot;Ensure geo places from listings&quot; above.</li>
          )}
          {citiesFromGeo.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/geo?city=${encodeURIComponent(c.id)}`} className={`rounded px-3 py-1 text-sm ${c.id === cityId ? 'bg-zinc-900 text-white' : 'bg-zinc-200 hover:bg-zinc-300'}`}>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {cityId && (
        <>
          <section className="mt-6">
            <h2 className="font-semibold text-zinc-900">Neighborhoods in {citiesFromGeo.find((c) => c.id === cityId)?.name}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {neighborhoods.length === 0 && <li className="text-sm text-zinc-500">None yet. Create one below.</li>}
              {neighborhoods.map((n) => (
                <li key={n.id} className="rounded bg-zinc-100 px-3 py-1 text-sm">{n.name}</li>
              ))}
            </ul>
          </section>
          <NeighborhoodForm cities={citiesFromGeo} selectedCityId={cityId} />
          <AssignCommunity cities={citiesFromGeo} neighborhoods={neighborhoods} communities={communities} />
        </>
      )}
    </main>
  )
}
