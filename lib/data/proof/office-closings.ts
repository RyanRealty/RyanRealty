/**
 * Office closings, one row per home: the pure shaping half of
 * getOfficeRecentClosings. No I/O here so the rules are unit tested.
 *
 * WHAT A ROW SAYS, AND WHAT IT NEVER SAYS (Matt, /sell brief 2026-09-28):
 *   city, bedrooms, the close price, days to contract and the sale-to-list
 *   ratio. Never the street, the month, the MLS number or anyone's name.
 *
 * DAYS TO CONTRACT uses the market fact definition every other proof figure
 * on the site uses (`daysToContract` in ./outcomes): contract date minus the
 * on-market date, kept only when it is zero or more. A record whose contract
 * predates its market date was entered after the sale, so it has no market
 * clock at all. That row prints "entered after contract", never a zero.
 *
 * SALE TO LIST is ClosePrice / ListPrice, the FINAL list price, and every
 * label that prints it says so. Sale to original list is a different ratio
 * and is not what this strip shows.
 */
import { daysToContract } from '@/lib/data/proof/outcomes'

export const OFFICE_CLOSINGS_LIMIT = 6
export const OFFICE_CLOSINGS_WINDOW_MONTHS = 12

export type OfficeClosingInput = {
  listNumber: string | null
  city: string | null
  propertySubType: string | null
  bedrooms: number | null
  listPrice: number | null
  closePrice: number | null
  onMarketDate: string | null
  contractDate: string | null
  closeDate: string | null
}

export type OfficeClosing = {
  /** Stable React key. Not printed. */
  key: string
  city: string
  bedrooms: number | null
  propertySubType: string | null
  closePrice: number
  /** Null when the record has no market clock (see header). */
  daysToContract: number | null
  /** True when the contract date is before the on-market date. */
  enteredAfterContract: boolean
  /** ClosePrice / ListPrice (final list). Null when either side is missing. */
  saleToList: number | null
}

function finitePositive(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

function day(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso.slice(0, 10) + 'T00:00:00Z')
  return Number.isFinite(t) ? t : null
}

export function shapeOfficeClosings(
  rows: readonly OfficeClosingInput[],
  limit = OFFICE_CLOSINGS_LIMIT,
): OfficeClosing[] {
  const out: OfficeClosing[] = []
  for (const r of rows) {
    const city = r.city?.trim()
    const closePrice = finitePositive(r.closePrice)
    if (!city || closePrice == null) continue
    const listPrice = finitePositive(r.listPrice)
    const onMarket = day(r.onMarketDate)
    const contract = day(r.contractDate)
    const enteredAfterContract = onMarket != null && contract != null && contract < onMarket
    out.push({
      key: r.listNumber?.trim() || `${city}-${closePrice}-${r.closeDate ?? out.length}`,
      city,
      bedrooms:
        typeof r.bedrooms === 'number' && Number.isFinite(r.bedrooms) && r.bedrooms > 0
          ? r.bedrooms
          : null,
      propertySubType: r.propertySubType?.trim() || null,
      closePrice,
      daysToContract: daysToContract(r.contractDate, r.onMarketDate),
      enteredAfterContract,
      saleToList: listPrice != null ? closePrice / listPrice : null,
    })
    if (out.length >= limit) break
  }
  return out
}
