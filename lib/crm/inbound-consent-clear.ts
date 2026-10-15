/**
 * Inbound consent clear (Matt 2026-10-14).
 *
 * When a contact who received any CRM-tracked email from us then reaches out
 * by inbound call, voicemail, SMS, or email reply, we lift the do-not-call
 * and do-not-text / no-SMS flags we set (and the matching contact tags) and
 * write a timeline note. TCPA STOP on inbound SMS still opts them out and
 * never clears. Broker flags and the email unsubscribe flag stay.
 *
 * This module is PURE so the six cases are unit-testable without a database.
 * The DAL apply lives in lib/data/crm/applyInboundConsentClear.ts.
 */

export const SMS_STOP_KEYWORDS: ReadonlySet<string> = new Set([
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
])

export type InboundConsentEvent = 'call' | 'voicemail' | 'sms' | 'email'

export type InboundConsentSuppression = {
  id: number
  channel: string
  reason: string
}

export type InboundConsentPlan =
  | {
      action: 'skip-stop' | 'skip-no-send' | 'skip-nothing'
      tagsToRemove: string[]
      nextTags: string[]
      suppressionIdsToClear: number[]
      noteTitle: string | null
      noteBody: string | null
    }
  | {
      action: 'clear'
      tagsToRemove: string[]
      nextTags: string[]
      suppressionIdsToClear: number[]
      noteTitle: string
      noteBody: string
    }

const CLEARABLE_TAGS = new Set([
  'contact:do-not-call',
  'contact:do-not-text',
  'do_not_call',
  'do_not_text',
  'do-not-call',
  'do-not-text',
  'compliance:dnc-registry',
])

const CLEARABLE_REASON_MARKERS = [
  'do-not-call',
  'do_not_call',
  'donotcall',
  'do-not-text',
  'do_not_text',
  'donottext',
  'no-sms',
  'no_sms',
  'dnc-registry',
  'dnc_registry',
] as const

const PROTECTED_REASON_MARKERS = [
  'stop-keyword',
  'twilio-opt-out',
  'unsubscribe',
  'unsubscribed',
  'bounce',
  'bounced',
  'complaint',
  'complained',
  'hard-stop',
  'hard_stop',
  'litigator',
  'deceased',
  'gpc',
] as const

const EVENT_LABEL: Record<InboundConsentEvent, string> = {
  call: 'inbound call',
  voicemail: 'inbound voicemail',
  sms: 'inbound SMS',
  email: 'inbound email reply',
}

function norm(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

/** True when the inbound SMS is an explicit TCPA STOP / opt-out keyword. */
export function isSmsStopKeyword(body: string | null | undefined): boolean {
  const tokens = norm(body).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  if (SMS_STOP_KEYWORDS.has(tokens[0])) return true
  return tokens.every((t) => SMS_STOP_KEYWORDS.has(t))
}

export function isBrokerFlagTag(tag: string): boolean {
  return norm(tag).startsWith('broker:')
}

export function isClearableContactTag(tag: string): boolean {
  const key = norm(tag)
  if (!key || isBrokerFlagTag(key)) return false
  return CLEARABLE_TAGS.has(key)
}

export function isProtectedInboundClearReason(reason: string): boolean {
  const key = norm(reason)
  if (!key) return true
  return PROTECTED_REASON_MARKERS.some((m) => key === m || key.includes(m))
}

export function isClearablePhoneSuppression(row: Pick<InboundConsentSuppression, 'channel' | 'reason'>): boolean {
  const channel = norm(row.channel)
  if (channel === 'email') return false
  if (channel !== 'sms' && channel !== 'call' && channel !== 'all') return false
  if (isProtectedInboundClearReason(row.reason)) return false
  const reason = norm(row.reason)
  return CLEARABLE_REASON_MARKERS.some((m) => reason === m || reason.includes(m))
}

function eventLabel(event: InboundConsentEvent): string {
  return EVENT_LABEL[event]
}

function buildNote(input: {
  event: InboundConsentEvent
  eventId?: string | null
  tagsToRemove: string[]
  suppressionCount: number
}): { noteTitle: string; noteBody: string } {
  const label = eventLabel(input.event)
  const tags = input.tagsToRemove.length ? input.tagsToRemove.join(', ') : 'none'
  const sid = (input.eventId ?? '').trim()
  return {
    noteTitle: `Cleared do-not-call / no-SMS flags after ${label}`,
    noteBody: [
      `Removed tags: ${tags}.`,
      `Cleared ${input.suppressionCount} phone suppression${input.suppressionCount === 1 ? '' : 's'}.`,
      `They reached us by ${label}${sid ? ` (${sid})` : ''} after a CRM-tracked email.`,
      'Broker flags and the email unsubscribe flag were left in place.',
    ].join(' '),
  }
}

/**
 * Decide whether this inbound event may lift DNC / no-SMS flags.
 * Never clears on STOP. Never clears without a prior tracked send.
 * Never touches broker flags or email unsubscribe.
 */
export function planInboundConsentClear(input: {
  event: InboundConsentEvent
  smsBody?: string | null
  hasTrackedSend: boolean
  tags: readonly string[]
  suppressions: readonly InboundConsentSuppression[]
  eventId?: string | null
}): InboundConsentPlan {
  const tags = Array.isArray(input.tags) ? [...input.tags] : []
  if (input.event === 'sms' && isSmsStopKeyword(input.smsBody)) {
    return {
      action: 'skip-stop',
      tagsToRemove: [],
      nextTags: tags,
      suppressionIdsToClear: [],
      noteTitle: null,
      noteBody: null,
    }
  }
  if (!input.hasTrackedSend) {
    return {
      action: 'skip-no-send',
      tagsToRemove: [],
      nextTags: tags,
      suppressionIdsToClear: [],
      noteTitle: null,
      noteBody: null,
    }
  }

  const tagsToRemove = tags.filter((t) => isClearableContactTag(t))
  const nextTags = tags.filter((t) => !isClearableContactTag(t))
  const suppressionIdsToClear = input.suppressions
    .filter((row) => isClearablePhoneSuppression(row))
    .map((row) => row.id)
    .filter((id) => Number.isInteger(id) && id > 0)

  if (tagsToRemove.length === 0 && suppressionIdsToClear.length === 0) {
    return {
      action: 'skip-nothing',
      tagsToRemove: [],
      nextTags: tags,
      suppressionIdsToClear: [],
      noteTitle: null,
      noteBody: null,
    }
  }

  const note = buildNote({
    event: input.event,
    eventId: input.eventId,
    tagsToRemove,
    suppressionCount: suppressionIdsToClear.length,
  })
  return {
    action: 'clear',
    tagsToRemove,
    nextTags,
    suppressionIdsToClear,
    noteTitle: note.noteTitle,
    noteBody: note.noteBody,
  }
}

export function inboundConsentDedupeKey(input: {
  personId: number
  event: InboundConsentEvent
  eventId?: string | null
}): string {
  const sid = (input.eventId ?? '').trim() || 'none'
  return `inbound-consent-clear:${input.event}:${sid}:p${input.personId}`
}
