/**
 * reachability: entry-point — conversion flow (Matt): answer first, then one
 * soft specific ask. If declined, one lighter step. Never more than one ask
 * per topic. No pressure language. Showings use pending times for Matt to
 * confirm. No auto-book from the calendar.
 */
import {
  BOOKING_PENDING_EN,
  BOOKING_PENDING_ES,
  LIGHTER_FOLLOW_UP_EN,
  SHOWING_ASK_EN,
  SHOWING_ASK_ES,
  type SarahLang,
} from './scripts'

export type ConversionTopic = 'showing' | 'listings-alert' | 'connect-matt' | 'pamphlet'

export type ConversionState = {
  asked: Partial<Record<ConversionTopic, boolean>>
  declined: Partial<Record<ConversionTopic, boolean>>
}

export const PRESSURE_LANGUAGE_RE =
  /\b(act now|hurry|don't wait|limited time|won't last|last chance|you'll miss|pressure)\b/i

export function hasPressureLanguage(text: string): boolean {
  return PRESSURE_LANGUAGE_RE.test(text)
}

export function showingAsk(lang: SarahLang): string {
  return lang === 'es' ? SHOWING_ASK_ES : SHOWING_ASK_EN
}

export function bookingPendingAsk(lang: SarahLang): string {
  return lang === 'es' ? BOOKING_PENDING_ES : BOOKING_PENDING_EN
}

export function nextConversionOffer(state: ConversionState, topic: ConversionTopic, lang: SarahLang): string | null {
  if (state.asked[topic] && state.declined[topic]) {
    if (topic === 'showing' && !state.asked['listings-alert']) return LIGHTER_FOLLOW_UP_EN
    return null
  }
  if (state.asked[topic]) return null
  if (topic === 'showing') return showingAsk(lang)
  return null
}

export function markAsked(state: ConversionState, topic: ConversionTopic): ConversionState {
  return { ...state, asked: { ...state.asked, [topic]: true } }
}

export function markDeclined(state: ConversionState, topic: ConversionTopic): ConversionState {
  return {
    asked: { ...state.asked, [topic]: true },
    declined: { ...state.declined, [topic]: true },
  }
}

export const EMPTY_CONVERSION: ConversionState = { asked: {}, declined: {} }
