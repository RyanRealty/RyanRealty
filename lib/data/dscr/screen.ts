import 'server-only'

/**
 * DSCR investment screen — every active listing a DSCR lender would finance,
 * scored on debt-service coverage and true cash flow.
 *
 * Rent is the one input the MLS cannot supply (populated on ~4% of listings),
 * so it comes from `dscr_rent_estimates` (Zillow rentZestimate, property-level).
 * That table also carries measured tax, HOA and insurance, which replace the
 * modelled percentages wherever present.
 *
 * Two numbers matter and they are not the same:
 *   DSCR      = gross rent / PITIA. The lender's test. Ignores operating costs.
 *   Cash flow = rent x (1 - opex) - PITIA. What actually lands in your pocket.
 * A property can clear DSCR 1.02 and still lose ~$500/mo, so both are surfaced.
 *
 * Oregon Measure 50: assessed value is capped and does NOT reset on sale, so a
 * reported tax bill carries forward to a buyer. Reported tax is always preferred
 * over a percentage of price, and `maxPriceForDscr` holds tax constant while
 * scaling only insurance.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface DscrAssumptions {
  /** DSCR investor rate. Market is 6.125–7.5% (Aug 2026); 6.875% is mid-band at 75–80% LTV. */
  ratePct: number
  downPct: number
  termYears: number
  /** Fallbacks only, used when the property has no measured figure. */
  taxRatePct: number
  insuranceRatePct: number
  closingCostPct: number
  vacancyPct: number
  mgmtPct: number
  maintPct: number
  capexPct: number
}

export const DSCR_DEFAULTS: DscrAssumptions = {
  ratePct: 6.875,
  downPct: 25,
  termYears: 30,
  taxRatePct: 1.2,
  insuranceRatePct: 0.35,
  closingCostPct: 1.5,
  vacancyPct: 5,
  mgmtPct: 8,
  maintPct: 5,
  capexPct: 5,
}

export interface DscrRow {
  listingKey: string
  listNumber: string | null
  address: string
  city: string | null
  county: string | null
  subdivision: string | null
  propertySubType: string | null
  photoUrl: string | null
  listingUrl: string
  price: number
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
  dom: number | null
  unitsTotal: number | null
  strPermit: boolean
  aduYn: boolean

  rent: number | null
  rentSource: string | null
  taxAnnual: number
  taxMeasured: boolean
  hoaMonthly: number
  insuranceAnnual: number

  pi: number
  pitia: number
  /** Rent required to reach DSCR 1.00 — equals PITIA. Needs no rent source. */
  rentForDscr1: number
  /** Rent required for genuinely positive cash flow after operating costs. */
  rentForPositiveCf: number

  dscr: number | null
  cashFlowMonthly: number | null
  cashNeeded: number
  cashOnCashPct: number | null

  /** Price at which this property would hit DSCR 1.00 on its rent. */
  maxPriceForDscr: number | null
  /** Dollars off asking required to get there. Negative = must come down. */
  priceDelta: number | null
  priceDeltaPct: number | null
}

function monthlyPI(loan: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12
  const n = years * 12
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n))
}

const EXCLUDED_SUBTYPES = ['In Park', 'Residential Leased Land', 'Tenancy in Common', 'On Leased Land', 'Timeshare']
/** DSCR loans need real property and clear a minimum loan amount (~$100K). */
const MIN_PRICE = 133_000
/**
 * Central Oregon — the brokerage's service area, matching lib/hud-fmr.ts.
 * The listings table spans 31 counties (a lot of southern Oregon), so without
 * this the screen ranks Klamath Falls and Grants Pass above everything local.
 */
export const CENTRAL_OREGON_COUNTIES = ['Deschutes', 'Crook', 'Jefferson'] as const

export async function getDscrScreen(
  a: DscrAssumptions = DSCR_DEFAULTS,
  opts: { counties?: readonly string[] | null } = {},
): Promise<DscrRow[]> {
  const counties = opts.counties === undefined ? CENTRAL_OREGON_COUNTIES : opts.counties
  const sb = createServiceClient()

  const listings: Record<string, unknown>[] = []
  for (let from = 0; ; from += 1000) {
    let q = sb
      .from('listing_search_mv')
      .select(
        'listing_key,list_number,street_number,street_name,street_suffix,city,county,subdivision_name,property_sub_type,photo_url,list_price,beds,baths,sqft,year_built,dom,units_total,str_permit_yn,adu_yn,tax_annual_amount,hoa_monthly',
      )
      .eq('standard_status', 'Active')
      .in('property_type', ['A', 'B', 'C'])
      .not('property_sub_type', 'in', `(${EXCLUDED_SUBTYPES.map((s) => `"${s}"`).join(',')})`)
      .gte('list_price', MIN_PRICE)
    if (counties?.length) q = q.in('county', counties)
    const { data, error } = await q.order('listing_key', { ascending: true }).range(from, from + 999)
    if (error) {
      console.error('[getDscrScreen] listings', error.message)
      return []
    }
    listings.push(...data)
    if (data.length < 1000) break
  }

  const rents: Record<string, Record<string, unknown>> = {}
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('dscr_rent_estimates')
      .select('listing_key,rent,source,tax_annual,hoa_monthly,insurance_annual,listing_url')
      .order('listing_key', { ascending: true })
      .range(from, from + 999)
    if (error) {
      console.error('[getDscrScreen] rents', error.message)
      break
    }
    for (const r of data) rents[r.listing_key as string] = r
    if (data.length < 1000) break
  }

  const opexSurvival = 1 - (a.vacancyPct + a.mgmtPct + a.maintPct + a.capexPct) / 100
  const r = a.ratePct / 100 / 12
  const payFactor = r / (1 - Math.pow(1 + r, -a.termYears * 12))

  const rows: DscrRow[] = listings.map((l) => {
    const est = rents[l.listing_key as string]
    const price = Number(l.list_price)

    // Prefer measured figures; fall back to the MLS field, then to a rate.
    const taxReported = est?.tax_annual ?? l.tax_annual_amount
    const taxAnnual = taxReported != null ? Number(taxReported) : price * (a.taxRatePct / 100)
    const hoaMonthly = Number(est?.hoa_monthly ?? l.hoa_monthly ?? 0)
    const insuranceAnnual =
      est?.insurance_annual != null ? Number(est.insurance_annual) : price * (a.insuranceRatePct / 100)

    const loan = price * (1 - a.downPct / 100)
    const pi = monthlyPI(loan, a.ratePct, a.termYears)
    const pitia = pi + taxAnnual / 12 + insuranceAnnual / 12 + hoaMonthly

    const rent = est?.rent != null ? Number(est.rent) : null
    const dscr = rent ? rent / pitia : null
    const cashFlowMonthly = rent ? rent * opexSurvival - pitia : null
    const cashNeeded = price * (a.downPct / 100 + a.closingCostPct / 100)

    // Solve for the price where rent == PITIA. Tax is held constant (Measure 50);
    // insurance scales with price.
    const denom = (1 - a.downPct / 100) * payFactor + a.insuranceRatePct / 100 / 12
    const maxPriceForDscr = rent ? (rent - taxAnnual / 12 - hoaMonthly) / denom : null

    return {
      listingKey: l.listing_key as string,
      listNumber: (l.list_number as string) ?? null,
      address: [l.street_number, l.street_name, l.street_suffix].filter(Boolean).join(' '),
      city: (l.city as string) ?? null,
      county: (l.county as string) ?? null,
      subdivision: (l.subdivision_name as string) ?? null,
      propertySubType: (l.property_sub_type as string) ?? null,
      photoUrl: (l.photo_url as string) ?? null,
      listingUrl: `/listing/${l.listing_key}`,
      price,
      beds: l.beds != null ? Number(l.beds) : null,
      baths: l.baths != null ? Number(l.baths) : null,
      sqft: l.sqft != null ? Number(l.sqft) : null,
      yearBuilt: l.year_built != null ? Number(l.year_built) : null,
      dom: l.dom != null ? Number(l.dom) : null,
      unitsTotal: l.units_total != null ? Number(l.units_total) : null,
      strPermit: l.str_permit_yn === true,
      aduYn: l.adu_yn === true,

      rent,
      rentSource: (est?.source as string) ?? null,
      taxAnnual,
      taxMeasured: taxReported != null,
      hoaMonthly,
      insuranceAnnual,

      pi,
      pitia,
      rentForDscr1: pitia,
      rentForPositiveCf: pitia / opexSurvival,

      dscr,
      cashFlowMonthly,
      cashNeeded,
      cashOnCashPct: cashFlowMonthly != null ? ((cashFlowMonthly * 12) / cashNeeded) * 100 : null,

      maxPriceForDscr,
      priceDelta: maxPriceForDscr != null ? maxPriceForDscr - price : null,
      priceDeltaPct: maxPriceForDscr != null ? (maxPriceForDscr / price - 1) * 100 : null,
    }
  })

  // Best first: scored properties by DSCR desc, unscored last.
  return rows.sort((x, y) => (y.dscr ?? -1) - (x.dscr ?? -1))
}
