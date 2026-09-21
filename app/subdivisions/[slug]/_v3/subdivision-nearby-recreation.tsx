/**
 * Parks and Trails ledgers for the plat grain (SITE-141).
 *
 * Same primitive and omit-empty rule as neighborhood and community:
 * recreationNearPoint against the parks/trails registry, two V3Ledger
 * sections, drop a type when the first row is missing. Distance is the
 * selection rule in PLACE_NEAR_RECREATION_TRACE; depth is the registry
 * line. Do not invent a park, a trail, or a centroid.
 */

import { v3Text, V3Ledger } from '@/components/site/v3'
import {
  PLACE_NEAR_RECREATION_TRACE,
  recreationNearPoint,
} from '@/lib/site/place-recreation'

export function SubdivisionNearbyRecreation({
  displayName,
  lat,
  lng,
}: {
  displayName: string
  lat: number | null | undefined
  lng: number | null | undefined
}) {
  const nearbyRecreation = recreationNearPoint(lat, lng)
  const [firstNearbyPark, ...restNearbyParks] = nearbyRecreation.parks
  const [firstNearbyTrail, ...restNearbyTrails] = nearbyRecreation.trails

  return (
    <>
      {firstNearbyPark ? (
        <V3Ledger
          id="parks"
          eyebrow={v3Text(`${displayName} · Parks`)}
          heading={v3Text('Parks')}
          rows={[firstNearbyPark, ...restNearbyParks]}
          source={v3Text(PLACE_NEAR_RECREATION_TRACE)}
          action={{ label: v3Text('Every Central Oregon park'), href: '/parks' }}
        />
      ) : null}

      {firstNearbyTrail ? (
        <V3Ledger
          id="trails"
          eyebrow={v3Text(`${displayName} · Trails`)}
          heading={v3Text('Trails')}
          rows={[firstNearbyTrail, ...restNearbyTrails]}
          source={v3Text(PLACE_NEAR_RECREATION_TRACE)}
          action={{ label: v3Text('Every Central Oregon trail'), href: '/central-oregon/trails' }}
        />
      ) : null}
    </>
  )
}
