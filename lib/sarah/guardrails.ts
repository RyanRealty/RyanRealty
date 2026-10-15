/**
 * reachability: entry-point — hard Sarah refusals. The system prompt states
 * these; this module is the mechanical gate so a model slip cannot quote a
 * price opinion, steer, or recommend a vendor. Pure: no DB, no Grok.
 */
import {
  ARE_YOU_REAL_EN,
  ARE_YOU_REAL_ES,
  COMMISSION_EN,
  DEMOGRAPHICS_EN,
  GOOD_DEAL_EN,
  HAS_AGENT_WRAP_EN,
  HAS_AGENT_WRAP_ES,
  CONTRACT_ADVICE_EN,
  OFFER_EN,
  PRICE_VALUE_EN,
  PRICE_VALUE_ES,
  RECORDING_OBJECTION_EN,
  RECORDING_OBJECTION_ES,
  RESPA_VENDOR_EN,
  RESPA_VENDOR_ES,
  SCHOOLS_SAFETY_EN,
  SCHOOLS_SAFETY_ES,
  type SarahLang,
} from './scripts'

export type SarahChannel = 'web' | 'voice' | 'sms'

export type GuardrailTopic =
  | 'price-opinion'
  | 'good-deal'
  | 'fair-housing-schools-safety'
  | 'fair-housing-demographics'
  | 'vendor'
  | 'commission'
  | 'human-check'
  | 'has-agent'
  | 'recording-objection'
  | 'make-offer'
  | 'contract-advice'
  | 'urgent'
  | 'spanish'
  | 'listing-showing'
  | 'cma-value'
  | 'other'

export type SarahTurnMode =
  | 'greet'
  | 'refuse'
  | 'wrap-has-agent'
  | 'stop-recording'
  | 'escalate'
  | 'continue'

export type SarahTurn = {
  mode: SarahTurnMode
  topic: GuardrailTopic
  lang: SarahLang
  reply: string | null
  crmTags: string[]
  spanishBridge: boolean
}

const PRICE_RE =
  /\b(worth|value|cma|appraisal|priced right|overpriced|underpriced|good price|fair price|what would they take|lowball|offer strategy|comp(s|arable)?s?\b|estimated value|zestimate)\b/i
const GOOD_DEAL_RE = /\b(good deal|steal|bargain|would they take|take less|come down)\b/i
const SCHOOLS_SAFETY_RE =
  /\b(good schools?|schools? (good|great)|safe (area|neighborhood|street)|family[- ]friendly|quiet (area|neighborhood)|up and coming)\b/i
const DEMOGRAPHICS_RE =
  /\b(what kind of people|who lives (there|here)|demographics|racial|religion|orientation|kids live|old people|young families)\b/i
const VENDOR_RE =
  /\b(good (lender|title|inspector|escrow)|recommend (a |the )?(lender|title|inspector|mortgage|lender)|who should I use for (lender|title|inspect))\b/i
const COMMISSION_RE = /\b(commission|what do you charge|your fee|broker fee|listing fee)\b/i
const HUMAN_RE = /\b(are you (a )?(real|human|person|a person)|are you (an )?ai|are you a bot|real person)\b/i
const HAS_AGENT_RE =
  /\b((already )?(have|working with) (an? )?(agent|broker|realtor)|my (agent|broker))\b/i
const RECORDING_OBJECTION_RE =
  /\b(don'?t .{0,24}record|stop recording|no recording|object to .{0,16}record)/i
const OFFER_RE = /\b(make an offer|write an offer|submit an offer|put in an offer)\b/i
const CONTRACT_ADVICE_RE =
  /\b(earnest money|contingen(cy|cies)|purchase agreement|listing agreement|explain (the |this )?contract|what does (the |this )?contract|should I (sign|offer|counter)|legal advice|brokerage advice|representation agreement|inspection contingency)\b/i
const URGENT_RE =
  /\b(closing today|lock(ed)? out|lockout|access problem|attorney|sue|lawsuit|legal threat|deal (is )?(falling|fell) (apart|through)|emergency)\b/i
const SHOWING_RE = /\b(see it|showing|tour|walk through|look at the (home|house))\b/i
const CMA_RE = /\b(what('s| is) (my|our) (home|house) worth|sell(ing)? my (home|house)|market analysis)\b/i

const SPANISH_SIGNAL_RE =
  /[¿¡ñáéíóúü]/i
const SPANISH_WORD_RE =
  /\b(hola|gracias|buenos|buenas|quisiera|quiero|cómo|cuánto|precio|barrio|escuelas|vender|comprar|llámame|llamame|casa|propiedad|por favor|vecindario)\b/i

const OUTPUT_BANNED: Array<{ id: string; re: RegExp }> = [
  { id: 'safe', re: /\bsafe (neighborhood|area|street)\b/i },
  { id: 'family-friendly', re: /\bfamily[- ]friendly\b/i },
  { id: 'good-schools', re: /\bgood schools\b/i },
  { id: 'who-lives', re: /\b(diverse|exclusive) (neighborhood|area|community)\b/i },
  { id: 'claim-agent', re: /\bi('m| am) (an? )?(agent|broker|realtor)\b/i },
  { id: 'claim-human', re: /\bi('m| am) (a )?(real )?(person|human)\b/i },
  { id: 'vendor-steer', re: /\bi recommend .{0,40}\b(lender|title company|inspector)\b/i },
  { id: 'good-deal', re: /\b(good deal|priced right|they would take)\b/i },
  { id: 'urgency', re: /\b(act now|don't miss|hurry|limited time|won't last)\b/i },
]

export function detectSpanish(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return SPANISH_SIGNAL_RE.test(t) || SPANISH_WORD_RE.test(t)
}

export function classifyVisitorMessage(text: string): GuardrailTopic[] {
  const topics: GuardrailTopic[] = []
  if (detectSpanish(text)) topics.push('spanish')
  if (RECORDING_OBJECTION_RE.test(text)) topics.push('recording-objection')
  if (HAS_AGENT_RE.test(text)) topics.push('has-agent')
  if (URGENT_RE.test(text)) topics.push('urgent')
  if (HUMAN_RE.test(text)) topics.push('human-check')
  if (VENDOR_RE.test(text)) topics.push('vendor')
  if (COMMISSION_RE.test(text)) topics.push('commission')
  if (DEMOGRAPHICS_RE.test(text)) topics.push('fair-housing-demographics')
  if (SCHOOLS_SAFETY_RE.test(text)) topics.push('fair-housing-schools-safety')
  if (GOOD_DEAL_RE.test(text)) topics.push('good-deal')
  if (PRICE_RE.test(text)) topics.push('price-opinion')
  if (OFFER_RE.test(text)) topics.push('make-offer')
  if (CONTRACT_ADVICE_RE.test(text)) topics.push('contract-advice')
  if (CMA_RE.test(text)) topics.push('cma-value')
  if (SHOWING_RE.test(text)) topics.push('listing-showing')
  if (topics.length === 0) topics.push('other')
  else if (topics.length === 1 && topics[0] === 'spanish') topics.push('other')
  return topics
}

function pickLang(preferred: SarahLang | undefined, text: string, alreadySpanish: boolean): SarahLang {
  if (alreadySpanish || detectSpanish(text)) return 'es'
  return preferred ?? 'en'
}

export function evaluateSarahTurn(input: {
  visitorText: string
  greeted: boolean
  lang?: SarahLang
  alreadySpanish?: boolean
}): SarahTurn {
  const alreadySpanish = Boolean(input.alreadySpanish)
  const lang = pickLang(input.lang, input.visitorText, alreadySpanish)
  const spanishNow = detectSpanish(input.visitorText)
  const spanishBridge = spanishNow && !alreadySpanish
  const topics = classifyVisitorMessage(input.visitorText)

  if (topics.includes('recording-objection')) {
    return {
      mode: 'stop-recording',
      topic: 'recording-objection',
      lang,
      reply: lang === 'es' ? RECORDING_OBJECTION_ES : RECORDING_OBJECTION_EN,
      crmTags: [],
      spanishBridge,
    }
  }
  if (topics.includes('has-agent')) {
    return {
      mode: 'wrap-has-agent',
      topic: 'has-agent',
      lang,
      reply: lang === 'es' ? HAS_AGENT_WRAP_ES : HAS_AGENT_WRAP_EN,
      crmTags: ['has agent'],
      spanishBridge,
    }
  }
  if (topics.includes('urgent')) {
    return {
      mode: 'escalate',
      topic: 'urgent',
      lang,
      reply: null,
      crmTags: ['sarah:urgent'],
      spanishBridge,
    }
  }

  const refusal = refusalFor(topics, lang)
  if (refusal) {
    return {
      mode: 'refuse',
      topic: refusal.topic,
      lang,
      reply: refusal.reply,
      crmTags: [],
      spanishBridge,
    }
  }

  return {
    mode: input.greeted ? 'continue' : 'greet',
    topic: topics.find((t) => t !== 'spanish') ?? 'other',
    lang,
    reply: null,
    crmTags: [],
    spanishBridge,
  }
}

function refusalFor(
  topics: GuardrailTopic[],
  lang: SarahLang,
): { topic: GuardrailTopic; reply: string } | null {
  if (topics.includes('vendor')) return { topic: 'vendor', reply: lang === 'es' ? RESPA_VENDOR_ES : RESPA_VENDOR_EN }
  if (topics.includes('fair-housing-demographics')) {
    return { topic: 'fair-housing-demographics', reply: DEMOGRAPHICS_EN }
  }
  if (topics.includes('fair-housing-schools-safety')) {
    return {
      topic: 'fair-housing-schools-safety',
      reply: lang === 'es' ? SCHOOLS_SAFETY_ES : SCHOOLS_SAFETY_EN,
    }
  }
  if (topics.includes('commission')) return { topic: 'commission', reply: COMMISSION_EN }
  if (topics.includes('good-deal')) return { topic: 'good-deal', reply: GOOD_DEAL_EN }
  if (topics.includes('price-opinion')) {
    return { topic: 'price-opinion', reply: lang === 'es' ? PRICE_VALUE_ES : PRICE_VALUE_EN }
  }
  if (topics.includes('human-check')) {
    return { topic: 'human-check', reply: lang === 'es' ? ARE_YOU_REAL_ES : ARE_YOU_REAL_EN }
  }
  if (topics.includes('make-offer')) return { topic: 'make-offer', reply: OFFER_EN }
  if (topics.includes('contract-advice')) return { topic: 'contract-advice', reply: CONTRACT_ADVICE_EN }
  return null
}

export function findGuardrailViolations(sarahText: string): string[] {
  return OUTPUT_BANNED.filter((row) => row.re.test(sarahText)).map((row) => row.id)
}

export function assertSafeSarahReply(sarahText: string): boolean {
  return findGuardrailViolations(sarahText).length === 0
}
