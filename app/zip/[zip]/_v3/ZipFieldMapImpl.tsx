'use client'

/**
 * The real map inside the Field's map slot.
 *
 * PATTERN 2 (design_system/public/PUBLIC_UI.md section 3) is "map + list in one
 * frame, hover/tap bound both ways". The barrel owns the frame, the list, and the
 * binding, and it takes the map as a SLOT on purpose: components/site/v3 ships no
 * map primitive, and a Google map is a vendor surface, not visual language. This
 * file is that slot for one route.
 *
 * It reads the SAME items the list renders, through useV3FieldBinding(), so the
 * pins and the rows cannot disagree about what is for sale. Pointing at a row
 * lights its pin and pointing at a pin lights its row, which is the binding the
 * pattern requires and the only motion here: a state change the visitor caused.
 *
 * Replaces KbListingMap on this route. Same population (every active tile that
 * carries coordinates), same behavior (frame to the features, click a pin to open
 * the listing). Dropped with the KB component: the marker-cluster renderer, the
 * photo-stamp icons at close zoom, the InfoWindow card, and the region town and
 * peak labels. A single ZIP returns a few hundred listings inside a few miles, so
 * clustering and a 5th-to-95th-percentile framing solve a problem this scope does
 * not have.
 *
 * Color: every value comes from lib/maps, which is where this repo keeps map ink.
 * No hex is written here (ci:design-tokens scans app/).
 *
 * google.maps is touched only inside onLoad and effects that run after
 * useGoogleMapsReady flips, never at module or render scope (ci:maps-safety).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleMap } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getExploreMapOptions, MAP_NAVY, MAP_WHITE } from '@/lib/maps/markers'
import { useV3FieldBinding, type V3FieldItem } from '@/components/site/v3'

type Plotted = V3FieldItem & { lat: number; lng: number }

/** Fills the frame the Field gives it, at a definite height from the first paint. */
const FILL = { position: 'absolute', inset: 0 } as const
const CONTAINER = { width: '100%', height: '100%' }

export function ZipFieldMapImpl() {
  const { items, activeId, setActiveId } = useV3FieldBinding()
  const { ready } = useGoogleMapsReady()
  const router = useRouter()

  // THE MAP INSTANCE IS STATE, NOT A REF, AND THAT IS THE WHOLE POINT.
  // @react-google-maps/api hands the instance to onLoad, which fires AFTER the
  // render that mounted <GoogleMap>. Held in a ref it changed nothing a render
  // could see, so the marker effect below — which runs on the render where
  // `ready` flips true, before the vendor has built the map — took its early
  // return and never ran again. Zero pins were ever created on this route:
  // verified in a browser on /zip/97760, /zip/97703 and /zip/97756, every one
  // drawing a correctly framed basemap with no marker on it, which left the
  // Field's "Select a pin to open that home" note pointing at nothing and
  // Pattern 2's map-to-list binding absent. As state, the instance arriving is
  // a render, and the effect that builds the pins runs with a map to build them
  // on. Same fix the sibling route made with `fitted`
  // (app/communities/[slug]/_v3/CommunityFieldMapImpl.tsx).
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  // Read inside marker callbacks so a re-render does not rebuild every marker
  // just to close over a fresh function.
  const setActiveRef = useRef(setActiveId)
  setActiveRef.current = setActiveId
  const routerRef = useRef(router)
  routerRef.current = router

  const plotted = useMemo(
    () =>
      items.filter(
        (item): item is Plotted =>
          typeof item.lat === 'number' &&
          Number.isFinite(item.lat) &&
          typeof item.lng === 'number' &&
          Number.isFinite(item.lng),
      ),
    [items],
  )

  // Raster styles rather than the Cloud map id, the same choice KbListingMapImpl
  // made for place maps: a misconfigured map id renders an unstyled basemap.
  const options = useMemo<google.maps.MapOptions>(
    () => ({ ...getExploreMapOptions({ preferMapId: false }), scrollwheel: false }),
    [],
  )

  // Read through a ref so framing the map is not a reason to rebuild markers.
  const plottedRef = useRef(plotted)
  plottedRef.current = plotted

  const frame = useCallback((map: google.maps.Map) => {
    const points = plottedRef.current
    if (points.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    for (const point of points) bounds.extend({ lat: point.lat, lng: point.lng })
    map.fitBounds(bounds, 48)
    // One listing gives a zero-area box, and fitBounds answers that with the
    // maximum zoom. Cap it so a single pin lands on a readable street view of
    // the block rather than on roof tiles.
    const once = google.maps.event.addListener(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > 16) map.setZoom(16)
      google.maps.event.removeListener(once)
    })
  }, [])

  const onLoad = useCallback(
    (instance: google.maps.Map) => {
      frame(instance)
      setMap(instance)
    },
    [frame],
  )

  const onUnmount = useCallback(() => {
    for (const marker of markersRef.current.values()) marker.setMap(null)
    markersRef.current.clear()
    setMap(null)
  }, [])

  // Build the pins once per item set. Icons are plain symbols, so the active
  // swap below repaints one marker instead of re-rendering the map.
  useEffect(() => {
    if (!ready || !map) return
    for (const marker of markersRef.current.values()) marker.setMap(null)
    markersRef.current.clear()

    for (const point of plotted) {
      const marker = new google.maps.Marker({
        map,
        position: { lat: point.lat, lng: point.lng },
        title: `${point.priceLabel} · ${point.title}`,
        icon: dot(false),
        cursor: 'pointer',
      })
      marker.addListener('mouseover', () => setActiveRef.current(point.id))
      marker.addListener('mouseout', () => setActiveRef.current(null))
      marker.addListener('click', () => routerRef.current.push(point.href))
      markersRef.current.set(point.id, marker)
    }
    frame(map)

    return () => {
      for (const marker of markersRef.current.values()) marker.setMap(null)
      markersRef.current.clear()
    }
  }, [ready, map, plotted, frame])

  // The other half of the binding: the row the visitor is pointing at lights its
  // pin. Only the two markers that changed are touched.
  const litRef = useRef<string | null>(null)
  useEffect(() => {
    if (!ready) return
    const previous = litRef.current
    if (previous && previous !== activeId) markersRef.current.get(previous)?.setIcon(dot(false))
    if (activeId) {
      const marker = markersRef.current.get(activeId)
      if (marker) {
        marker.setIcon(dot(true))
        marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1)
      }
    }
    litRef.current = activeId
  }, [ready, activeId])

  if (!ready) {
    // No pins, no claim. The list beside this frame is the accessible and the
    // complete representation of the same set, so a quiet frame while the vendor
    // script loads costs the visitor nothing.
    return <div style={FILL} aria-hidden />
  }

  return (
    <div style={FILL}>
      <GoogleMap
        mapContainerStyle={CONTAINER}
        options={options}
        onLoad={onLoad}
        onUnmount={onUnmount}
      />
    </div>
  )
}

/**
 * The pin. Navy fill, cream stroke, larger when its row is lit. Both colors come
 * from lib/maps so map ink stays in one place and no hex is authored under app/.
 */
function dot(lit: boolean): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: lit ? 8 : 5,
    fillColor: MAP_NAVY,
    fillOpacity: 1,
    strokeColor: MAP_WHITE,
    strokeWeight: lit ? 2 : 1.4,
  }
}

