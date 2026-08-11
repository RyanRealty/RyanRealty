'use client'
// brand-voice:exempt — pure UI component, no user-facing prose

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, Polygon } from '@react-google-maps/api'
import { MarkerClusterer, SuperClusterAlgorithm, type Renderer } from '@googlemaps/markerclusterer'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getExploreMapOptions } from '@/lib/maps/markers'
import { PHOTO_STAMP_MIN_ZOOM } from '@/lib/maps/photo-stamp'
import { kbMoneyFull } from './types'

export type KbMapFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    p: number | null
    bd: number | null
    ba: number | null
    sf: number | null
    a: string
    sub: string
    city: string
    img: string
    /** ListingKey for dual-pane list↔map highlight */
    k?: string
  }
}
export type KbMapGeo = { type: 'FeatureCollection'; features: KbMapFeature[] }

const CREAM = '#faf8f4'
const NAVY = '#102742'
// The homepage feeds up to 3000 active listings; creating that many
// google.maps.Marker jams the thread. They cluster at region/city zoom anyway,
// so a capped sample yields an identical clustered overview (the count-up still
// shows the true total). City-scoped pages pass fewer than the cap.
const MAX_MARKERS = 800

const TOWNS: { n: string; c: [number, number] }[] = [
  { n: 'Bend', c: [-121.313, 44.058] },
  { n: 'Redmond', c: [-121.174, 44.272] },
  { n: 'Sisters', c: [-121.549, 44.291] },
  { n: 'Sunriver', c: [-121.438, 43.872] },
  { n: 'La Pine', c: [-121.503, 43.67] },
  { n: 'Terrebonne', c: [-121.178, 44.351] },
]
const PEAKS: { n: string; c: [number, number] }[] = [
  { n: 'South Sister', c: [-121.769, 44.103] },
  { n: 'Broken Top', c: [-121.7, 44.083] },
  { n: 'Mt. Bachelor', c: [-121.688, 43.979] },
  { n: 'Black Butte', c: [-121.638, 44.389] },
  { n: 'Smith Rock', c: [-121.14, 44.366] },
  { n: 'Paulina Peak', c: [-121.243, 43.69] },
]

// C-13: was `$2.2M` / `$715K` while the tiles on the SAME page rendered
// `$3,200,000`. VOICE.md Mechanics: currency to the nearest thousand.
// kbMoneyFull is the canon formatter — one implementation, not a second here.
function money(n: number | null): string {
  return kbMoneyFull(n) ?? '—'
}

const REGION = { west: -121.98, south: 43.5, east: -120.9, north: 44.52 }

function geojsonToPaths(geo: GeoJSON.Geometry): google.maps.LatLngLiteral[][] {
  if (geo.type === 'Polygon') return (geo.coordinates as number[][][]).map((r) => r.map(([lng, lat]) => ({ lat, lng })))
  if (geo.type === 'MultiPolygon') return (geo.coordinates as number[][][][]).flatMap((p) => p.map((r) => r.map(([lng, lat]) => ({ lat, lng }))))
  return []
}

/**
 * KB listings map — Google Maps (the only mapping we use). Declarative
 * <GoogleMap> container + a MarkerClusterer of navy price clusters, an optional
 * neighborhood polygon overlay, named towns + Cascade peaks (region scope),
 * click-to-read listing cards, and a live count-up. Props are unchanged from the
 * prior MapLibre version so every consumer (homepage, cities, communities,
 * price-drops, schools, …) is untouched.
 */
export function KbListingMapImpl({
  geojson,
  totalActive,
  fitToFeatures = false,
  showRegionMarkers = true,
  polygons,
  eyebrow = 'Central Oregon',
  title = 'Every home\nfor sale',
  // Input-neutral verb: "click" mismatched phones, where the gesture is a tap
  // (design-audit P3). The dot-tap instruction was cut 2026-08-06 (VOICE.md —
  // explaining that a dot is clickable is the "obvious restatement" the canon
  // names by example).
  subtitle = 'Every active listing across the six cities.',
  centerLonLat,
  // What the pinned count actually counts, when it is not "active listings"
  // (open houses, price drops) — the legend chip used to say "N ACTIVE
  // LISTINGS" for every consumer, contradicting the page's own hero stat
  // (design-audit P2, §0).
  countNoun = 'active listings',
  /** When set, scale up / raise z-index of the matching listing pin (list↔map). */
  activeKey = null as string | null,
  /** Pin click → parent list highlight (dual-pane). */
  onActiveKeyChange,
}: {
  geojson: KbMapGeo
  totalActive: number
  fitToFeatures?: boolean
  showRegionMarkers?: boolean
  polygons?: { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; geometry: unknown; properties: { name: string } }> }
  eyebrow?: string
  title?: string
  subtitle?: string
  centerLonLat?: [number, number]
  countNoun?: string
  activeKey?: string | null
  onActiveKeyChange?: (key: string | null) => void
}) {
  const { ready } = useGoogleMapsReady()
  const countEl = useRef<HTMLElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  const overlaysRef = useRef<google.maps.Marker[]>([])
  const listingMarkersRef = useRef<google.maps.Marker[]>([])
  const featureKeysRef = useRef<(string | undefined)[]>([])
  // Stable ref so marker click handlers do not force a full map rebuild.
  const onActiveKeyChangeRef = useRef(onActiveKeyChange)
  useEffect(() => {
    onActiveKeyChangeRef.current = onActiveKeyChange
  }, [onActiveKeyChange])

  const polygonPaths = useMemo(
    () => (polygons?.features ?? []).map((f) => geojsonToPaths(f.geometry as GeoJSON.Geometry)).filter((p) => p.length),
    [polygons],
  )

  // <GoogleMap> REQUIRES an initial center+zoom to create a valid viewport (a map
  // without them never paints tiles). onLoad's fitBounds refines it. Computed
  // once (stable) so the library doesn't re-apply it and clobber fitBounds.
  const [initialView] = useState(() => {
    if (fitToFeatures && centerLonLat) return { center: { lat: centerLonLat[1], lng: centerLonLat[0] }, zoom: 13 }
    if (fitToFeatures && geojson.features.length) {
      const [lng, lat] = geojson.features[0].geometry.coordinates
      return { center: { lat, lng }, zoom: 11 }
    }
    return { center: { lat: 44.05, lng: -121.32 }, zoom: 8 } // Central Oregon region
  })

  // Exploration System: same cream/muted basemap as search (Cloud Map ID when set).
  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({ ...getExploreMapOptions(), scrollwheel: false }),
    [],
  )

  // Google Maps caches the container size at construction. A height of '100%'
  // resolves against #kbMap's own height, which may still be 0 at that instant
  // (the map then inits at 0px and never repaints). Give the container an
  // INTRINSIC height (clamp resolves from the viewport, synchronously, no parent
  // dependency) — the same clamp #kbMap uses — and memoize it. This is why
  // VenueMap (explicit px height) paints and the '100%' version did not.
  const containerStyle = useMemo(() => ({ width: '100%', height: 'clamp(440px, 58vw, 640px)' }), [])

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      const g = google.maps
      mapRef.current = map

      // frame: polygon bounds -> feature bounds -> center fallback -> region
      const bounds = new g.LatLngBounds()
      let framed = false
      if (fitToFeatures) {
        for (const rings of polygonPaths) for (const ring of rings) for (const pt of ring) { bounds.extend(pt); framed = true }
        if (!framed && geojson.features.length > 0) {
          // At region scale (many pins), frame the inventory CORE: a handful of
          // outlying listings (Mitchell, Crescent) stretched the box so far
          // that fitBounds in a wide container panned in the Willamette Valley.
          // 5th-95th percentile bounds keep the frame on the market; outliers
          // stay reachable by panning and still count in the clusters.
          if (geojson.features.length > 50) {
            const lats = geojson.features.map((f) => f.geometry.coordinates[1]).sort((a, b) => a - b)
            const lngs = geojson.features.map((f) => f.geometry.coordinates[0]).sort((a, b) => a - b)
            const lo = Math.floor(lats.length * 0.05)
            const hi = Math.ceil(lats.length * 0.95) - 1
            bounds.extend({ lat: lats[lo], lng: lngs[lo] })
            bounds.extend({ lat: lats[hi], lng: lngs[hi] })
          } else {
            for (const f of geojson.features) { const [lng, lat] = f.geometry.coordinates; bounds.extend({ lat, lng }) }
          }
          framed = true
        }
        if (!framed && centerLonLat) { bounds.extend({ lat: centerLonLat[1] - 0.008, lng: centerLonLat[0] - 0.012 }); bounds.extend({ lat: centerLonLat[1] + 0.008, lng: centerLonLat[0] + 0.012 }); framed = true }
      }
      if (framed) {
        map.fitBounds(bounds, 56)
        // Cap at 16 so close zoom can show photo stamps (PHOTO_STAMP_MIN_ZOOM = 15).
        const cap = g.event.addListener(map, 'idle', () => {
          if ((map.getZoom() ?? 0) > 16) map.setZoom(16)
          g.event.removeListener(cap)
        })
      } else {
        map.fitBounds(REGION, 24)
      }

      // Classic Markers (stable with MarkerClusterer). Photo stamps = image icon
      // + price label at close zoom. OverlayView path crashed some place maps.
      const info = new g.InfoWindow({ maxWidth: 236 })
      infoRef.current = info
      const features = geojson.features.slice(0, MAX_MARKERS)
      const dot: google.maps.Symbol = {
        path: g.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: NAVY,
        fillOpacity: 1,
        strokeColor: CREAM,
        strokeWeight: 1.4,
      }
      const photoIcon = (url: string): google.maps.Icon => ({
        url,
        scaledSize: new g.Size(48, 48),
        anchor: new g.Point(24, 48),
      })

      const openPopup = (m: google.maps.Marker, p: KbMapFeature['properties']) => {
        const specs = [
          p.bd != null ? `${p.bd} bd` : '',
          p.ba != null ? `${p.ba} ba` : '',
          p.sf ? `${Number(p.sf).toLocaleString('en-US')} sf` : '',
        ]
          .filter(Boolean)
          .map((s) => `<span>${s}</span>`)
          .join('')
        const img = p.img ? `<img class="kb-pop-img" src="${p.img}" alt="" loading="lazy">` : ''
        info.setContent(
          `<div class="kb-pop">${img}<div class="kb-pop-body"><div class="kb-pop-price mono-num">${money(p.p)}</div><div class="kb-pop-addr">${p.a || ''}<span class="sub">${p.sub ? p.sub + ' · ' : ''}${p.city || ''}</span></div><div class="kb-pop-specs">${specs}</div></div></div>`,
        )
        info.open({ map, anchor: m })
      }

      const markers = features.map((f) => {
        const [lng, lat] = f.geometry.coordinates
        const p = f.properties
        const m = new g.Marker({
          position: { lat, lng },
          icon: dot,
          title: `${money(p.p)} · ${p.a || 'Listing'}`,
        })
        m.addListener('click', () => {
          openPopup(m, p)
          if (p.k) onActiveKeyChangeRef.current?.(p.k)
        })
        return m
      })
      listingMarkersRef.current = markers
      featureKeysRef.current = features.map((f) => f.properties.k)

      const applyMarkerMode = () => {
        const photoMode = (map.getZoom() ?? 12) >= PHOTO_STAMP_MIN_ZOOM
        markers.forEach((m, i) => {
          const p = features[i]?.properties
          if (!p) return
          if (photoMode && p.img) {
            m.setIcon(photoIcon(p.img))
            m.setLabel({
              text: money(p.p),
              color: NAVY,
              fontSize: '10px',
              fontWeight: '700',
              className: 'kb-map-stamp-lbl',
            })
          } else {
            m.setIcon(dot)
            m.setLabel(null)
          }
        })
      }
      map.addListener('zoom_changed', applyMarkerMode)
      applyMarkerMode()

      const renderer: Renderer = {
        render: ({ count, position }) => {
          const r = count < 25 ? 17 : count < 100 ? 21 : count < 400 ? 26 : 32
          return new g.Marker({
            position,
            zIndex: 1000 + count,
            icon: {
              path: g.SymbolPath.CIRCLE,
              scale: r,
              fillColor: NAVY,
              fillOpacity: 1,
              strokeColor: 'rgba(250,248,244,0.9)',
              strokeWeight: 2,
            },
            label: { text: String(count), color: CREAM, fontSize: '13px', fontWeight: '700' },
            title: `${count} listings`,
          })
        },
      }
      try {
        clustererRef.current = new MarkerClusterer({
          map,
          markers,
          renderer,
          algorithm: new SuperClusterAlgorithm({ radius: 80, maxZoom: 14 }),
        })
      } catch (err) {
        // Fail open: still show unclustered markers if clusterer throws.
        console.warn('[KbListingMap] clusterer failed; showing unclustered markers', err)
        for (const m of markers) m.setMap(map)
      }

      // towns + Cascade peaks (region scope only)
      const overlays: google.maps.Marker[] = []
      if (showRegionMarkers) {
        for (const t of TOWNS) overlays.push(new g.Marker({ position: { lat: t.c[1], lng: t.c[0] }, map, clickable: false, title: t.n, icon: { path: g.SymbolPath.CIRCLE, scale: 3, fillColor: NAVY, fillOpacity: 0.9, strokeColor: CREAM, strokeWeight: 1.5 }, label: { text: t.n, color: NAVY, fontSize: '11px', fontWeight: '700', className: 'kb-map-town-lbl' } }))
        for (const t of PEAKS) overlays.push(new g.Marker({ position: { lat: t.c[1], lng: t.c[0] }, map, clickable: false, title: t.n, icon: { path: 'M 0,-6 L 5,4 L -5,4 Z', fillColor: NAVY, fillOpacity: 0.85, strokeColor: CREAM, strokeWeight: 1, scale: 1.1, anchor: new g.Point(0, 4) }, label: { text: t.n, color: NAVY, fontSize: '10px', fontWeight: '600', className: 'kb-map-peak-lbl' } }))
      }
      overlaysRef.current = overlays

      // count-up
      if (countEl.current) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduce || totalActive <= 0) countEl.current.textContent = totalActive.toLocaleString('en-US')
        else {
          const start = performance.now(), dur = 1600
          const tick = (now: number) => { const k = Math.min(1, (now - start) / dur); if (countEl.current) countEl.current.textContent = Math.round(totalActive * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US'); if (k < 1) requestAnimationFrame(tick) }
          requestAnimationFrame(tick)
        }
      }
    },
    [geojson, totalActive, fitToFeatures, showRegionMarkers, polygonPaths, centerLonLat],
  )

  // List↔map highlight: scale + raise the active pin without remounting the map.
  useEffect(() => {
    const markers = listingMarkersRef.current
    const keys = featureKeysRef.current
    if (!markers.length) return
    markers.forEach((m, i) => {
      const isActive = Boolean(activeKey && keys[i] && keys[i] === activeKey)
      m.setZIndex(isActive ? 10_000 : 1)
      // Slight icon scale via opacity/label emphasis — classic Marker has no
      // scale transform; use animation for a clear "this one" cue.
      m.setAnimation(isActive ? google.maps.Animation.BOUNCE : null)
      if (isActive) {
        // Bounce briefly then stop so it does not loop forever.
        window.setTimeout(() => {
          try {
            m.setAnimation(null)
          } catch {
            /* map unmounted */
          }
        }, 700)
      }
    })
  }, [activeKey])

  const onUnmount = useCallback(() => {
    infoRef.current?.close()
    clustererRef.current?.clearMarkers()
    clustererRef.current?.setMap(null)
    for (const o of overlaysRef.current) o.setMap(null)
    overlaysRef.current = []
    for (const m of listingMarkersRef.current) m.setMap(null)
    listingMarkersRef.current = []
    mapRef.current = null
  }, [])

  return (
    <section className="section neigh" id="map">
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">
            {title.split('\n').map((ln, i) => (
              <span key={i}>
                {i > 0 ? <br /> : null}
                {ln}
              </span>
            ))}
          </h2>
        </div>
        <p className="neigh-sub">{subtitle}</p>
        <div className="neigh-map" id="neighMap">
          <div id="kbMap" role="region" aria-label="Map of active single-family listings">
            {ready ? (
              <GoogleMap mapContainerStyle={containerStyle} center={initialView.center} zoom={initialView.zoom} options={mapOptions} onLoad={onLoad} onUnmount={onUnmount}>
                {polygonPaths.map((paths, i) => (
                  <Polygon key={i} paths={paths} options={{ strokeColor: NAVY, strokeOpacity: 0.62, strokeWeight: 1.5, fillColor: NAVY, fillOpacity: 0.07, clickable: false, zIndex: 1 }} />
                ))}
              </GoogleMap>
            ) : (
              <div aria-hidden style={{ width: '100%', height: '100%' }} className="animate-pulse bg-card" />
            )}
          </div>
          <div className="neigh-legend">
            <span className="nl-live">
              <span className="dot" /> Live · MLS
            </span>
            <span>
              <b ref={countEl}>0</b> {countNoun}
            </span>
          </div>
        </div>
        <div className="sec-cta">
          <a href="/homes-for-sale" className="btn">
            Browse homes <span className="arr">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
