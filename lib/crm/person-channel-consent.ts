/**
 * Person channel consent (SMS / email / call).
 *
 * CMA report-bar answers live on `crm_people.custom.cmaConsent` `{sms, email}`.
 * Declined-SMS also shows as `sms-consent:no` and the soft `no-sms-consent`
 * suppression. Call consent is the DNC tag / suppression. TCPA STOP and
 * CAN-SPAM unsubscribe stay hard locks: an inbound clear and an admin toggle
 * to "allowed" both refuse those.
 *
 * Pure so inbound auto-clear and the person-page editor share one decision.
 */

export type ConsentChannel = 'sms' | 'email' | 'call'

export type CmaConsentRecord = {
  sms: boolean
  email: boolean
  at?: string
  slug?: string
  viewer?: string
  consentVersion?: string
  [key: string]: unknown
}

export type ChannelConsentView = {
  channel: ConsentChannel
  allowed: boolean
  lockedReason: string | null
}

export type PersonChannelConsentView = {
  sms: ChannelConsentView
  email: ChannelConsentView
  call: ChannelConsentView
  cmaConsent: CmaConsentRecord | null
}

export type ConsentSuppression = {
  id?: number
  channel: string
  reason: string
}

export type PersonChannelConsentEditPlan =
  | {
      action: 'noop'
      channel: ConsentChannel
      allowed: boolean
      nextTags: string[]
      nextCmaConsent: CmaConsentRecord | null
      suppressionIdsToClear: number[]
      addSuppression: { channel: 'sms' | 'email' | 'call'; reason: string } | null
      noteTitle: string | null
      noteBody: string | null
    }
  | {
      action: 'refuse'
      channel: ConsentChannel
      allowed: boolean
      refuseReason: string
      nextTags: string[]
      nextCmaConsent: CmaConsentRecord | null
      suppressionIdsToClear: number[]
      addSuppression: null
      noteTitle: string | null
      noteBody: string | null
    }
  | {
      action: 'apply'
      channel: ConsentChannel
      allowed: boolean
      nextTags: string[]
      nextCmaConsent: CmaConsentRecord | null
      suppressionIdsToClear: number[]
      addSuppression: { channel: 'sms' | 'email' | 'call'; reason: string } | null
      noteTitle: string
      noteBody: string
    }

const DNC_TAGS = new Set(['contact:do-not-call', 'do_not_call', 'do-not-call'])
const DNT_TAGS = new Set(['contact:do-not-text', 'do_not_text', 'do-not-text', 'sms-consent:no'])
const SMS_YES_TAG = 'sms-consent:yes'
const SMS_NO_TAG = 'sms-consent:no'
const DNC_TAG = 'contact:do-not-call'
const DNT_TAG = 'contact:do-not-text'

const STOP_MARKERS = ['stop-keyword', 'twilio-opt-out']
const EMAIL_HARD_MARKERS = ['unsubscribe', 'unsubscribed', 'bounce', 'bounced', 'complaint', 'complained']
const HARD_STOP_MARKERS = ['hard-stop', 'hard_stop', 'litigator', 'deceased']

function norm(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

function reasonHas(reason: string, markers: readonly string[]): boolean {
  const key = norm(reason)
  return markers.some((m) => key === m || key.includes(m))
}

export function readCmaConsent(custom: unknown): CmaConsentRecord | null {
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return null
  const raw = (custom as Record<string, unknown>).cmaConsent
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  return {
    ...rec,
    sms: rec.sms === true,
    email: rec.email === true,
  }
}

export function cmaConsentNeedsReset(consent: CmaConsentRecord | null): boolean {
  return Boolean(consent && (consent.sms === false || consent.email === false))
}

export function resetCmaConsentAllowed(consent: CmaConsentRecord): CmaConsentRecord {
  return { ...consent, sms: true, email: true }
}

export function isDeclinedSmsTag(tag: string): boolean {
  return DNT_TAGS.has(norm(tag))
}

export function isDncTag(tag: string): boolean {
  return DNC_TAGS.has(norm(tag))
}

export function readPersonChannelConsent(input: {
  tags?: readonly string[] | null
  custom?: unknown
  suppressions?: readonly ConsentSuppression[] | null
}): PersonChannelConsentView {
  const tags = (input.tags ?? []).map((t) => norm(t))
  const suppressions = input.suppressions ?? []
  const cma = readCmaConsent(input.custom)

  const hardAll = suppressions.some((s) => norm(s.channel) === 'all' && reasonHas(s.reason, HARD_STOP_MARKERS))
  const stopSms = suppressions.some(
    (s) => (norm(s.channel) === 'sms' || norm(s.channel) === 'all') && reasonHas(s.reason, STOP_MARKERS),
  )
  const emailHard = suppressions.some(
    (s) => (norm(s.channel) === 'email' || norm(s.channel) === 'all') && reasonHas(s.reason, EMAIL_HARD_MARKERS),
  )
  const dncSup = suppressions.some(
    (s) =>
      (norm(s.channel) === 'call' || norm(s.channel) === 'all') &&
      (reasonHas(s.reason, ['do-not-call', 'do_not_call', 'donotcall']) || reasonHas(s.reason, HARD_STOP_MARKERS)),
  )
  const dntSup = suppressions.some(
    (s) =>
      (norm(s.channel) === 'sms' || norm(s.channel) === 'all') &&
      (reasonHas(s.reason, ['do-not-text', 'do_not_text', 'no-sms', 'no_sms']) || reasonHas(s.reason, HARD_STOP_MARKERS)),
  )

  const smsDeclined =
    cma?.sms === false || tags.includes(SMS_NO_TAG) || tags.some((t) => DNT_TAGS.has(t)) || dntSup || stopSms || hardAll
  const emailDeclined = cma?.email === false || tags.includes('unsubscribed') || emailHard || hardAll
  const callDeclined = tags.some((t) => DNC_TAGS.has(t)) || dncSup || hardAll

  return {
    cmaConsent: cma,
    sms: {
      channel: 'sms',
      allowed: !smsDeclined,
      lockedReason: hardAll ? 'hard-stop' : stopSms ? 'stop-keyword' : null,
    },
    email: {
      channel: 'email',
      allowed: !emailDeclined,
      lockedReason: hardAll ? 'hard-stop' : emailHard ? 'unsubscribe' : null,
    },
    call: {
      channel: 'call',
      allowed: !callDeclined,
      lockedReason: hardAll ? 'hard-stop' : null,
    },
  }
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tags) {
    const key = String(t ?? '').trim()
    if (!key) continue
    const low = key.toLowerCase()
    if (seen.has(low)) continue
    seen.add(low)
    out.push(key)
  }
  return out
}

function dropTags(tags: readonly string[], drop: (tag: string) => boolean): string[] {
  return tags.filter((t) => !drop(t))
}

function writeCmaChannel(existing: CmaConsentRecord | null, channel: 'sms' | 'email', allowed: boolean): CmaConsentRecord {
  const base: CmaConsentRecord = existing ?? {
    sms: true,
    email: true,
    at: new Date(0).toISOString(),
    consentVersion: 'a2p-2026-06',
  }
  return {
    ...base,
    [channel]: allowed,
    at: new Date().toISOString(),
  }
}

function clearableIds(
  suppressions: readonly ConsentSuppression[],
  channel: ConsentChannel,
): number[] {
  const markers =
    channel === 'call'
      ? ['do-not-call', 'do_not_call', 'donotcall']
      : channel === 'sms'
        ? ['do-not-text', 'do_not_text', 'donottext', 'no-sms', 'no_sms', 'no-sms-consent']
        : []
  const channels = channel === 'email' ? [] : channel === 'call' ? ['call', 'all'] : ['sms', 'all']
  return suppressions
    .filter((s) => {
      if (reasonHas(s.reason, STOP_MARKERS) || reasonHas(s.reason, EMAIL_HARD_MARKERS) || reasonHas(s.reason, HARD_STOP_MARKERS)) {
        return false
      }
      if (!channels.includes(norm(s.channel))) return false
      return reasonHas(s.reason, markers)
    })
    .map((s) => Number(s.id))
    .filter((id) => Number.isInteger(id) && id > 0)
}

/**
 * Plan one admin toggle. STOP / unsubscribe / hard-stop refuse an allow.
 * Declining SMS or call writes the matching contact tag + a soft suppression.
 * Email decline only flips CMA consent (never invents a CAN-SPAM unsubscribe).
 */
export function planPersonChannelConsentEdit(input: {
  channel: ConsentChannel
  allowed: boolean
  tags?: readonly string[] | null
  custom?: unknown
  suppressions?: readonly ConsentSuppression[] | null
}): PersonChannelConsentEditPlan {
  const tags = Array.isArray(input.tags) ? [...input.tags] : []
  const suppressions = input.suppressions ?? []
  const current = readPersonChannelConsent({ tags, custom: input.custom, suppressions })
  const cma = current.cmaConsent
  const empty = {
    channel: input.channel,
    allowed: input.allowed,
    nextTags: tags,
    nextCmaConsent: cma,
    suppressionIdsToClear: [] as number[],
    addSuppression: null as { channel: 'sms' | 'email' | 'call'; reason: string } | null,
    noteTitle: null as string | null,
    noteBody: null as string | null,
  }

  if (current[input.channel].allowed === input.allowed) {
    return { action: 'noop', ...empty }
  }

  if (input.allowed && current[input.channel].lockedReason) {
    return {
      action: 'refuse',
      channel: input.channel,
      allowed: input.allowed,
      refuseReason: current[input.channel].lockedReason ?? 'locked',
      nextTags: tags,
      nextCmaConsent: cma,
      suppressionIdsToClear: [],
      addSuppression: null,
      noteTitle: null,
      noteBody: null,
    }
  }

  let nextTags = tags
  let nextCma = cma
  let addSuppression: PersonChannelConsentEditPlan['addSuppression'] = null
  let suppressionIdsToClear: number[] = []
  const label = input.channel === 'sms' ? 'SMS' : input.channel === 'email' ? 'Email' : 'Call'
  const state = input.allowed ? 'allowed' : 'declined'

  if (input.channel === 'sms') {
    if (input.allowed) {
      nextTags = uniqueTags([...dropTags(tags, (t) => isDeclinedSmsTag(t)), SMS_YES_TAG])
      nextCma = writeCmaChannel(cma, 'sms', true)
      suppressionIdsToClear = clearableIds(suppressions, 'sms')
    } else {
      nextTags = uniqueTags([...dropTags(tags, (t) => norm(t) === SMS_YES_TAG), DNT_TAG, SMS_NO_TAG])
      nextCma = writeCmaChannel(cma, 'sms', false)
      addSuppression = { channel: 'sms', reason: 'no-sms-consent' }
    }
  } else if (input.channel === 'email') {
    nextCma = writeCmaChannel(cma, 'email', input.allowed)
  } else if (input.channel === 'call') {
    if (input.allowed) {
      nextTags = dropTags(tags, (t) => isDncTag(t))
      suppressionIdsToClear = clearableIds(suppressions, 'call')
    } else {
      nextTags = uniqueTags([...tags, DNC_TAG])
      addSuppression = { channel: 'call', reason: 'do-not-call' }
    }
  }

  return {
    action: 'apply',
    channel: input.channel,
    allowed: input.allowed,
    nextTags,
    nextCmaConsent: nextCma,
    suppressionIdsToClear,
    addSuppression,
    noteTitle: `${label} consent set to ${state}`,
    noteBody: `${label} consent set to ${state} from the person page.`,
  }
}
