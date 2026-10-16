/**
 * Web chat chips and a light discovery-then-funnel (Matt 2026-10-16).
 * Pure: no DB. Capture is a later action. Sarah never quotes a value.
 */
import { CRM_STAGES } from '@/lib/crm/constants'
import { JOURNEY_ENTRY_STAGE } from '@/lib/crm/journey-advance'
import { decideSarahConsent, sarahConsentAsk, type SarahConsentChannel } from './lead-consent'
import { DEFAULT_DESK_BROKER_FIRST_NAME } from './scripts'

export const SARAH_INTENT_CHIPS = [
  { id: 'buyer', label: 'Find a home' },
  { id: 'seller', label: 'Selling' },
  { id: 'home-worth', label: "What's my home worth?" },
  { id: 'how', label: 'How you buy or sell' },
  { id: 'market', label: 'The market' },
] as const

export type SarahIntent = (typeof SARAH_INTENT_CHIPS)[number]['id']

export const WEB_BRINGS_YOU_HERE_EN =
  "Hi, I'm Sarah. I work with Matt and his team at Ryan Realty. How can I help you today?"

/** Small notice under the opening. No AI announcement. */
export const WEB_DISCLOSURE_LINE_EN = 'Chats are saved so our team can follow up.'

export type SarahFunnelStage = 'opened' | 'intent' | 'name' | 'contact' | 'consent'

export type FlowStep =
  | 'intent'
  | 'discover'
  | 'name'
  | 'offer'
  | 'consent'
  | 'done'
  | 'area'
  | 'budget'
  | 'timeline'
  | 'address'
  | 'sell-timeline'
  | 'cma-offer'
  | 'ask'
  | 'contact'
  | 'handoff'

export type FlowAnswers = {
  area?: string
  budget?: string
  timeline?: string
  address?: string
  question?: string
  helpFinding?: string
  name?: string
  email?: string
  phone?: string
  cmaWanted?: boolean
  declinedName?: number
  declinedContact?: number
  consentGranted?: boolean
  marketingConsent?: boolean
}

export type FlowState = {
  step: FlowStep
  intent: SarahIntent | null
  answers: FlowAnswers
  captured: boolean
}

export type FlowChip = { id: string; label: string }

export type IntentTurn = {
  reply: string
  chips: FlowChip[] | null
  capture: boolean
  startCma: boolean
  funnel: SarahFunnelStage | null
  askConsent: boolean
  consentQuestion: string | null
  next: FlowState
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/
const SKIP_RE = /^(no|nope|not now|later|skip|nah|no thanks|no thank you)\b/i

const INTENT_BY_LABEL = new Map<string, SarahIntent>(
  SARAH_INTENT_CHIPS.map((chip) => [chip.label.toLowerCase(), chip.id]),
)

export function initialFlow(): FlowState {
  return { step: 'intent', intent: null, answers: {}, captured: false }
}

export function matchIntentChip(text: string): SarahIntent | null {
  const t = text.trim().toLowerCase()
  if (!t) return null
  const exact = INTENT_BY_LABEL.get(t)
  if (exact) return exact
  if (
    /find a home|look(?:ing)? (?:at|for) (?:a )?(?:home|house)s?|buy(?:ing)? (?:a )?(?:home|house)/i.test(
      t,
    )
  ) {
    return 'buyer'
  }
  if (/^selling$|thinking of selling|want to sell|selling (my|our) (home|house)/i.test(t)) {
    return 'seller'
  }
  if (/what('s| is) my (home|house) worth|home worth|market analysis|cma\b/i.test(t)) {
    return 'home-worth'
  }
  if (/how you buy or sell|how (do|we|to) (buy|sell)|buy or sell/i.test(t)) return 'how'
  if (/^the market$|housing market|the (bend )?market\b/i.test(t)) return 'market'
  return null
}

export function parseContactBits(text: string): { email: string | null; phone: string | null } {
  const email = text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null
  const rawPhone = text.match(PHONE_RE)?.[0] ?? null
  const digits = rawPhone ? rawPhone.replace(/\D/g, '') : ''
  const phone = digits.length >= 10 ? digits.slice(-10) : null
  return { email, phone }
}

export function looksLikeName(text: string): boolean {
  const t = text.trim()
  if (t.length < 2 || t.length > 80) return false
  if (EMAIL_RE.test(t) || PHONE_RE.test(t)) return false
  if (SKIP_RE.test(t)) return false
  if (!/[a-zA-Z]/.test(t)) return false
  return true
}

function brokerName(first: string): string {
  return first.trim() || DEFAULT_DESK_BROKER_FIRST_NAME
}

function blankTurn(next: FlowState, reply: string, extras: Partial<IntentTurn> = {}): IntentTurn {
  return {
    reply,
    chips: null,
    capture: false,
    startCma: false,
    funnel: null,
    askConsent: false,
    consentQuestion: null,
    next,
    ...extras,
  }
}

function favorOffer(intent: SarahIntent | null, broker: string): string {
  if (intent === 'buyer') {
    return `If you'd like, I can have ${broker} send a few that fit. What's a good email or phone?`
  }
  if (intent === 'seller' || intent === 'home-worth') {
    return `I can have ${broker} take a look. What's a good email or phone?`
  }
  return `I can have ${broker} follow up if that would help. What's a good email or phone?`
}

function discoverReply(intent: SarahIntent, broker: string): string {
  if (intent === 'buyer') {
    return 'What are you hoping to find? A city, a community, or a kind of home is all useful.'
  }
  if (intent === 'seller') return "What's on your mind about selling?"
  if (intent === 'home-worth') {
    return `What's the address? I don't give values myself. I can start a review for ${broker}.`
  }
  if (intent === 'how') return 'What part of buying or selling do you want to understand?'
  return 'A city, a community, or the whole region?'
}

function mergeContact(answers: FlowAnswers, text: string): FlowAnswers {
  const bits = parseContactBits(text)
  return {
    ...answers,
    email: bits.email ?? answers.email,
    phone: bits.phone ?? answers.phone,
  }
}

function finishContact(
  next: FlowState,
  broker: string,
  channel: SarahConsentChannel,
): IntentTurn {
  const phone = next.answers.phone
  const startCma = Boolean(
    (next.intent === 'home-worth' || next.intent === 'seller' || next.answers.cmaWanted) &&
      next.answers.address,
  )
  next.captured = true
  if (phone) {
    const question = sarahConsentAsk(phone)
    next.step = 'consent'
    return blankTurn(next, question, {
      capture: true,
      startCma,
      funnel: 'contact',
      askConsent: true,
      consentQuestion: question,
    })
  }
  next.step = 'done'
  return blankTurn(
    next,
    `I've saved that for ${broker}. I'll leave the rest with the team.`,
    { capture: true, startCma, funnel: 'contact' },
  )
}

export function applyIntentTurn(
  state: FlowState,
  visitorText: string,
  brokerFirstName = DEFAULT_DESK_BROKER_FIRST_NAME,
  channel: SarahConsentChannel = 'typed',
): IntentTurn {
  const text = visitorText.trim()
  const broker = brokerName(brokerFirstName)
  const next: FlowState = {
    step: state.step,
    intent: state.intent,
    answers: mergeContact({ ...state.answers }, text),
    captured: state.captured,
  }

  if (state.step === 'intent') {
    const intent = matchIntentChip(text)
    if (!intent) {
      if (!text) {
        return blankTurn(next, WEB_BRINGS_YOU_HERE_EN, { chips: [...SARAH_INTENT_CHIPS] })
      }
      next.intent = null
      next.step = 'discover'
      next.answers.question = text
      return blankTurn(
        next,
        "Got it. Are you looking for a home, thinking about selling, or just have a question?",
        { funnel: 'intent' },
      )
    }
    next.intent = intent
    next.step = 'discover'
    return blankTurn(next, discoverReply(intent, broker), { funnel: 'intent' })
  }

  if (state.step === 'discover') {
    if (state.intent === 'buyer') {
      if (!next.answers.area) {
        next.answers.area = text
        return blankTurn(next, 'Want a hand looking, or are you just browsing for now?')
      }
      next.answers.helpFinding = text
    } else if (state.intent === 'home-worth' || state.intent === 'seller') {
      if (!next.answers.address && /[0-9]/.test(text)) next.answers.address = text
      else if (!next.answers.question) next.answers.question = text
      if (state.intent === 'home-worth' || /worth|value|review|cma/i.test(text)) {
        next.answers.cmaWanted = true
      }
    } else {
      next.answers.question = text
    }
    next.step = 'name'
    return blankTurn(next, "What's a good name for you?")
  }

  if (state.step === 'name') {
    if (next.answers.email || next.answers.phone) {
      if (looksLikeName(text.replace(EMAIL_RE, '').replace(PHONE_RE, '').trim())) {
        next.answers.name = text.replace(EMAIL_RE, '').replace(PHONE_RE, '').trim()
      } else if (!next.answers.name) {
        next.answers.name = 'Friend'
      }
      return finishContact(next, broker, channel)
    }
    if (SKIP_RE.test(text)) {
      next.answers.declinedName = (next.answers.declinedName ?? 0) + 1
      if (next.answers.declinedName < 2) {
        return blankTurn(next, 'Just a first name is fine.')
      }
      next.step = 'offer'
      return blankTurn(next, favorOffer(next.intent, broker))
    }
    if (!looksLikeName(text)) {
      return blankTurn(next, 'Just a first name is fine.')
    }
    next.answers.name = text
    next.step = 'offer'
    return blankTurn(next, favorOffer(next.intent, broker), { funnel: 'name' })
  }

  if (state.step === 'offer') {
    if (next.answers.email || next.answers.phone) {
      if (!next.answers.name && looksLikeName(text.replace(EMAIL_RE, '').replace(PHONE_RE, '').trim())) {
        next.answers.name = text.replace(EMAIL_RE, '').replace(PHONE_RE, '').trim()
      }
      return finishContact(next, broker, channel)
    }
    if (SKIP_RE.test(text)) {
      next.answers.declinedContact = (next.answers.declinedContact ?? 0) + 1
      if (next.answers.declinedContact < 2) {
        return blankTurn(next, "No problem. An email is enough if that's easier.")
      }
      next.step = 'done'
      return blankTurn(next, "No problem. I'm here if you want to keep talking.")
    }
    return blankTurn(next, `I need an email or a phone so ${broker} can follow up. Whichever you prefer.`)
  }

  if (state.step === 'consent') {
    const decision = decideSarahConsent(text, channel)
    if (!decision) {
      return blankTurn(next, 'A yes or no is fine.', {
        askConsent: true,
        consentQuestion: next.answers.phone ? sarahConsentAsk(next.answers.phone) : null,
      })
    }
    next.answers.consentGranted = decision.granted
    next.answers.marketingConsent = decision.marketing
    next.step = 'done'
    return blankTurn(
      next,
      decision.granted
        ? `Thanks. I've saved that for ${broker}.`
        : `No problem. ${broker} has the note if you want to pick this up later.`,
      { funnel: 'consent' },
    )
  }

  return blankTurn(next, WEB_BRINGS_YOU_HERE_EN, { chips: [...SARAH_INTENT_CHIPS] })
}

/** After a helpful page answer, ask for a name once if we do not have one. */
export function afterHelpfulAnswer(
  state: FlowState,
  brokerFirstName = DEFAULT_DESK_BROKER_FIRST_NAME,
): IntentTurn | null {
  if (state.answers.name || state.step === 'name' || state.step === 'offer' || state.step === 'consent') {
    return null
  }
  if (state.step !== 'intent' && state.step !== 'discover' && state.step !== 'ask') return null
  const next: FlowState = {
    ...state,
    step: 'name',
    answers: { ...state.answers },
  }
  return blankTurn(next, "What's a good name for you?")
}

export const SARAH_SOURCE = 'sarah-chat'

export const SARAH_STAGE_BY_INTENT: Record<SarahIntent, (typeof CRM_STAGES)[number]> = {
  buyer: JOURNEY_ENTRY_STAGE,
  seller: 'Seller Prospect',
  'home-worth': 'Seller Prospect',
  how: JOURNEY_ENTRY_STAGE,
  market: JOURNEY_ENTRY_STAGE,
}

const FROZEN_STAGES = new Set<string>([
  'Active Client',
  'Pending',
  'Past Client',
  'Closed',
  'Archive',
  'Trash',
  'Real Estate Agent',
  'Vendor',
])

export function decideSarahStage(
  current: string | null | undefined,
  proposed: string,
): string | null {
  if (!(CRM_STAGES as readonly string[]).includes(proposed)) return null
  const cur = (current ?? '').trim()
  if (!cur || cur === proposed) return cur ? null : proposed
  if (FROZEN_STAGES.has(cur)) return null
  if (cur === JOURNEY_ENTRY_STAGE && proposed === 'Seller Prospect') return proposed
  return null
}

export function sarahEventType(
  intent: SarahIntent,
): 'Property Search' | 'Seller Inquiry' | 'General Inquiry' {
  if (intent === 'buyer') return 'Property Search'
  if (intent === 'seller' || intent === 'home-worth') return 'Seller Inquiry'
  return 'General Inquiry'
}

export function sarahCaptureTags(intent: SarahIntent): string[] {
  const audience =
    intent === 'buyer' ? 'audience:buyer' : intent === 'seller' || intent === 'home-worth' ? 'audience:seller' : null
  return [
    `source:${SARAH_SOURCE}`,
    'captured:by-sarah',
    `sarah:intent-${intent}`,
    audience,
  ].filter((t): t is string => Boolean(t))
}

export function sarahOriginNote(input: {
  intent: SarahIntent
  answers: FlowAnswers
  brokerFirstName: string
}): { title: string; body: string } {
  const lines = [
    `Captured by Sarah (${input.intent.replace('-', ' ')}). Assigned broker fallback is ${brokerName(input.brokerFirstName)}.`,
    input.answers.area ? `Area: ${input.answers.area}` : null,
    input.answers.helpFinding ? `Help finding: ${input.answers.helpFinding}` : null,
    input.answers.budget ? `Budget: ${input.answers.budget}` : null,
    input.answers.timeline ? `Timeline: ${input.answers.timeline}` : null,
    input.answers.address ? `Address: ${input.answers.address}` : null,
    input.answers.question ? `Question: ${input.answers.question}` : null,
    input.answers.cmaWanted ? 'Draft CMA requested for broker review. Sarah did not quote a value.' : null,
  ].filter((line): line is string => Boolean(line))
  return { title: 'Captured by Sarah', body: lines.join('\n') }
}
