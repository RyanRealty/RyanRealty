/**
 * The pure half of V3SeasonStrips: whether a run can be drawn honestly, how
 * tall each column stands, how much of it reaches past the threshold the call
 * turns on, where a band sits, and where the arrow keys go next.
 *
 * Nothing here reads the DOM, formats a figure or parses a date. The rows
 * arrive already folded by calendar year (the caller owns the months), and a
 * value arrives only as geometry: the label beside it is the printed figure.
 *
 * Nothing is clamped into range. A value outside the domain would draw a
 * column standing on the top of its row as if that were the value, which is a
 * lie about the number, so the whole drawing is refused instead (the same rule
 * V3Answers.marks applies to a scale).
 */

/** Twelve columns, January first. A season strip is a calendar year. */
export const V3_SEASON_COLUMNS = 12

/** A run shorter than this is a sentence, not a drawing. */
export const V3_SEASON_MIN_READINGS = 2

export type V3SeasonPos = { row: number; column: number }

type Valued = { value: number }
type RowLike<C> = { cells: readonly (C | null)[] }

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * True when every row is a calendar year of twelve slots, the domain is
 * positive, every value sits inside it, every band ascends inside it, and
 * there are at least two readings to draw.
 */
export function seasonDrawable<C extends Valued>(
  rows: readonly RowLike<C>[],
  max: number,
  bands: readonly { from: number; to: number }[] = [],
): boolean {
  if (!finite(max) || max <= 0) return false
  let readings = 0
  for (const row of rows) {
    if (row.cells.length !== V3_SEASON_COLUMNS) return false
    for (const cell of row.cells) {
      if (cell == null) continue
      if (!finite(cell.value) || cell.value < 0 || cell.value > max) return false
      readings += 1
    }
  }
  for (const band of bands) {
    if (seasonBandPlacement(band, max) == null) return false
  }
  return readings >= V3_SEASON_MIN_READINGS
}

/**
 * Every filled cell in time order. Rows arrive NEWEST FIRST (the page reads
 * this year first), so time runs from the last row's January to the first
 * row's December.
 */
export function seasonTimeline<C>(rows: readonly RowLike<C>[]): V3SeasonPos[] {
  const out: V3SeasonPos[] = []
  for (let row = rows.length - 1; row >= 0; row -= 1) {
    const cells = rows[row]!.cells
    for (let column = 0; column < cells.length; column += 1) {
      if (cells[column] != null) out.push({ row, column })
    }
  }
  return out
}

export function samePos(a: V3SeasonPos | null | undefined, b: V3SeasonPos | null | undefined): boolean {
  return a != null && b != null && a.row === b.row && a.column === b.column
}

export function cellAt<C>(rows: readonly RowLike<C>[], pos: V3SeasonPos | null | undefined): C | null {
  if (!pos) return null
  return rows[pos.row]?.cells[pos.column] ?? null
}

/** The column's height as a percentage of its row, zero at the baseline. */
export function seasonHeightPct(value: number, max: number): number {
  return (value / max) * 100
}

/**
 * How much of a column, as a percentage of the column's OWN height, stands
 * above the threshold. Zero when the value does not pass it: a value exactly
 * on the line has not crossed it, the same direction lib/market/classify.ts
 * sends months of supply at 4.0.
 */
export function seasonCapPct(value: number, threshold: number | undefined): number {
  if (threshold == null || !finite(threshold) || value <= threshold || value <= 0) return 0
  return ((value - threshold) / value) * 100
}

/**
 * A band's place on the row, measured from the baseline, or null when it does
 * not ascend or leaves the domain. A band that reaches past the top of the
 * domain is refused rather than cut: the caller sets the domain to hold it.
 */
export function seasonBandPlacement(
  band: { from: number; to: number },
  max: number,
): { bottomPct: number; heightPct: number; closesAtTop: boolean } | null {
  if (!finite(band.from) || !finite(band.to) || !finite(max) || max <= 0) return null
  if (band.from < 0 || band.to <= band.from || band.to > max) return null
  return {
    bottomPct: (band.from / max) * 100,
    heightPct: ((band.to - band.from) / max) * 100,
    closesAtTop: band.to === max,
  }
}

/** The filled cell in a row nearest a column, or null when the row has none. */
export function nearestInRow<C>(rows: readonly RowLike<C>[], row: number, column: number): V3SeasonPos | null {
  const cells = rows[row]?.cells
  if (!cells) return null
  let best = -1
  let bestD = Infinity
  for (let c = 0; c < cells.length; c += 1) {
    if (cells[c] == null) continue
    const d = Math.abs(c - column)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best < 0 ? null : { row, column: best }
}

/**
 * Where a key moves the reading. Left and right step through time, across a
 * year boundary; up and down step to the same month a year newer or older,
 * which is the comparison the strips exist for; Home and End reach the ends
 * of the run; Escape returns to the resting reading. Undefined when the key is
 * not one the drawing answers, so the caller leaves the event alone.
 */
export function seasonStep<C>(
  rows: readonly RowLike<C>[],
  timeline: readonly V3SeasonPos[],
  at: V3SeasonPos | null,
  key: string,
  resting: V3SeasonPos | null,
): V3SeasonPos | null | undefined {
  if (timeline.length === 0) return undefined
  const first = timeline[0]!
  const last = timeline[timeline.length - 1]!
  switch (key) {
    case 'Home':
      return first
    case 'End':
      return last
    case 'Escape':
      return resting
    case 'ArrowLeft':
    case 'ArrowRight': {
      if (!at) return key === 'ArrowRight' ? first : last
      const i = timeline.findIndex((p) => samePos(p, at))
      if (i < 0) return last
      const next = key === 'ArrowRight' ? i + 1 : i - 1
      return timeline[Math.max(0, Math.min(timeline.length - 1, next))]!
    }
    case 'ArrowUp':
    case 'ArrowDown': {
      if (!at) return last
      const row = key === 'ArrowUp' ? at.row - 1 : at.row + 1
      return rows[row]?.cells[at.column] != null ? { row, column: at.column } : at
    }
    default:
      return undefined
  }
}
