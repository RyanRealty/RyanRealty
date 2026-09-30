/**
 * Map-mark layout reads, once per drawing pass instead of once per mark.
 *
 * Google Maps redraws every OverlayView in one synchronous loop on each camera
 * frame. `projection.fromLatLngToContainerPixel` measures the page
 * (getBoundingClientRect) and a mark's offsetWidth measures it again, so when
 * each mark's draw() also moves its own box, every read after the first forces
 * a full layout. The clusterer draws every mark in the world, and a Bend
 * search load made about 4,000 of those reads: the page took no input for most
 * of a minute (profiled on production 2026-09-30, 26.5s of 28s of main-thread
 * time inside getBoundingClientRect under the price-pill draw).
 *
 * The overlay pane and the map container differ by a CSS transform, a
 * translation while panning and a scale while a zoom animates. Two reference
 * points read once per pass therefore fix the map from div pixels to container
 * pixels for every mark drawn in that pass.
 */

export type PixelPoint = { x: number; y: number }

/** container = s * div + t, per axis. */
export type DivToContainer = { sx: number; sy: number; tx: number; ty: number }

/** Reference points closer than this on an axis cannot fix a scale on it. */
const MIN_REF_SPAN_PX = 1

export function divToContainerFromRefs(
  divA: PixelPoint,
  containerA: PixelPoint,
  divB: PixelPoint,
  containerB: PixelPoint,
): DivToContainer {
  const spanX = divB.x - divA.x
  const spanY = divB.y - divA.y
  const sx = Math.abs(spanX) >= MIN_REF_SPAN_PX ? (containerB.x - containerA.x) / spanX : 1
  const sy = Math.abs(spanY) >= MIN_REF_SPAN_PX ? (containerB.y - containerA.y) / spanY : 1
  return { sx, sy, tx: containerA.x - sx * divA.x, ty: containerA.y - sy * divA.y }
}

export function divToContainer(t: DivToContainer, p: PixelPoint): PixelPoint {
  return { x: t.sx * p.x + t.tx, y: t.sy * p.y + t.ty }
}

/**
 * A per-key value computed at most once per synchronous pass. The first caller
 * computes it; everyone after reads the cached value until the pass's task
 * ends (a microtask clears it). A null compute is not cached, so the next
 * caller tries again.
 */
export function createPassMemo<K extends object, V>(): (key: K, compute: () => V | null) => V | null {
  const cache = new WeakMap<K, V>()
  return (key, compute) => {
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const value = compute()
    if (value == null) return null
    cache.set(key, value)
    queueMicrotask(() => cache.delete(key))
    return value
  }
}
