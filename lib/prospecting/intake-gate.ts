/**
 * Expired and FSBO intake decision (Matt 2026-10-05).
 *
 * Order is fixed: live status, then compliance, then a sendable email.
 * A proceed decision is the only one that may create a CRM person or a CMA.
 * Seller and lead-form CMAs do not use this gate.
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
  | 'no-sendable-email'

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
      email: string
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
}

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
  if (input.emailSuppressed) return { action: 'skip', reason: 'email-suppressed', ...carry }
  const email = (input.email ?? '').trim().toLowerCase()
  if (!hasSendableEmail(email)) return { action: 'skip', reason: 'no-sendable-email', ...carry }
  return { action: 'proceed', email, emailHardStop: false, flags: mapped.flags, tags: mapped.tags }
}
