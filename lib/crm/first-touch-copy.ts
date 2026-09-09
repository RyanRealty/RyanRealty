/**
 * Expired + FSBO first-touch SMS — THIS home, not a brochure.
 *
 * Source of truth for the composed body the prospecting send dialog previews
 * when the live crm_templates row is still a canonical seed (old v1 or the
 * v2 rewrite). Matt's custom Settings edits still merge through renderCrmMerge.
 *
 * Rules (Track 2 Loop C):
 *  - Merge only facts the caller already has. Missing fact → omit the clause.
 *  - Never invent a price, DOM, cut count, or address.
 *  - Never blame a prior agent.
 *  - Never ask a worth-question.
 *  - Never auto-send. This module only composes strings.
 */

export type FirstTouchKind = 'expired' | 'fsbo'

export type FirstTouchFacts = {
  address: string | null
  listPrice: number | null
  daysOnMarket: number | null
  originalListPrice: number | null
  finalListPrice: number | null
  priceCutCount: number | null
  senderFirstName: string | null
  cmaLink: string | null
}

/** Production seed body before slice C (`20260718120300_seed_prospecting_templates.sql`). */
export const EXPIRED_FIRST_TOUCH_SEED_V1 =
  'Hi, %sender_first_name% with Ryan Realty. I saw %address% came off the market without selling, so I put together a market analysis for it. Take a look when you get a chance: %cma_link% No pressure either way.'

export const FSBO_FIRST_TOUCH_SEED_V1 =
  'Hi, %sender_first_name% with Ryan Realty. I saw you are selling %address% yourself. No pitch, and good luck with the sale. I put together a market analysis for %address% that may help you price and negotiate. Want me to send it over? A little about us: ryan-realty.com/sell'

/** Settings / seed fallback. Optional facts are composed by the helper, not tokens. */
export const EXPIRED_FIRST_TOUCH_TEMPLATE_V2 =
  'Hi, %sender_first_name% with Ryan Realty. %address% came off the market without a sale. We built a market analysis for %address% and the plan we would run on that address: listing video, flyers, and a photo set made for this house. %cma_link%'

export const FSBO_FIRST_TOUCH_TEMPLATE_V2 =
  'Hi, %sender_first_name% with Ryan Realty. %address% is listed by owner. We built a market analysis for %address% and the plan we would run on that address: listing video, flyers, and a photo set made for this house. %cma_link%'

/**
 * Matt 2026-09-09: the register is his. Sorry it did not sell, the analysis,
 * the ask to earn their business. A FSBO gets respect and a second set of
 * numbers, no charge and no strings. Same shape as the composed body below.
 */
export const EXPIRED_FIRST_TOUCH_TEMPLATE_V3 =
  "Hi, %sender_first_name% with Ryan Realty. We noticed %address% came off the market without selling, and we're sorry it didn't. We put together a market analysis for %address%. We would like the opportunity to earn your business should you decide to relist. %cma_link%"

export const FSBO_FIRST_TOUCH_TEMPLATE_V3 =
  "Hi, %sender_first_name% with Ryan Realty. We noticed %address% is for sale by owner. We respect that. We put together a market analysis for %address%. If a second set of numbers helps, it's yours, no charge and no strings. %cma_link%"

const WORTH_QUESTION =
  /what(?:'s| is) (?:my|your|the) home worth|what is (?:my|your) home worth|what'?s it worth/i
const PRIOR_AGENT_BLAME =
  /\b(?:your last agent|prior agent|the last agent|failed you|should have sold)\b/i

function assertNever(x: never): never {
  throw new Error(`unexpected first-touch kind: ${String(x)}`)
}

function trim(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s || null
}

function finiteMoney(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return n
}

function finiteDays(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

export function formatFirstTouchUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function isWorthQuestionCopy(text: string): boolean {
  return WORTH_QUESTION.test(text)
}

export function blamesPriorAgent(text: string): boolean {
  return PRIOR_AGENT_BLAME.test(text)
}

export function isCanonicalFirstTouchBody(kind: FirstTouchKind, body: string): boolean {
  const t = body.trim()
  switch (kind) {
    case 'expired':
      return t === EXPIRED_FIRST_TOUCH_SEED_V1 || t === EXPIRED_FIRST_TOUCH_TEMPLATE_V2 || t === EXPIRED_FIRST_TOUCH_TEMPLATE_V3
    case 'fsbo':
      return t === FSBO_FIRST_TOUCH_SEED_V1 || t === FSBO_FIRST_TOUCH_TEMPLATE_V2 || t === FSBO_FIRST_TOUCH_TEMPLATE_V3
    default:
      return assertNever(kind)
  }
}

export function composeThisHomeMarketClause(address: string | null): string {
  const named = trim(address)
  return `We put together a market analysis for ${named ?? 'this home'}.`
}

// Matt 2026-09-07 (hard lock, said twice): the owner lived their own listing.
// Never state their list price, days on market, or price cuts back at them —
// not "the ask," not a dollar figure, not a day count. State only that it
// did not sell / that they are listing it themselves.
//
// Matt 2026-09-09: and say it the way we talk. We are sorry their home did
// not sell. This is someone's home. Not "here's what we got".

export function composeExpiredKnowClause(facts: FirstTouchFacts): string {
  const address = trim(facts.address)
  const head = address ?? 'your home'
  return `We noticed ${head} came off the market without selling, and we're sorry it didn't.`
}

export function composeFsboKnowClause(facts: FirstTouchFacts): string {
  const address = trim(facts.address)
  const head = address ?? 'your home'
  return `We noticed ${head} is for sale by owner. We respect that.`
}

const EXPIRED_ASK = 'We would like the opportunity to earn your business should you decide to relist.'
const FSBO_ASK = "If a second set of numbers helps, it's yours, no charge and no strings."

function joinSms(parts: Array<string | null>): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/ {2,}/g, ' ')
    .trim()
}

function withSenderAndLink(facts: FirstTouchFacts, mid: string): string {
  const sender = trim(facts.senderFirstName)
  const hi = sender ? `Hi, ${sender} with Ryan Realty.` : null
  const link = trim(facts.cmaLink)
  return joinSms([hi, mid, link])
}

export function buildExpiredFirstTouchSms(facts: FirstTouchFacts): string {
  return withSenderAndLink(facts, `${composeExpiredKnowClause(facts)} ${composeThisHomeMarketClause(facts.address)} ${EXPIRED_ASK}`)
}

export function buildFsboFirstTouchSms(facts: FirstTouchFacts): string {
  return withSenderAndLink(facts, `${composeFsboKnowClause(facts)} ${composeThisHomeMarketClause(facts.address)} ${FSBO_ASK}`)
}

export function buildFirstTouchSms(kind: FirstTouchKind, facts: FirstTouchFacts): string {
  switch (kind) {
    case 'expired':
      return buildExpiredFirstTouchSms(facts)
    case 'fsbo':
      return buildFsboFirstTouchSms(facts)
    default:
      return assertNever(kind)
  }
}

export function emptyFirstTouchFacts(): FirstTouchFacts {
  return {
    address: null,
    listPrice: null,
    daysOnMarket: null,
    originalListPrice: null,
    finalListPrice: null,
    priceCutCount: null,
    senderFirstName: null,
    cmaLink: null,
  }
}

/** Pull first-touch facts from a prospect row / detail. Never invent. */
export function firstTouchFactsFromProspect(input: {
  address?: string | null
  listPrice?: number | null
  daysOnMarket?: number | null
  listedAt?: string | null
  expiredAt?: string | null
  originalListPrice?: number | null
  priceHistory?: Array<{
    originalListPrice: number | null
    finalListPrice: number | null
    daysOnMarket: number | null
    priceDropCount: number | null
  }>
  senderFirstName?: string | null
  cmaLink?: string | null
}): FirstTouchFacts {
  const cycle = input.priceHistory?.[0] ?? null
  const fromDates = daysBetween(input.listedAt ?? null, input.expiredAt ?? null)
  return {
    address: trim(input.address),
    listPrice: finiteMoney(input.listPrice) ?? finiteMoney(cycle?.finalListPrice),
    daysOnMarket: finiteDays(input.daysOnMarket) ?? finiteDays(cycle?.daysOnMarket) ?? fromDates,
    originalListPrice: finiteMoney(input.originalListPrice) ?? finiteMoney(cycle?.originalListPrice),
    finalListPrice: finiteMoney(cycle?.finalListPrice) ?? finiteMoney(input.listPrice),
    priceCutCount:
      cycle?.priceDropCount != null && Number.isFinite(cycle.priceDropCount)
        ? Math.round(cycle.priceDropCount)
        : null,
    senderFirstName: trim(input.senderFirstName),
    cmaLink: trim(input.cmaLink),
  }
}

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const a = new Date(start)
  const b = new Date(end)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  return days >= 0 ? days : null
}
