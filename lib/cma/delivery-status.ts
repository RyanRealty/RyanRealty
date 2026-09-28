/**
 * How a sent CMA reads after the mailbox reports on it.
 *
 * cmas.delivered_at stays. That column is when the send left, not an SMTP
 * receipt. A hard bounce is a later fact on build_summary.delivery so the
 * admin badge can say Bounced without wiping the send. A stamp older than
 * the row's current delivered_at is a previous attempt: the broker sent
 * again, and that stamp no longer counts. Send does not clear it.
 */

export const CMA_BOUNCED_LABEL = 'Bounced'

export type CmaDeliveryMark = 'bounced' | 'deferred'

export type CmaHardBounceStamp = {
  status: 'bounced'
  at: string
  enhanced_status: string | null
  smtp_code: string | null
  recipient: string | null
  diagnostic: string | null
  source: 'gmail-dsn'
}

function deliveryRecord(summary: unknown): Record<string, unknown> | null {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return null
  const delivery = (summary as Record<string, unknown>).delivery
  if (!delivery || typeof delivery !== 'object' || Array.isArray(delivery)) return null
  return delivery as Record<string, unknown>
}

/**
 * The bounce stamp counts only when its `at` is at or after delivered_at.
 * No delivered_at means no later send has replaced it, so the stamp counts.
 * A stamp with no readable `at` does not count once a send time is on the row.
 * Deferred is not a bounce and is not compared to the send.
 */
export function readCmaDeliveryStatus(
  summary: unknown,
  deliveredAt: string | null,
): CmaDeliveryMark | null {
  const delivery = deliveryRecord(summary)
  if (!delivery) return null
  const status = delivery.status
  if (status === 'deferred') return 'deferred'
  if (status !== 'bounced') return null
  if (!bounceStampCoversSend(delivery, deliveredAt)) return null
  return 'bounced'
}

/** A bounced stamp is on the summary, including one a later send has superseded. */
export function hasCmaBounceStamp(summary: unknown): boolean {
  return deliveryRecord(summary)?.status === 'bounced'
}

function bounceStampCoversSend(delivery: Record<string, unknown>, deliveredAt: string | null): boolean {
  const sent = (deliveredAt ?? '').trim()
  if (!sent) return true
  const at = typeof delivery.at === 'string' ? delivery.at.trim() : ''
  const stampMs = Date.parse(at)
  const sentMs = Date.parse(sent)
  if (!Number.isFinite(stampMs) || !Number.isFinite(sentMs)) return false
  return stampMs >= sentMs
}

/**
 * A successful rebuild replaces build_summary. The bounce stamp is not a
 * build product, so it is copied onto the new object. build_error_code is
 * not copied: a successful build clears that failure. judge_cache is left
 * as the new summary already has it.
 */
export function carryDeliveryAcrossRebuild(
  next: Record<string, unknown>,
  prior: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!prior || typeof prior !== 'object' || Array.isArray(prior)) return next
  if (!Object.prototype.hasOwnProperty.call(prior, 'delivery')) return next
  return { ...next, delivery: prior.delivery }
}

/**
 * Copy build_summary and set delivery. Every other key stays, including the
 * prior letter. html_path is not a summary field and is not written here.
 */
export function mergeCmaDelivery(
  current: Record<string, unknown>,
  stamp: CmaHardBounceStamp,
): Record<string, unknown> {
  return { ...current, delivery: stamp }
}

export function cmaSlugFromSentEvent(sent: {
  send_type?: string | null
  email_key?: string | null
  meta?: Record<string, unknown> | null
}): string | null {
  const meta = sent.meta && typeof sent.meta === 'object' && !Array.isArray(sent.meta) ? sent.meta : {}
  const fromMeta = typeof meta.slug === 'string' ? meta.slug.trim().toLowerCase() : ''
  const key = (sent.email_key ?? '').trim()
  const fromKey = key.toLowerCase().startsWith('cma:') ? key.slice(4).trim().toLowerCase() : ''
  const slug = fromMeta || fromKey
  if (!slug) return null
  const type = (sent.send_type ?? '').trim().toLowerCase()
  if (type === 'cma' || fromKey || fromMeta) return slug
  return null
}

/** A hard bounce is not a delivery, even when an inferred delivered event exists. */
export function countsAsEmailDelivered(deliveredAt: string | null, bounced: boolean): boolean {
  if (bounced) return false
  return Boolean(deliveredAt)
}
