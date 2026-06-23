/**
 * Twilio message-status classifier (blueprint Phase 9.4 — delivery receipts).
 *
 * Twilio POSTs a StatusCallback for every outbound message as it moves through
 * the delivery lifecycle: queued -> sent -> delivered (or -> undelivered/failed).
 * The /api/twilio/status route writes the latest state onto the matching
 * crm_timeline sms_out row. This module is the PURE, testable core: given a
 * MessageStatus + optional ErrorCode it returns the normalized state, whether a
 * carrier filtered the message, and whether the SMS channel must be suppressed.
 *
 * Carrier filtering (ErrorCode 30007/30008) means the carrier silently dropped
 * the text — the contact never saw it. It is detectable but NOT auto-suppressed
 * here: a single carrier filter is often transient (spam heuristics on one
 * message), so the route records it without writing a suppression. Hard opt-outs
 * (21610 STOP) are the only delivery-receipt code that suppresses.
 */

/** Normalized terminal/interim state we persist for an sms_out row. */
export type SmsDeliveryState = 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed' | 'unknown'

export interface ClassifiedSmsStatus {
  /** Normalized lifecycle state. */
  state: SmsDeliveryState
  /** True when ErrorCode 30007/30008 — the carrier filtered/blocked the message. */
  carrierFiltered: boolean
  /** True only when the delivery receipt itself implies a permanent opt-out (21610 STOP). */
  shouldSuppress: boolean
  /** The numeric Twilio error code, when one was reported. */
  errorCode: number | null
}

/** Twilio MessageStatus value -> our normalized state. */
const STATE_MAP: Record<string, SmsDeliveryState> = {
  queued: 'queued',
  accepted: 'queued',
  scheduled: 'queued',
  sending: 'sending',
  sent: 'sent',
  delivered: 'delivered',
  undelivered: 'undelivered',
  failed: 'failed',
  // 'read' (RCS/WhatsApp) is strictly past delivered — treat as delivered.
  read: 'delivered',
}

/** Carrier-filtering error codes — the carrier dropped the message before delivery. */
const CARRIER_FILTERED_CODES = new Set([30007, 30008])

/** Delivery-receipt codes that mean a permanent opt-out and must suppress the sms channel. */
const SUPPRESS_CODES = new Set([21610])

/**
 * Classify a Twilio status callback. Pure: no I/O, no env, no Date.
 *
 * @param status   the MessageStatus form field (case-insensitive)
 * @param errorCode the ErrorCode form field, if present (string | number | null)
 */
export function classifyTwilioStatus(
  status: string | null | undefined,
  errorCode: string | number | null | undefined,
): ClassifiedSmsStatus {
  const state = STATE_MAP[String(status ?? '').trim().toLowerCase()] ?? 'unknown'

  const parsed = errorCode === null || errorCode === undefined || String(errorCode).trim() === ''
    ? null
    : Number(errorCode)
  const code = parsed !== null && Number.isFinite(parsed) ? parsed : null

  const carrierFiltered = code !== null && CARRIER_FILTERED_CODES.has(code)
  const shouldSuppress = code !== null && SUPPRESS_CODES.has(code)

  return { state, carrierFiltered, shouldSuppress, errorCode: code }
}

/**
 * Forward-only ranking of delivery states. A late-arriving callback (Twilio does
 * not guarantee ordering) must never roll a row backward: once 'delivered', a
 * stray 'sent' that lands afterward is ignored. Higher rank wins.
 */
const STATE_RANK: Record<SmsDeliveryState, number> = {
  unknown: 0,
  queued: 1,
  sending: 2,
  sent: 3,
  // delivered and the failure terminals are all terminal — equal top rank so a
  // terminal state never overwrites another terminal state.
  delivered: 4,
  undelivered: 4,
  failed: 4,
}

/**
 * True when transitioning from `current` to `next` is allowed under the
 * forward-only rule. A null/unknown current always advances; equal-or-lower
 * incoming states are rejected (the late-'sent'-after-'delivered' case).
 */
export function isForwardStateTransition(current: SmsDeliveryState | null | undefined, next: SmsDeliveryState): boolean {
  if (!current) return true
  return STATE_RANK[next] > STATE_RANK[current]
}
