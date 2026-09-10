'use client'

/**
 * Search Field map chrome. Google tiles stay. Google Draw / Map dropdown /
 * zoom / Roboto controls do not. Ledger hairline. Floating layers + locate
 * for Zillow map-first mobile (draw stays in MapDrawTools).
 *
 * SITE-44: the three controls used to float as three separate boxes down the
 * right edge, which reads as a portal's control cluster however it is colored.
 * They are one hairline panel now — a single instrument in the corner of the
 * frame, in the register V3Atlas uses for its own toggles. Nothing was added or
 * removed; the aria contract (Map layers / Map zoom / Locate me) is unchanged.
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
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    // Keep roadmap — SITE-72 dropped the Map/Satellite product toggle from the
    // fold so the field reads as house cartography, not Google chrome.
    if (isSatellite(String(map.getMapTypeId() ?? ''))) {
      map.setMapTypeId('roadmap')
    }
    const onZoom = map.addListener('zoom_changed', () => {
      setZoom(map.getZoom() ?? 10)
    })
    return () => {
      onZoom.remove()
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
    <div className="map-search-chrome pointer-events-auto">
      <div className="map-search-zoom" role="group" aria-label="Map zoom">
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
        className="map-search-locate"
        aria-label="Locate me"
        disabled={locating}
        onClick={locateMe}
      >
        {locating ? '…' : 'Locate'}
      </button>
    </div>
  )
}
