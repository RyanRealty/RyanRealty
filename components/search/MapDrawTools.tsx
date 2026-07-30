'use client'

/**
 * MapDrawTools — multi-shape draw layer for SearchMapClustered (Phase 2,
 * SEARCH_OPTIMIZATION_PLAN_2026-07-29 items 1+3).
 *
 * Three tools: freeform polygon (click vertices), rectangle (drag corner to
 * corner), circle (drag center → edge with a LIVE radius readout in miles —
 * Flexmls parity). Shapes coexist; each renders a floating pill carrying its
 * name (the rename hook for Phase 2.4 named areas), an include/exclude toggle
 * (excluded areas render red-tinted), and a remove control. All changes
 * surface through ONE onShapesChange(shapes) callback — the parent owns the
 * shape set, syncs it to `?shapes=`, and feeds the PostGIS shapes contract.
 *
 * Renders INSIDE SearchMapClustered's MapContext.Provider (the <Polygon>/
 * <Circle> overlays need it) and anchors its absolute UI to the map's
 * relative root container.
 */

import React, { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import { Circle, Polygon } from '@react-google-maps/api'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { haversineMeters, MAX_SHAPES, type DrawnShape, type MapPolygonPoint } from '@/lib/map-polygon'
import { MAP_EXCLUDE_RED, MAP_NAVY } from '@/lib/maps/markers'

// Map-overlay literal (Google Maps overlays cannot read CSS tokens). Same
// red literal the saved-pin ring in SearchMapClustered already uses.

/** A circle drag shorter than this is a click, not a radius — rejected. */
const MIN_CIRCLE_RADIUS_M = 10
/** A rectangle drag under this diagonal is a mis-click, not an area. */
const MIN_RECT_DIAGONAL_M = 10

export type DrawMode = 'polygon' | 'rectangle' | 'circle'

/** Live readout formatting: "0.72 mi" under a mile, "1.4 mi", "12 mi". */
export function formatRadiusMiles(meters: number): string {
  const mi = meters / 1609.344
  const label = mi >= 10 ? mi.toFixed(0) : mi >= 1 ? mi.toFixed(1) : mi.toFixed(2)
  return `${label} mi`
}

// ── Screen ↔ world (Web-Mercator, heading-0 map) ────────────────────────────
// Exact for an untilted, unrotated map: lng is linear across the viewport,
// lat goes through the Mercator y so shapes/pills land where the cursor is
// (the legacy draw path's linear-lat approximation drifts mid-viewport).

function mercY(latDeg: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latDeg))
  return Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))
}

function invMercY(y: number): number {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI
}

function pixelToLatLng(
  map: google.maps.Map,
  rect: DOMRect,
  x: number,
  y: number
): MapPolygonPoint | null {
  const b = map.getBounds()
  if (b == null || rect.width <= 0 || rect.height <= 0) return null
  const ne = b.getNorthEast()
  const sw = b.getSouthWest()
  const lng = sw.lng() + (x / rect.width) * (ne.lng() - sw.lng())
  const topY = mercY(ne.lat())
  const bottomY = mercY(sw.lat())
  const lat = invMercY(topY - (y / rect.height) * (topY - bottomY))
  return { lat, lng }
}

function latLngToPixel(
  map: google.maps.Map,
  rect: DOMRect,
  p: MapPolygonPoint
): { x: number; y: number } | null {
  const b = map.getBounds()
  if (b == null || rect.width <= 0 || rect.height <= 0) return null
  const ne = b.getNorthEast()
  const sw = b.getSouthWest()
  const lngSpan = ne.lng() - sw.lng()
  const topY = mercY(ne.lat())
  const bottomY = mercY(sw.lat())
  if (lngSpan === 0 || topY === bottomY) return null
  return {
    x: ((p.lng - sw.lng()) / lngSpan) * rect.width,
    y: ((topY - mercY(p.lat)) / (topY - bottomY)) * rect.height,
  }
}

function shapeAnchor(shape: DrawnShape): MapPolygonPoint {
  if (shape.type === 'circle') return shape.center
  let lat = 0
  let lng = 0
  for (const p of shape.points) {
    lat += p.lat
    lng += p.lng
  }
  return { lat: lat / shape.points.length, lng: lng / shape.points.length }
}

function shapeOverlayOptions(exclude: boolean): google.maps.PolygonOptions {
  const color = exclude ? MAP_EXCLUDE_RED : MAP_NAVY
  return {
    fillColor: color,
    fillOpacity: exclude ? 0.14 : 0.15,
    strokeColor: color,
    strokeWeight: 2,
    strokeOpacity: 0.85,
    clickable: false,
  }
}

const TOOL_BUTTON =
  'rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-primary shadow-md hover:bg-muted'
const TOOL_BUTTON_PRIMARY =
  'rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-md hover:bg-primary/90'
const TOOL_BUTTON_MUTED =
  'rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-md hover:bg-muted'

type Props = {
  map: google.maps.Map
  /** The map canvas div — draw gestures attach here; pixel math reads its rect. */
  containerRef: RefObject<HTMLDivElement | null>
  shapes: DrawnShape[]
  onShapesChange: (shapes: DrawnShape[]) => void
  /** True while a draw tool is armed — the parent freezes map drag/POI clicks. */
  onDrawActiveChange: (active: boolean) => void
  /**
   * Consume-a-map-tap hook: while a draw is armed the parent's price pills call
   * this instead of opening a listing, so a tap near a pin lands a vertex
   * exactly on it (parity with the legacy single-polygon draw).
   */
  drawClickRef: MutableRefObject<((p: MapPolygonPoint) => boolean) | null>
}

export default function MapDrawTools({
  map,
  containerRef,
  shapes,
  onShapesChange,
  onDrawActiveChange,
  drawClickRef,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<DrawMode | null>(null)
  const [draftPoints, setDraftPoints] = useState<MapPolygonPoint[]>([])
  const [drag, setDrag] = useState<{
    start: MapPolygonPoint
    current: MapPolygonPoint
    px: { x: number; y: number }
  } | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  // The map canvas rect, refreshed on every map movement/resize — pills and
  // the radius label project through it, so they track their shapes live.
  const [hostRect, setHostRect] = useState<DOMRect | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashHint = useCallback((message: string) => {
    setHint(message)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    hintTimerRef.current = setTimeout(() => setHint(null), 4000)
  }, [])

  useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
  }, [])

  // Parent map options react to draw state (drag off, POI clicks off, crosshair).
  useEffect(() => {
    onDrawActiveChange(mode != null)
    return () => onDrawActiveChange(false)
  }, [mode, onDrawActiveChange])

  // Price-pill taps: vertex in polygon mode, swallowed in drag modes.
  useEffect(() => {
    if (mode === 'polygon') {
      drawClickRef.current = (p) => {
        setDraftPoints((prev) => [...prev, p])
        return true
      }
    } else if (mode != null) {
      drawClickRef.current = () => true
    } else {
      drawClickRef.current = null
    }
    return () => {
      drawClickRef.current = null
    }
  }, [mode, drawClickRef])

  // Pills track the map: bounds_changed fires continuously through a pan.
  useEffect(() => {
    const update = () => {
      const el = containerRef.current
      setHostRect(el ? el.getBoundingClientRect() : null)
    }
    update()
    const listener = map.addListener('bounds_changed', update)
    window.addEventListener('resize', update)
    return () => {
      listener.remove()
      window.removeEventListener('resize', update)
    }
  }, [map, containerRef])

  // Freeform polygon: each map click is a vertex.
  useEffect(() => {
    const container = containerRef.current
    if (mode !== 'polygon' || container == null) return
    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const point = pixelToLatLng(map, rect, e.clientX - rect.left, e.clientY - rect.top)
      if (point) setDraftPoints((prev) => [...prev, point])
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [mode, map, containerRef])

  const commitShape = useCallback(
    (shape: DrawnShape) => {
      if (shapes.length >= MAX_SHAPES) {
        flashHint(`Up to ${MAX_SHAPES} areas per search. Remove one to draw another.`)
        return
      }
      onShapesChange([...shapes, shape])
      setMode(null)
      setMenuOpen(false)
      setDraftPoints([])
    },
    [shapes, onShapesChange, flashHint]
  )

  // Rectangle + circle: press, drag, release.
  useEffect(() => {
    const container = containerRef.current
    if ((mode !== 'rectangle' && mode !== 'circle') || container == null) return
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const rect = container.getBoundingClientRect()
      const start = pixelToLatLng(map, rect, e.clientX - rect.left, e.clientY - rect.top)
      if (start == null) return
      e.preventDefault()
      let last = start
      setDrag({ start, current: start, px: { x: e.clientX - rect.left, y: e.clientY - rect.top } })
      const move = (ev: PointerEvent) => {
        ev.preventDefault()
        const r = container.getBoundingClientRect()
        const point = pixelToLatLng(map, r, ev.clientX - r.left, ev.clientY - r.top)
        if (point == null) return
        last = point
        setDrag({ start, current: point, px: { x: ev.clientX - r.left, y: ev.clientY - r.top } })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        setDrag(null)
        if (mode === 'circle') {
          const radiusM = haversineMeters(start, last)
          // A zero-radius click is rejected with a clear error (plan spec).
          if (radiusM < MIN_CIRCLE_RADIUS_M) {
            flashHint('Press on the center and drag outward to set the radius. A single tap has no size.')
            return
          }
          commitShape({ type: 'circle', center: start, radiusM: Math.round(radiusM), exclude: false })
        } else {
          if (haversineMeters(start, last) < MIN_RECT_DIAGONAL_M) {
            flashHint('Drag corner to corner to outline a rectangle.')
            return
          }
          // A rectangle IS a 4-point polygon in the shapes contract.
          commitShape({
            type: 'polygon',
            points: [
              { lat: start.lat, lng: start.lng },
              { lat: start.lat, lng: last.lng },
              { lat: last.lat, lng: last.lng },
              { lat: last.lat, lng: start.lng },
            ],
            exclude: false,
          })
        }
      }
      window.addEventListener('pointermove', move, { passive: false })
      window.addEventListener('pointerup', up)
    }
    container.addEventListener('pointerdown', down)
    return () => container.removeEventListener('pointerdown', down)
  }, [mode, map, containerRef, commitShape, flashHint])

  const applyPolygon = useCallback(() => {
    if (draftPoints.length < 3) return
    commitShape({ type: 'polygon', points: [...draftPoints], exclude: false })
  }, [draftPoints, commitShape])

  const cancelDraw = useCallback(() => {
    setMode(null)
    setMenuOpen(false)
    setDraftPoints([])
    setDrag(null)
    setHint(null)
  }, [])

  const startMode = useCallback((next: DrawMode) => {
    setMode(next)
    setMenuOpen(false)
    setDraftPoints([])
    setHint(null)
  }, [])

  const toggleExclude = useCallback(
    (index: number) => {
      onShapesChange(shapes.map((s, i) => (i === index ? { ...s, exclude: s.exclude === false } : s)))
    },
    [shapes, onShapesChange]
  )

  const removeShape = useCallback(
    (index: number) => {
      onShapesChange(shapes.filter((_, i) => i !== index))
    },
    [shapes, onShapesChange]
  )

  const dragRadiusM = mode === 'circle' && drag ? haversineMeters(drag.start, drag.current) : null
  const dragRectPath =
    mode === 'rectangle' && drag
      ? [
          { lat: drag.start.lat, lng: drag.start.lng },
          { lat: drag.start.lat, lng: drag.current.lng },
          { lat: drag.current.lat, lng: drag.current.lng },
          { lat: drag.current.lat, lng: drag.start.lng },
        ]
      : null

  const statusText =
    hint ??
    (mode === 'polygon'
      ? draftPoints.length < 3
        ? `Click the map to outline an area. ${3 - draftPoints.length} more point${3 - draftPoints.length === 1 ? '' : 's'} to go.`
        : 'Keep adding points, or press Apply area.'
      : mode === 'rectangle'
        ? 'Drag corner to corner to outline a rectangle.'
        : mode === 'circle'
          ? 'Press on the center and drag outward. The distance shows in miles as you drag.'
          : null)

  const idle = mode == null && menuOpen === false

  return (
    <>
      {/* Committed shapes on the map canvas */}
      {shapes.map((shape, i) =>
        shape.type === 'circle' ? (
          <Circle
            key={`shape-${i}`}
            center={{ lat: shape.center.lat, lng: shape.center.lng }}
            radius={shape.radiusM}
            options={shapeOverlayOptions(shape.exclude)}
          />
        ) : (
          <Polygon key={`shape-${i}`} paths={shape.points} options={shapeOverlayOptions(shape.exclude)} />
        )
      )}

      {/* Draft previews */}
      {mode === 'polygon' && draftPoints.length >= 2 && (
        <Polygon paths={draftPoints} options={shapeOverlayOptions(false)} />
      )}
      {dragRectPath && <Polygon paths={dragRectPath} options={shapeOverlayOptions(false)} />}
      {mode === 'circle' && drag && dragRadiusM != null && dragRadiusM > 0 && (
        <Circle
          center={{ lat: drag.start.lat, lng: drag.start.lng }}
          radius={dragRadiusM}
          options={shapeOverlayOptions(false)}
        />
      )}

      {/* LIVE radius readout riding the cursor during a circle drag */}
      {mode === 'circle' && drag && dragRadiusM != null && (
        <div
          className="pointer-events-none absolute z-[110]"
          style={{ left: drag.px.x + 14, top: drag.px.y - 12 }}
          role="status"
          aria-live="polite"
        >
          <Badge className="bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-md tabular-nums">
            {formatRadiusMiles(dragRadiusM)}
          </Badge>
        </div>
      )}

      {/* Per-shape floating pill: name (rename hook) + exclude toggle + remove */}
      {hostRect &&
        shapes.map((shape, i) => {
          const px = latLngToPixel(map, hostRect, shapeAnchor(shape))
          if (px == null) return null
          const label = shape.name ?? `Area ${i + 1}`
          return (
            <div
              key={`pill-${i}`}
              className="absolute z-[105] -translate-x-1/2 -translate-y-1/2"
              style={{ left: px.x, top: px.y }}
            >
              <div
                className={cn(
                  'flex items-center gap-0.5 rounded-full border bg-card py-0.5 pl-2.5 pr-0.5 shadow-md',
                  shape.exclude ? 'border-destructive/50' : 'border-border'
                )}
              >
                <span
                  className={cn(
                    'text-xs font-medium',
                    shape.exclude ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {label}
                  {shape.exclude ? ' (excluded)' : ''}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-6 rounded-full px-1.5 text-xs',
                    shape.exclude ? 'text-destructive' : 'text-muted-foreground'
                  )}
                  onClick={() => toggleExclude(i)}
                  aria-label={
                    shape.exclude ? `Include ${label} in the search` : `Exclude ${label} from the search`
                  }
                >
                  {shape.exclude ? 'Include' : 'Exclude'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 rounded-full p-0 text-muted-foreground"
                  onClick={() => removeShape(i)}
                  aria-label={`Remove ${label}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          )
        })}

      {/* Draw toolbar */}
      <div className="absolute left-3 top-3 z-[100] flex flex-col items-start gap-2" aria-label="Draw tools">
        <div className="flex flex-wrap gap-2">
          {idle && (
            <Button type="button" onClick={() => setMenuOpen(true)} className={TOOL_BUTTON}>
              Draw
            </Button>
          )}
          {mode == null && menuOpen && (
            <>
              <Button type="button" onClick={() => startMode('polygon')} className={TOOL_BUTTON}>
                Freeform
              </Button>
              <Button type="button" onClick={() => startMode('rectangle')} className={TOOL_BUTTON}>
                Rectangle
              </Button>
              <Button type="button" onClick={() => startMode('circle')} className={TOOL_BUTTON}>
                Radius
              </Button>
              <Button type="button" onClick={() => setMenuOpen(false)} className={TOOL_BUTTON_MUTED}>
                Cancel
              </Button>
            </>
          )}
          {mode === 'polygon' && (
            <Button
              type="button"
              onClick={applyPolygon}
              disabled={draftPoints.length < 3}
              className={TOOL_BUTTON_PRIMARY}
            >
              Apply area ({draftPoints.length})
            </Button>
          )}
          {mode != null && (
            <Button type="button" onClick={cancelDraw} className={TOOL_BUTTON_MUTED}>
              Cancel
            </Button>
          )}
          {idle && shapes.length > 0 && (
            <Button
              type="button"
              onClick={() => onShapesChange([])}
              className="rounded-lg border border-destructive bg-card px-3 py-2 text-sm font-medium text-destructive shadow-md hover:bg-destructive/10"
            >
              Clear areas ({shapes.length})
            </Button>
          )}
        </div>
        {statusText && (
          <span
            role="status"
            className="pointer-events-none w-max max-w-xs rounded-lg bg-primary/80 px-3 py-2 text-xs font-medium text-primary-foreground shadow-md"
          >
            {statusText}
          </span>
        )}
      </div>
    </>
  )
}
