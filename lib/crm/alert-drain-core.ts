/**
 * alert-drain-core — pure decision logic for the serverless crm_broker_alerts
 * drain (W5.5). Extracted so the safety rules are unit-tested and gate-pinned:
 *
 *   - BROKER-PHONE WHITELIST (the 2026-06-16 incident backstop): the drain
 *     sends ONLY internal broker alerts (Matt / Rebecca / Paul). Any queued row
 *     whose to_phone is not a broker line is refused, never sent — lead SMS
 *     belongs to the A2P messaging paths, not this channel.
 *   - RETRY POLICY: transient failures retry up to 3 attempts, then terminal
 *     'failed' (mirrors the mac-mini relay).
 *
 * Shared by app/api/cron/crm-alert-drain (serverless) and asserted by
 * scripts/check-crm-sms-channel-safety.mjs.
 */

/** Last 10 digits — the phone identity used for whitelist comparison. */
export function last10(phone: string | null | undefined): string {
  return String(phone ?? '').replace(/\D/g, '').slice(-10)
}

/** The broker cell whitelist from env (TWILIO_FORWARD_*). */
export function brokerPhoneSet(env: {
  TWILIO_FORWARD_MATT?: string
  TWILIO_FORWARD_REBECCA?: string
  TWILIO_FORWARD_PAUL?: string
}): Set<string> {
  return new Set(
    [env.TWILIO_FORWARD_MATT, env.TWILIO_FORWARD_REBECCA, env.TWILIO_FORWARD_PAUL]
      .map(last10)
      .filter(Boolean),
  )
}

/** True only when to_phone is one of the three broker lines. */
export function isBrokerPhone(toPhone: string | null | undefined, whitelist: Set<string>): boolean {
  const key = last10(toPhone)
  return key.length === 10 && whitelist.has(key)
}

/** Normalize a stored phone to E.164 (+1XXXXXXXXXX) for the Twilio API. */
export function toE164(phone: string): string {
  return phone.startsWith('+') ? phone : `+1${last10(phone)}`
}

export const MAX_ATTEMPTS = 3

/** Failure transition: retry (back to pending) until MAX_ATTEMPTS, then terminal. */
export function failureTransition(currentAttempts: number | null | undefined): {
  attempts: number
  status: 'pending' | 'failed'
} {
  const attempts = (currentAttempts ?? 0) + 1
  return { attempts, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending' }
}

/** The policy-refusal message for a non-broker to_phone (same wording family as the relay). */
export const NON_BROKER_REFUSAL =
  'skipped: non-broker to_phone, lead SMS must use the A2P messaging paths, never the broker alert channel'
