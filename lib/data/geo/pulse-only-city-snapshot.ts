export type PulseOnlyCitySnapshot = {
  geoType: 'city'
  geoKey: string
  geoLabel: string
  activeSfrCount: number
  activeAllCount: number
  pendingCount: number
  medianListPrice: number | null
  communityCount: number
  refreshedAt: string
}

export type PulseCityRow = {
  geo_slug: string
  geo_label: string
  active_count: number
  pending_count: number
  median_list_price: number | null
  updated_at: string
}

/**
 * City door with a pulse row but no geo_snapshot_mv row.
 * Tumalo is not an MLS City. Redirecting /cities/tumalo to Bend published
 * Bend's inventory under a Tumalo door (fleet 68e429f53384684f4bff707cec907db9).
 */
export function pulseOnlyCitySnapshot(key: string, pulse: PulseCityRow): PulseOnlyCitySnapshot {
  const label = pulse.geo_label?.trim()
  return {
    geoType: 'city',
    geoKey: key,
    geoLabel: label && label.length > 0 ? label : key.replace(/\b\w/g, (c) => c.toUpperCase()),
    activeSfrCount: pulse.active_count,
    activeAllCount: pulse.active_count,
    pendingCount: pulse.pending_count,
    medianListPrice:
      pulse.median_list_price != null ? Math.round(Number(pulse.median_list_price)) : null,
    communityCount: 0,
    refreshedAt: pulse.updated_at,
  }
}
