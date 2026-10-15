/**
 * Inbound voicemail / SMS enrichment — name, intent, area, timing, budget.
 *
 * The Twilio webhooks create a placeholder person ("Call lead 945…"). This
 * module reads the transcription or text, extracts structured facts, and
 * returns a write plan. The DAL apply is lib/data/crm/applyInboundMessageEnrichment.ts.
 *
 * Hard rules:
 *   - First/last name only when the stored name is still a placeholder.
 *   - Never overwrite a real name.
 *   - Never send a reply text or email (this module has no send imports).
 *   - industry:contact / broker flags: note only, no lead-type or source write.
 *   - Likely bulk-text scams are tagged quality:unverified, not discarded.
 *
 * Extraction is Claude (lib/ai/anthropic CLASSIFIER_MODEL) plus a conservative
 * deterministic fallback so a model miss still names "this is Elize Marais".
 * Fail-soft: a model error returns null and the apply still writes the note.
 */

import { isUnknownCaller } from '@/lib/crm/display-name'
import { isIndustryContact } from '@/lib/crm/industry-contact'
import { QUALITY_UNVERIFIED_TAG } from '@/lib/crm/lead-quality'
import { hasSellerIntent } from '@/lib/crm/seller-intent'
import { canonicalTagsToAdd } from '@/lib/crm/tag-canonical'

function last10Digits(phone: string | null | undefined): string | null {
  const d = String(phone ?? '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) return d.slice(1)
  return d.length >= 10 ? d.slice(-10) : null
}

export type InboundChannel = 'sms' | 'voicemail'

export type InboundIntent = 'buyer' | 'seller' | 'other'

export type InboundExtract = {
  firstName: string | null
  lastName: string | null
  intent: InboundIntent
  areas: string[]
  timing: string | null
  budget: string | null
  scamLikely: boolean
  scamReasons: string[]
  confidence: number
  source: 'model' | 'fallback' | 'merged'
}

export type PersonSnapshot = {
  name: string | null
  first_name: string | null
  last_name: string | null
  source: string | null
  tags: string[]
  stage: string | null
  custom: Record<string, unknown> | null
  timeframe: string | null
  neighborhood_slug: string | null
  subdivision: string | null
}

export type EnrichPlan = {
  setName: { first: string; last: string; name: string } | null
  tagsToAdd: string[]
  source: string | null
  timeframe: string | null
  neighborhoodSlug: string | null
  subdivision: string | null
  customPatch: Record<string, unknown>
  noteTitle: string
  noteBody: string
  skipReason: string | null
}

/** Central Oregon NANP codes. An inbound from anywhere else is out-of-area. */
export const LOCAL_AREA_CODES = new Set(['541', '458'])

/**
 * Known place names we will stamp onto a person when the message names them.
 * Labels are what we store on subdivision / the note; slugs go on neighborhood_slug.
 */
export const KNOWN_AREAS: ReadonlyArray<{ slug: string; label: string; aliases: string[] }> = [
  { slug: 'tetherow', label: 'Tetherow', aliases: ['tetherow'] },
  { slug: 'sunriver', label: 'Sunriver', aliases: ['sunriver'] },
  { slug: 'eagle-crest', label: 'Eagle Crest', aliases: ['eagle crest', 'eaglecrest'] },
  { slug: 'pronghorn', label: 'Pronghorn', aliases: ['pronghorn'] },
  { slug: 'caldera-springs', label: 'Caldera Springs', aliases: ['caldera springs', 'caldera'] },
  { slug: 'awbrey-glen', label: 'Awbrey Glen', aliases: ['awbrey glen', 'awbrey'] },
  { slug: 'northwest-crossing', label: 'NorthWest Crossing', aliases: ['northwest crossing', 'nw crossing', 'nwx'] },
  { slug: 'crosswater', label: 'Crosswater', aliases: ['crosswater'] },
  { slug: 'black-butte-ranch', label: 'Black Butte Ranch', aliases: ['black butte ranch', 'black butte'] },
  { slug: 'brasada-ranch', label: 'Brasada Ranch', aliases: ['brasada ranch', 'brasada'] },
  { slug: 'widgi-creek', label: 'Widgi Creek', aliases: ['widgi creek', 'widgi'] },
  { slug: 'vandevert-ranch', label: 'Vandevert Ranch', aliases: ['vandevert ranch', 'vandevert'] },
  { slug: 'three-rivers', label: 'Three Rivers', aliases: ['three rivers'] },
  { slug: 'broken-top', label: 'Broken Top', aliases: ['broken top'] },
  { slug: 'bend', label: 'Bend', aliases: ['bend'] },
  { slug: 'redmond', label: 'Redmond', aliases: ['redmond'] },
  { slug: 'sisters', label: 'Sisters', aliases: ['sisters'] },
  { slug: 'la-pine', label: 'La Pine', aliases: ['la pine'] },
  { slug: 'terrebonne', label: 'Terrebonne', aliases: ['terrebonne'] },
  { slug: 'tumalo', label: 'Tumalo', aliases: ['tumalo'] },
  { slug: 'prineville', label: 'Prineville', aliases: ['prineville'] },
  { slug: 'madras', label: 'Madras', aliases: ['madras'] },
]

const CHANNEL_SOURCE: Record<InboundChannel, string> = {
  sms: 'inbound-sms',
  voicemail: 'inbound-voicemail',
}

const OUR_GREETING_RE =
  /\b(?:this is|i(?:['’]m| am))\s+matt\b[\s\S]{0,80}\bryan realty\b|\bleave (?:me )?a message\b/i

const GENERIC_BULK_RE =
  /\b(?:cash buyer|wholesale|we buy houses|any (?:investment )?propert(?:y|ies)|investment propert(?:y|ies) in your area|funds ready|can close (?:quickly|fast|asap)|i have (?:buyers|clients) looking)\b/i

const SELF_INTRO_RE =
  /\b(?:this is|i(?:['’]m| am)|my name is)\s+([A-Z][a-zA-Z'’-]{1,30})(?:\s+([A-Z][a-zA-Z'’-]{1,40}))?\b/

const BUYER_RE =
  /\b(?:purchas(?:e|ing)|buy(?:ing)?|looking (?:to buy|for (?:a |an )?(?:home|house|vacation)))\b/i

const EMPTY_EXTRACT: InboundExtract = {
  firstName: null,
  lastName: null,
  intent: 'other',
  areas: [],
  timing: null,
  budget: null,
  scamLikely: false,
  scamReasons: [],
  confidence: 0,
  source: 'fallback',
}

export function isPlaceholderPersonName(name: string | null | undefined): boolean {
  return isUnknownCaller(name)
}

/** Stored inbound from person 64825 (2026-10-14). Used by tests and the replay path. */
export const ELIZE_INBOUND_SMS =
  "Hey Matthew , this is Elize Marais. I was just trying to reach you and thought I’d leave you a quick message.\nI’m exploring the possibility of purchasing a single family vacation home in Tetherow or the surrounding Bend area, and I’d love to connect with someone who knows the market well. I came across your profile and thought you might be a great person to speak with.\nWhen you have a moment, I’d really appreciate a call back. I’d love to introduce myself, share a little about what I’m looking for, and hear your thoughts on the area"

export const SCAM_INBOUND_SMS =
  'Hi I am a cash buyer looking to purchase any investment properties in your area. Please call me back to discuss. I have funds ready and can close quickly.'

export const SCAM_FROM_NUMBER = '+12125550199'

export const REAL_NAME_PERSON: PersonSnapshot = {
  name: 'Jane Doe',
  first_name: 'Jane',
  last_name: 'Doe',
  source: 'inbound-sms',
  tags: ['source:inbound-sms'],
  stage: 'Lead',
  custom: {},
  timeframe: null,
  neighborhood_slug: null,
  subdivision: null,
}

export function isOurVoicemailGreeting(body: string): boolean {
  return OUR_GREETING_RE.test((body ?? '').trim())
}

export function areaCodeOf(phone: string | null | undefined): string | null {
  const ten = last10Digits(phone)
  return ten && ten.length === 10 ? ten.slice(0, 3) : null
}

export function isOutOfAreaNumber(phone: string | null | undefined): boolean {
  const code = areaCodeOf(phone)
  if (!code) return false
  return !LOCAL_AREA_CODES.has(code)
}

export function areasNamedIn(body: string): Array<{ slug: string; label: string }> {
  const text = ` ${(body ?? '').toLowerCase()} `
  const found: Array<{ slug: string; label: string }> = []
  const seen = new Set<string>()
  for (const area of KNOWN_AREAS) {
    for (const alias of area.aliases) {
      if (text.includes(` ${alias} `) || text.includes(` ${alias},`) || text.includes(` ${alias}.`)) {
        if (!seen.has(area.slug)) {
          seen.add(area.slug)
          found.push({ slug: area.slug, label: area.label })
        }
        break
      }
    }
  }
  return found
}

export function nameFromSelfIntro(body: string): { first: string; last: string } | null {
  const m = SELF_INTRO_RE.exec(body ?? '')
  if (!m) return null
  const first = tidyNamePart(m[1])
  const last = tidyNamePart(m[2])
  if (!first) return null
  if (/^(matt|matthew|ryan)$/i.test(first) && !last) return null
  return { first, last }
}

function tidyNamePart(raw: string | undefined): string {
  const t = String(raw ?? '').replace(/['’]/g, "'").replace(/-+/g, '-').trim()
  if (!t || t.length < 2) return ''
  return t[0].toUpperCase() + t.slice(1)
}

export function looksLikeBulkTextScam(input: {
  body: string
  fromNumber?: string | null
}): { scam: boolean; reasons: string[] } {
  const body = (input.body ?? '').trim()
  const reasons: string[] = []
  const outOfArea = isOutOfAreaNumber(input.fromNumber)
  const generic = GENERIC_BULK_RE.test(body)
  const local = areasNamedIn(body).length > 0
  const intro = nameFromSelfIntro(body)
  if (outOfArea) reasons.push('out-of-area number')
  if (generic) reasons.push('generic bulk wording')
  if (!local && !intro && body.length > 40) reasons.push('no local place or self-introduction')
  // Both signals the request named: generic wording AND an out-of-area number.
  // A named person who names Tetherow / Bend is not this class, even from Texas.
  const scam = outOfArea && (generic || (!local && !intro))
  return { scam, reasons: scam ? reasons : [] }
}

export function fallbackExtract(input: {
  body: string
  fromNumber?: string | null
}): InboundExtract {
  const body = (input.body ?? '').trim()
  if (!body) return { ...EMPTY_EXTRACT }
  const intro = nameFromSelfIntro(body)
  const areas = areasNamedIn(body).map((a) => a.label)
  const seller = hasSellerIntent(body)
  const buyer = BUYER_RE.test(body)
  const scam = looksLikeBulkTextScam(input)
  const intent: InboundIntent = seller && !buyer ? 'seller' : buyer ? 'buyer' : 'other'
  return {
    firstName: intro?.first ?? null,
    lastName: intro?.last || null,
    intent,
    areas,
    timing: null,
    budget: null,
    scamLikely: scam.scam,
    scamReasons: scam.reasons,
    confidence: intro || areas.length ? 0.7 : 0.4,
    source: 'fallback',
  }
}

export function emptyExtract(): InboundExtract {
  return { ...EMPTY_EXTRACT }
}

function cleanToken(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim()
  if (!t || t.toLowerCase() === 'null' || t.toLowerCase() === 'unknown') return null
  return t
}

function asIntent(value: unknown): InboundIntent {
  if (value === 'buyer' || value === 'seller' || value === 'other') return value
  return 'other'
}

/** Normalize a Claude (or test) JSON object into InboundExtract. Fail-soft. */
export function normalizeExtract(raw: unknown, source: InboundExtract['source'] = 'model'): InboundExtract | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const firstName = cleanToken(o.first_name ?? o.firstName)
  const lastName = cleanToken(o.last_name ?? o.lastName)
  const areasRaw = Array.isArray(o.areas) ? o.areas : []
  const areas = [...new Set(areasRaw.map((a) => cleanToken(a)).filter((a): a is string => !!a))]
  const scamReasonsRaw = Array.isArray(o.scam_reasons) ? o.scam_reasons : Array.isArray(o.scamReasons) ? o.scamReasons : []
  const scamReasons = scamReasonsRaw.map((r) => cleanToken(r)).filter((r): r is string => !!r)
  const confidenceRaw = Number(o.confidence)
  return {
    firstName,
    lastName,
    intent: asIntent(o.intent),
    areas,
    timing: cleanToken(o.timing),
    budget: cleanToken(o.budget),
    scamLikely: o.scam_likely === true || o.scamLikely === true,
    scamReasons,
    confidence: Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0,
    source,
  }
}

/** Model fields win when set; fallback fills gaps. Never invents a name the sources lack. */
export function mergeExtract(model: InboundExtract | null, fallback: InboundExtract): InboundExtract {
  if (!model) return fallback
  const areas = [...new Set([...(model.areas ?? []), ...(fallback.areas ?? [])])]
  const scamLikely = model.scamLikely || fallback.scamLikely
  const scamReasons = [...new Set([...(model.scamReasons ?? []), ...(fallback.scamReasons ?? [])])]
  return {
    firstName: model.firstName ?? fallback.firstName,
    lastName: model.lastName ?? fallback.lastName,
    intent: model.intent !== 'other' ? model.intent : fallback.intent,
    areas,
    timing: model.timing ?? fallback.timing,
    budget: model.budget ?? fallback.budget,
    scamLikely,
    scamReasons,
    confidence: Math.max(model.confidence, fallback.confidence),
    source: 'merged',
  }
}

function displayName(first: string, last: string): string {
  return [first, last].filter(Boolean).join(' ').trim()
}

function primaryArea(extract: InboundExtract): { slug: string; label: string } | null {
  for (const named of extract.areas) {
    const hit = KNOWN_AREAS.find(
      (a) => a.label.toLowerCase() === named.toLowerCase() || a.aliases.includes(named.toLowerCase()),
    )
    if (hit) return { slug: hit.slug, label: hit.label }
  }
  return null
}

function audienceTag(intent: InboundIntent): string | null {
  if (intent === 'buyer') return 'audience:buyer'
  if (intent === 'seller') return 'audience:seller'
  return null
}

export function planInboundEnrichment(input: {
  person: PersonSnapshot
  extract: InboundExtract | null
  body: string
  channel: InboundChannel
  fromNumber?: string | null
}): EnrichPlan {
  const body = (input.body ?? '').trim()
  const channelLabel = input.channel === 'voicemail' ? 'voicemail' : 'text'
  const noteBodyBase = body ? `Transcript:\n${body}` : '(no transcript)'

  if (!body) {
    return {
      setName: null,
      tagsToAdd: [],
      source: null,
      timeframe: null,
      neighborhoodSlug: null,
      subdivision: null,
      customPatch: {},
      noteTitle: `Inbound ${channelLabel}`,
      noteBody: noteBodyBase,
      skipReason: 'empty-body',
    }
  }

  if (isOurVoicemailGreeting(body)) {
    return {
      setName: null,
      tagsToAdd: [],
      source: null,
      timeframe: null,
      neighborhoodSlug: null,
      subdivision: null,
      customPatch: {},
      noteTitle: `Inbound ${channelLabel} (our greeting — not a lead message)`,
      noteBody: noteBodyBase,
      skipReason: 'our-greeting',
    }
  }

  const extract = input.extract ?? fallbackExtract({ body, fromNumber: input.fromNumber })
  const industry = isIndustryContact({ tags: input.person.tags, stage: input.person.stage })
  const placeholder = isPlaceholderPersonName(input.person.name)
  const first = extract.firstName?.trim() ?? ''
  const last = extract.lastName?.trim() ?? ''
  const composed = displayName(first, last)
  const setName = !industry && placeholder && composed ? { first, last, name: composed } : null

  const scam = extract.scamLikely || looksLikeBulkTextScam({ body, fromNumber: input.fromNumber }).scam
  const area = primaryArea(extract)
  const tagsToAdd: string[] = []
  const sourceTag = `source:${CHANNEL_SOURCE[input.channel]}`
  if (!input.person.tags.some((t) => t.toLowerCase() === sourceTag)) tagsToAdd.push(sourceTag)

  if (industry) {
    return {
      setName: null,
      tagsToAdd,
      source: null,
      timeframe: null,
      neighborhoodSlug: null,
      subdivision: null,
      customPatch: {
        inbound_extract: {
          channel: input.channel,
          intent: extract.intent,
          areas: extract.areas,
          skipped: 'industry:contact',
        },
      },
      noteTitle: `Inbound ${channelLabel} (industry contact — not tagged as a lead)`,
      noteBody: noteBodyBase,
      skipReason: 'industry-contact',
    }
  }

  if (scam) {
    if (!input.person.tags.includes(QUALITY_UNVERIFIED_TAG)) tagsToAdd.push(QUALITY_UNVERIFIED_TAG)
    if (!input.person.tags.includes('quality:signal:bulk-text')) tagsToAdd.push('quality:signal:bulk-text')
    return {
      setName,
      tagsToAdd,
      source: input.person.source?.trim() ? null : CHANNEL_SOURCE[input.channel],
      timeframe: null,
      neighborhoodSlug: null,
      subdivision: null,
      customPatch: {
        inbound_extract: {
          channel: input.channel,
          intent: extract.intent,
          areas: extract.areas,
          scam: true,
          scamReasons: extract.scamReasons,
        },
        lead_type: extract.intent,
      },
      noteTitle: `Inbound ${channelLabel} flagged unverified (possible bulk text)`,
      noteBody: [noteBodyBase, extract.scamReasons.length ? `Flag: ${extract.scamReasons.join('; ')}.` : null]
        .filter(Boolean)
        .join('\n\n'),
      skipReason: 'unverified-scam',
    }
  }

  const audience = audienceTag(extract.intent)
  if (audience && !input.person.tags.some((t) => t.toLowerCase() === audience)) tagsToAdd.push(audience)
  const extras = canonicalTagsToAdd({ tags: [...input.person.tags, ...tagsToAdd] })
  for (const t of extras) {
    if (!tagsToAdd.includes(t) && !input.person.tags.includes(t)) tagsToAdd.push(t)
  }

  const who = setName?.name ?? composed
  const where = extract.areas.length ? extract.areas.join(', ') : null
  const intentBit = extract.intent !== 'other' ? extract.intent : null
  const titleBits = [`Inbound ${channelLabel}`, who ? `named ${who}` : null, intentBit, where]
    .filter(Boolean)
    .join(', ')

  const summary = [
    intentBit ? `Intent: ${intentBit}.` : null,
    where ? `Areas: ${where}.` : null,
    extract.timing ? `Timing: ${extract.timing}.` : null,
    extract.budget ? `Budget: ${extract.budget}.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    setName,
    tagsToAdd,
    source: input.person.source?.trim() ? null : CHANNEL_SOURCE[input.channel],
    timeframe: extract.timing && !input.person.timeframe ? extract.timing : null,
    neighborhoodSlug: area && !input.person.neighborhood_slug ? area.slug : null,
    subdivision: area && !input.person.subdivision ? area.label : null,
    customPatch: {
      inbound_extract: {
        channel: input.channel,
        intent: extract.intent,
        areas: extract.areas,
        timing: extract.timing,
        budget: extract.budget,
      },
      lead_type: extract.intent,
    },
    noteTitle: titleBits,
    noteBody: [noteBodyBase, summary || null].filter(Boolean).join('\n\n'),
    skipReason: null,
  }
}
