'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

export type KbMapFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { p: number | null; bd: number | null; ba: number | null; sf: number | null; a: string; sub: string; city: string; img: string }
}
export type KbMapGeo = { type: 'FeatureCollection'; features: KbMapFeature[] }

const CREAM = '#faf8f4'
const NAVY = '#102742'

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

function money(n: number | null): string {
  const v = Number(n) || 0
  return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`
}

/**
 * KB listings map — MapLibre, navy/cream brutalist basemap (OpenFreeMap vector
 * + terrarium hillshade), live active-listing clusters, named towns + Cascade
 * peaks, click-to-read listing cards, live count-up. Approved design (the
 * production basemap migrates to self-hosted Protomaps PMTiles later). SSR-safe:
 * maplibre is dynamically imported inside the effect.
 */
const REGION_BOUNDS: [[number, number], [number, number]] = [[-121.98, 43.5], [-120.9, 44.52]]

/** Bounding box of the point features, padded ~10%, for city-scoped zoom. */
function featureBounds(g: KbMapGeo): [[number, number], [number, number]] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const f of g.features) {
    const [x, y] = f.geometry.coordinates
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (!isFinite(minX)) return null
  const px = (maxX - minX) * 0.1 || 0.03
  const py = (maxY - minY) * 0.1 || 0.03
  return [[minX - px, minY - py], [maxX + px, maxY + py]]
}

/** Bounding box of polygon geometries (the neighborhood extent = the city core). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function polygonBounds(p: { features: Array<{ geometry: any }> }): [[number, number], [number, number]] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const f of p.features) {
    const g = f.geometry
    if (!g) continue
    const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
    for (const poly of polys) for (const ring of poly) for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (!isFinite(minX)) return null
  const px = (maxX - minX) * 0.06 || 0.02
  const py = (maxY - minY) * 0.06 || 0.02
  return [[minX - px, minY - py], [maxX + px, maxY + py]]
}

export function KbListingMap({
  geojson,
  totalActive,
  fitToFeatures = false,
  showRegionMarkers = true,
  polygons,
  eyebrow = 'Central Oregon',
  title = 'Every home\nfor sale',
  subtitle = 'Every active listing across the six cities, on the real terrain. Click any dot for the price, the beds, and the street.',
}: {
  geojson: KbMapGeo
  totalActive: number
  /** Zoom to the listing cluster's bounding box (city scope) instead of the region. */
  fitToFeatures?: boolean
  /** Show the named-town + Cascade-peak markers (region scope). */
  showRegionMarkers?: boolean
  /** Neighborhood boundary polygons drawn under the listings (city scope). */
  polygons?: { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; geometry: unknown; properties: { name: string } }> }
  eyebrow?: string
  title?: string
  subtitle?: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const countEl = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any
    ;(async () => {
      const maplibregl = (await import('maplibre-gl')).default
      if (cancelled || !el.current) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const style = {
        version: 8 as const,
        glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
        sources: {
          of: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
          terrain: { type: 'raster-dem', tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Terrain: Mapzen / USGS' },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': CREAM } },
          { id: 'hillshade', type: 'hillshade', source: 'terrain', paint: { 'hillshade-shadow-color': 'rgba(16,39,66,0.74)', 'hillshade-highlight-color': 'rgba(250,248,244,0)', 'hillshade-accent-color': 'rgba(16,39,66,0.32)', 'hillshade-exaggeration': 1 } },
          { id: 'water', type: 'fill', source: 'of', 'source-layer': 'water', paint: { 'fill-color': 'rgba(16,39,66,0.14)' } },
          { id: 'river', type: 'line', source: 'of', 'source-layer': 'waterway', paint: { 'line-color': 'rgba(16,39,66,0.34)', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 12, 1.6] } },
          { id: 'rd-major', type: 'line', source: 'of', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false], paint: { 'line-color': 'rgba(16,39,66,0.22)', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 12, 2] } },
          { id: 'rd-minor', type: 'line', source: 'of', 'source-layer': 'transportation', minzoom: 10, filter: ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false], paint: { 'line-color': 'rgba(16,39,66,0.12)', 'line-width': 0.8 } },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any

      const initialBounds =
        (fitToFeatures
          ? polygons && polygons.features.length
            ? polygonBounds(polygons)
            : featureBounds(geojson)
          : null) ?? REGION_BOUNDS
      map = new maplibregl.Map({
        container: el.current,
        style,
        attributionControl: false,
        bounds: initialBounds,
        fitBoundsOptions: { padding: fitToFeatures ? 56 : 38, maxZoom: fitToFeatures ? 13.5 : 15 },
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        minZoom: 7,
        maxZoom: 15,
        renderWorldCopies: false,
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© OpenStreetMap' }))
      map.touchZoomRotate?.disableRotation()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pop: any = null

      map.on('load', () => {
        if (polygons && polygons.features.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.addSource('nbhd', { type: 'geojson', data: polygons as any })
          map.addLayer({ id: 'nbhd-fill', type: 'fill', source: 'nbhd', paint: { 'fill-color': NAVY, 'fill-opacity': 0.07 } })
          map.addLayer({ id: 'nbhd-line', type: 'line', source: 'nbhd', paint: { 'line-color': 'rgba(16,39,66,0.62)', 'line-width': 1.5 } })
          map.addLayer({ id: 'nbhd-label', type: 'symbol', source: 'nbhd', minzoom: 10, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.08, 'text-max-width': 7, 'symbol-placement': 'point' }, paint: { 'text-color': NAVY, 'text-halo-color': CREAM, 'text-halo-width': 2 } })
        }
        map.addSource('listings', { type: 'geojson', data: geojson, cluster: true, clusterRadius: 48, clusterMaxZoom: 13 })
        map.addLayer({ id: 'clusters', type: 'circle', source: 'listings', filter: ['has', 'point_count'], paint: { 'circle-color': NAVY, 'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 15, 25, 22, 100, 30, 400, 42], 'circle-stroke-width': 2, 'circle-stroke-color': 'rgba(250,248,244,0.9)' } })
        map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'listings', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13 }, paint: { 'text-color': CREAM } })
        map.addLayer({ id: 'pts', type: 'circle', source: 'listings', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': NAVY, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3.2, 13, 6], 'circle-stroke-width': 1.4, 'circle-stroke-color': CREAM } })

        if (showRegionMarkers) {
          TOWNS.forEach((t) => {
            const d = document.createElement('div')
            d.className = 'kb-town'
            d.innerHTML = `<div class="ring"></div><div class="lbl">${t.n}</div>`
            new maplibregl.Marker({ element: d, anchor: 'top' }).setLngLat(t.c).addTo(map)
          })
          PEAKS.forEach((t) => {
            const d = document.createElement('div')
            d.className = 'kb-peak'
            d.innerHTML = `<div class="pk-mark">▲</div><div class="pk-lbl">${t.n}</div>`
            new maplibregl.Marker({ element: d, anchor: 'top' }).setLngLat(t.c).addTo(map)
          })
        }

        map.on('click', 'clusters', (e: { point: unknown }) => {
          const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
          if (!f) return
          map.getSource('listings').getClusterExpansionZoom(f.properties.cluster_id).then((z: number) => {
            map.easeTo({ center: f.geometry.coordinates, zoom: z, duration: 650 })
          })
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on('click', 'pts', (e: any) => {
          const p = e.features[0].properties
          const c = e.features[0].geometry.coordinates.slice()
          const specs = [p.bd != null && p.bd !== '' ? `${p.bd} bd` : '', p.ba != null && p.ba !== '' ? `${p.ba} ba` : '', p.sf ? `${Number(p.sf).toLocaleString('en-US')} sf` : '']
            .filter(Boolean)
            .map((s) => `<span>${s}</span>`)
            .join('')
          const img = p.img ? `<img class="kb-pop-img" src="${p.img}" alt="" loading="lazy">` : ''
          const html = `${img}<div class="kb-pop-body"><div class="kb-pop-price mono-num">${money(p.p)}</div><div class="kb-pop-addr">${p.a || ''}<span class="sub">${p.sub ? p.sub + ' · ' : ''}${p.city || ''}</span></div><div class="kb-pop-specs">${specs}</div></div>`
          if (pop) pop.remove()
          pop = new maplibregl.Popup({ className: 'kb-pop', closeButton: true, maxWidth: '232px', offset: 11 }).setLngLat(c).setHTML(html).addTo(map)
        })
        ;['clusters', 'pts'].forEach((L) => {
          map.on('mouseenter', L, () => { map.getCanvas().style.cursor = 'pointer' })
          map.on('mouseleave', L, () => { map.getCanvas().style.cursor = '' })
        })

        // count-up
        if (countEl.current) {
          if (reduce || totalActive <= 0) {
            countEl.current.textContent = totalActive.toLocaleString('en-US')
          } else {
            const start = performance.now()
            const dur = 1600
            const tick = (now: number) => {
              const k = Math.min(1, (now - start) / dur)
              const v = Math.round(totalActive * (1 - Math.pow(1 - k, 3)))
              if (countEl.current) countEl.current.textContent = v.toLocaleString('en-US')
              if (k < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          }
        }
      })
      map.on('error', () => {})
    })()

    return () => {
      cancelled = true
      if (map) map.remove()
    }
  }, [geojson, totalActive, fitToFeatures, showRegionMarkers, polygons])

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
          <div id="kbMap" ref={el} role="img" aria-label="Map of active single-family listings; the same homes are listed as text above and below." />
          <div className="neigh-legend">
            <span className="nl-live">
              <span className="dot" /> Live · MLS
            </span>
            <span>
              <b ref={countEl}>0</b> active listings
            </span>
          </div>
        </div>
        <div className="sec-cta">
          <a href="/homes-for-sale" className="btn">
            Search every listing <span className="arr">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
