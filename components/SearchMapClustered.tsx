'use client'

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { GoogleMap, InfoWindow, MapContext, Polygon } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { MarkerClusterer, defaultOnClusterClickHandler } from '@googlemaps/markerclusterer'

import { MAP_DEFAULT_CENTER } from '@/lib/map-constants'
import { listingDetailPath } from '@/lib/slug'
import type { MapPolygonPoint } from '@/lib/map-polygon'
import { Button } from "@/components/ui/button"
import {
  buildClusterIcon,
  formatPriceLabel,
  buildInfoWindowHTML,
  getSearchMapOptions,
  MAP_NAVY,
  MAP_WHITE,
} from '@/lib/maps/markers'

// Map ID strategy (dual-path, P0-1 fix 2026-06-10):
//   - With NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID set (Vercel env): vector map via
//     `mapId` + AdvancedMarkerElement price pills. Raster `styles` must NOT be
//     passed alongside `mapId` — Google ignores them and logs a warning.
//   - Without it: Google HARD-REQUIRES a valid Map ID for AdvancedMarkerElement.
//     Constructing them on a mapId-less map rejects every marker, logs
//     "initialized without a valid Map ID" once per marker, and drops the map
//     into degraded mode (the "Do you own this website?" error dialog). So in
//     this mode we render the SAME price-pill HTML through a classic
//     google.maps.OverlayView subclass (PricePillOverlay below) on a raster map
//     with `styles` — no Map ID required, no degraded mode.
// Matt: to enable the vector path, create a Map ID in Google Cloud Console
// (Maps Platform → Map IDs → Create Map ID → Type: JavaScript, Map type:
// Vector) and set NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID in Vercel + .env.local.
const MAP_ID =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID) || ''
const HAS_MAP_ID = MAP_ID.length > 0

type GeoJSONPolygon = { type: 'Polygon'; coordinates: number[][][] | number[][] }
type GeoJSONMultiPolygon = { type: 'MultiPolygon'; coordinates: number[][][][] }

function geojsonToPaths(geo: unknown): { lat: number; lng: number }[][] {
  const g = geo as GeoJSONPolygon | GeoJSONMultiPolygon | null
  if (!g || typeof g !== 'object') return []
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    const first = g.coordinates[0]
    if (Array.isArray(first) && first.length > 0) {
      const ring = Array.isArray(first[0]) ? (first as number[][]) : (g.coordinates as number[][])
      return [ring.map((c) => ({ lng: c[0], lat: c[1] }))]
    }
  }
  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    return g.coordinates.flatMap((poly) => {
      const ring = poly[0]
      return [ring.map((c) => ({ lng: c[0], lat: c[1] }))]
    })
  }
  return []
}

export type ListingForMap = {
  Latitude: number | null
  Longitude: number | null
  ListingKey?: string | null
  ListNumber?: string | number | null
  ListPrice?: number | null
  StreetNumber?: string | null
  StreetName?: string | null
  StreetSuffix?: string | null
  City?: string | null
  State?: string | null
  PostalCode?: string | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  /** Hero photo for the marker popup card. */
  PhotoURL?: string | null
  /** Living area for the marker popup card. */
  TotalLivingAreaSqFt?: number | null
  /** When true, marker label shows "video" instead of "showcase". */
  hasVideo?: boolean
}

function getBounds(listings: ListingForMap[]) {
  const valid = listings.filter(
    (l) =>
      l.Latitude != null &&
      l.Longitude != null &&
      Number.isFinite(Number(l.Latitude)) &&
      Number.isFinite(Number(l.Longitude))
  )
  if (valid.length === 0) return null
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity
  for (const l of valid) {
    const lat = Number(l.Latitude)
    const lng = Number(l.Longitude)
    minLat = Math.min(minLat, lat)
    minLng = Math.min(minLng, lng)
    maxLat = Math.max(maxLat, lat)
    maxLng = Math.max(maxLng, lng)
  }
  return { minLng, minLat, maxLng, maxLat } as const
}

export type MapBounds = { west: number; south: number; east: number; north: number }

type Props = {
  listings: ListingForMap[]
  savedListingKeys?: string[]
  likedListingKeys?: string[]
  className?: string
  onMarkerClick?: (listingKey: string) => void
  /** When set, fit map to this place (e.g. "Bend Oregon", "Tetherow Bend") via Google Places for boundary/context. */
  placeQuery?: string | null
  /** When no listings, use this center (e.g. Bend). Defaults to MAP_DEFAULT_CENTER. */
  initialCenter?: { lat: number; lng: number } | null
  /** When no listings, use this zoom. Defaults to 11. */
  initialZoom?: number
  /** Called when map is ready or viewport bounds change (debounced). Use for bounds-driven listing fetch. */
  onBoundsChanged?: (bounds: MapBounds) => void
  /** Optional GeoJSON boundary (Polygon/MultiPolygon) to draw for city/neighborhood/community. */
  boundaryGeojson?: unknown
  /** Called when user draws a polygon on the map. Returns the polygon path for filtering. */
  onPolygonDrawn?: (polygon: MapPolygonPoint[] | null) => void
  /** Initial polygon to render (e.g. from URL saved search). */
  initialPolygon?: MapPolygonPoint[] | null
  /** List to map hover sync: the listing key currently hovered in the list (highlights its marker). */
  hoveredKey?: string | null
  /** List to map hover sync: fired when the user hovers/unhovers a marker (null on mouseout). */
  onMarkerHover?: (listingKey: string | null) => void
}

/**
 * Build the HTML element for an AdvancedMarkerElement price pill.
 * Returns a <div> that Google Maps renders as a custom marker via the
 * content property of AdvancedMarkerElement.
 *
 * Navy pill + cream text, caret pointing down, hover/active scale ring.
 * Isolated from Tailwind (rendered in Maps overlay context) — inline styles only.
 */
function buildPricePillElement(
  label: string,
  opts?: { hover?: boolean; active?: boolean; saved?: boolean },
): HTMLDivElement {
  const hover = opts?.hover ?? false
  const active = opts?.active ?? false
  const saved = opts?.saved ?? false

  const el = document.createElement('div')
  el.style.cssText = [
    'position:relative',
    'display:inline-flex',
    'align-items:center',
    'cursor:pointer',
    'transition:transform 120ms ease,box-shadow 120ms ease',
    'transform-origin:50% 100%',
    hover || active ? 'transform:scale(1.18)' : 'transform:scale(1)',
    'filter:drop-shadow(0 2px 6px rgba(16,39,66,0.32))',
  ].join(';')
  el.setAttribute('data-price-pill', '1')

  const pill = document.createElement('div')
  pill.style.cssText = [
    `background:${active ? MAP_WHITE : MAP_NAVY}`,
    `color:${active ? MAP_NAVY : MAP_WHITE}`,
    'font-family:system-ui,-apple-system,sans-serif',
    `font-size:${hover || active ? '14px' : '13px'}`,
    'font-weight:700',
    'padding:5px 11px',
    'border-radius:999px',
    'white-space:nowrap',
    'letter-spacing:-0.01em',
    'font-variant-numeric:tabular-nums',
    active ? `box-shadow:0 0 0 2px ${MAP_NAVY},0 0 0 4px ${MAP_WHITE}` : '',
    saved ? `box-shadow:0 0 0 2px #dc2626` : '',
    'line-height:1.3',
  ].join(';')
  pill.textContent = label + (saved ? ' ♥' : '')

  // Caret (downward triangle)
  const caret = document.createElement('div')
  caret.style.cssText = [
    'position:absolute',
    'bottom:-6px',
    'left:50%',
    'transform:translateX(-50%)',
    'width:0',
    'height:0',
    `border-left:6px solid transparent`,
    `border-right:6px solid transparent`,
    `border-top:7px solid ${active ? MAP_WHITE : MAP_NAVY}`,
  ].join(';')

  el.appendChild(pill)
  el.appendChild(caret)
  return el
}

/**
 * Build the HTML element for a cluster bubble.
 * Navy circle with white count — AdvancedMarkerElement version.
 */
function buildClusterElement(count: number): HTMLDivElement {
  const size = count >= 100 ? 44 : count >= 20 ? 38 : 32
  const fontSize = count >= 100 ? 11 : count >= 20 ? 12 : 13
  const el = document.createElement('div')
  el.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    `border-radius:50%`,
    `background:${MAP_NAVY}`,
    `border:2px solid ${MAP_WHITE}`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `color:${MAP_WHITE}`,
    `font-family:system-ui,-apple-system,sans-serif`,
    `font-size:${fontSize}px`,
    `font-weight:700`,
    `font-variant-numeric:tabular-nums`,
    `cursor:pointer`,
    `box-shadow:0 2px 8px rgba(16,39,66,0.4)`,
    `transition:transform 120ms ease`,
  ].join(';')
  el.textContent = String(count)
  return el
}

// ─── Classic OverlayView price pill (no-Map-ID raster path) ────────────────────

/**
 * Marker-like surface shared by AdvancedMarkerElement and PricePillOverlay so
 * the marker layer + emphasis effect are path-agnostic. `content` / `zIndex`
 * mirror the AdvancedMarkerElement property API.
 */
interface PricePillOverlayHandle {
  content: HTMLElement
  zIndex: number
  setMap(map: google.maps.Map | null): void
  getPosition(): google.maps.LatLng
  getVisible(): boolean
}

type PriceMarker = google.maps.marker.AdvancedMarkerElement | PricePillOverlayHandle

interface PricePillOverlayOptions {
  position: google.maps.LatLng | google.maps.LatLngLiteral
  content: HTMLElement
  map?: google.maps.Map | null
  title?: string
  zIndex?: number
  /** Fired on pill click. Propagation to the map container is stopped. */
  onClick?: (ev: MouseEvent) => void
}

type PricePillOverlayCtor = new (opts: PricePillOverlayOptions) => PricePillOverlayHandle

let PricePillOverlayClass: PricePillOverlayCtor | null = null

/**
 * Lazily build the OverlayView subclass — the class body references
 * google.maps.OverlayView, which only exists after the Maps script loads.
 *
 * Duck-types the subset of the classic google.maps.Marker API that
 * @googlemaps/markerclusterer's MarkerUtils calls on non-Advanced markers:
 * setMap + addListener (inherited from OverlayView/MVCObject), getPosition,
 * getVisible. DOM clicks re-fire as a Maps 'click' event so the clusterer's
 * default zoom-into-cluster handler works on cluster bubbles.
 */
function getPricePillOverlayClass(): PricePillOverlayCtor {
  if (PricePillOverlayClass) return PricePillOverlayClass

  class PricePillOverlay extends google.maps.OverlayView {
    private container: HTMLDivElement | null = null
    private contentEl: HTMLElement
    private latLng: google.maps.LatLng
    private zIndexValue: number
    private titleText: string
    private onClick?: (ev: MouseEvent) => void

    constructor(opts: PricePillOverlayOptions) {
      super()
      this.contentEl = opts.content
      this.latLng =
        opts.position instanceof google.maps.LatLng
          ? opts.position
          : new google.maps.LatLng(opts.position)
      this.zIndexValue = opts.zIndex ?? 1
      this.titleText = opts.title ?? ''
      this.onClick = opts.onClick
      if (opts.map) this.setMap(opts.map)
    }

    onAdd() {
      const div = document.createElement('div')
      div.style.position = 'absolute'
      // Anchor bottom-center so the caret tip sits on the exact lat/lng.
      div.style.transform = 'translate(-50%, -100%)'
      div.style.zIndex = String(this.zIndexValue)
      div.style.cursor = 'pointer'
      if (this.titleText) div.title = this.titleText
      div.appendChild(this.contentEl)
      div.addEventListener('click', (ev) => {
        // Don't let pill clicks bubble into the map container (the polygon-draw
        // click handler lives there).
        ev.stopPropagation()
        this.onClick?.(ev)
        // Re-fire as a Maps event: MarkerClusterer attaches its cluster-click
        // (zoom) handler via addListener('click', …) on non-Advanced markers.
        google.maps.event.trigger(this, 'click', ev)
      })
      // Clicks/gestures on the pill must not hit the map underneath (parity
      // with native marker behavior).
      google.maps.OverlayView.preventMapHitsAndGesturesFrom(div)
      this.getPanes()?.overlayMouseTarget.appendChild(div)
      this.container = div
    }

    draw() {
      const div = this.container
      if (!div) return
      const proj = this.getProjection()
      if (!proj) return
      const pt = proj.fromLatLngToDivPixel(this.latLng)
      if (!pt) return
      div.style.left = `${pt.x}px`
      div.style.top = `${pt.y}px`
    }

    onRemove() {
      this.container?.remove()
      this.container = null
    }

    // AdvancedMarkerElement-compatible accessors (the emphasis effect mutates
    // these on hover/select).
    get content(): HTMLElement {
      return this.contentEl
    }
    set content(el: HTMLElement) {
      if (this.container) this.contentEl.replaceWith(el)
      this.contentEl = el
    }
    get zIndex(): number {
      return this.zIndexValue
    }
    set zIndex(z: number) {
      this.zIndexValue = z
      if (this.container) this.container.style.zIndex = String(z)
    }

    // Classic-Marker duck-typing for @googlemaps/markerclusterer MarkerUtils.
    getPosition(): google.maps.LatLng {
      return this.latLng
    }
    getVisible(): boolean {
      return true
    }
  }

  PricePillOverlayClass = PricePillOverlay as unknown as PricePillOverlayCtor
  return PricePillOverlayClass
}

/** Detach a marker from the map, whichever implementation it is. */
function detachMarker(m: PriceMarker) {
  try {
    if ('setMap' in m && typeof m.setMap === 'function') {
      m.setMap(null)
    } else {
      ;(m as google.maps.marker.AdvancedMarkerElement).map = null
    }
  } catch {
    // marker already torn down mid-unmount — ignore
  }
}

export default function SearchMapClustered({
  listings,
  savedListingKeys = [],
  likedListingKeys = [],
  className = '',
  onMarkerClick,
  placeQuery,
  initialCenter = null,
  initialZoom = 11,
  onBoundsChanged,
  boundaryGeojson,
  onPolygonDrawn,
  initialPolygon,
  hoveredKey = null,
  onMarkerHover,
}: Props) {
  const mapRef = useRef<google.maps.Map | null>(null)
  // Ref for the DOM container we pass to new google.maps.Map(). We manage map
  // creation ourselves so we are not dependent on @react-google-maps/api's
  // internal useEffect timing (which had a race against our custom loader).
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  // mapInstance drives MapContext.Provider so <Polygon>/<InfoWindow> etc. work.
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  // Price-pill marker refs — AdvancedMarkerElement on the vector map (Map ID
  // present), PricePillOverlay on the raster map (no Map ID).
  const advMarkersRef = useRef<PriceMarker[]>([])
  const markersByKeyRef = useRef<Map<string, PriceMarker>>(new Map())
  const placeViewportRef = useRef<google.maps.LatLngBounds | null>(null)
  const [placeViewport, setPlaceViewport] = useState<google.maps.LatLngBounds | null>(null)
  const [showBoundary, setShowBoundary] = useState(true)
  const [drawingMode, setDrawingMode] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<MapPolygonPoint[]>([])
  const [activePolygon, setActivePolygon] = useState<MapPolygonPoint[] | null>(initialPolygon ?? null)
  const [openInfo, setOpenInfo] = useState<{
    listingKey: string
    position: { lat: number; lng: number }
    listing: ListingForMap & { Latitude: number; Longitude: number }
  } | null>(null)

  // 'marker' library only needed for AdvancedMarkerElement (vector/Map ID path).
  // The raster path uses OverlayView from the core 'maps' module.
  const { ready: isLoaded, error: loadError } = useGoogleMapsReady({
    libraries: HAS_MAP_ID ? ['places', 'marker'] : ['places'],
  })

  const validListings = useMemo(
    () =>
      listings.filter(
        (l) =>
          l.Latitude != null &&
          l.Longitude != null &&
          Number.isFinite(Number(l.Latitude)) &&
          Number.isFinite(Number(l.Longitude))
      ) as (ListingForMap & { Latitude: number; Longitude: number })[],
    [listings]
  )

  const bounds = useMemo(() => getBounds(validListings), [validListings])

  const defaultCenter = initialCenter ?? MAP_DEFAULT_CENTER
  const defaultZoom = initialZoom ?? 11
  const center = useMemo(() => {
    if (validListings.length === 0) return defaultCenter
    if (validListings.length === 1)
      return { lat: validListings[0].Latitude, lng: validListings[0].Longitude }
    if (bounds)
      return {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lng: (bounds.minLng + bounds.maxLng) / 2,
      }
    return defaultCenter
  }, [validListings, bounds, defaultCenter])

  const zoom = useMemo(() => {
    if (validListings.length === 0) return defaultZoom
    if (validListings.length === 1) return 14
    return 11
  }, [validListings.length, defaultZoom])

  const savedSet = useMemo(
    () => new Set([...savedListingKeys, ...likedListingKeys]),
    [savedListingKeys, likedListingKeys]
  )

  const boundaryPaths = useMemo(() => geojsonToPaths(boundaryGeojson), [boundaryGeojson])

  useEffect(() => {
    setActivePolygon(initialPolygon && initialPolygon.length >= 3 ? initialPolygon : null)
  }, [initialPolygon])

  const reportBounds = useCallback(() => {
    const map = mapRef.current
    if (!map || !onBoundsChanged) return
    const b = map.getBounds()
    if (!b) return
    const ne = b.getNorthEast()
    const sw = b.getSouthWest()
    onBoundsChanged({
      west: sw.lng(),
      south: sw.lat(),
      east: ne.lng(),
      north: ne.lat(),
    })
  }, [onBoundsChanged])

  const recenterMap = useCallback(() => {
    const map = mapRef.current
    const viewport = placeViewportRef.current
    if (!map || !viewport) return
    setShowBoundary(true)
    map.fitBounds(viewport, { top: 48, right: 48, bottom: 48, left: 48 })
    if (onBoundsChanged) setTimeout(reportBounds, 300)
  }, [onBoundsChanged, reportBounds])

  // Map options: greedy gesture handling. See the MAP_ID strategy comment at the
  // top of this file — `mapId` (vector / Cloud styling) and raster `styles` are
  // mutually exclusive, so we guard against ever passing both.
  //
  // Declared before any effects that use it to avoid TS2448 forward-reference error.
  const mapOptions = useMemo(() => {
    const base = getSearchMapOptions()
    if (HAS_MAP_ID) {
      // Map ID present: vector map. Strip raster `styles` (Google ignores them
      // alongside mapId and logs a warning).
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { styles: _styles, ...baseWithoutStyles } = base
      return {
        ...baseWithoutStyles,
        mapId: MAP_ID,
        draggable: !drawingMode,
        clickableIcons: !drawingMode,
      }
    }
    // No Map ID: raster map with `styles` for POI suppression. Markers render
    // via PricePillOverlay — AdvancedMarkerElement is never constructed in this
    // mode because Google hard-requires a valid Map ID for Advanced Markers.
    return {
      ...base,
      draggable: !drawingMode,
      clickableIcons: !drawingMode,
    }
    // isLoaded: getSearchMapOptions()'s control-position fields are gated on
    // `typeof google !== 'undefined'` internally. This memo's first
    // computation usually runs before the Maps script has loaded, freezing
    // in the position-less defaults (zoom control landing bottom-right,
    // map type control stuck top-left under the Draw-area button) since
    // isLoaded flipping true afterward wasn't a dependency (design-audit
    // P2, evidence: mapTypeControlOptions.position never took effect).
  }, [drawingMode, isLoaded])

  // ─── Imperative map creation ───────────────────────────────────────────────
  // We create the google.maps.Map instance ourselves rather than relying on
  // @react-google-maps/api's GoogleMapFunctional.useEffect([], []). That
  // component's effect had an unresolved timing race against our custom loader
  // (useGoogleMapsReady): both run "after mount" in the same commit cycle, and
  // depending on execution order the lib's ref.current was null and no map was
  // constructed. By owning the Map() call here we eliminate the race entirely.
  //
  // mapContainerRef is attached to the div we render. Once isLoaded is true and
  // the div is in the DOM, this effect fires, constructs the Map, calls onLoad,
  // and stores the instance in mapInstance (→ MapContext.Provider) so that
  // <Polygon> / <InfoWindow> children from @react-google-maps/api work as before.
  useEffect(() => {
    if (!isLoaded) return
    const container = mapContainerRef.current
    if (!container) return
    // Already initialized — skip re-creation on unrelated re-renders.
    if (mapRef.current) return

    const map = new google.maps.Map(container, {
      ...mapOptions,
      center,
      zoom,
    })
    mapRef.current = map
    setMapInstance(map)
    onLoad(map)

    return () => {
      // On unmount, clean up the map. The clusterer cleanup is handled by the
      // marker effect. We null out mapRef so the init guard above resets.
      mapRef.current = null
      setMapInstance(null)
    }
  // We intentionally omit center/zoom/mapOptions from deps: those are the
  // initial values and we don't want to recreate the map on every pan/zoom.
  // The map manages its own view after construction. onLoad is stable
  // (useCallback with stable deps). isLoaded only goes false→true once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded])

  // When mapOptions changes (e.g. drawingMode toggle), push the delta to the
  // existing map instance rather than recreating it.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setOptions(mapOptions)
  }, [mapOptions])

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      const padding = { top: 48, right: 48, bottom: 48, left: 48 }

      // Attach the idle listener HERE — inside onLoad — so we always have a
      // reference to the live map instance. The separate useEffect below had a
      // race: it checked mapRef.current when isLoaded changed, but onLoad fires
      // slightly AFTER that effect runs, so mapRef.current was null and the
      // listener was never attached. Attaching here guarantees the listener is
      // set before the map ever fires its first idle event.
      //
      // This is the primary mechanism for "search as you move": every time the
      // map settles after a pan/zoom, reportBounds fires (debounced 200 ms) and
      // UnifiedMapListingsView's onBoundsChanged updates the listing results.
      if (onBoundsChanged) {
        let idleTimeout: ReturnType<typeof setTimeout> | null = null
        const onIdle = () => {
          if (idleTimeout) clearTimeout(idleTimeout)
          idleTimeout = setTimeout(reportBounds, 200)
        }
        try {
          map.addListener('idle', onIdle)
        } catch {
          // map already destroyed — skip
        }
      }

      // Preferred frame: the actual city/neighborhood/community boundary polygon,
      // so the map opens fit to that area's true extent (the "not zoomed in
      // enough" complaint) instead of a fixed zoom or the listing bbox. Clamp to a
      // readable band so a tiny subdivision doesn't zoom to street level and a big
      // city doesn't pull back too far.
      if (boundaryPaths.flat().length >= 2) {
        const bb = new google.maps.LatLngBounds()
        for (const ring of boundaryPaths) for (const p of ring) bb.extend(p)
        if (!bb.isEmpty()) {
          map.fitBounds(bb, padding)
          const z = map.getZoom()
          if (typeof z === 'number') {
            if (z > 15) map.setZoom(15)
            else if (z < 9) map.setZoom(9)
          }
          // idle listener above will fire reportBounds after tiles settle
          return
        }
      }

      if (placeQuery?.trim() && window.google?.maps?.places) {
        const service = new window.google.maps.places.PlacesService(map)
        service.findPlaceFromQuery(
          { query: placeQuery.trim(), fields: ['geometry'] },
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]?.geometry?.viewport) {
              const viewport = results[0].geometry!.viewport!
              placeViewportRef.current = viewport
              setPlaceViewport(viewport)
              map.fitBounds(viewport, padding)
              const zoom = map.getZoom()
              if (typeof zoom === 'number' && zoom < 12) map.setZoom(12)
            } else if (validListings.length > 0 && bounds) {
              const b = new google.maps.LatLngBounds(
                { lat: bounds.minLat, lng: bounds.minLng },
                { lat: bounds.maxLat, lng: bounds.maxLng }
              )
              map.fitBounds(b, padding)
            }
            // idle listener fires reportBounds once the map settles
          }
        )
      } else if (validListings.length > 0 && bounds) {
        const b = new google.maps.LatLngBounds(
          { lat: bounds.minLat, lng: bounds.minLng },
          { lat: bounds.maxLat, lng: bounds.maxLng }
        )
        map.fitBounds(b, padding)
        const zoom = map.getZoom()
        if (typeof zoom === 'number' && zoom < 12) map.setZoom(12)
        // idle listener fires reportBounds once the map settles
      }
      // If neither case applies the idle listener above will still fire once
      // the map renders its initial center/zoom position.
    },
    [validListings.length, bounds, placeQuery, onBoundsChanged, reportBounds, boundaryPaths]
  )

  // NOTE: The idle listener for bounds reporting is attached directly in onLoad
  // above. This effect is intentionally removed to avoid the race condition where
  // the effect ran before onLoad set mapRef.current (causing no listener to be
  // attached). Only the markers effect and the onPolygon/recenter helpers remain.

  // Keep the latest callbacks + saved-state in refs so the marker-creation
  // effect does NOT depend on them. Markers are created once per data change
  // (map instance + listings), never per parent re-render. (P0-1: the old deps
  // rebuilt the whole layer on unrelated re-renders — with ~58 markers that
  // multiplied one Google warning into 1,160 console lines per page load.)
  const onMarkerClickRef = useRef(onMarkerClick)
  const onMarkerHoverRef = useRef(onMarkerHover)
  const savedSetRef = useRef(savedSet)
  const drawingModeRef = useRef(drawingMode)
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
    onMarkerHoverRef.current = onMarkerHover
    savedSetRef.current = savedSet
    drawingModeRef.current = drawingMode
  })

  // Create the price-pill marker layer + clusterer when map and listings are
  // ready. Dual-path: AdvancedMarkerElement on the vector map (Map ID present),
  // classic OverlayView pills on the raster map (no Map ID) — see the MAP_ID
  // strategy comment at the top of this file.
  useEffect(() => {
    const map = mapInstance
    if (!map || !window.google || validListings.length === 0) return

    // Vector path: AdvancedMarkerElement requires the 'marker' library (loaded
    // via useGoogleMapsReady). Bail gracefully if not yet available (edge case
    // on slow load). Raster path: OverlayView ships with the core 'maps' module.
    const AdvancedMarkerElement = HAS_MAP_ID
      ? window.google.maps.marker?.AdvancedMarkerElement
      : undefined
    if (HAS_MAP_ID && !AdvancedMarkerElement) return
    const PricePillOverlay = AdvancedMarkerElement ? null : getPricePillOverlayClass()

    // Clear previous clusterer and markers.
    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
      clustererRef.current = null
    }
    advMarkersRef.current.forEach(detachMarker)
    advMarkersRef.current = []
    markersByKeyRef.current = new Map()

    const newMarkers: PriceMarker[] = validListings.map((l, i) => {
      const listingKey = (l.ListNumber ?? l.ListingKey ?? `point-${i}`).toString()
      const price = Number(l.ListPrice ?? 0)
      const label = formatPriceLabel(price)
      const isSaved = savedSetRef.current.has(listingKey)

      const pillEl = buildPricePillElement(label, { saved: isSaved })
      const title = `${label} — ${[l.StreetNumber, l.StreetName].filter(Boolean).join(' ') || 'View listing'}`
      const handleClick = () => {
        // Draw mode: a tap near a pill is an outline vertex, not a listing
        // open — use the pill's own coordinates so the point lands where the
        // user aimed instead of zooming or opening the info window mid-draw.
        if (drawingModeRef.current) {
          setDrawingPoints((prev) => [...prev, { lat: l.Latitude, lng: l.Longitude }])
          return
        }
        setOpenInfo((prev) =>
          prev?.listingKey === listingKey
            ? null
            : {
                listingKey,
                position: { lat: l.Latitude, lng: l.Longitude },
                listing: l,
              }
        )
        onMarkerClickRef.current?.(listingKey)
      }

      let marker: PriceMarker
      if (AdvancedMarkerElement) {
        const adv = new AdvancedMarkerElement({
          position: { lat: l.Latitude, lng: l.Longitude },
          map,
          content: pillEl,
          title,
          zIndex: 1,
          gmpClickable: true,
        })
        // 'gmp-click' replaces the deprecated 'click' listener on Advanced Markers.
        adv.addEventListener('gmp-click', handleClick)
        marker = adv
      } else {
        marker = new PricePillOverlay!({
          position: { lat: l.Latitude, lng: l.Longitude },
          map,
          content: pillEl,
          title,
          zIndex: 1,
          onClick: handleClick,
        })
      }

      pillEl.addEventListener('mouseenter', () => onMarkerHoverRef.current?.(listingKey))
      pillEl.addEventListener('mouseleave', () => onMarkerHoverRef.current?.(null))

      markersByKeyRef.current.set(listingKey, marker)
      return marker
    })

    advMarkersRef.current = newMarkers

    // Cluster renderer: navy count bubble in whichever marker tech is active.
    clustererRef.current = new MarkerClusterer({
      map,
      markers: newMarkers as unknown as google.maps.Marker[],
      // Draw mode: the default handler zooms into the cluster, which yanks the
      // viewport mid-outline and strands the user's partial polygon across two
      // zoom levels. Clusters go inert while drawing.
      onClusterClick: (event, cluster, clusterMap) => {
        if (drawingModeRef.current) return
        defaultOnClusterClickHandler(event, cluster, clusterMap)
      },
      renderer: {
        render: (cluster, _stats, map) => {
          const count = cluster.count
          const position = cluster.position
          const bubbleEl = buildClusterElement(count)
          const zIndex = Number(google.maps.Marker.MAX_ZINDEX) + count
          if (AdvancedMarkerElement) {
            const clusterMarker = new AdvancedMarkerElement({
              position,
              map,
              content: bubbleEl,
              zIndex,
              gmpClickable: true,
            })
            return clusterMarker as unknown as google.maps.Marker
          }
          // OverlayView bubble: its DOM click re-fires as a Maps 'click' event,
          // which drives MarkerClusterer's default zoom-into-cluster handler.
          const clusterOverlay = new PricePillOverlay!({
            position,
            map,
            content: bubbleEl,
            zIndex,
          })
          return clusterOverlay as unknown as google.maps.Marker
        },
      },
    })

    return () => {
      try {
        newMarkers.forEach(detachMarker)
        if (clustererRef.current) {
          try { clustererRef.current.clearMarkers() } catch { /* ignore */ }
          clustererRef.current = null
        }
      } catch {
        // guard against unmount race
      }
    }
  }, [mapInstance, validListings])

  // Marker emphasis: update the pill element in-place for hovered / active
  // marker. Both marker implementations expose the same `content` / `zIndex`
  // property API, so we mutate directly — much smoother than recreating the
  // marker (no flicker, no clusterer churn). Also refreshes the saved-heart
  // state when savedSet changes (marker creation reads it once).
  const activeKey = openInfo?.listingKey ?? null
  useEffect(() => {
    const byKey = markersByKeyRef.current
    if (byKey.size === 0) return
    for (const [key, marker] of byKey) {
      const isHover = key === hoveredKey
      const isActive = key === activeKey
      const emphasized = isHover || isActive
      try {
        const listing = validListings.find(
          (l) => (l.ListNumber ?? l.ListingKey ?? '').toString() === key
        )
        const price = Number(listing?.ListPrice ?? 0)
        const label = formatPriceLabel(price)
        const isSaved = savedSet.has(key)
        // Replace content element with updated state
        const newEl = buildPricePillElement(label, { hover: emphasized, active: isActive, saved: isSaved })
        marker.content = newEl
        marker.zIndex = emphasized ? Number(google.maps.Marker.MAX_ZINDEX) : 1
        newEl.addEventListener('mouseenter', () => onMarkerHoverRef.current?.(key))
        newEl.addEventListener('mouseleave', () => onMarkerHoverRef.current?.(null))
      } catch {
        // marker DOM may be gone mid-pan; ignore
      }
    }
  }, [hoveredKey, activeKey, validListings, savedSet])

  if (loadError) {
    return (
      <div
        className={className}
        style={{
          height: '100%',
          minHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--muted)',
          color: 'var(--muted-foreground)',
        }}
      >
        Map failed to load. Check your Google Maps API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div
        className={className}
        style={{
          height: '100%',
          minHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--muted)',
          color: 'var(--muted-foreground)',
        }}
      >
        Loading map...
      </div>
    )
  }

  const openListing = openInfo?.listing
  const openKey = openInfo?.listingKey

  const hasBoundary = boundaryPaths.length > 0
  const showBoundaryControls = boundaryPaths.length > 0 || (placeQuery != null && placeQuery !== '')

  return (
    <div
      className={`relative ${className}`.trim()}
      style={{
        height: '100%',
        minHeight: 360,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(16,39,66,0.14), 0 1px 4px rgba(16,39,66,0.10)',
      }}
    >
      {/* Map container — we own map creation via the imperative useEffect above.
          MapContext.Provider makes mapInstance available to <Polygon> and
          <InfoWindow> children which read it via useGoogleMap() internally. */}
      <MapContext.Provider value={mapInstance}>
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%', minHeight: 360, cursor: drawingMode ? 'crosshair' : '' }}
          onClick={(e) => {
            if (!drawingMode) return
            // Translate click coordinates to lat/lng via the map's projection.
            const map = mapRef.current
            if (!map) return
            const proj = map.getProjection()
            const bounds = map.getBounds()
            if (!proj || !bounds) return
            const ne = bounds.getNorthEast()
            const sw = bounds.getSouthWest()
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            const w = rect.width
            const h = rect.height
            const lng = sw.lng() + (x / w) * (ne.lng() - sw.lng())
            const lat = ne.lat() - (y / h) * (ne.lat() - sw.lat())
            const point = { lat, lng }
            setDrawingPoints((prev) => [...prev, point])
          }}
        />
        {/* Overlays — only rendered once the map instance exists */}
        {mapInstance && (
          <>
            {/* Drawing preview polygon */}
            {drawingMode && drawingPoints.length >= 2 && (
              <Polygon
                paths={drawingPoints}
                options={{
                  fillColor: MAP_NAVY,
                  fillOpacity: 0.15,
                  strokeColor: MAP_NAVY,
                  strokeWeight: 2,
                  strokeOpacity: 0.8,
                }}
              />
            )}
            {/* Completed drawn polygon */}
            {!drawingMode && activePolygon && activePolygon.length >= 3 && (
              <Polygon
                paths={activePolygon}
                options={{
                  fillColor: MAP_NAVY,
                  fillOpacity: 0.2,
                  strokeColor: MAP_NAVY,
                  strokeWeight: 2,
                }}
              />
            )}
            {/* City / neighborhood boundary overlay — brand signature navy stroke + 6% fill */}
            {showBoundary && boundaryPaths.flat().length > 0 &&
              boundaryPaths.map((path, i) => (
                <Polygon
                  key={`geo-${i}`}
                  paths={path}
                  options={{
                    fillColor: MAP_NAVY,
                    fillOpacity: 0.06,
                    strokeColor: MAP_NAVY,
                    strokeWeight: 2.5,
                    strokeOpacity: 0.75,
                  }}
                />
              ))}
            {openInfo && openListing && openKey && (
              <InfoWindow
                position={openInfo.position}
                onCloseClick={() => setOpenInfo(null)}
                options={{ maxWidth: 280, pixelOffset: new google.maps.Size(0, -12) }}
              >
                {/* Inline styles required: Google InfoWindow renders in an isolated
                    DOM context that does not inherit the app's Tailwind stylesheet.
                    All styles come from buildInfoWindowHTML in lib/maps/markers.ts. */}
                <div
                  dangerouslySetInnerHTML={{
                    __html: buildInfoWindowHTML({
                      price: openListing.ListPrice ?? null,
                      photoURL: openListing.PhotoURL ?? null,
                      streetNumber: openListing.StreetNumber ?? null,
                      streetName: openListing.StreetName ?? null,
                      streetSuffix: openListing.StreetSuffix ?? null,
                      city: openListing.City ?? null,
                      state: openListing.State ?? null,
                      postalCode: openListing.PostalCode ?? null,
                      bedroomsTotal: openListing.BedroomsTotal ?? null,
                      bathroomsTotal: openListing.BathroomsTotal ?? null,
                      sqft: openListing.TotalLivingAreaSqFt ?? null,
                      isSaved: savedSet.has(openKey),
                      href: listingDetailPath(
                        openKey,
                        {
                          streetNumber: openListing.StreetNumber,
                          streetName: openListing.StreetName,
                          city: openListing.City,
                          state: openListing.State,
                          postalCode: openListing.PostalCode,
                        },
                        undefined,
                        { mlsNumber: openListing.ListNumber != null ? String(openListing.ListNumber) : null }
                      ),
                    }),
                  }}
                />
              </InfoWindow>
            )}
          </>
        )}
      </MapContext.Provider>
      {/* Draw-on-map controls */}
      {onPolygonDrawn && (
        <div className="absolute left-3 top-3 z-[100] flex gap-2" aria-label="Draw controls">
          {!drawingMode && (!activePolygon || activePolygon.length < 3) && (
            <Button
              type="button"
              onClick={() => {
                setDrawingMode(true)
                setDrawingPoints([])
              }}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-primary shadow-md hover:bg-muted"
            >
              Draw area
            </Button>
          )}
          {drawingMode && (
            <>
              <Button
                type="button"
                onClick={() => {
                  // Finalize the polygon.
                  if (drawingPoints.length >= 3) {
                    const path = [...drawingPoints]
                    setActivePolygon(path)
                    onPolygonDrawn?.(path)
                  }
                  setDrawingMode(false)
                }}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-md hover:bg-primary/90"
                disabled={drawingPoints.length < 3}
              >
                Apply area ({drawingPoints.length})
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDrawingMode(false)
                  setDrawingPoints([])
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-md hover:bg-muted"
              >
                Cancel
              </Button>
              <span
                role="status"
                className="pointer-events-none absolute left-0 top-full mt-2 w-max max-w-[280px] rounded-lg bg-primary/80 px-3 py-2 text-xs font-medium text-primary-foreground shadow-md"
              >
                {drawingPoints.length < 3
                  ? `Click the map to outline an area. ${3 - drawingPoints.length} more point${3 - drawingPoints.length === 1 ? '' : 's'} to go.`
                  : 'Keep adding points, or press Apply area.'}
              </span>
            </>
          )}
          {!drawingMode && activePolygon && activePolygon.length >= 3 && (
            <Button
              type="button"
              onClick={() => {
                setActivePolygon(null)
                setDrawingPoints([])
                onPolygonDrawn?.(null)
              }}
              className="rounded-lg border border-destructive bg-card px-3 py-2 text-sm font-medium text-destructive shadow-md hover:bg-destructive/10"
            >
              Clear area
            </Button>
          )}
        </div>
      )}

      {showBoundaryControls && (
        <div className="absolute right-3 top-14 z-[100] flex flex-col gap-2 rounded-lg border border-border bg-card p-1.5 shadow-md" aria-label="Map controls">
          {showBoundary && hasBoundary && (
            <Button
              type="button"
              onClick={() => setShowBoundary(false)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-primary shadow-sm hover:bg-muted"
            >
              Remove boundary
            </Button>
          )}
          {placeViewport && (
            <Button
              type="button"
              onClick={recenterMap}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
            >
              Re-center
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
