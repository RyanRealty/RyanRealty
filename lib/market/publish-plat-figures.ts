/**
 * Live figures a plat page may print as THAT plat's figures.
 *
 * A registry plat has no `market_pulse_live` row. The counted SFR set
 * (`getPlatPublicInventory`) is the only plat-grain live inventory.
 * City and community pulse are other geographies. Printing them next
 * to "homes for sale in {plat}" attributes Redmond's pending days
 * (or Eagle Crest's) to Ridge At Eagle Crest.
 *
 * Founding case: /subdivisions/ridge-at-eagle-crest printed Median list
 * $910,000 (honest plat inventory) and Pending in 19.5 days (Redmond
 * city pulse). Fleet 6a52801e3ef9e0d041b830497794290d.
 *
 * Withhold days-to-pending and 30-day sold. Do not invent a plat pulse.
 */

export type PublishedPlatFigures = {
  medianListPrice: number | null
  medianDaysToPending: null
  soldCount30d: null
}

function asPositiveMedian(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function publishPlatFigures(input: {
  platMedianListPrice: number | null | undefined
}): PublishedPlatFigures {
  return {
    medianListPrice: asPositiveMedian(input.platMedianListPrice),
    medianDaysToPending: null,
    soldCount30d: null,
  }
}
