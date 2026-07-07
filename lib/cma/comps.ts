/**
 * CMA comp selection — tiered widening per the CMA producer skill (step 4):
 * subdivision first (24 months), then same-zip, then city, loosening the
 * sqft band last. Stops at the first tier stack that yields >= MIN_COMPS,
 * caps at MAX_COMPS ordered by similarity, drops $/sqft outliers beyond two
 * standard deviations when enough comps remain.
 */

import { selectCmaCompsPool } from '@/lib/data'
import type { CmaListingRow } from '@/lib/data'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

export const MIN_COMPS = 3
export const TARGET_COMPS = 6
export const MAX_COMPS = 10

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : null
  return s || null
}

function rowToComp(row: CmaListingRow, tier: string): CmaComp | null {
  const closePrice = num(row['ClosePrice'])
  const sqft = num(row['TotalLivingAreaSqFt'])
  const closeDate = str(row['CloseDate'])
  const listingKey = str(row['ListingKey'])
  if (!closePrice || closePrice <= 0 || !sqft || sqft < 300 || !closeDate || !listingKey) return null
  const pendingTs = str(row['pending_timestamp'])
  const onMarket = str(row['OnMarketDate']) ?? str(row['ListDate'])
  let daysToOffer = num(row['days_to_pending'])
  if (daysToOffer == null && pendingTs && onMarket) {
    const ms = new Date(pendingTs).getTime() - new Date(onMarket).getTime()
    if (Number.isFinite(ms) && ms >= 0) daysToOffer = Math.round(ms / 86_400_000)
  }
  return {
    listingKey,
    mlsNumber: str(row['ListNumber']),
    address: `${str(row['StreetNumber']) ?? ''} ${str(row['StreetName']) ?? ''}`.trim(),
    city: str(row['City']) ?? '',
    subdivision: str(row['SubdivisionName']),
    latitude: num(row['Latitude']),
    longitude: num(row['Longitude']),
    beds: num(row['BedroomsTotal']),
    baths: num(row['BathroomsTotal']),
    sqft,
    lotAcres: num(row['lot_size_acres']),
    yearBuilt: num(row['year_built']),
    photoUrl: str(row['PhotoURL']),
    publicRemarks: str(row['public_remarks']),
    viewDescription: str(row['view_description']),
    taxAnnual: num(row['tax_annual_amount']),
    listPrice: num(row['ListPrice']),
    closePrice,
    closeDate: closeDate.slice(0, 10),
    daysToOffer,
    domTotal: num(row['CumulativeDaysOnMarket']) ?? num(row['DaysOnMarket']),
    selectionTier: tier,
  }
}

function isoMonthsAgo(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

function similarityScore(subjectSqft: number, comp: CmaComp): number {
  const sizeProximity = 1 / (1 + Math.abs(subjectSqft - comp.sqft) / subjectSqft)
  const months = Math.max(0, (Date.now() - new Date(comp.closeDate).getTime()) / (30.44 * 86_400_000))
  const recency = 1 / (1 + months / 12)
  return sizeProximity * recency
}

export interface CompSelection {
  comps: CmaComp[]
  excludedOutliers: Array<{ address: string; closePrice: number; ppsf: number; reason: string }>
  tiersUsed: string[]
  trace: string[]
}

/**
 * Select 6-10 closed comps for the subject. Every query filter is recorded in
 * the trace for citations.
 */
export async function selectComps(subject: CmaSubject): Promise<CompSelection> {
  const sqft = subject.sqft ?? 0
  if (!sqft || !subject.city) {
    return { comps: [], excludedOutliers: [], tiersUsed: [], trace: ['Subject is missing sqft or city — comps cannot be selected.'] }
  }
  const trace: string[] = []
  const tiersUsed: string[] = []
  const byKey = new Map<string, CmaComp>()

  // Acreage comparability: only constrain lot size when the subject is on acreage.
  const lotMin = subject.lotAcres != null && subject.lotAcres >= 1 ? +(subject.lotAcres * 0.4).toFixed(2) : null
  const lotMax = subject.lotAcres != null && subject.lotAcres >= 1 ? +(subject.lotAcres * 2.5).toFixed(2) : null

  const tiers: Array<{
    name: string
    subdivisionIlike?: string | null
    postalCode?: string | null
    monthsBack: number
    sqftBand: number
    useLot: boolean
  }> = [
    { name: 'subdivision-24mo', subdivisionIlike: subject.subdivision, monthsBack: 24, sqftBand: 0.25, useLot: true },
    { name: 'zip-12mo', postalCode: subject.postalCode, monthsBack: 12, sqftBand: 0.25, useLot: true },
    { name: 'city-12mo', monthsBack: 12, sqftBand: 0.25, useLot: true },
    { name: 'city-24mo-wide', monthsBack: 24, sqftBand: 0.35, useLot: false },
  ]

  for (const tier of tiers) {
    if (tier.name.startsWith('subdivision') && !tier.subdivisionIlike) continue
    if (tier.name.startsWith('zip') && !tier.postalCode) continue
    const sqftMin = Math.round(sqft * (1 - tier.sqftBand))
    const sqftMax = Math.round(sqft * (1 + tier.sqftBand))
    const closeDateGte = isoMonthsAgo(tier.monthsBack)
    const rows = await selectCmaCompsPool({
      cityIlike: subject.city,
      subdivisionIlike: tier.subdivisionIlike ?? null,
      postalCode: tier.postalCode ?? null,
      closeDateGte,
      sqftMin,
      sqftMax,
      lotMin: tier.useLot ? lotMin : null,
      lotMax: tier.useLot ? lotMax : null,
      limit: 50,
    })
    let added = 0
    for (const row of rows) {
      const comp = rowToComp(row, tier.name)
      if (!comp) continue
      if (subject.listingKey && comp.listingKey === subject.listingKey) continue
      if (subject.streetAddress && comp.address.toLowerCase() === subject.streetAddress.toLowerCase()) continue
      if (!byKey.has(comp.listingKey)) {
        byKey.set(comp.listingKey, comp)
        added++
      }
    }
    trace.push(
      `Tier ${tier.name}: listings WHERE StandardStatus ILIKE '%Closed%' AND PropertyType='A' AND ClosePrice>0 AND CloseDate>='${closeDateGte}' AND City ILIKE '${subject.city}'${tier.subdivisionIlike ? ` AND SubdivisionName ILIKE '${tier.subdivisionIlike}'` : ''}${tier.postalCode ? ` AND PostalCode='${tier.postalCode}'` : ''} AND TotalLivingAreaSqFt BETWEEN ${sqftMin} AND ${sqftMax}${tier.useLot && lotMin != null ? ` AND lot_size_acres BETWEEN ${lotMin} AND ${lotMax}` : ''}. Returned ${rows.length} rows, ${added} new comps.`,
    )
    if (added > 0) tiersUsed.push(tier.name)
    if (byKey.size >= TARGET_COMPS) break
  }

  let comps = Array.from(byKey.values())

  // Outlier exclusion: drop $/sqft beyond 2 standard deviations, only when the
  // set stays at or above MIN_COMPS afterward.
  const excludedOutliers: CompSelection['excludedOutliers'] = []
  if (comps.length >= TARGET_COMPS) {
    const ppsfs = comps.map((c) => c.closePrice / c.sqft)
    const mean = ppsfs.reduce((a, b) => a + b, 0) / ppsfs.length
    const sd = Math.sqrt(ppsfs.reduce((a, b) => a + (b - mean) ** 2, 0) / ppsfs.length)
    if (sd > 0) {
      const kept: CmaComp[] = []
      for (const c of comps) {
        const ppsf = c.closePrice / c.sqft
        if (Math.abs(ppsf - mean) > 2 * sd && comps.length - excludedOutliers.length > MIN_COMPS) {
          excludedOutliers.push({
            address: c.address,
            closePrice: c.closePrice,
            ppsf: Math.round(ppsf),
            reason: `$${Math.round(ppsf)}/sqft is more than 2 standard deviations from the set mean of $${Math.round(mean)}/sqft`,
          })
        } else {
          kept.push(c)
        }
      }
      comps = kept
      if (excludedOutliers.length > 0) {
        trace.push(`Excluded ${excludedOutliers.length} $/sqft outlier(s) beyond 2 standard deviations of the set mean.`)
      }
    }
  }

  // Rank by similarity (size proximity x recency) and cap.
  comps.sort((a, b) => similarityScore(sqft, b) - similarityScore(sqft, a))
  comps = comps.slice(0, MAX_COMPS)
  // Present most recent first (matches the exemplar ordering).
  comps.sort((a, b) => b.closeDate.localeCompare(a.closeDate))

  trace.push(`Final comp set: ${comps.length} closed sales (tiers: ${tiersUsed.join(', ') || 'none'}).`)
  return { comps, excludedOutliers, tiersUsed, trace }
}
