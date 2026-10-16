/**
 * Sarah public-records tools: classify, look up, and answer.
 * Web chat and the phone receptionist (voice-sip) both use this.
 */
import type { SarahListingFacts } from '@/lib/data/sarah/listing-facts'
import { extractShopPhrase } from './listing-answer'
import { activePermits, pickShopPermit } from './public-records-parse'
import {
  lookupPublicRecords,
  type PublicRecordsBundle,
  type PublicRecordsDeps,
  type PublicRecordsSubject,
  type PublicRecordsZone,
} from './public-records-lookup'
import {
  DEFAULT_DESK_BROKER_FIRST_NAME,
  LET_ME_CHECK_EN,
  PUBLIC_RECORDS_NOT_FOUND_EN,
  PUBLIC_RECORDS_VERIFY_EN,
  publicRecordsBrokerOfferEn,
  publicRecordsVoiceOfferEn,
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
    'Look up public property records for permits, zoning, ADUs, lot rules, or outbuildings. Use when you do not already have the fact. Prefer stored listing parcel and address. On the phone, say "Let me check" first. Then speak the tool result exactly. Never give a legal determination. Never read a URL aloud.',
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
export type PublicRecordsChannel = 'web' | 'voice'

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

function titlePlace(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Zone once, in plain English: "RS, standard density residential". */
export function plainZoneLabel(zone: Pick<PublicRecordsZone, 'code' | 'name'>): string {
  const escaped = zone.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const stripped = zone.name
    .replace(new RegExp(`\\(?\\s*${escaped}\\s*\\)?`, 'ig'), ' ')
    .replace(/\b(district|zone)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return stripped ? `${zone.code}, ${stripped}` : zone.code
}

function shortAduLimit(zone: PublicRecordsZone, voice: boolean): string | null {
  const sq = voice ? 'square feet' : 'sq ft'
  if (zone.jurisdiction === 'bend' && zone.adu === 'allowed') {
    return `up to 800 ${sq} for the first`
  }
  if (zone.jurisdiction === 'redmond' && zone.adu === 'allowed') {
    return `300 to 900 ${sq} for a stand-alone unit`
  }
  if (zone.jurisdiction === 'sisters' && zone.adu === 'allowed') {
    return `up to 800 ${sq}`
  }
  return null
}

function speakForVoice(text: string): string {
  return text
    .replace(/\b(\d+)\s*[x×]\s*(\d+)\b/gi, '$1 by $2')
    .replace(/\bsq\.?\s*ft\b/gi, 'square feet')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function citeUrl(bundle: PublicRecordsBundle, fallback: string): string {
  return bundle.permits?.sourceUrl ?? bundle.citations[0]?.url ?? fallback
}

function closeAnswer(
  facts: string[],
  broker: string,
  channel: PublicRecordsChannel,
  sourceUrl: string | null,
): string {
  const parts = [...facts]
  if (facts[0] !== PUBLIC_RECORDS_NOT_FOUND_EN) {
    parts.push(PUBLIC_RECORDS_VERIFY_EN)
  }
  if (channel === 'web' && sourceUrl) {
    parts.push(`Source: ${sourceUrl}`)
    parts.push(publicRecordsBrokerOfferEn(broker))
    return joinSentences(parts)
  }
  parts.push(channel === 'voice' ? publicRecordsVoiceOfferEn(broker) : publicRecordsBrokerOfferEn(broker))
  const joined = joinSentences(parts)
  return channel === 'voice' ? speakForVoice(joined) : joined
}

function permitAnswer(
  question: string,
  facts: SarahListingFacts | null,
  bundle: PublicRecordsBundle,
  broker: string,
  channel: PublicRecordsChannel,
): string {
  const permits = activePermits(bundle.permits?.permits ?? [])
  const shop = pickShopPermit(permits)
  const remarksShop = facts ? extractShopPhrase(facts.publicRemarks) : null
  const source = bundle.permits?.sourceUrl ?? citeUrl(bundle, 'https://dial.deschutes.org')
  const lines: string[] = []

  if (shop) {
    const year = shop.year ? ` in ${shop.year}` : ''
    const label = (shop.name ?? shop.type ?? 'building')
      .replace(/\b(shop|workshop|garage|barn|shed|studio|adu)\b/gi, (word) => word.toLowerCase())
    lines.push(`It looks like there was a permit for a ${label}${year}`)
  } else if (permits.length > 0) {
    const first = permits[0]
    const when = first.year ? ` from ${first.year}` : first.date ? ` dated ${first.date}` : ''
    const status = first.status ? `${first.status.toLowerCase()} ` : ''
    const kind = (first.type ?? 'building').toLowerCase()
    lines.push(`County records show a ${status}${kind} permit${when}`.replace(/\s+/g, ' '))
    if (SHOP_RE.test(question) && remarksShop) {
      const size = remarksShop.match(/\d+\s*[x×]\s*\d+/i)?.[0]
      lines.push(
        `The listing mentions ${size ? `a ${size} shop` : 'a shop'}, but the permit does not name it`,
      )
    } else if (SHOP_RE.test(question)) {
      lines.push('The permit does not name a shop')
    }
  } else {
    return closeAnswer([PUBLIC_RECORDS_NOT_FOUND_EN], broker, channel, null)
  }

  return closeAnswer(lines, broker, channel, source)
}

function aduAnswer(
  bundle: PublicRecordsBundle,
  broker: string,
  channel: PublicRecordsChannel,
): string {
  const zone = bundle.zone
  if (!zone) {
    return closeAnswer([PUBLIC_RECORDS_NOT_FOUND_EN], broker, channel, null)
  }
  const place = titlePlace(zone.jurisdiction)
  const zoned = `This lot is zoned ${plainZoneLabel(zone)}`
  const limit = shortAduLimit(zone, channel === 'voice')
  const lines: string[] = [zoned]
  if (zone.adu === 'allowed') {
    lines.push(limit ? `${place} allows ADUs there, ${limit}` : `${place} allows ADUs there`)
  } else if (zone.adu === 'conditional') {
    lines.push(
      limit
        ? `${place} may allow ADUs there with conditions, ${limit}`
        : `${place} may allow ADUs there with conditions`,
    )
  } else if (zone.adu === 'not-permitted') {
    lines.push('The code does not list ADUs as a permitted use there')
  } else {
    lines.push('The code page does not give a clear ADU rule I can read')
  }
  return closeAnswer(lines, broker, channel, zone.sourceUrl)
}

function zoningAnswer(
  bundle: PublicRecordsBundle,
  broker: string,
  channel: PublicRecordsChannel,
): string {
  if (bundle.zone) {
    return closeAnswer(
      [`This lot is zoned ${plainZoneLabel(bundle.zone)}`],
      broker,
      channel,
      bundle.zone.sourceUrl,
    )
  }
  if (bundle.taxlot) {
    return closeAnswer(
      [`The assessor map shows taxlot ${bundle.taxlot}. I do not have a verified zone for it`],
      broker,
      channel,
      bundle.citations[0]?.url ?? null,
    )
  }
  return closeAnswer([PUBLIC_RECORDS_NOT_FOUND_EN], broker, channel, null)
}

export function formatPublicRecordsReply(input: {
  intent: PublicRecordsIntent
  question: string
  facts: SarahListingFacts | null
  bundle: PublicRecordsBundle
  brokerFirstName?: string
  channel?: PublicRecordsChannel
}): string {
  const broker = brokerName(input.brokerFirstName ?? DEFAULT_DESK_BROKER_FIRST_NAME)
  const channel = input.channel ?? 'web'
  const intent = input.intent ?? 'zoning'
  if (intent === 'permit') return permitAnswer(input.question, input.facts, input.bundle, broker, channel)
  if (intent === 'adu') return aduAnswer(input.bundle, broker, channel)
  return zoningAnswer(input.bundle, broker, channel)
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
  channel?: PublicRecordsChannel
}): Promise<string> {
  const intent = classifyPublicRecordsQuestion(input.question)
  const bundle = await lookupPublicRecords(subjectFromFacts(input.facts ?? null, input.subject), input.deps)
  return formatPublicRecordsReply({
    intent,
    question: input.question,
    facts: input.facts ?? null,
    bundle,
    brokerFirstName: input.brokerFirstName,
    channel: input.channel ?? 'web',
  })
}

export async function runLookupPublicRecords(
  args: PublicRecordsSubject & { question: string; brokerFirstName?: string },
  deps?: PublicRecordsDeps,
): Promise<string> {
  return answerPublicRecordsQuestion({
    question: args.question,
    subject: args,
    brokerFirstName: args.brokerFirstName,
    deps,
    channel: 'voice',
  })
}

export { LET_ME_CHECK_EN }
