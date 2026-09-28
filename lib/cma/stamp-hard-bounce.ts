/**
 * Stamp a hard bounce onto the CMA row the sent event belongs to.
 *
 * Writes build_summary.delivery only. delivered_at and status stay, so the
 * send time is still on the row and the queue reads the stamp instead.
 */
import 'server-only'

import { readCmaBuildSummaryForMerge, updateCmaRowFieldsBySlug } from '@/lib/data'
import {
  cmaSlugFromSentEvent,
  mergeCmaDelivery,
  type CmaHardBounceStamp,
} from '@/lib/cma/delivery-status'

export async function stampCmaHardBounce(args: {
  sendType: string | null
  emailKey: string | null
  meta: Record<string, unknown> | null
  recipientEmail: string | null
  enhancedStatus: string | null
  smtpCode: string | null
  diagnostic: string | null
  at?: string
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const slug = cmaSlugFromSentEvent({
    send_type: args.sendType,
    email_key: args.emailKey,
    meta: args.meta,
  })
  if (!slug) return { ok: true, skipped: true }
  const prior = await readCmaBuildSummaryForMerge(slug)
  if (!prior.ok) return { ok: false, error: prior.error }
  const stamp: CmaHardBounceStamp = {
    status: 'bounced',
    at: args.at ?? new Date().toISOString(),
    enhanced_status: args.enhancedStatus,
    smtp_code: args.smtpCode,
    recipient: (args.recipientEmail ?? '').trim().toLowerCase() || null,
    diagnostic: args.diagnostic ? args.diagnostic.slice(0, 500) : null,
    source: 'gmail-dsn',
  }
  const written = await updateCmaRowFieldsBySlug(slug, {
    build_summary: mergeCmaDelivery(prior.summary, stamp),
  })
  return written.ok ? { ok: true } : { ok: false, error: written.error ?? 'update failed' }
}
