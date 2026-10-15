/**
 * Web chat intent chips and short qualifying flows (Matt 2026-10-15).
 * Pure: no DB. Capture is a later action. Sarah never quotes a value.
 */
import { CRM_STAGES } from '@/lib/crm/constants'
import { JOURNEY_ENTRY_STAGE } from '@/lib/crm/journey-advance'
import { CALLBACK_PHONE_DISPLAY, DEFAULT_DESK_BROKER_FIRST_NAME } from './scripts'

export const SARAH_INTENT_CHIPS = [
  { id: 'buyer', label: "I'm looking for a home" },
  { id: 'seller', label: "I'm thinking of selling" },
  { id: 'home-worth', label: "What's my home worth?" },
  { id: 'question', label: 'I have a question' },
] as const

export type SarahIntent = (typeof SARAH_INTENT_CHIPS)[number]['id']

export const WEB_BRINGS_YOU_HERE_EN = 'What brings you here today?'

export const SARAH_CMA_OFFER_YES = 'Yes, start a review'
export const SARAH_CMA_OFFER_NO = 'Not right now'
export const SARAH_HANDOFF_CALL = 'Call'
export const SARAH_HANDOFF_TEXT = 'Text'
export const SARAH_HANDOFF_EMAIL = 'Email'
export const SARAH_HANDOFF_SKIP = 'No thanks'

export type FlowStep =
  | 'intent'
  | 'area'
  | 'budget'
  | 'timeline'
  | 'address'
  | 'sell-timeline'
  | 'cma-offer'
  | 'ask'
  | 'name'
  | 'contact'
  | 'handoff'
  | 'done'

export type FlowAnswers = {
  area?: string
  budget?: string
  timeline?: string
  address?: string
  question?: string
  name?: string
  email?: string
  phone?: string
  cmaWanted?: boolean
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
  next: FlowState
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/
const YES_RE = /^(yes|yeah|yep|yup|sure|please|ok|okay|do it|go ahead|start|sounds good)\b/i
const NO_RE = /^(no|nope|not now|later|skip|nah|no thanks)\b/i

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
    /looking for a home|look at homes|look(ing)? at homes?( here)?|buy(ing)? (a )?(home|house)|find (a )?(home|house|listings?)|homes? here|house hunting|search(ing)? (for )?(a )?(home|house|listings?)/i.test(
      t,
    )
  )
    return 'buyer'
  if (/thinking of selling|want to sell|selling (my|our) (home|house)/i.test(t)) return 'seller'
  if (/what('s| is) my (home|house) worth|home worth|market analysis|cma\b/i.test(t)) return 'home-worth'
  if (/^i have a question/.test(t)) return 'question'
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
  if (!/[a-zA-Z]/.test(t)) return false
  return true
}

function brokerName(first: string): string {
  return first.trim() || DEFAULT_DESK_BROKER_FIRST_NAME
}

function chipsOf(labels: FlowChip[]): FlowChip[] {
  return labels
}

export function applyIntentTurn(
  state: FlowState,
  visitorText: string,
  brokerFirstName = DEFAULT_DESK_BROKER_FIRST_NAME,
): IntentTurn {
  const text = visitorText.trim()
  const broker = brokerName(brokerFirstName)
  const next: FlowState = {
    step: state.step,
    intent: state.intent,
    answers: { ...state.answers },
    captured: state.captured,
  }

  if (state.step === 'intent') {
    const intent = matchIntentChip(text) ?? (text ? 'question' : null)
    if (!intent) {
      return {
        reply: WEB_BRINGS_YOU_HERE_EN,
        chips: [...SARAH_INTENT_CHIPS],
        capture: false,
        startCma: false,
        next,
      }
    }
    next.intent = intent
    if (intent === 'buyer') {
      next.step = 'area'
      return {
        reply: "Happy to help you look. Which area are you thinking about? Bend, Redmond, a community name, or wherever you're curious is fine.",
        chips: null,
        capture: false,
        startCma: false,
        next,
      }
    }
    if (intent === 'seller') {
      next.step = 'address'
      return {
        reply: "I can help with that. What's the address?",
        chips: null,
        capture: false,
        startCma: false,
        next,
      }
    }
    if (intent === 'home-worth') {
      next.step = 'address'
      return {
        reply: `I don't give values myself. I can start a home value review for ${broker} to look at. What's the address?`,
        chips: null,
        capture: false,
        startCma: false,
        next,
      }
    }
    next.step = 'ask'
    next.answers.question = /i have a question/i.test(text) ? undefined : text
    if (next.answers.question) {
      next.step = 'name'
      return {
        reply: `Got it. If you'd like, I can have ${broker} follow up. What's a good name for you?`,
        chips: null,
        capture: false,
        startCma: false,
        next,
      }
    }
    return {
      reply: "Sure. What's on your mind?",
      chips: null,
      capture: false,
      startCma: false,
      next,
    }
  }

  if (state.step === 'area') {
    next.answers.area = text
    next.step = 'budget'
    return {
      reply: "Rough budget, if you have one? Totally fine if you're still figuring that out.",
      chips: null,
      capture: false,
      startCma: false,
      next,
    }
  }

  if (state.step === 'budget') {
    next.answers.budget = text
    next.step = 'timeline'
    return {
      reply: 'Any sense of timing? This year, next year, or just looking around is all useful.',
      chips: null,
      capture: false,
      startCma: false,
      next,
    }
  }

  if (state.step === 'timeline') {
    next.answers.timeline = text
    next.step = 'name'
    return {
      reply: "Great. What's a good name for you?",
      chips: null,
      capture: false,
      startCma: false,
      next,
    }
  }

  if (state.step === 'address') {
    next.answers.address = text
    if (state.intent === 'seller') {
      next.step = 'sell-timeline'
      return {
        reply: "Any sense of when you'd like to sell? No rush if you're just thinking about it.",
        chips: null,
        capture: false,
        startCma: false,
        next,
      }
    }
    next.step = 'cma-offer'
    return {
      reply: `I can start a draft home value review for ${broker} to look over. I won't quote a number myself. Want me to start that?`,
      chips: chipsOf([
        { id: 'cma-yes', label: SARAH_CMA_OFFER_YES },
        { id: 'cma-no', label: SARAH_CMA_OFFER_NO },
      ]),
      capture: false,
      startCma: false,
      next,
    }
  }

  if (state.step === 'sell-timeline') {
    next.answers.timeline = text
    next.step = 'cma-offer'
    return {
      reply: `I can't quote what it would sell for. I can start a draft home value review for ${broker} to review. Want me to start that?`,
      chips: chipsOf([
        { id: 'cma-yes', label: SARAH_CMA_OFFER_YES },
        { id: 'cma-no', label: SARAH_CMA_OFFER_NO },
      ]),
      capture: false,
      startCma: false,
      next,
    }
  }

  if (state.step === 'cma-offer') {
    const wanted = YES_RE.test(text) || text === SARAH_CMA_OFFER_YES
    const declined = NO_RE.test(text) || text === SARAH_CMA_OFFER_NO
    next.answers.cmaWanted = wanted && !declined
    next.step = 'name'
    return {
      reply: next.answers.cmaWanted
        ? `I'll start that draft for ${broker}. What's a good name for you?`
        : `No problem. What's a good name for you, in case ${broker} should follow up?`,
      chips: null,
      capture: false,
      startCma: false,
      next,
    }
  }

  if (state.step === 'ask') {
    next.answers.question = text
    next.step = 'name'
    return {
      reply: `Thanks. If you'd like, I can have ${broker} follow up. What's a good name for you?`,
      chips: null,
      capture: false,
      startCma: false,
      next,
    }
  }

  if (state.step === 'name') {
    if (!looksLikeName(text)) {
      return {
        reply: 'Just a first name is fine.',
        chips: null,
        capture: false,
        startCma: false,
        next,
      }
    }
    next.answers.name = text
    next.step = 'contact'
    return {
      reply: `Thanks, ${text.split(/\s+/)[0]}. What's an email or phone ${broker} can use? Either one works.`,
      chips: null,
      capture: false,
      startCma: false,
      next,
    }
  }

  if (state.step === 'contact') {
    const bits = parseContactBits(text)
    if (!bits.email && !bits.phone) {
      return {
        reply: `I need an email or a phone so ${broker} can follow up. Whichever you prefer.`,
        chips: null,
        capture: false,
        startCma: false,
        next,
      }
    }
    next.answers.email = bits.email ?? next.answers.email
    next.answers.phone = bits.phone ?? next.answers.phone
    next.step = 'handoff'
    next.captured = true
    const startCma = Boolean(next.answers.cmaWanted && next.answers.address)
    return {
      reply: startCma
        ? `I've saved that for ${broker} and started a draft review for Matt to look at. Want me to connect you with ${broker} now?`
        : `I've saved that for ${broker}. Want me to connect you now?`,
      chips: chipsOf([
        { id: 'handoff-call', label: SARAH_HANDOFF_CALL },
        { id: 'handoff-text', label: SARAH_HANDOFF_TEXT },
        { id: 'handoff-email', label: SARAH_HANDOFF_EMAIL },
        { id: 'handoff-skip', label: SARAH_HANDOFF_SKIP },
      ]),
      capture: true,
      startCma,
      next,
    }
  }

  if (state.step === 'handoff') {
    next.step = 'done'
    if (text === SARAH_HANDOFF_CALL || /^call\b/i.test(text)) {
      return {
        reply: `You can call ${broker} at ${CALLBACK_PHONE_DISPLAY}.`,
        chips: null,
        capture: false,
        startCma: false,
        next,
      }
    }
    if (text === SARAH_HANDOFF_TEXT || /^text\b/i.test(text)) {
      return {
        reply: `You can text ${broker} at ${CALLBACK_PHONE_DISPLAY}.`,
        chips: null,
        capture: false,
        startCma: false,
        next,
      }
    }
    if (text === SARAH_HANDOFF_EMAIL || /^email\b/i.test(text)) {
      return {
        reply: `I can have ${broker} email you at the address you shared.`,
        chips: null,
        capture: false,
        startCma: false,
        next,
      }
    }
    return {
      reply: `No problem. ${broker} has the note if you want to pick this up later.`,
      chips: null,
      capture: false,
      startCma: false,
      next,
    }
  }

  return {
    reply: WEB_BRINGS_YOU_HERE_EN,
    chips: [...SARAH_INTENT_CHIPS],
    capture: false,
    startCma: false,
    next,
  }
}

export const SARAH_SOURCE = 'sarah-chat'

export const SARAH_STAGE_BY_INTENT: Record<SarahIntent, (typeof CRM_STAGES)[number]> = {
  buyer: JOURNEY_ENTRY_STAGE,
  seller: 'Seller Prospect',
  'home-worth': 'Seller Prospect',
  question: JOURNEY_ENTRY_STAGE,
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

/**
 * Existing stages only. Never downgrade. Frozen pipeline stages stay put.
 * Lead may move to Seller Prospect for seller / home-worth. Anything else
 * already past Lead is left alone.
 */
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
  const audience = intent === 'buyer' ? 'audience:buyer' : intent === 'question' ? null : 'audience:seller'
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
    input.answers.budget ? `Budget: ${input.answers.budget}` : null,
    input.answers.timeline ? `Timeline: ${input.answers.timeline}` : null,
    input.answers.address ? `Address: ${input.answers.address}` : null,
    input.answers.question ? `Question: ${input.answers.question}` : null,
    input.answers.cmaWanted ? 'Draft CMA requested for broker review. Sarah did not quote a value.' : null,
  ].filter((line): line is string => Boolean(line))
  return { title: 'Captured by Sarah', body: lines.join('\n') }
}
