/**
 * Sales heat in the atlas's own projection.
 *
 * Intensity is closings, not inventory: a cluster of closes is hotter than a
 * lone close. Empty input paints nothing. The caller names the window; this
 * module only bins the points it is given.
 *
 * Navy-on-cream paint and the legend live in the Atlas. Do not add a hue.
 */
export const ATLAS_PULSE_WINDOW_DAYS = 30
export const ATLAS_HEAT_WINDOW_DAYS = 90

export type HeatPoint = { readonly x: number; readonly y: number }

export type HeatCell = {
  x: number
  y: number
  size: number
  /** 1 = fewer sales … 4 = more sales. */
  step: 1 | 2 | 3 | 4
}

export type HeatField = {
  cells: HeatCell[]
  /** Closings that contributed. */
  n: number
  max: number
}

export type HeatBounds = { readonly width: number; readonly height: number }

/** Cell size in projection units (the atlas frame is 1000 wide). */
const CELL = 10
/** Epanechnikov radius in projection units — a few percent of the frame. */
const BANDWIDTH = 42

/** A closing counts as heat. Active and pending never do. */
export function isAtlasHeatClosing(status: string): boolean {
  return status === 'sold' || status === 'closed'
}

/** The 30-day sold count and the pulses: not the heat window. */
export function isAtlasPulseSold(dot: { s: string; soldAgo?: number | null }): boolean {
  return dot.s === 'sold' && dot.soldAgo != null && dot.soldAgo <= ATLAS_PULSE_WINDOW_DAYS
}

export function atlasHeatWindowLabel(days: number = ATLAS_HEAT_WINDOW_DAYS): string {
  if (days === 365) return 'sold in the last 12 months'
  if (days === 90) return 'sold in the last 90 days'
  if (days === 30) return 'sold in the last 30 days'
  return `sold in the last ${days} days`
}

function stepOf(value: number): 1 | 2 | 3 | 4 | null {
  if (value <= 0.18) return null
  if (value >= 3.4) return 4
  if (value >= 2.2) return 3
  if (value >= 1.15) return 2
  return 1
}

/**
 * Epanechnikov kernel density on a grid in projection space.
 * One close at a cell's centre contributes ~1; stacked closes add.
 */
export function salesHeatField(points: readonly HeatPoint[], bounds: HeatBounds): HeatField {
  if (points.length === 0 || bounds.width <= 0 || bounds.height <= 0) {
    return { cells: [], n: 0, max: 0 }
  }
  const cols = Math.max(1, Math.ceil(bounds.width / CELL))
  const rows = Math.max(1, Math.ceil(bounds.height / CELL))
  const values = new Float64Array(cols * rows)
  const h2 = BANDWIDTH * BANDWIDTH
  const reach = BANDWIDTH

  for (const p of points) {
    const c0 = Math.max(0, Math.floor((p.x - reach) / CELL))
    const c1 = Math.min(cols - 1, Math.floor((p.x + reach) / CELL))
    const r0 = Math.max(0, Math.floor((p.y - reach) / CELL))
    const r1 = Math.min(rows - 1, Math.floor((p.y + reach) / CELL))
    for (let r = r0; r <= r1; r += 1) {
      const cy = (r + 0.5) * CELL
      const dy = p.y - cy
      for (let c = c0; c <= c1; c += 1) {
        const cx = (c + 0.5) * CELL
        const dx = p.x - cx
        const u2 = (dx * dx + dy * dy) / h2
        if (u2 >= 1) continue
        values[r * cols + c]! += 1 - u2
      }
    }
  }

  let max = 0
  const cells: HeatCell[] = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const v = values[r * cols + c]!
      if (v > max) max = v
      const step = stepOf(v)
      if (step == null) continue
      cells.push({ x: c * CELL, y: r * CELL, size: CELL, step })
    }
  }
  if (max <= 0) return { cells: [], n: points.length, max: 0 }
  return { cells, n: points.length, max }
}
