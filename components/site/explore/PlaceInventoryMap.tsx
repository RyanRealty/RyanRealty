/**
 * Place inventory map: dual-pane list↔map when pins exist, map-only otherwise.
 * Keeps city/community/subdivision page files under the line budget.
 */

import { PlaceMapListSplit } from '@/components/site/explore/PlaceMapListSplit.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { splitRowsFromTiles } from '@/lib/explore/subdivision-page-extras'

type Tile = Parameters<typeof splitRowsFromTiles>[0][number]

type Props = {
  tiles: Tile[]
  mapGeo: KbMapGeo
  polygons?: {
    type: 'FeatureCollection'
    features: Array<{ type: 'Feature'; geometry: unknown; properties: { name: string } }>
  }
  placeName: string
  totalActive: number
  centerLonLat?: [number, number]
  viewAllHref?: string
  viewAllLabel?: string
  dualPaneSubtitle?: string
  mapOnlySubtitle?: string
}

export function PlaceInventoryMap({
  tiles,
  mapGeo,
  polygons,
  placeName,
  totalActive,
  centerLonLat,
  viewAllHref,
  viewAllLabel,
  dualPaneSubtitle,
  mapOnlySubtitle,
}: Props) {
  if (mapGeo.features.length > 0 && tiles.length > 0) {
    return (
      <PlaceMapListSplit
        rows={splitRowsFromTiles(tiles)}
        mapGeo={mapGeo}
        polygons={polygons}
        eyebrow={placeName}
        title={`Homes in ${placeName}`}
        subtitle={
          dualPaneSubtitle ??
          `Active single-family listings in ${placeName}. Hover the list or tap a pin.`
        }
        totalActive={totalActive}
        centerLonLat={centerLonLat}
        viewAllHref={viewAllHref}
        viewAllLabel={viewAllLabel}
      />
    )
  }

  return (
    <KbListingMap
      geojson={mapGeo}
      totalActive={totalActive}
      fitToFeatures
      showRegionMarkers={false}
      polygons={polygons}
      eyebrow={placeName}
      title={`Homes in\n${placeName}`}
      subtitle={
        mapOnlySubtitle ??
        `Every active single-family listing in ${placeName}, on the map.`
      }
      centerLonLat={centerLonLat}
    />
  )
}
