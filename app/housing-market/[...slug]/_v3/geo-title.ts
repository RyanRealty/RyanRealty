/**
 * Document title for every /housing-market/{geo} URL (SITE-173).
 *
 * The win query is "{geo} housing market". Inventory phrasing ("homes for
 * sale", listing counts) belongs to city, search, and place titles.
 *
 * Price leads (Search Console 2026-10-04): /housing-market/bend sat at
 * position 14 to 20 for "median home price bend oregon", "bend home prices",
 * "bend house prices" and "average home price bend", while the title led with
 * "3.6 months of supply", a phrase nobody searched. The figure is the page's
 * own Dataset "Median List Price" (active single-family listings), so the
 * title says "median list price", never a bare "home price" that would read
 * as a sale price (CLAUDE.md §0). Months of supply is the fallback when the
 * Dataset withholds the price, and the year form when it withholds both.
 */
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceCompact } from '@/lib/format/money'
import { TITLE_BUDGET } from '@/lib/site/page-metadata'

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
  const fallback = `${geo} housing market ${MARKET_TITLE_YEAR}`
  const candidates: string[] = []

  const price = Number(readVariable(input.datasetVariables, 'Median List Price'))
  if (Number.isFinite(price) && price > 0) {
    const p = formatPriceCompact(price)
    candidates.push(`${geo} housing market: ${p} median list price`, `${geo} housing market: ${p} median list`)
  }
  const supply = readVariable(input.datasetVariables, 'Months of Supply')
  if (supply != null) {
    candidates.push(`${geo} housing market: ${supplyLabel(supply)} months of supply`)
  }

  return candidates.find((t) => t.length <= TITLE_BUDGET) ?? fallback
}
