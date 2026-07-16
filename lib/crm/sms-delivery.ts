/**
 * Pure SMS delivery-state reader (admin rebuild — delivery visibility). Shared by
 * the server DAL (inbox thread) and client renderers. The Twilio StatusCallback
 * webhook writes deliveryState / errorCode / carrierFiltered onto an sms_out
 * payload; this turns that into a compact, display-ready summary so the broker can
 * see whether a text actually delivered — previously shown on exactly one surface
 * (desktop person-detail), never in the inbox.
 */
export type SmsDelivery = {
  state: string | null
  errorCode: number | null
  carrierFiltered: boolean
  hasSid: boolean
}

export function readSmsDelivery(payload: unknown): SmsDelivery {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  return {
    state: typeof p.deliveryState === 'string' ? p.deliveryState : null,
    errorCode: typeof p.errorCode === 'number' ? p.errorCode : null,
    carrierFiltered: p.carrierFiltered === true,
    hasSid: typeof p.twilioSid === 'string' && p.twilioSid.length > 0,
  }
}

export type DeliveryTone = 'delivered' | 'sent' | 'pending' | 'failed'

/** A one-word label + tone for a compact delivery indicator, or null when there is
 *  no telemetry to show (imported legacy texts with no Twilio SID). */
export function deliverySummary(d: SmsDelivery): { label: string; tone: DeliveryTone } | null {
  if (!d.hasSid) return null
  if (d.carrierFiltered) return { label: `Carrier blocked${d.errorCode ? ` (${d.errorCode})` : ''}`, tone: 'failed' }
  switch (d.state) {
    case 'delivered':
      return { label: 'Delivered', tone: 'delivered' }
    case 'undelivered':
      return { label: `Undelivered${d.errorCode ? ` (${d.errorCode})` : ''}`, tone: 'failed' }
    case 'failed':
      return { label: `Failed${d.errorCode ? ` (${d.errorCode})` : ''}`, tone: 'failed' }
    case 'sent':
      return { label: 'Sent', tone: 'sent' }
    case 'queued':
      return { label: 'Queued', tone: 'pending' }
    case 'sending':
      return { label: 'Sending', tone: 'pending' }
    default:
      return { label: 'Pending', tone: 'pending' }
  }
}
