/**
 * Sarah public-records tools: classify, look up, and answer.
 * Phone and web import this. Voice-sip is not edited here; it can call
 * LOOKUP_PUBLIC_RECORDS_TOOL / runLookupPublicRecords.
 */
import type { SarahListingFacts } from '@/lib/data/sarah/listing-facts'
import { extractShopPhrase } from './listing-answer'
import { activePermits, pickShopPermit } from './public-records-parse'
import {
  lookupPublicRecords,
  type PublicRecordsBundle,
  type PublicRecordsDeps,
  type PublicRecordsSubject,
} from './public-records-lookup'
import {
  DEFAULT_DESK_BROKER_FIRST_NAME,
  LET_ME_FIND_OUT_EN,
  PUBLIC_RECORDS_NOT_FOUND_EN,
  PUBLIC_RECORDS_NOT_LEGAL_EN,
  PUBLIC_RECORDS_VERIFY_EN,
  publicRecordsBrokerOfferEn,
} from './scripts'

export {
  clearPublicRecordsCache,
  lookupPublicRecords,
  DIAL_HOME,
  DIAL_PERMITS_URL,
  DESCHUTES_ZONING_LAYER,
} from './public-records-lookup'
export type { PublicRecordsBundle, PublicRecordsDeps, PublicRecordsSubject } from './public-records-lookup'
export { parseDialPermitsHtml, pickShopPermit } from './public-records-parse'

export const LOOKUP_PUBLIC_RECORDS_TOOL = {
  type: 'function',
  name: 'lookup_public_records',
  description:
    'Look up public property records for permits, zoning, ADUs, lot rules, or outbuildings. Use when you do not already have the fact. Prefer stored listing parcel and address. Report only what the records show, with the source link. Never give a legal determination.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      streetNumber: { type: 'string' },
      streetName: { type: 'string' },
      city: { type: 'string' },
      county: { type: 'string' },
      parcelNumber: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
    },
    required: ['question'],
  },
} as const

const PERMIT_RE = /\bpermits?\b/i
const ADU_RE = /\b(adu|accessory dwelling|guest house|in-law)\b/i
const ZONING_RE =
  /\b(zon(e|ing)|lot rules?|setback|outbuildings?|can I (build|add)|allowed to build)\b/i
const SHOP_RE = /\b(shop|workshop|barn|shed|studio)\b/i

export type PublicRecordsIntent = 'permit' | 'adu' | 'zoning' | null

export function classifyPublicRecordsQuestion(question: string): PublicRecordsIntent {
  const q = question.trim()
  if (!q) return null
  if (PERMIT_RE.test(q)) return 'permit'
  if (ADU_RE.test(q)) return 'adu'
  if (ZONING_RE.test(q)) return 'zoning'
  return null
}

function brokerName(first: string): string {
  return first.trim() || DEFAULT_DESK_BROKER_FIRST_NAME
}

function joinSentences(parts: string[]): string {
  return parts
    .map((p) => p.replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim())
    .filter(Boolean)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(' ')
}

function cite(bundle: PublicRecordsBundle, fallbackUrl: string): { label: string; url: string } {
  const row = bundle.citations[0]
  return { label: row?.source ?? 'public records', url: row?.url ?? fallbackUrl }
}

function permitAnswer(
  question: string,
  facts: SarahListingFacts | null,
  bundle: PublicRecordsBundle,
  broker: string,
): string {
  const permits = activePermits(bundle.permits?.permits ?? [])
  const shop = pickShopPermit(permits)
  const remarksShop = facts ? extractShopPhrase(facts.publicRemarks) : null
  const source = bundle.permits?.sourceUrl ?? cite(bundle, 'https://dial.deschutes.org').url
  const parts: string[] = [LET_ME_FIND_OUT_EN]

  if (shop) {
    const year = shop.year ? ` in ${shop.year}` : ''
    const label = shop.name ?? shop.type ?? 'building'
    parts.push(`It looks like there was a permit for a ${label}${year}`)
    if (shop.id) parts.push(`DIAL lists it as ${shop.id}${shop.status ? ` (${shop.status.toLowerCase()})` : ''}`)
    parts.push(`Source: Deschutes County DIAL ${source}`)
  } else if (permits.length > 0) {
    const first = permits[0]
    const when = first.year ? ` from ${first.year}` : first.date ? ` dated ${first.date}` : ''
    parts.push(
      `Deschutes County DIAL shows a ${first.status ? first.status.toLowerCase() : ''} ${first.type ?? 'building'} permit ${first.id}${when}`.replace(/\s+/g, ' '),
    )
    if (SHOP_RE.test(question) && remarksShop) {
      parts.push(`The listing describes ${remarksShop}`)
      parts.push('The permit record does not name the shop specifically')
    } else if (SHOP_RE.test(question)) {
      parts.push('The permit record does not name a shop')
    }
    parts.push(`Source: Deschutes County DIAL ${source}`)
  } else {
    parts.push(PUBLIC_RECORDS_NOT_FOUND_EN)
    if (remarksShop) parts.push(`The listing describes ${remarksShop}`)
  }

  parts.push(PUBLIC_RECORDS_VERIFY_EN)
  parts.push(publicRecordsBrokerOfferEn(broker))
  return joinSentences(parts)
}

function aduAnswer(bundle: PublicRecordsBundle, broker: string): string {
  const parts: string[] = [LET_ME_FIND_OUT_EN]
  const zone = bundle.zone
  if (zone && (zone.adu === 'allowed' || zone.adu === 'conditional')) {
    const how = zone.adu === 'conditional' ? 'may be allowed with conditions' : 'are generally allowed'
    const limits = zone.limits ? ` with these limits: ${zone.limits}` : ''
    parts.push(
      `Based on the code, ADUs ${how} in ${zone.code} (${zone.name})${limits}, a broker or the city can confirm`,
    )
    parts.push(`${zone.sourceCite}: ${zone.sourceUrl}`)
    parts.push(PUBLIC_RECORDS_VERIFY_EN)
    parts.push(PUBLIC_RECORDS_NOT_LEGAL_EN)
  } else if (zone && zone.adu === 'not-permitted') {
    parts.push(
      `Based on the code, ADUs are generally not listed as a permitted use in ${zone.code} (${zone.name}), a broker or the city can confirm`,
    )
    parts.push(`${zone.sourceCite}: ${zone.sourceUrl}`)
    parts.push(PUBLIC_RECORDS_VERIFY_EN)
    parts.push(PUBLIC_RECORDS_NOT_LEGAL_EN)
  } else if (zone) {
    parts.push(
      `The records show this lot is ${zone.code} (${zone.name}). The code page does not give a clear ADU rule I can read`,
    )
    parts.push(`${zone.sourceCite}: ${zone.sourceUrl}`)
    parts.push(PUBLIC_RECORDS_VERIFY_EN)
    parts.push(PUBLIC_RECORDS_NOT_LEGAL_EN)
  } else {
    parts.push(PUBLIC_RECORDS_NOT_FOUND_EN)
    if (bundle.notes[0]) parts.push(bundle.notes[0])
    parts.push(PUBLIC_RECORDS_VERIFY_EN)
  }
  parts.push(publicRecordsBrokerOfferEn(broker))
  return joinSentences(parts)
}

function zoningAnswer(bundle: PublicRecordsBundle, broker: string, facts: SarahListingFacts | null): string {
  const parts: string[] = [LET_ME_FIND_OUT_EN]
  if (bundle.zone) {
    parts.push(`The county GIS shows this lot as ${bundle.zone.code}, ${bundle.zone.name}`)
    parts.push(`${bundle.zone.sourceCite}: ${bundle.zone.sourceUrl}`)
    parts.push(PUBLIC_RECORDS_VERIFY_EN)
    parts.push(PUBLIC_RECORDS_NOT_LEGAL_EN)
  } else if (bundle.taxlot) {
    parts.push(`The assessor map shows taxlot ${bundle.taxlot}. I do not have a verified zone for it`)
    parts.push(PUBLIC_RECORDS_VERIFY_EN)
  } else {
    parts.push(PUBLIC_RECORDS_NOT_FOUND_EN)
    const shop = facts ? extractShopPhrase(facts.publicRemarks) : null
    if (shop) parts.push(`The listing describes ${shop}`)
    parts.push(PUBLIC_RECORDS_VERIFY_EN)
  }
  parts.push(publicRecordsBrokerOfferEn(broker))
  return joinSentences(parts)
}

export function formatPublicRecordsReply(input: {
  intent: PublicRecordsIntent
  question: string
  facts: SarahListingFacts | null
  bundle: PublicRecordsBundle
  brokerFirstName?: string
}): string {
  const broker = brokerName(input.brokerFirstName ?? DEFAULT_DESK_BROKER_FIRST_NAME)
  const intent = input.intent ?? 'zoning'
  if (intent === 'permit') return permitAnswer(input.question, input.facts, input.bundle, broker)
  if (intent === 'adu') return aduAnswer(input.bundle, broker)
  return zoningAnswer(input.bundle, broker, input.facts)
}

function subjectFromFacts(facts: SarahListingFacts | null, extra?: PublicRecordsSubject): PublicRecordsSubject {
  return {
    streetNumber: extra?.streetNumber ?? facts?.streetNumber ?? null,
    streetName: extra?.streetName ?? facts?.streetName ?? null,
    city: extra?.city ?? facts?.city ?? null,
    county: extra?.county ?? facts?.county ?? null,
    parcelNumber: extra?.parcelNumber ?? facts?.parcelNumber ?? null,
    latitude: extra?.latitude ?? facts?.latitude ?? null,
    longitude: extra?.longitude ?? facts?.longitude ?? null,
  }
}

export async function answerPublicRecordsQuestion(input: {
  question: string
  facts?: SarahListingFacts | null
  subject?: PublicRecordsSubject
  brokerFirstName?: string
  deps?: PublicRecordsDeps
}): Promise<string> {
  const intent = classifyPublicRecordsQuestion(input.question)
  const bundle = await lookupPublicRecords(subjectFromFacts(input.facts ?? null, input.subject), input.deps)
  return formatPublicRecordsReply({
    intent,
    question: input.question,
    facts: input.facts ?? null,
    bundle,
    brokerFirstName: input.brokerFirstName,
  })
}

export async function runLookupPublicRecords(
  args: PublicRecordsSubject & { question: string },
  deps?: PublicRecordsDeps,
): Promise<string> {
  return answerPublicRecordsQuestion({
    question: args.question,
    subject: args,
    deps,
  })
}
