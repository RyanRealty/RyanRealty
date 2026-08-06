'use client'
// brand-voice:exempt — no user-facing prose; every string is a caller-supplied
// label or a price formatted from live data.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getBaseMapOptions, MAP_BOUNDARY_STYLES, MAP_NAVY, MAP_WHITE } from '@/lib/maps/markers'
import { cn } from '@/lib/utils'
import {
  boundaryToRings,
  computeBoundsLiteral,
  computeStagger,
  easeOutCubic,
  hexToRgbTriplet,
  isDegenerateBounds,
  markerDelayMs,
  MAX_RING_POINTS,
  normalizeSales,
  resampleRing,
  ringDrawPath,
  salesForAudience,
  type AnimatedSale,
  type LatLngPoint,
  type NormalizedSale,
  type SalesMapAudience,
} from '@/lib/maps/animated-sales-map'

/**
 * AnimatedSalesMap — one reusable animated geography map.
 *
 * On enter (IntersectionObserver, once) it draws the authoritative GIS boundary
 * as a growing stroke, then pops in the last 12 months of closed sales oldest
 * first, each scaling from small to full with its close price as the label.
 *
 * Built to be dropped onto any geography page — subdivision, neighborhood,
 * community, city — with no per-page bespoke logic.
 *
 * ── HOW IT STAYS FAST ────────────────────────────────────────────────────────
 * · ONE OverlayView holds every pill, so a pan reprojects in a single pass over
 *   plain DOM nodes instead of mounting N React overlay components.
 * · The pills live in the `overlayLayer` pane: no pointer events, no hit
 *   testing, and structurally incapable of blocking the map controls or the
 *   Google attribution.
 * · The pop is a Web Animations API keyframe per pill with a staggered `delay`,
 *   so the compositor drives 150 transforms and the main thread stays free. The
 *   stagger compresses as the count rises, so the run holds 3-5s either way.
 * · Boundary rings are thinned to MAX_RING_POINTS before the stroke is animated
 *   — county plat rings run to thousands of vertices.
 * · The container has a fixed aspect ratio, so nothing reflows when the map or
 *   the pills arrive.
 *
 * ── DATA ACCURACY, CLAUDE.md §0 ──────────────────────────────────────────────
 * The boundary MUST be an authoritative polygon from the `boundaries` table
 * (getGeoBoundaryMapData / getBoundaryGeoJSON). When one does not exist for a
 * geography, pass null: the component draws NO boundary and still renders the
 * sales. It never approximates, hulls, or circle-fits a shape. Sales missing a
 * coordinate, a price, or a close date are dropped, never estimated.
 *
 * ── ODS §5-4, THE HARD ONE ───────────────────────────────────────────────────
 * `audience` is required and has no default. Row-level sold data is VOW-only —
 * the IDX license covers active display only, and public indexable sold pages
 * are prohibited. `audience="public"` therefore renders the boundary and ZERO
 * sale markers; only `audience="vow"` (a signed-in consumer behind a VOW terms
 * click-through) renders them. The gate is enforced in
 * lib/maps/animated-sales-map.ts salesForAudience and fails closed.
 */

// ─── props ────────────────────────────────────────────────────────────────────

export type AnimatedSalesMapProps = {
  /**
   * Authoritative GIS polygon for this geography, or null when none exists.
   * Accepts a GeoJSON Polygon / MultiPolygon — i.e. the `polygon` field of
   * getGeoBoundaryMapData, or getBoundaryGeoJSON's return value, unchanged.
   * Anything unrecognizable is treated as "no boundary".
   */
  boundary: unknown | null

  /** Closed sales in any order. The component orders them oldest first. */
  sales: readonly AnimatedSale[]

  /**
   * REQUIRED, no default. ODS §5-4: 'public' drops every sale marker.
   * Use 'vow' only behind an authenticated VOW experience.
   */
  audience: SalesMapAudience

  /** Accessible name for the map region. Defaults to a generic label. */
  ariaLabel?: string

  /** Container aspect ratio as width/height. Fixed, so there is no layout shift. */
  aspect?: number

  /** Hard cap on rendered pills. Most recent N are kept. */
  maxSales?: number

  /** Run-length window for the full pop sequence, in ms. */
  minRunMs?: number
  maxRunMs?: number

  className?: string
}

// ─── overlay class (constructed only after the Maps API is live) ──────────────

type OverlayItem = { position: google.maps.LatLng; el: HTMLDivElement }

type SalesOverlay = google.maps.OverlayView & { setMap(map: google.maps.Map | null): void }
type SalesOverlayCtor = new (items: OverlayItem[]) => SalesOverlay

let SalesOverlayClass: SalesOverlayCtor | null = null

/**
 * `google.maps.OverlayView` only exists once the API script has run, so the
 * subclass is created lazily inside an effect — never at module or render scope
 * (that is the crash ci:maps-safety exists to prevent).
 */
function getSalesOverlayClass(): SalesOverlayCtor {
  if (SalesOverlayClass) return SalesOverlayClass

  class Overlay extends google.maps.OverlayView {
    private root: HTMLDivElement | null = null
    private items: OverlayItem[]

    constructor(items: OverlayItem[]) {
      super()
      this.items = items
    }

    onAdd() {
      const root = document.createElement('div')
      root.style.position = 'absolute'
      root.style.left = '0'
      root.style.top = '0'
      // Decorative layer: never intercepts gestures, clicks, or the attribution.
      root.style.pointerEvents = 'none'

      // One reflow for the whole batch instead of one per pill.
      const frag = document.createDocumentFragment()
      for (const item of this.items) frag.appendChild(item.el)
      root.appendChild(frag)

      this.getPanes()?.overlayLayer.appendChild(root)
      this.root = root
    }

    draw() {
      if (!this.root) return
      const proj = this.getProjection()
      if (!proj) return
      // Single pass, two style writes per pill. Positions are precomputed
      // LatLng instances so no objects are allocated per frame.
      for (const item of this.items) {
        const pt = proj.fromLatLngToDivPixel(item.position)
        if (!pt) continue
        item.el.style.left = `${pt.x}px`
        item.el.style.top = `${pt.y}px`
      }
    }

    onRemove() {
      this.root?.remove()
      this.root = null
    }
  }

  SalesOverlayClass = Overlay as unknown as SalesOverlayCtor
  return SalesOverlayClass
}

// ─── pill construction ────────────────────────────────────────────────────────

const NAVY_RGB = hexToRgbTriplet(MAP_NAVY) ?? '16 39 66'
const PILL_SHADOW = `0 2px 6px rgb(${NAVY_RGB} / 0.35)`
const CARET_SIZE_PX = 5

/** Navy price pill with a caret whose tip sits on the exact coordinate. */
function buildPillElement(sale: NormalizedSale, zIndex: number): HTMLDivElement {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.zIndex = String(zIndex)
  el.style.pointerEvents = 'none'
  // Anchor the caret tip to the point; the pop animation re-declares this
  // translate in its keyframes so the two never fight.
  el.style.transform = 'translate(-50%, -100%)'
  el.style.transformOrigin = '50% 100%'
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.alignItems = 'center'

  const pill = document.createElement('div')
  pill.textContent = sale.label
  pill.style.background = MAP_NAVY
  pill.style.color = MAP_WHITE
  pill.style.font = '700 12px/1 var(--font-sans, system-ui), system-ui, sans-serif'
  pill.style.fontVariantNumeric = 'tabular-nums'
  pill.style.letterSpacing = '-0.01em'
  pill.style.padding = '5px 8px'
  pill.style.borderRadius = '999px'
  pill.style.whiteSpace = 'nowrap'
  pill.style.boxShadow = PILL_SHADOW

  const caret = document.createElement('div')
  caret.style.width = '0'
  caret.style.height = '0'
  caret.style.borderLeft = `${CARET_SIZE_PX}px solid transparent`
  caret.style.borderRight = `${CARET_SIZE_PX}px solid transparent`
  caret.style.borderTop = `${CARET_SIZE_PX}px solid ${MAP_NAVY}`

  el.appendChild(pill)
  el.appendChild(caret)
  return el
}

// ─── motion helpers ───────────────────────────────────────────────────────────

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

const BOUNDARY_DRAW_MS = 900
const BOUNDARY_FILL_MS = 260
const BOUNDARY_FILL_OPACITY = 0.08
const BOUNDARY_STROKE_WEIGHT = 2.5
/** Keeps pills clear of the Google attribution strip and the control cluster. */
const FIT_PADDING = { top: 28, right: 28, bottom: 56, left: 28 }
const DEGENERATE_ZOOM = 15
const MAX_FIT_ZOOM = 16

// ─── component ────────────────────────────────────────────────────────────────

export default function AnimatedSalesMap({
  boundary,
  sales,
  audience,
  ariaLabel = 'Map of recent activity',
  aspect = 16 / 10,
  maxSales,
  minRunMs,
  maxRunMs,
  className,
}: AnimatedSalesMapProps) {
  const { ready, error } = useGoogleMapsReady()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [armed, setArmed] = useState(false)

  // ODS gate first, then the §0 guards. Both are pure and memoized so the
  // animation effect does not re-run on unrelated parent renders.
  const licensed = useMemo(() => salesForAudience(sales, audience), [sales, audience])
  const normalized = useMemo(
    () => normalizeSales(licensed as readonly AnimatedSale[], { maxSales }),
    [licensed, maxSales],
  )
  const rings = useMemo<LatLngPoint[][]>(() => boundaryToRings(boundary), [boundary])
  const bounds = useMemo(() => computeBoundsLiteral(rings, normalized), [rings, normalized])

  const hasBoundary = rings.length > 0
  const hasSales = normalized.length > 0
  /** Nothing truthful to draw -> render nothing at all, never an empty grey box. */
  const renderable = Boolean(bounds) && (hasBoundary || hasSales) && !error

  // ── arm on enter, once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!renderable || armed) return

    // Reduced motion skips the reveal entirely: final state, immediately.
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setArmed(true)
      return
    }

    const node = containerRef.current
    if (!node) return

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true)
          io.disconnect()
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [renderable, armed])

  // ── frame the geography ─────────────────────────────────────────────────────
  const onLoad = useCallback(
    (instance: google.maps.Map) => {
      if (bounds) {
        if (isDegenerateBounds(bounds)) {
          // One point (or several stacked): fitBounds would slam to max zoom.
          instance.setCenter({ lat: bounds.north, lng: bounds.east })
          instance.setZoom(DEGENERATE_ZOOM)
        } else {
          instance.fitBounds(
            new google.maps.LatLngBounds(
              { lat: bounds.south, lng: bounds.west },
              { lat: bounds.north, lng: bounds.east },
            ),
            FIT_PADDING,
          )
          // A very tight boundary can still over-zoom past street level.
          const once = google.maps.event.addListenerOnce(instance, 'idle', () => {
            const z = instance.getZoom()
            if (typeof z === 'number' && z > MAX_FIT_ZOOM) instance.setZoom(MAX_FIT_ZOOM)
          })
          void once
        }
      }
      setMap(instance)
    },
    [bounds],
  )

  const onUnmount = useCallback(() => setMap(null), [])

  // ── the reveal ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !armed || !renderable) return

    const reduced = prefersReducedMotion()
    const teardown: Array<() => void> = []
    let cancelled = false
    let rafId = 0

    // ---- boundary --------------------------------------------------------
    const drawnRings = rings.map((r) => resampleRing(r, MAX_RING_POINTS))

    const polygon = hasBoundary
      ? new google.maps.Polygon({
          paths: drawnRings,
          strokeColor: MAP_NAVY,
          strokeWeight: BOUNDARY_STROKE_WEIGHT,
          strokeOpacity: reduced ? 1 : 0,
          fillColor: MAP_NAVY,
          fillOpacity: reduced ? BOUNDARY_FILL_OPACITY : 0,
          clickable: false,
          map,
        })
      : null
    if (polygon) teardown.push(() => polygon.setMap(null))

    // ---- sale pills ------------------------------------------------------
    const plan = computeStagger(normalized.length, { minRunMs, maxRunMs })
    const items: OverlayItem[] = normalized.map((sale, i) => ({
      position: new google.maps.LatLng(sale.lat, sale.lng),
      // Newest on top: the sequence ends with the current picture legible.
      el: buildPillElement(sale, i + 1),
    }))

    let overlay: SalesOverlay | null = null
    if (items.length > 0) {
      const Ctor = getSalesOverlayClass()
      overlay = new Ctor(items)
      overlay.setMap(map)
      const handle = overlay
      teardown.push(() => handle.setMap(null))
    }

    const animations: Animation[] = []

    const popPills = () => {
      if (cancelled || items.length === 0) return

      if (reduced) {
        // Final state, no motion.
        for (const item of items) item.el.style.opacity = '1'
        return
      }

      for (let i = 0; i < items.length; i++) {
        const el = items[i].el
        if (typeof el.animate !== 'function') {
          el.style.opacity = '1'
          continue
        }
        el.style.willChange = 'transform, opacity'
        const anim = el.animate(
          [
            { transform: 'translate(-50%, -100%) scale(0.35)', opacity: 0 },
            { transform: 'translate(-50%, -100%) scale(1)', opacity: 1 },
          ],
          {
            duration: plan.markerDurationMs,
            delay: markerDelayMs(plan, i),
            // §3 motion ladder: ease-out entrance.
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            // `backwards` holds frame 0 through the delay, so a pill is invisible
            // until its turn without a second style write per element.
            fill: 'backwards',
          },
        )
        anim.onfinish = () => {
          el.style.opacity = '1'
          el.style.willChange = 'auto'
        }
        animations.push(anim)
      }
    }
    teardown.push(() => {
      for (const a of animations) {
        try {
          a.cancel()
        } catch {
          /* an already-finished animation is fine to ignore */
        }
      }
    })

    // Pills start hidden only when they are going to animate in.
    if (!reduced) for (const item of items) item.el.style.opacity = '0'

    // ---- sequence --------------------------------------------------------
    if (reduced || !polygon) {
      popPills()
      return () => {
        cancelled = true
        cancelAnimationFrame(rafId)
        for (const fn of teardown) fn()
      }
    }

    const lines = drawnRings.map(
      (_, i) =>
        new google.maps.Polyline({
          path: [],
          strokeColor: MAP_NAVY,
          strokeWeight: BOUNDARY_STROKE_WEIGHT,
          strokeOpacity: 0.95,
          clickable: false,
          zIndex: i,
          map,
        }),
    )
    teardown.push(() => lines.forEach((l) => l.setMap(null)))

    const drawStart = performance.now()

    const fillIn = (now: number) => {
      if (cancelled) return
      const t = Math.min(1, (now - drawStart - BOUNDARY_DRAW_MS) / BOUNDARY_FILL_MS)
      const e = easeOutCubic(t)
      polygon.setOptions({ strokeOpacity: e, fillOpacity: BOUNDARY_FILL_OPACITY * e })
      if (t < 1) {
        rafId = requestAnimationFrame(fillIn)
      } else {
        // The polygon now carries the stroke; drop the scratch polylines.
        for (const l of lines) l.setMap(null)
      }
    }

    const drawStroke = (now: number) => {
      if (cancelled) return
      const t = Math.min(1, (now - drawStart) / BOUNDARY_DRAW_MS)
      const e = easeOutCubic(t)
      for (let i = 0; i < lines.length; i++) lines[i].setPath(ringDrawPath(drawnRings[i], e))
      if (t < 1) {
        rafId = requestAnimationFrame(drawStroke)
      } else {
        popPills()
        rafId = requestAnimationFrame(fillIn)
      }
    }
    rafId = requestAnimationFrame(drawStroke)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      for (const fn of teardown) fn()
    }
  }, [map, armed, renderable, rings, hasBoundary, normalized, minRunMs, maxRunMs])

  // Hooks are all above this line; the early return is safe.
  if (!renderable) return null

  return (
    <div
      ref={containerRef}
      // Inline aspect-ratio keeps the box reserved before the map paints, with
      // no arbitrary Tailwind bracket (G26) and no layout shift.
      style={{ aspectRatio: String(aspect) }}
      className={cn('relative w-full overflow-hidden rounded-xl border border-border bg-muted', className)}
    >
      {ready ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            ...getBaseMapOptions(),
            styles: MAP_BOUNDARY_STYLES,
            // A storytelling map, not a search map: no accidental scroll capture.
            gestureHandling: 'cooperative',
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            keyboardShortcuts: false,
          }}
          // Google Maps renders its own canvas; the wrapper carries the label.
          aria-label={ariaLabel}
        />
      ) : null}
    </div>
  )
}
