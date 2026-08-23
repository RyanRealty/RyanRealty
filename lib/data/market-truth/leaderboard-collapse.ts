export type LeaderboardRow = {
  geoSlug: string
  value: number
  sampleN: number
  windowMonths: number
}

export type RawLeaderboardRow = {
  geo_slug: string
  value: number | string
  sample_n: number | string
  window_months: number | string
  period_end: string
  computed_at: string
}

/** Later period_end, then shortest ladder window (12 before 24/36), then later computed_at. */
export function preferLeaderboardCell(next: RawLeaderboardRow, prev: RawLeaderboardRow): boolean {
  const peN = String(next.period_end)
  const peP = String(prev.period_end)
  if (peN !== peP) return peN > peP
  const wN = Number(next.window_months)
  const wP = Number(prev.window_months)
  if (wN !== wP) {
    if (wN === 0) return true
    if (wP === 0) return false
    return wN < wP
  }
  return String(next.computed_at) > String(prev.computed_at)
}

export function collapseLeaderboardRows(
  rows: RawLeaderboardRow[],
  opts: { ascending?: boolean; limit?: number },
): LeaderboardRow[] {
  const best = new Map<string, RawLeaderboardRow>()
  for (const row of rows) {
    const slug = String(row.geo_slug)
    const prev = best.get(slug)
    if (!prev || preferLeaderboardCell(row, prev)) best.set(slug, row)
  }
  const collapsed = [...best.values()].map((r) => ({
    geoSlug: String(r.geo_slug),
    value: Number(r.value),
    sampleN: Number(r.sample_n),
    windowMonths: Number(r.window_months),
  }))
  collapsed.sort((a, b) => (opts.ascending ? a.value - b.value : b.value - a.value))
  return collapsed.slice(0, opts.limit ?? 16)
}
