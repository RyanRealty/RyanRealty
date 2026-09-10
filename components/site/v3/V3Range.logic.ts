/**
 * Dual-range tick math for V3Range.
 *
 * Adapted from beUI range-slider's job (tick stops, snap on release, no
 * bounce) into house numbers. Visual spacing is one equal step per stop so
 * a $300K–$750K Bend band is not a sliver on a $0–$5M linear axis.
 * Callers own §0: this file never invents a listing count or a market figure.
 */

export const V3_PRICE_STOPS = [
  0, 250_000, 300_000, 400_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000,
] as const

export type V3RangeStops = readonly number[]

export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  if (lo > hi) return lo
  return Math.min(hi, Math.max(lo, n))
}

/** Nearest stop by value. Empty / non-finite → first stop. */
export function snapToStops(value: number, stops: V3RangeStops): number {
  if (stops.length === 0) return 0
  if (!Number.isFinite(value)) return stops[0]!
  let best = stops[0]!
  let bestDist = Math.abs(value - best)
  for (let i = 1; i < stops.length; i += 1) {
    const s = stops[i]!
    const d = Math.abs(value - s)
    if (d < bestDist) {
      best = s
      bestDist = d
    }
  }
  return best
}

/**
 * Visual percent along equally spaced ticks. Off-grid values interpolate
 * between neighbouring stops so a typed $325K sits between $300K and $400K.
 */
export function visualPercent(value: number, stops: V3RangeStops): number {
  if (stops.length <= 1) return 0
  const first = stops[0]!
  const last = stops[stops.length - 1]!
  if (value <= first) return 0
  if (value >= last) return 100
  let i = 1
  while (i < stops.length && stops[i]! < value) i += 1
  const hi = stops[i]!
  const lo = stops[i - 1]!
  const local = hi === lo ? 0 : (value - lo) / (hi - lo)
  return ((i - 1 + local) / (stops.length - 1)) * 100
}

/** Value for a pointer percent on equally spaced ticks, snapped to a stop. */
export function valueFromVisualPercent(pct: number, stops: V3RangeStops): number {
  if (stops.length === 0) return 0
  if (stops.length === 1) return stops[0]!
  const t = clamp(pct, 0, 100) / 100
  const idx = Math.round(t * (stops.length - 1))
  return stops[idx]!
}

export function parseBound(raw: string | undefined | null): number | null {
  if (raw == null || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * URL min/max → thumbs. Missing min is the first stop; missing max is the
 * last stop (open-ended). Values are not snapped so a typed figure stays.
 */
export function urlToRange(
  minRaw: string | undefined | null,
  maxRaw: string | undefined | null,
  stops: V3RangeStops,
): { low: number; high: number } {
  const first = stops[0] ?? 0
  const last = stops[stops.length - 1] ?? first
  let low = parseBound(minRaw) ?? first
  let high = parseBound(maxRaw) ?? last
  if (low > high) {
    const swap = low
    low = high
    high = swap
  }
  return { low: clamp(low, first, last), high: clamp(high, first, last) }
}

/**
 * Thumbs → URL. First stop omits min (any floor). Last stop omits max (no
 * ceiling). Integers as strings — the search URL already speaks whole dollars.
 */
export function rangeToUrl(
  low: number, high: number, stops: V3RangeStops,
): { min: string | undefined; max: string | undefined } {
  const first = stops[0] ?? 0
  const last = stops[stops.length - 1] ?? first
  const lo = snapToStops(low, stops)
  const hi = snapToStops(high, stops)
  const ordered = lo <= hi ? { lo, hi } : { lo: hi, hi: lo }
  return {
    min: ordered.lo <= first ? undefined : String(ordered.lo),
    max: ordered.hi >= last ? undefined : String(ordered.hi),
  }
}

export function formatPriceStop(n: number, stops: V3RangeStops = V3_PRICE_STOPS): string {
  const last = stops[stops.length - 1] ?? n
  if (n <= (stops[0] ?? 0)) return 'Any'
  const plus = n >= last ? '+' : ''
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    const body = m % 1 === 0 ? String(m) : m.toFixed(1).replace(/\.0$/, '')
    return `$${body}M${plus}`
  }
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K${plus}`
  return `$${n}${plus}`
}

export function formatPriceRange(low: number, high: number, stops: V3RangeStops = V3_PRICE_STOPS): string {
  const first = stops[0] ?? 0
  const last = stops[stops.length - 1] ?? high
  if (low <= first && high >= last) return 'Any price'
  if (low <= first) return `Up to ${formatPriceStop(high, stops)}`
  if (high >= last) return `${formatPriceStop(low, stops)}+`
  return `${formatPriceStop(low, stops)} to ${formatPriceStop(high, stops)}`
}
