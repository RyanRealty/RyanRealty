'use client'

/**
 * Search Field map chrome. Google tiles stay. Google Draw / Map dropdown /
 * zoom / Roboto controls do not. Ledger hairline. Floating layers + locate
 * for Zillow map-first mobile (draw stays in MapDrawTools).
 */

import { useCallback, useEffect, useState } from 'react'
import './search-ledger.css'

const MIN_ZOOM = 7
const MAX_ZOOM = 18

function isSatellite(id: string | undefined): boolean {
  return id === 'satellite' || id === 'hybrid'
}

export default function MapChrome({ map }: { map: google.maps.Map }) {
  const [zoom, setZoom] = useState(() => map.getZoom() ?? 10)
  const [satellite, setSatellite] = useState(() => isSatellite(String(map.getMapTypeId() ?? '')))
  const [locating, setLocating] = useState(false)

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

  const locateMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        const next = Math.max(map.getZoom() ?? 12, 13)
        map.setZoom(Math.min(MAX_ZOOM, next))
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }, [map])

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[100] flex flex-col items-end gap-2">
      <div className="map-search-views pointer-events-auto" role="radiogroup" aria-label="Map layers">
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
      <button
        type="button"
        className="map-search-locate pointer-events-auto"
        aria-label="Locate me"
        disabled={locating}
        onClick={locateMe}
      >
        {locating ? '…' : 'Locate'}
      </button>
    </div>
  )
}
