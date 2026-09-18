/**
 * Screen-space clustering for Atlas price pins (SITE-128 residual).
 *
 * City folds letterbox a tall Bend projection into a short wide stage. Union-
 * find at a 40px radius then chains every ask into ONE bubble (live
 * /cities/bend @ 1112×610 → 1 × 759). Neighborhood / community frames already
 * have room between marks, so the same grid leaves those as price pills.
 *
 * One occupied cell = one mark. Adjacent cells do not merge — a connected
 * city stays many navy count bubbles, not one centroid. Zoom stretches
 * screen distances and the grid dissolves back to 735K pills.
 *
 * Import-free so `ci:atlas-price-pins` can transpile and run the matrix.
 */

/**
 * Occupied-cell size in stage pixels. ~one Atlas price pill (52×22) plus a
 * little air — two pills whose centres share this cell become one bubble.
 * Live Bend city fold densest cell at this size is ~42, which is the bubble
 * the fold should paint, not a 759 pile and not 759 stacked asks.
 */
export const ATLAS_PIN_CLUSTER_CELL_PX = 64

/** Hit / expand still speak in "radius"; the cell is that radius. */
export const ATLAS_PIN_CLUSTER_RADIUS_PX = ATLAS_PIN_CLUSTER_CELL_PX

export type AtlasPinCandidate = {
  /** Index in the caller's dots / pinMarks array. */
  i: number
  x: number
  y: number
}

export type AtlasPinCluster = {
  /** Stable key: the lowest member index, unique because a pin is in one group. */
  id: string
  x: number
  y: number
  indices: number[]
  /** 1 = a lone price pin; >1 = a cluster bubble. */
  count: number
}

export type AtlasPinLayerHit =
  | { kind: 'cluster'; id: string }
  | { kind: 'pin'; i: number }

/**
 * Group pins that share one screen-space cell. Order-stable: members keep
 * input order, clusters emit by lowest index so the same pile always yields
 * the same bubbles. Not transitive across cell edges — that is what kept
 * Bend's fold as one 759 bubble after the first cluster land.
 */
export function clusterAtlasPins(
  pins: readonly AtlasPinCandidate[],
  cellPx = ATLAS_PIN_CLUSTER_CELL_PX,
): AtlasPinCluster[] {
  const n = pins.length
  if (n === 0) return []
  if (n === 1) {
    const p = pins[0]!
    return [{ id: `c-${p.i}`, x: p.x, y: p.y, indices: [p.i], count: 1 }]
  }

  const cell = Math.max(cellPx, 1)
  const buckets = new Map<string, number[]>()
  for (let i = 0; i < n; i += 1) {
    const p = pins[i]!
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      const k = `nan-${p.i}`
      const bucket = buckets.get(k)
      if (bucket) bucket.push(i)
      else buckets.set(k, [i])
      continue
    }
    const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`
    const bucket = buckets.get(k)
    if (bucket) bucket.push(i)
    else buckets.set(k, [i])
  }

  const out: AtlasPinCluster[] = []
  for (const members of buckets.values()) {
    members.sort((a, b) => a - b)
    let sx = 0
    let sy = 0
    const indices: number[] = []
    for (const mi of members) {
      const p = pins[mi]!
      sx += p.x
      sy += p.y
      indices.push(p.i)
    }
    indices.sort((a, b) => a - b)
    const count = indices.length
    const minI = indices[0]!
    out.push({
      id: `c-${minI}`,
      x: sx / count,
      y: sy / count,
      indices,
      count,
    })
  }
  out.sort((a, b) => a.indices[0]! - b.indices[0]!)
  return out
}

/** World-space box of a cluster's members, for `fitRect` on tap. */
export function atlasClusterWorldBounds(
  pts: readonly { x: number; y: number }[],
): { x0: number; y0: number; x1: number; y1: number } | null {
  if (pts.length === 0) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of pts) {
    if (p.x < x0) x0 = p.x
    if (p.y < y0) y0 = p.y
    if (p.x > x1) x1 = p.x
    if (p.y > y1) y1 = p.y
  }
  return { x0, y0, x1, y1 }
}

/**
 * True when zooming to `maxK` would pull member centres at least two cells
 * apart. A condo stack that shares one coordinate never expands — the tap
 * should open a listing instead of a no-op zoom.
 */
export function atlasClusterCanExpand(
  pts: readonly { x: number; y: number }[],
  maxK: number,
  cellPx = ATLAS_PIN_CLUSTER_CELL_PX,
): boolean {
  if (pts.length < 2 || !(maxK > 0)) return false
  const b = atlasClusterWorldBounds(pts)
  if (!b) return false
  const spread = Math.max(b.x1 - b.x0, b.y1 - b.y0)
  return spread * maxK >= cellPx * 2
}

export type AtlasPinLayerMark = {
  kind: 'pin' | 'cluster'
  id: string
  i?: number
  x: number
  y: number
}

/**
 * Nearest painted mark in SCREEN pixels. Cluster bubbles sit on their
 * centroid; price pills sit just above the listing coordinate (caret).
 */
export function hitAtlasPinLayer(
  px: number,
  py: number,
  marks: readonly AtlasPinLayerMark[],
  reach: number,
): AtlasPinLayerHit | null {
  if (marks.length === 0 || !(reach > 0)) return null
  let best: AtlasPinLayerHit | null = null
  let bestD = reach * reach
  for (const m of marks) {
    const mx = m.x
    const my = m.kind === 'pin' ? m.y - 12 : m.y
    const dx = mx - px
    const dy = my - py
    const dd = dx * dx + dy * dy
    if (dd >= bestD) continue
    bestD = dd
    if (m.kind === 'cluster') best = { kind: 'cluster', id: m.id }
    else if (m.i != null) best = { kind: 'pin', i: m.i }
  }
  return best
}

export function atlasClusterSize(count: number): 'sm' | 'md' | 'lg' {
  if (count >= 40) return 'lg'
  if (count >= 10) return 'md'
  return 'sm'
}
