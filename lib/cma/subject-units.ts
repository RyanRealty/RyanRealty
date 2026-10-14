/**
 * How many living units the subject has, read from its own MLS records.
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
 * says so. A multi-unit home is never priced from single-family sales, and the
 * comp pool (sale_pricing_facts, PropertyType A only) holds no multi-unit
 * sales, so the build refuses with a named reason and the queue shows it as
 * "Multi-unit home" for Matt. A house with an ADU and no multi-unit record
 * stays a detached home (rule 23); its ADU is read here so the trace and the
 * letter can state it.
 *
 * Pure. The rows are the builder's own subject rows (lib/data/cma/builderReads
 * SUBJECT_CMA_COLUMNS, which adds `details`).
 */

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
}

export type SubjectUnitFacts = {
  /** The current record itself describes a multi-unit home. */
  multiUnit: boolean
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
  const prior = pool
    .filter((r) => strOf(r['ListingKey']) !== current.listingKey)
    .map(unitRecordOf)
    .filter((r) => r.reasons.length > 0 && describesSameStructure(current, r))
    .sort((a, b) => (b.closeDate ?? '').localeCompare(a.closeDate ?? ''))[0]
  return {
    multiUnit: current.reasons.length > 0,
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
  } else if (facts.aduYn) {
    lines.push(
      `The MLS record lists ${facts.aduType ? `a ${facts.aduType.toLowerCase()} ` : 'an '}ADU${facts.aduSqft ? ` of ${sqftWord(facts.aduSqft)}` : ''}; the living area above is the main home.`,
    )
  }
  return lines.join(' ')
}

/**
 * The build refusal for a multi-unit subject, or null when the home may be
 * priced. The sentence opens "Multi-unit home:" so the queue files it under
 * that reason (lib/cma/queue-view.ts).
 */
export function multiUnitSubjectRefusal(subject: {
  streetAddress: string
  sqft: number | null
  propertySubType: string | null
  units?: SubjectUnitFacts | null
}): string | null {
  const facts = subject.units
  if (!facts) return null
  const close =
    'A multi-unit home is priced from multi-unit sales only (rule 23), and the comp pool holds single-family sales, so this letter is not built. Matt prices it by hand.'
  if (facts.multiUnit) {
    return `Multi-unit home: the MLS record for ${subject.streetAddress} describes a multi-unit home (${facts.reasons.join('; ')}). ${close}`
  }
  if (facts.priorMultiUnit) {
    const cur = `${subject.propertySubType ?? 'untyped'} at ${sqftWord(subject.sqft)}${facts.aduYn && facts.aduSqft ? ` with a ${sqftWord(facts.aduSqft)} ADU` : ''}`
    return `Multi-unit home: ${priorSentence(facts.priorMultiUnit)}, the same structure the current record lists as ${cur}. ${close}`
  }
  return null
}
