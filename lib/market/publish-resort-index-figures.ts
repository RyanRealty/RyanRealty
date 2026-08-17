/**
 * Live figures a registry resort may print on an index tile, homepage card,
 * newsletter pill, or community metadata.
 *
 * A resort's homes are MLS-tagged under many SubdivisionName values. The
 * literal-name index entity key undercounts every one of them. The community
 * page already prints the alias-aware set (`resortActiveSfrCounts` +
 * `resortTilesForSlug`).
 *
 * Founding case: homepage Tetherow tile 12 ACTIVE vs /communities/tetherow
 * 35 homes for sale (fleet a7a6038f1d78857572e7e2199cf399bf).
 *
 * Snapshot, pulse, and literal-name counts are other sets. Do not pass them
 * in. Withhold the median when the count is 0 (no ask to publish).
 */

export type PublishedResortIndexFigures = {
  activeCount: number | null
  medianListPrice: number | null
}

function asCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return value
}

function asPositiveMedian(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function publishResortIndexFigures(input: {
  aliasAwareCount: number | null | undefined
  aliasAwareMedian: number | null | undefined
}): PublishedResortIndexFigures {
  const activeCount = asCount(input.aliasAwareCount)
  return {
    activeCount,
    medianListPrice:
      activeCount != null && activeCount > 0 ? asPositiveMedian(input.aliasAwareMedian) : null,
  }
}
