/**
 * Document title for every /housing-market/{geo} URL (SITE-173).
 *
 * The win query is "{geo} housing market". Inventory phrasing ("homes for
 * sale", listing counts) belongs to city, search, and place titles.
 * Months of supply is the market figure this page already publishes.
 */
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'

export const MARKET_TITLE_YEAR = 2026

function readVariable(
  variables: ReadonlyArray<{ name: string; value: string | number }>,
  name: string,
): string | number | null {
  return variables.find((v) => v.name === name)?.value ?? null
}

function supplyLabel(value: string | number): string {
  if (typeof value === 'number' && Number.isFinite(value)) return formatMonthsOfSupply(value)
  return String(value).trim()
}

export function geoTitle(input: {
  geoName: string
  datasetVariables: ReadonlyArray<{ name: string; value: string | number }>
}): string {
  const geo = input.geoName.trim()
  const supply = readVariable(input.datasetVariables, 'Months of Supply')
  if (supply == null) return `${geo} housing market ${MARKET_TITLE_YEAR}`
  return `${geo} housing market ${MARKET_TITLE_YEAR}: ${supplyLabel(supply)} months of supply`
}
