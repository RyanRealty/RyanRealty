/**
 * How many living units the subject has, read from its own MLS records, and
 * the profile a multi-unit home is priced under.
 *
 * WHY (Matt 2026-10-14, 429 Irving). The current MLS record was typed Single
 * Family Residence at 1,629 sq ft with "a 520 sq ft ADU" in the remarks, and
 * its details carried Accessory Dwelling Unit YN = Yes, ADU SqFt = 520. The
 * record before it at the same address, a 2005 close, was PropertyType C,
 * sub type Duplex, NumberOfUnitsTotal 2, 2,300 sq ft, built 2003: the same
 * two buildings. The builder read only the newest row, classed the home
 * detached, priced it on five single-family sales, and the owner wrote back
 * that there are two units totaling 2,149 sq ft.
 *
 * THE RULE (rule 23, extended). A home is multi-unit when its own record says
 * so (PropertyType C, a Duplex / Triplex / Fourplex / Multi Family sub type,
 * NumberOfUnitsTotal of two or more, or remarks that describe the home as a
 * duplex), or when an earlier MLS record of the same structure at the address
 * says so. A multi-unit home is never priced from single-family sales. Since
 * 2026-10-14 it is priced on the multi-unit ladder instead (Matt: "build a
 * multi-unit ladder"): the resolver stamps the profile below on the subject
 * (`applyMultiUnitSubject`), which types it Duplex / Triplex / Quadruplex,
 * carries the whole building's living area, and sends every listings read to
 * PropertyType C closes (lib/cma/comps.ts, lib/pricing/select.ts). Only a
 * building of more than four units is still refused: that is income property,
 * priced on its rents, and the queue shows it as "Multi-unit home" for Matt.
 * A house with an ADU and no multi-unit record stays a detached home (rule
 * 23); its ADU is read here so the trace and the letter can state it.
 *
 * Pure. The rows are the builder's own subject rows (lib/data/cma/builderReads
 * SUBJECT_CMA_COLUMNS, which adds `details`).
 */

import { isMultiUnitSubType, multiUnitNoun, multiUnitSubTypeFor, unitsFromSubType } from '@/lib/cma/market-area'
import { aduFromRemarks, classifyProduct, multiUnitFromRemarks } from '@/lib/pricing/classes'

/** One MLS record's unit reading. */
export type SubjectUnitRecord = {
  listingKey: string | null
  mlsNumber: string | null
  propertyType: string | null
  propertySubType: string | null
  unitsTotal: number | null
  sqft: number | null
  yearBuilt: number | null
  status: string | null
  closeDate: string | null
  /** Why this record reads multi-unit. Empty when it does not. */
  reasons: string[]
  /** An MLS field types it (PropertyType C, a 2-4 unit sub type, NumberOfUnitsTotal 2-4), not the remarks alone. */
  typed: boolean
}

export type SubjectUnitFacts = {
  /** The current record itself describes a multi-unit home. */
  multiUnit: boolean
  /** ... and an MLS field types it, not the remarks alone (SubjectUnitRecord.typed). */
  multiUnitTyped: boolean
  reasons: string[]
  unitsTotal: number | null
  /** MLS Accessory Dwelling Unit YN, else the remarks' ADU reading, else null. */
  aduYn: boolean | null
  aduSqft: number | null
  aduType: string | null
  /** An earlier MLS record of the same structure at this address that reads multi-unit. */
  priorMultiUnit: SubjectUnitRecord | null
}

type Row = Record<string, unknown>

function detailsOf(row: Row): Record<string, unknown> | null {
  const d = row['details']
  if (d == null) return null
  if (typeof d === 'object' && !Array.isArray(d)) return d as Record<string, unknown>
  if (typeof d === 'string') {
    try {
      const parsed = JSON.parse(d) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  return null
}

function strOf(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s && s !== '********' ? s : null
}

function numOf(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function ynOf(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  const s = strOf(v)?.toLowerCase()
  if (!s) return null
  if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return true
  if (s === 'no' || s === 'n' || s === 'false' || s === '0') return false
  return null
}

/** Read one subject row's unit facts. */
export function unitRecordOf(row: Row): SubjectUnitRecord {
  const d = detailsOf(row)
  const propertyType = strOf(row['PropertyType']) ?? strOf(d?.['PropertyType'])
  const propertySubType = strOf(row['property_sub_type'])
  const unitsTotal = numOf(d?.['NumberOfUnitsTotal'])
  const product = classifyProduct(propertySubType)
  const reasons: string[] = []
  if (propertyType === 'C') {
    reasons.push(`PropertyType C (${strOf(d?.['PropertyTypeLabel']) ?? 'Residential Income'})`)
  }
  if (product === 'multi-unit') reasons.push(`sub type ${propertySubType}`)
  // A unit count is a duplex signal on a house or an income record. On a
  // condo or townhouse record Spark carries the building's count, and a farm
  // record carries anything, so those never read as a multi-unit home.
  const countSpeaks = propertyType === 'C' || product === 'multi-unit' || (propertyType === 'A' && (product === 'detached' || product === 'unknown'))
  if (unitsTotal != null && unitsTotal >= 2 && unitsTotal <= 4 && countSpeaks) reasons.push(`NumberOfUnitsTotal ${unitsTotal}`)
  // The typed signals are the ones above. The remarks reader is a flag for
  // Matt, never a reason to retype a home for the ladder (review 2026-10-14:
  // "next to a duplex" must not price a house from duplexes).
  const typed = reasons.length > 0
  if (multiUnitFromRemarks(strOf(row['public_remarks']))) reasons.push('remarks that describe a multi-unit home')
  return {
    listingKey: strOf(row['ListingKey']),
    mlsNumber: strOf(row['ListNumber']),
    propertyType,
    propertySubType,
    unitsTotal,
    sqft: numOf(row['TotalLivingAreaSqFt']),
    yearBuilt: numOf(row['year_built']),
    status: strOf(row['StandardStatus']),
    closeDate: strOf(row['CloseDate'])?.slice(0, 10) ?? null,
    reasons,
    typed,
  }
}

/**
 * Is the earlier record the same structure as the current one? The year built
 * decides when both records carry one (a duplex torn down for a new house is
 * a different year). Without years, the earlier living area has to sit between
 * the current one and four times it: a duplex lists the whole building where
 * the house-plus-ADU record lists the main home, and a 34,200 sq ft apartment
 * record sharing a townhouse's address is not that townhouse.
 */
export function describesSameStructure(
  current: { sqft: number | null; yearBuilt: number | null },
  prior: Pick<SubjectUnitRecord, 'sqft' | 'yearBuilt' | 'unitsTotal'>,
): boolean {
  if (prior.unitsTotal != null && prior.unitsTotal > 4) return false
  const bothSqft = current.sqft != null && current.sqft > 0 && prior.sqft != null
  // Four times the current living area is the apartment-complex guard and
  // holds with or without years.
  if (bothSqft && prior.sqft! > current.sqft! * 4) return false
  // The year decides when both records carry one. An income record may list
  // one unit's area, so no lower bound applies here.
  if (current.yearBuilt != null && prior.yearBuilt != null) return Math.abs(current.yearBuilt - prior.yearBuilt) <= 1
  return bothSqft && prior.sqft! >= current.sqft! * 0.9
}

/** The subject's unit facts from its newest row and every other row at the address. */
export function subjectUnitFacts(best: Row, pool: readonly Row[]): SubjectUnitFacts {
  const current = unitRecordOf(best)
  const d = detailsOf(best)
  const aduFromField = ynOf(d?.['Accessory Dwelling Unit YN'])
  const aduYn = aduFromField ?? (aduFromRemarks(strOf(best['public_remarks'])) ? true : null)
  // An earlier record counts only when a field typed it: a remark on an old
  // listing is not a reading of the structure.
  const prior = pool
    .filter((r) => strOf(r['ListingKey']) !== current.listingKey)
    .map(unitRecordOf)
    .filter((r) => r.typed && describesSameStructure(current, r))
    .sort((a, b) => (b.closeDate ?? '').localeCompare(a.closeDate ?? ''))[0]
  return {
    multiUnit: current.reasons.length > 0,
    multiUnitTyped: current.typed,
    reasons: current.reasons,
    unitsTotal: current.unitsTotal,
    aduYn,
    aduSqft: numOf(d?.['ADU SqFt']),
    aduType: strOf(d?.['ADU Type']),
    priorMultiUnit: prior ?? null,
  }
}

function sqftWord(n: number | null): string {
  return n != null ? `${new Intl.NumberFormat('en-US').format(Math.round(n))} sq ft` : 'no living area on record'
}

function priorSentence(prior: SubjectUnitRecord): string {
  const when = prior.closeDate ? `${(prior.status ?? 'closed').toLowerCase()} ${prior.closeDate}` : (prior.status ?? 'earlier').toLowerCase()
  const parts = [
    prior.propertySubType ? `typed ${prior.propertySubType}` : null,
    prior.unitsTotal != null ? `${prior.unitsTotal} units` : null,
    sqftWord(prior.sqft),
    prior.yearBuilt != null ? `built ${prior.yearBuilt}` : null,
  ].filter(Boolean)
  return `an earlier MLS record at this address (MLS ${prior.mlsNumber ?? prior.listingKey ?? 'unknown'}, ${when}) is ${parts.join(', ')}`
}

/** One or two sentences for the subject trace. Empty when nothing is worth saying. */
export function subjectUnitsTrace(
  facts: SubjectUnitFacts | null | undefined,
  subject: { streetAddress: string; sqft: number | null; propertySubType: string | null },
): string {
  if (!facts) return ''
  const lines: string[] = []
  if (facts.multiUnit) {
    lines.push(`The MLS record for ${subject.streetAddress} describes a multi-unit home (${facts.reasons.join('; ')}).`)
  }
  if (facts.priorMultiUnit) {
    const cur = `${subject.propertySubType ?? 'untyped'} at ${sqftWord(subject.sqft)}${facts.aduYn && facts.aduSqft ? ` with a ${sqftWord(facts.aduSqft)} ADU` : ''}`
    lines.push(`${priorSentence(facts.priorMultiUnit)[0]!.toUpperCase()}${priorSentence(facts.priorMultiUnit).slice(1)}: the same structure the current record lists as ${cur}.`)
    if (currentReadsHouseWithAdu(facts)) {
      lines.push('The current record lists a house with a recorded ADU, so the home prices as one, the way it was marketed; the earlier multi-unit record is read only as a cross-check (Matt 2026-10-14).')
    }
  } else if (facts.aduYn) {
    lines.push(
      `The MLS record lists ${facts.aduType ? `a ${facts.aduType.toLowerCase()} ` : 'an '}ADU${facts.aduSqft ? ` of ${sqftWord(facts.aduSqft)}` : ''}; the living area above is the main home.`,
    )
  }
  return lines.join(' ')
}

/** The most units the comparable-sales engine prices. Above it a building is priced on its income. */
export const MULTI_UNIT_MAX_UNITS = 4

/**
 * THE MARKET CONTEXT A 2-4 UNIT HOME IS PRICED AGAINST (review 2026-10-14).
 * pricing_market_index and the context's year-over-year figure are
 * single-family series, and both the index path and the year-over-year path
 * (adjustComps) would move a duplex sale by them. The pricing call gets the
 * context with that figure withheld; the letter's market chapters keep the
 * context as read.
 */
export function pricingMarketFor<T extends { yoyMedianPriceDeltaPct: number | null }>(
  subject: { multiUnit?: MultiUnitProfile | null },
  market: T | null,
): T | null {
  return subject.multiUnit && market ? { ...market, yoyMedianPriceDeltaPct: null } : market
}

/**
 * How a multi-unit subject is priced: its unit count, the MLS 2-4 unit sub
 * type the ladder matches on, and the whole building's living area.
 */
export type MultiUnitProfile = {
  /** Two to four, or null when no record states a count (a bare Multi Family record). */
  units: number | null
  /** Duplex, Triplex, Quadruplex or Multi Family: the sub type the product walls read. */
  propertySubType: string
  /** The whole building's living area, the number the price per square foot is read over. */
  sqft: number | null
  /** Where that area came from when it is not the current record's own figure. */
  sqftBasis: string | null
  /** Which record made the home multi-unit. */
  basis: 'current' | 'prior'
}

/**
 * The unit count a typed record states: the sub type's own word first
 * (Duplex is two whatever a stray NumberOfUnitsTotal says, the same order the
 * ladder reads a sale), then the count field. Null when neither names one.
 */
function recordUnits(subType: string | null, unitsTotal: number | null): number | null {
  return unitsFromSubType(subType) ?? unitsTotal
}

/** The typed record that makes the home multi-unit: the current one when a field types it, else the earlier one. */
function typedMultiUnitRecord(
  facts: SubjectUnitFacts,
  subject: { sqft: number | null; propertySubType: string | null },
): { basis: 'current' | 'prior'; units: number | null; subType: string | null; sqft: number | null; mls: string | null } | null {
  if (facts.multiUnit && facts.multiUnitTyped) {
    return { basis: 'current', units: recordUnits(subject.propertySubType, facts.unitsTotal), subType: subject.propertySubType, sqft: subject.sqft, mls: null }
  }
  // THE CURRENT RECORD WINS (Matt 2026-10-14, second call, 429 Irving). A
  // current record that lists a house with a recorded ADU prices as one, the
  // way it was marketed, even when an earlier record at the address was typed
  // Duplex: the earlier reading stays on priorMultiUnit as the cross-check the
  // letter prints (priorRecordMultiUnitProfile), never as the price.
  if (currentReadsHouseWithAdu(facts)) return null
  const prior = facts.priorMultiUnit
  if (!prior) return null
  return { basis: 'prior', units: recordUnits(prior.propertySubType, prior.unitsTotal), subType: prior.propertySubType, sqft: prior.sqft, mls: prior.mlsNumber ?? prior.listingKey }
}

/**
 * True when the current record lists a house with a recorded ADU: no MLS field
 * types it multi-unit, Accessory Dwelling Unit YN is Yes and ADU SqFt is on
 * record. The remarks alone do not make one (a field is a reading of the
 * structure, a remark is not).
 */
export function currentReadsHouseWithAdu(facts: Pick<SubjectUnitFacts, 'multiUnitTyped' | 'aduYn' | 'aduSqft'> | null | undefined): boolean {
  return Boolean(facts && !facts.multiUnitTyped && facts.aduYn === true && facts.aduSqft != null && facts.aduSqft > 0)
}

/**
 * THE DUPLEX CROSS-CHECK. The profile the earlier typed record would have
 * priced the home under had the current ADU record not won: the same count,
 * sub type and whole-building area the multi-unit ladder reads. The build
 * prices it on the side and the letter prints that number as a check beside
 * the house-with-ADU price, never as the price. Null when the current record
 * is not a house with a recorded ADU, when there is no earlier typed record,
 * or when that record could not be priced (count or area missing).
 */
export function priorRecordMultiUnitProfile(
  facts: SubjectUnitFacts | null | undefined,
  subject: { sqft: number | null; propertySubType: string | null },
): MultiUnitProfile | null {
  if (!facts || !facts.priorMultiUnit || !currentReadsHouseWithAdu(facts)) return null
  const prior = facts.priorMultiUnit
  const units = recordUnits(prior.propertySubType, prior.unitsTotal)
  if (units == null || units < 2 || units > MULTI_UNIT_MAX_UNITS) return null
  const area = wholeBuildingArea(facts, subject.sqft, { sqft: prior.sqft, subType: prior.propertySubType, mls: prior.mlsNumber ?? prior.listingKey })
  if (!area) return null
  return { units, propertySubType: multiUnitSubTypeFor(units), sqft: area.sqft, sqftBasis: area.basis, basis: 'prior' }
}

/**
 * The whole building's living area on a prior-record reading, where the
 * current record lists the main home alone: that area plus the recorded ADU
 * area when the record states an ADU (1,629 + 520 = 2,149 for 429 Irving, the
 * figure the owner gave); else the earlier record's area, and only when it is
 * larger than the current one, because an income record may list one unit's
 * area (review 2026-10-14: a 900 sq ft prior figure must never shrink an
 * 1,800 sq ft home). Null when the building's area is not on record.
 */
function wholeBuildingArea(
  facts: SubjectUnitFacts,
  current: number | null,
  prior: { sqft: number | null; subType: string | null; mls: string | null },
): { sqft: number; basis: string } | null {
  if (current != null && current > 0 && facts.aduYn === true && facts.aduSqft != null && facts.aduSqft > 0) {
    return { sqft: current + facts.aduSqft, basis: `the current record's ${sqftWord(current)} main home plus its ${sqftWord(facts.aduSqft)} ADU` }
  }
  if (prior.sqft != null && prior.sqft > 0 && (current == null || current <= 0 || prior.sqft > current)) {
    return { sqft: prior.sqft, basis: `the earlier ${prior.subType ?? 'multi-unit'} record (MLS ${prior.mls ?? 'unknown'})` }
  }
  return null
}

/**
 * The profile a multi-unit subject is priced under, or null when the ladder
 * cannot price it (multiUnitSubjectRefusal says why) or the home is not
 * multi-unit. Only a typed record makes one: PropertyType C, a 2-4 unit sub
 * type, or NumberOfUnitsTotal of two to four, on the current record or an
 * earlier record of the same structure. The count has to be two to four, and
 * the building's living area has to be on record.
 */
export function multiUnitProfile(
  facts: SubjectUnitFacts | null | undefined,
  subject: { sqft: number | null; propertySubType: string | null },
): MultiUnitProfile | null {
  if (!facts) return null
  const record = typedMultiUnitRecord(facts, subject)
  if (!record || record.units == null || record.units < 2 || record.units > MULTI_UNIT_MAX_UNITS) return null
  const propertySubType = multiUnitSubTypeFor(record.units)
  if (record.basis === 'current') {
    if (subject.sqft == null || subject.sqft <= 0) return null
    return { units: record.units, propertySubType, sqft: subject.sqft, sqftBasis: null, basis: 'current' }
  }
  const area = wholeBuildingArea(facts, subject.sqft, record)
  if (!area) return null
  return { units: record.units, propertySubType, sqft: area.sqft, sqftBasis: area.basis, basis: 'prior' }
}

/**
 * Stamp the profile on the subject so every pricing build reads one field:
 * the sub type becomes the 2-4 unit product, the segment C, and the living
 * area the whole building's. Returns the profile, or null when the home is
 * not multi-unit (the subject is untouched then). A broker's own facts
 * (applySubjectFactOverrides) still win afterwards.
 */
export function applyMultiUnitSubject(subject: {
  sqft: number | null
  propertySubType: string | null
  propertyType?: string | null
  units?: SubjectUnitFacts | null
  multiUnit?: MultiUnitProfile | null
}): MultiUnitProfile | null {
  const profile = multiUnitProfile(subject.units, subject)
  if (!profile) return null
  subject.multiUnit = profile
  subject.propertySubType = profile.propertySubType
  subject.propertyType = 'C'
  if (profile.sqft != null && profile.sqft > 0) subject.sqft = profile.sqft
  return profile
}

/** One sentence for the subject trace: how a multi-unit home is priced. Empty for any other home. */
export function multiUnitSubjectTrace(profile: MultiUnitProfile | null | undefined): string {
  if (!profile) return ''
  const noun = multiUnitNoun(profile.propertySubType) ?? 'multi-unit home'
  const count = profile.units != null ? `${profile.units} units, ` : ''
  const area = profile.sqft != null ? `${sqftWord(profile.sqft)}${profile.sqftBasis ? `: ${profile.sqftBasis}` : ''}` : 'no living area on record'
  const from = profile.units != null ? `closed ${noun} sales` : 'closed two- to four-unit sales'
  return `Priced as a ${noun} (${count}${area}) from ${from} on the multi-unit ladder, never from single-family sales (rule 23, Matt 2026-10-14).`
}

/**
 * The build refusal for a multi-unit subject the ladder cannot price, or null
 * when the home may be priced (a profile was stamped) or is not multi-unit.
 * Since 2026-10-14 a typed two- to four-unit home with its building's area
 * on record prices on the multi-unit ladder; what is refused is a reading
 * the remarks alone made, a record with no unit count, a building of more
 * than four units, and a building whose living area is not on record. The
 * sentence opens "Multi-unit home:" so the queue files it under that reason
 * for Matt (lib/cma/queue-view.ts).
 */
export function multiUnitSubjectRefusal(subject: {
  streetAddress: string
  sqft: number | null
  propertySubType: string | null
  units?: SubjectUnitFacts | null
  multiUnit?: MultiUnitProfile | null
}): string | null {
  const facts = subject.units
  if (!facts) return null
  if (subject.multiUnit || multiUnitProfile(facts, subject)) return null
  // A house with a recorded ADU is a house (Matt 2026-10-14, second call),
  // unless the current record's own remarks describe a multi-unit home: that
  // reading is still refused for Matt below (review 2026-10-15).
  if (currentReadsHouseWithAdu(facts) && !facts.multiUnit) return null
  const byHand = 'This letter is not built. Matt prices it by hand.'
  const record = typedMultiUnitRecord(facts, subject)
  if (!record) {
    if (!facts.multiUnit) return null
    return `Multi-unit home: the remarks for ${subject.streetAddress} describe a multi-unit home, but no MLS field types it (PropertyType, sub type or NumberOfUnitsTotal), so the multi-unit ladder cannot read its unit count (rule 23). ${byHand}`
  }
  const opener =
    record.basis === 'current'
      ? `Multi-unit home: the MLS record for ${subject.streetAddress} describes a multi-unit home (${facts.reasons.join('; ')}).`
      : `Multi-unit home: ${priorSentence(facts.priorMultiUnit!)}, the same structure as the current record.`
  if (record.units == null) {
    return `${opener} No MLS record states its unit count, so the multi-unit ladder cannot match it to two- to four-unit sales (rule 23). ${byHand}`
  }
  if (record.units > MULTI_UNIT_MAX_UNITS) {
    return `${opener} A building of ${record.units} units is priced on its income, not on comparable sales, and this engine prices two- to four-unit homes only (rule 23). ${byHand}`
  }
  if (record.units < 2) {
    return `${opener} Its record states ${record.units} unit, so it is not a two- to four-unit home for the ladder (rule 23). ${byHand}`
  }
  const current = subject.sqft != null && subject.sqft > 0 ? sqftWord(subject.sqft) : 'no living area'
  const earlier = record.sqft != null ? sqftWord(record.sqft) : 'no living area'
  return `${opener} The whole building's living area is not on record (the current record lists ${current} and the earlier record ${earlier}, with no recorded ADU area to add), so a price per square foot cannot be read (rule 23). ${byHand}`
}
