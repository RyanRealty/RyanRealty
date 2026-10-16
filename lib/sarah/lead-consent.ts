/**
 * Counsel conversational consent for Sarah (Matt 2026-10-15).
 * Versioned. Typed yes = marketing consent. Spoken yes answers the
 * request only; a later inbound YES text is marketing consent.
 *
 * Do not edit lib/crm/sms-consent-text.ts or the registered 10DLC
 * campaign. This line is the Counsel ask. It does not match the
 * CI-locked SMS_CONSENT_TEXT or the A2P checkbox message_flow.
 */
export const SARAH_CONSENT_WORDING_VERSION = 'sarah-consent-v1-2026-10-15'

export const SARAH_CONSENT_ASK_TEMPLATE =
  "Is it okay if Ryan Realty texts and calls you at [number], including with our AI assistant, about your request and real estate? Consent isn't required to buy anything. Msg and data rates may apply. Reply STOP to opt out, HELP for help."

export const SARAH_POST_VOICE_YES_ASK =
  'Thanks for talking with Sarah at Ryan Realty. Reply YES if it is okay for Ryan Realty to text and call you at this number, including with our AI assistant, about your request and real estate. Consent is not required to buy anything. Reply STOP to opt out, HELP for help.'

export const YES_RE = /^(yes|yeah|yep|yup|sure|please|ok|okay|i agree|sounds good)\b/i
export const NO_RE = /^(no|nope|not now|later|skip|nah|no thanks|no thank you)\b/i

export function sarahConsentAsk(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const ten = digits.length >= 10 ? digits.slice(-10) : digits
  const pretty =
    ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : phone.trim()
  return SARAH_CONSENT_ASK_TEMPLATE.replace('[number]', pretty)
}

export function isConsentYes(text: string): boolean {
  return YES_RE.test(text.trim())
}

export function isConsentNo(text: string): boolean {
  return NO_RE.test(text.trim())
}

export type SarahConsentChannel = 'typed' | 'spoken' | 'sms'

export type SarahConsentDecision = {
  granted: boolean
  marketing: boolean
  needsPostVoiceYes: boolean
}

/**
 * Typed yes is marketing consent. Spoken yes covers only answering the
 * request; queue a post-voice YES text before any marketing.
 */
export function decideSarahConsent(
  reply: string,
  channel: SarahConsentChannel,
): SarahConsentDecision | null {
  const text = reply.trim()
  if (isConsentYes(text)) {
    const spoken = channel === 'spoken'
    return {
      granted: true,
      marketing: !spoken,
      needsPostVoiceYes: spoken,
    }
  }
  if (isConsentNo(text)) {
    return { granted: false, marketing: false, needsPostVoiceYes: false }
  }
  return null
}
