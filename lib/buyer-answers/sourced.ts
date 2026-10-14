/**
 * HOA master assessments and STR rules that are already in committed JSON.
 * Nothing here is inferred. A missing field means no page.
 *
 * Master annuals: data/resort-community-{tetherow,sunriver,caldera-springs}.json
 * STR: data/resort-community-tetherow.json (TOA 30-day / 38-week VR) and
 * data/resort-community-pronghorn.json (Four Peaks nightly).
 */
import tetherowRich from '@/data/resort-community-tetherow.json' assert { type: 'json' }
import sunriverRich from '@/data/resort-community-sunriver.json' assert { type: 'json' }
import calderaRich from '@/data/resort-community-caldera-springs.json' assert { type: 'json' }
import type { SourcedStrFact } from './types'

function masterAnnual(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null
  return raw
}

const MASTER_HOA_BY_DURABLE: Record<string, number> = (() => {
  const map: Record<string, number> = {}
  const tetherow = masterAnnual((tetherowRich as { hoa_master_assessment_annual?: unknown }).hoa_master_assessment_annual)
  const sunriver = masterAnnual((sunriverRich as { hoa_master_assessment_annual?: unknown }).hoa_master_assessment_annual)
  const caldera = masterAnnual((calderaRich as { hoa_master_assessment_annual?: unknown }).hoa_master_assessment_annual)
  if (tetherow != null) map.tetherow = tetherow
  if (sunriver != null) map.sunriver = sunriver
  if (caldera != null) map['caldera-springs'] = caldera
  return map
})()

/** Durable registry slugs that have a sourced master HOA annual. */
export const MASTER_HOA_DURABLE_SLUGS: readonly string[] = Object.freeze(Object.keys(MASTER_HOA_BY_DURABLE))

export function masterHoaAnnual(durableSlug: string): number | null {
  return MASTER_HOA_BY_DURABLE[durableSlug] ?? null
}

/**
 * STR facts copied from sourced resort JSON. Do not add a community that
 * only mentions rentals in marketing prose.
 */
const STR_BY_PUBLIC: Record<string, SourcedStrFact> = {
  tetherow: {
    summary:
      'Tetherow Owners Association rules require leases of 30 days or longer on standard homes. Only designated vacation-rental homes, mainly the production cottages in Trailhead and the townhomes at Triple Knot, may operate short-term, and those must stay available at least 38 weeks a year.',
    sourceLabel: 'Tetherow Owners Association FAQ',
    sourceHref: 'https://www.tetherowowners.com/f-a-q.html',
  },
  'juniper-preserve': {
    summary:
      'At Juniper Preserve, homes in Four Peaks can be set up as nightly or short-term rentals. The other neighborhoods on the property are not described that way in the sourced resort notes.',
    sourceLabel: 'Juniper Preserve real estate page',
    sourceHref: 'https://juniperpreserve.com/real-estate/',
  },
}

export const STR_PUBLIC_SLUGS: readonly string[] = Object.freeze(Object.keys(STR_BY_PUBLIC))

export function sourcedStr(publicSlug: string): SourcedStrFact | null {
  return STR_BY_PUBLIC[publicSlug] ?? null
}
