'use client'

/**
 * Search Field map chrome. Google tiles stay. Google Draw / Map dropdown /
 * zoom / Roboto controls do not. Ledger hairline, radius 0.
 */

import { useEffect, useState } from 'react'
import './search-ledger.css'

const MIN_ZOOM = 7
const MAX_ZOOM = 18

function isSatellite(id: string | undefined): boolean {
  return id === 'satellite' || id === 'hybrid'
}

export default function MapChrome({ map }: { map: google.maps.Map }) {
  const [zoom, setZoom] = useState(() => map.getZoom() ?? 10)
  const [satellite, setSatellite] = useState(() => isSatellite(String(map.getMapTypeId() ?? '')))

  useEffect(() => {
    const onZoom = map.addListener('zoom_changed', () => {
      setZoom(map.getZoom() ?? 10)
    })
    const onType = map.addListener('maptypeid_changed', () => {
      setSatellite(isSatellite(String(map.getMapTypeId() ?? '')))
    })
    return () => {
      onZoom.remove()
      onType.remove()
    }
  }, [map])

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[100] flex flex-col items-end gap-2">
      <div className="map-search-views pointer-events-auto" role="radiogroup" aria-label="Map type">
        <button
          type="button"
          role="radio"
          aria-checked={satellite === false}
          aria-label="Map"
          onClick={() => map.setMapTypeId('roadmap')}
        >
          Map
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={satellite}
          aria-label="Satellite"
          onClick={() => map.setMapTypeId('satellite')}
        >
          Satellite
        </button>
      </div>
      <div className="map-search-zoom pointer-events-auto" role="group" aria-label="Map zoom">
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => map.setZoom(Math.min(MAX_ZOOM, zoom + 1))}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => map.setZoom(Math.max(MIN_ZOOM, zoom - 1))}
        >
          −
        </button>
      </div>
    </div>
  )
}
