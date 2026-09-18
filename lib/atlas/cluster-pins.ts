/**
 * Screen-space clustering for Atlas price pins (SITE-128 residual).
 *
 * City folds paint hundreds of 735K pills into one unreadable pile. Neighborhood
 * and community frames already have room between marks. Same radius in screen
 * pixels does both jobs: overlapping centres merge into a count bubble; a
 * zoom (or a tighter frame) spreads them until each ask is a pin again.
 * Redfin-style, on the existing pin layer — not a second map.
 *
 * Import-free so `ci:atlas-price-pins` can transpile and run the matrix.
 */

/** Two pill centres closer than this (px) share a bubble. ~one Atlas pin wide. */
export const ATLAS_PIN_CLUSTER_RADIUS_PX = 40

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

function find(parent: number[], i: number): number {
  let r = i
  while (parent[r] !== r) r = parent[r]!
  let c = i
  while (parent[c] !== r) {
    const next = parent[c]!
    parent[c] = r
    c = next
  }
  return r
}

function union(parent: number[], rank: number[], a: number, b: number): void {
  const ra = find(parent, a)
  const rb = find(parent, b)
  if (ra === rb) return
  if (rank[ra]! < rank[rb]!) parent[ra] = rb
  else if (rank[ra]! > rank[rb]!) parent[rb] = ra
  else {
    parent[rb] = ra
    rank[ra]! += 1
  }
}

/**
 * Group pins whose screen centres sit inside `radiusPx`. Order-stable: members
 * keep input order, clusters emit by lowest index so the same pile always
 * yields the same bubbles.
 */
export function clusterAtlasPins(
  pins: readonly AtlasPinCandidate[],
  radiusPx = ATLAS_PIN_CLUSTER_RADIUS_PX,
): AtlasPinCluster[] {
  const n = pins.length
  if (n === 0) return []
  if (n === 1) {
    const p = pins[0]!
    return [{ id: `c-${p.i}`, x: p.x, y: p.y, indices: [p.i], count: 1 }]
  }

  const parent = Array.from({ length: n }, (_, i) => i)
  const rank = new Array<number>(n).fill(0)
  const cell = Math.max(radiusPx, 1)
  const buckets = new Map<string, number[]>()
  const keyOf = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`

  for (let i = 0; i < n; i += 1) {
    const p = pins[i]!
    const k = keyOf(p.x, p.y)
    const bucket = buckets.get(k)
    if (bucket) bucket.push(i)
    else buckets.set(k, [i])
  }

  const r2 = radiusPx * radiusPx
  for (let i = 0; i < n; i += 1) {
    const p = pins[i]!
    const cx = Math.floor(p.x / cell)
    const cy = Math.floor(p.y / cell)
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const near = buckets.get(`${cx + dx},${cy + dy}`)
        if (!near) continue
        for (const j of near) {
          if (j <= i) continue
          const q = pins[j]!
          const ddx = p.x - q.x
          const ddy = p.y - q.y
          if (ddx * ddx + ddy * ddy <= r2) union(parent, rank, i, j)
        }
      }
    }
  }

  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i += 1) {
    const root = find(parent, i)
    const list = groups.get(root)
    if (list) list.push(i)
    else groups.set(root, [i])
  }

  const out: AtlasPinCluster[] = []
  for (const members of groups.values()) {
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
 * True when zooming to `maxK` would pull member centres at least two radii
 * apart. A condo stack that shares one coordinate never expands — the tap
 * should open a listing instead of a no-op zoom.
 */
export function atlasClusterCanExpand(
  pts: readonly { x: number; y: number }[],
  maxK: number,
  radiusPx = ATLAS_PIN_CLUSTER_RADIUS_PX,
): boolean {
  if (pts.length < 2 || !(maxK > 0)) return false
  const b = atlasClusterWorldBounds(pts)
  if (!b) return false
  const spread = Math.max(b.x1 - b.x0, b.y1 - b.y0)
  return spread * maxK >= radiusPx * 2
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
