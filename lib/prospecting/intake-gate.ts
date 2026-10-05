/**
 * Expired and FSBO intake decision (Matt 2026-10-05).
 *
 * Order is fixed: live status, then compliance, then a sendable email,
 * then a cell. A proceed decision is the only one that may create a CRM
 * person or a CMA. Email still wins when both exist. A cell with no
 * sendable email proceeds on SMS. Seller and lead-form CMAs do not use
 * this gate. This module does not send.
 */
import { hasSendableEmail } from '@/lib/data/prospecting/types'
import { complianceFromSkipTrace } from '@/lib/owner-resolution.mjs'

/** Flags that close every channel, including email. */
export const EMAIL_HARD_STOP_FLAGS = new Set(['litigator', 'deceased', 'hard-stop'])

/** Phone-only flags. They close sms and call. They leave email open. */
export const PHONE_BLOCK_FLAGS = new Set([
  'dnc',
  'dnc:tcpa',
  'do-not-call',
  'do_not_call',
  'do-not-text',
])

export type ProspectIntakeSkipReason =
  | 'back-on-market'
  | 'litigator'
  | 'deceased'
  | 'email-suppressed'
  | 'sms-blocked'
  | 'no-sendable-email'

/** Skip-trace line types that can take an SMS. Landline, VOIP, and a blank type are not cells. */
const CELL_LINE_TYPE = /mobile|wireless|cell/i

export type IntakePhone = {
  number?: string | null
  value?: string | null
  type?: string | null
  dnc?: boolean | null
}

export type ProspectIntakeDecision =
  | {
      action: 'skip'
      reason: ProspectIntakeSkipReason
      emailHardStop: boolean
      flags: string[]
      tags: string[]
    }
  | {
      action: 'proceed'
      channel: 'email' | 'sms'
      email: string | null
      phone: string | null
      emailHardStop: false
      flags: string[]
      tags: string[]
    }

export type ProspectIntakeInput = {
  onMarket: boolean
  litigator: boolean
  deceased: boolean
  dncTcpa: boolean
  dncPhone: boolean
  email: string | null | undefined
  emailSuppressed: boolean
  /** Skip-trace phones, with line type. An untyped number is not a cell. */
  phones?: readonly IntakePhone[] | null
}

export function isCellLineType(type: string | null | undefined): boolean {
  const t = (type ?? '').trim()
  if (!t) return false
  return CELL_LINE_TYPE.test(t)
}

/** First non-DNC mobile, wireless, or cell number. Digits only, 10-digit national form. */
export function pickSendableCell(phones: readonly IntakePhone[] | null | undefined): string | null {
  for (const phone of phones ?? []) {
    if (phone.dnc) continue
    if (!isCellLineType(phone.type)) continue
    const digits = String(phone.number ?? phone.value ?? '').replace(/\D/g, '')
    if (digits.length === 10) return digits
    if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  }
  return null
}

const SMS_BLOCK_TAGS = new Set(['contact:do-not-call', 'contact:do-not-text', 'compliance:dnc-registry'])

/** True only when the intake decision allows a person and a CMA. */
export function intakeBuildsCma(decision: ProspectIntakeDecision): decision is Extract<ProspectIntakeDecision, { action: 'proceed' }> {
  return decision.action === 'proceed'
}

/**
 * Email block from the persisted column or an email hard-stop flag.
 * TCPA and DNC phone flags are not in this set.
 */
export function emailBlockedByFlags(flags: readonly string[], persistedHardStop: boolean): string | null {
  if (persistedHardStop) return 'Compliance hard stop on the record'
  const hit = flags.find((f) => EMAIL_HARD_STOP_FLAGS.has(f.toLowerCase()))
  return hit ? `Skip-trace flag: ${hit}` : null
}

/** Phone block from a DNC or TCPA flag. Null when the flag is absent. */
export function phoneBlockedByFlags(flags: readonly string[]): string | null {
  const hit = flags.find((f) => PHONE_BLOCK_FLAGS.has(f.toLowerCase()))
  return hit ? `Skip-trace flag: ${hit}` : null
}

export function decideProspectIntake(input: ProspectIntakeInput): ProspectIntakeDecision {
  const mapped = complianceFromSkipTrace({
    litigator: input.litigator,
    deceased: input.deceased,
    dncTcpa: input.dncTcpa,
    dncPhone: input.dncPhone,
  })
  const carry = {
    emailHardStop: mapped.emailHardStop,
    flags: mapped.flags,
    tags: mapped.tags,
  }
  if (input.onMarket) return { action: 'skip', reason: 'back-on-market', ...carry }
  if (input.litigator) return { action: 'skip', reason: 'litigator', ...carry }
  if (input.deceased) return { action: 'skip', reason: 'deceased', ...carry }
  const email = (input.email ?? '').trim().toLowerCase()
  if (hasSendableEmail(email) && !input.emailSuppressed) {
    return {
      action: 'proceed',
      channel: 'email',
      email,
      phone: null,
      emailHardStop: false,
      flags: mapped.flags,
      tags: mapped.tags,
    }
  }
  // A clean cell is enough. Person-level DNC on some other number must not
  // tag this cell do-not-text. TCPA still blocks the text.
  const cell = pickSendableCell(input.phones)
  if (cell && !input.dncTcpa) {
    return {
      action: 'proceed',
      channel: 'sms',
      email: null,
      phone: cell,
      emailHardStop: false,
      flags: mapped.flags.filter((flag) => !PHONE_BLOCK_FLAGS.has(flag.toLowerCase())),
      tags: mapped.tags.filter((tag) => !SMS_BLOCK_TAGS.has(tag)),
    }
  }
  if (input.emailSuppressed && hasSendableEmail(email)) {
    return { action: 'skip', reason: 'email-suppressed', ...carry }
  }
  if (cell && input.dncTcpa) return { action: 'skip', reason: 'sms-blocked', ...carry }
  return { action: 'skip', reason: 'no-sendable-email', ...carry }
}
