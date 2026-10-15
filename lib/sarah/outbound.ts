/**
 * reachability: entry-point — Addendum A outbound AI-voice gates (Counsel
 * 2026-10-14) plus Matt's later lock: informational only, no telemarketing,
 * no toll-free number, flag OFF by default. Pure functions. The dialer must
 * call evaluateOutboundDial before every attempt and refuse when ok is false.
 */
import { DEFAULT_SMS_TIMEZONE, minuteOfDayInTimeZone } from '@/lib/crm/quiet-hours'
import { CALLBACK_PHONE_DISPLAY, informationalVoicemailEn, outboundOpenerEn, YES_CONSENT_TEXT } from './scripts'

/** Default off. Set SARAH_OUTBOUND_ENABLED=true only after Counsel confirms. */
function envFlag(env: object, name: string): boolean {
  return (env as Record<string, unknown>)[name] === 'true'
}

/** Default off. Reads SARAH_OUTBOUND_ENABLED / SARAH_OUTBOUND_KILL_SWITCH. */
export function sarahOutboundEnabled(env: object = process.env): boolean {
  if (envFlag(env, 'SARAH_OUTBOUND_KILL_SWITCH')) return false
  return envFlag(env, 'SARAH_OUTBOUND_ENABLED')
}

export const OUTBOUND_WINDOW_START_HOUR = 9
export const OUTBOUND_WINDOW_END_HOUR = 19
export const OUTBOUND_WINDOW_END_MINUTE = 30
export const MAX_ATTEMPTS_PER_24H = 2
export const MAX_ATTEMPTS_PER_7D = 3
export const INBOUND_TEXT_CONSENT_DAYS = 30
export const WRITTEN_CONSENT_RECONFIRM_MONTHS = 18
export const NATIONAL_DNC_SCRUB_MAX_DAYS = 31
export const RECORD_RETENTION_YEARS = 5
export const ANSWER_SPEAK_WITHIN_MS = 2000

export const YES_FLOW_TEXT = YES_CONSENT_TEXT

/** Lead sources that must never receive an AI call. */
export const BANNED_LEAD_SOURCES = [
  'purchased',
  'purchased-list',
  'scraped',
  'county',
  'county-record',
  'batchdata',
  'fsbo',
  'expired',
  'expired-listing',
] as const

export type BannedLeadSource = (typeof BANNED_LEAD_SOURCES)[number]

/**
 * NANP area codes assigned to FL, OK, and WA. Blocked without written consent
 * (Counsel Addendum A rule 21). Keep in lockstep with NANP assignments; tests
 * pin 305, 405, and 206.
 */
export const BLOCKED_STATE_AREA_CODES: ReadonlySet<string> = new Set([
  // Florida
  '239', '305', '321', '324', '352', '386', '407', '448', '561', '656', '689',
  '727', '754', '772', '786', '813', '850', '863', '904', '941', '954',
  // Oklahoma
  '405', '539', '572', '580', '918',
  // Washington
  '206', '253', '360', '425', '509', '564',
])

export type OutboundConsentKind = 'inbound-text' | 'yes-reply' | 'web-form-voice' | 'past-client-transaction'

export type OutboundConsentRecord = {
  kind: OutboundConsentKind
  sourceText: string
  capturedAt: string
  phone: string
  topic?: string | null
}

export type OutboundDialInput = {
  phone: string
  leadSource?: string | null
  consent: OutboundConsentRecord | null
  internalDnc: boolean
  nationalDnc: boolean
  attemptsLast24h: number
  attemptsLast7d: number
  unansweredStreak: number
  timeZone?: string
  now?: Date
  wantsPitch?: boolean
  optOutFailedToLog?: boolean
  env?: object
}

export type OutboundDialDecision =
  | { ok: true; opener: string; voicemail: string }
  | { ok: false; reason: string }

function tenDigit(phone: string): string | null {
  const d = phone.replace(/\D/g, '')
  if (d.length === 10) return d
  if (d.length === 11 && d.startsWith('1')) return d.slice(1)
  return null
}

export function areaCodeOf(phone: string): string | null {
  return tenDigit(phone)?.slice(0, 3) ?? null
}

export function isBannedLeadSource(source: string | null | undefined): boolean {
  const key = String(source ?? '').trim().toLowerCase()
  return (BANNED_LEAD_SOURCES as readonly string[]).includes(key)
}

export function inOutboundCallingWindow(now: Date, timeZone: string = DEFAULT_SMS_TIMEZONE): boolean {
  const minuteOfDay = minuteOfDayInTimeZone(now, timeZone)
  const start = OUTBOUND_WINDOW_START_HOUR * 60
  const end = OUTBOUND_WINDOW_END_HOUR * 60 + OUTBOUND_WINDOW_END_MINUTE
  return minuteOfDay >= start && minuteOfDay <= end
}

function daysBetween(iso: string, now: Date): number {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY
  return (now.getTime() - then) / 86_400_000
}

export function evaluateOutboundDial(input: OutboundDialInput): OutboundDialDecision {
  if (input.optOutFailedToLog) return { ok: false, reason: 'kill-switch:opt-out-log-failed' }
  if (!sarahOutboundEnabled(input.env ?? process.env)) return { ok: false, reason: 'flag-off' }
  if (input.internalDnc) return { ok: false, reason: 'internal-dnc' }
  if (isBannedLeadSource(input.leadSource)) return { ok: false, reason: 'banned-lead-source' }
  if (!input.consent) return { ok: false, reason: 'no-consent' }
  if (input.wantsPitch && input.consent.kind === 'inbound-text') {
    return { ok: false, reason: 'inbound-text-not-written-for-pitch' }
  }
  if (input.consent.kind === 'inbound-text' && daysBetween(input.consent.capturedAt, input.now ?? new Date()) > INBOUND_TEXT_CONSENT_DAYS) {
    return { ok: false, reason: 'inbound-text-consent-expired' }
  }
  const ac = areaCodeOf(input.phone)
  const written = input.consent.kind === 'yes-reply' || input.consent.kind === 'web-form-voice'
  if (ac && BLOCKED_STATE_AREA_CODES.has(ac) && !written) {
    return { ok: false, reason: 'blocked-state-needs-written-consent' }
  }
  if (input.nationalDnc && !written && input.consent.kind !== 'inbound-text' && input.consent.kind !== 'past-client-transaction') {
    return { ok: false, reason: 'national-dnc' }
  }
  if (input.attemptsLast24h >= MAX_ATTEMPTS_PER_24H) return { ok: false, reason: 'max-attempts-24h' }
  if (input.attemptsLast7d >= MAX_ATTEMPTS_PER_7D) return { ok: false, reason: 'max-attempts-7d' }
  if (input.unansweredStreak >= 3) return { ok: false, reason: 'unanswered-cap' }
  const tz = input.timeZone ?? DEFAULT_SMS_TIMEZONE
  if (!inOutboundCallingWindow(input.now ?? new Date(), tz)) return { ok: false, reason: 'outside-calling-hours' }

  const topic = input.consent.topic?.trim() || 'your request'
  return {
    ok: true,
    opener: outboundOpenerEn(topic),
    voicemail: informationalVoicemailEn(topic, 'What else should Matt know about what you need?'),
  }
}

export function outboundStopWords(text: string): boolean {
  return /\b(stop|don't call|do not call|remove me|quit|unsubscribe|opt out|opt-out)\b/i.test(text) || text.trim() === '9'
}

export { CALLBACK_PHONE_DISPLAY, informationalVoicemailEn, outboundOpenerEn }
