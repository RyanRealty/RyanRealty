/**
 * Which inbound texts never reached a broker's phone (Matt 2026-10-12: three
 * texts to Paul's and Rebecca's lines were received by Twilio and silently
 * dropped by the webhook, found only when he asked why).
 *
 * Pure: compares what Twilio received against crm_sms_inbound_log, the outcome
 * the inbound-sms webhook records for every text. A text is a miss when
 *  - Twilio received it and the webhook recorded nothing (never processed),
 *  - the webhook recorded forward_failed, or
 *  - the forward was sent but Twilio reports it failed or undelivered.
 * Recorded deliberate drops (own line, blocked number, STOP) and agent turns
 * are not misses. Texts younger than the grace window, or older than the first
 * log row (before logging existed), are not judged.
 */

export const INBOUND_FORWARD_GRACE_MINUTES = 10

export type TwilioMessageRow = { sid: string; direction: string; to: string; status: string; dateCreated: string }
export type InboundLogRow = { messageSid: string; outcome: string; forwardSid: string | null }
export type UnforwardedText = { sid: string; to: string; why: 'not processed' | 'forward failed' | 'forward undelivered' }

export function findUnforwardedTexts(input: {
  messages: TwilioMessageRow[]
  log: InboundLogRow[]
  /** ts of the earliest crm_sms_inbound_log row; null = table empty. */
  logStartedAt: string | null
  now: Date
}): UnforwardedText[] {
  if (!input.logStartedAt) return []
  const logStart = new Date(input.logStartedAt).getTime()
  const cutoff = input.now.getTime() - INBOUND_FORWARD_GRACE_MINUTES * 60_000
  const bySid = new Map(input.log.map((r) => [r.messageSid, r]))
  const status = new Map(input.messages.map((m) => [m.sid, m.status]))
  const out: UnforwardedText[] = []
  for (const m of input.messages) {
    if (m.direction !== 'inbound') continue
    const at = new Date(m.dateCreated).getTime()
    if (at < logStart || at > cutoff) continue
    const row = bySid.get(m.sid)
    if (!row) {
      out.push({ sid: m.sid, to: m.to, why: 'not processed' })
    } else if (row.outcome === 'forward_failed') {
      out.push({ sid: m.sid, to: m.to, why: 'forward failed' })
    } else if (row.outcome === 'forwarded' && row.forwardSid) {
      const s = status.get(row.forwardSid)
      if (s === 'failed' || s === 'undelivered') out.push({ sid: m.sid, to: m.to, why: 'forward undelivered' })
    }
  }
  return out
}
