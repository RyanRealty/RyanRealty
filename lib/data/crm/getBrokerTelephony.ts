import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { CRM_BROKER_BY_EMAIL, type CrmBrokerSlug } from '@/lib/crm/constants'

/**
 * Broker telephony — the single source of truth tying each CRM broker to their
 * Twilio business line and the private cell it forwards to (Twilio cutover,
 * 2026-06-24). Reads public.brokers (twilio_number, forward_to_cell), keyed to
 * the CRM slug via the broker's email. Cached on the brokers tag; the inbound
 * webhook + composer read this (env is the resilience fallback in lib/crm/twilio).
 *
 * `byTwilioLast10` powers dialed-number routing: an inbound call/text to a given
 * Twilio line resolves to the broker who owns that line, regardless of who the
 * caller is.
 */
export type BrokerTelephonyEntry = { twilioNumber: string | null; forwardToCell: string | null; smsOptIn: boolean }
export type BrokerTelephony = {
  bySlug: Partial<Record<CrmBrokerSlug, BrokerTelephonyEntry>>
  /** normalized last-10 of each broker's twilio_number → CRM slug */
  byTwilioLast10: Record<string, CrmBrokerSlug>
}

function last10(v: string | null | undefined): string | null {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : null
}

export const getBrokerTelephony = unstable_cache(
  async (): Promise<BrokerTelephony> => {
    const out: BrokerTelephony = { bySlug: {}, byTwilioLast10: {} }
    const sb = supabaseAnon()
    if (!sb) return out
    const { data, error } = await sb
      .from('brokers')
      .select('email, twilio_number, forward_to_cell, notify_sms')
      .eq('is_active', true)
    if (error || !data) {
      if (error) console.error('[getBrokerTelephony]', error.message)
      return out
    }
    for (const row of data as Array<{ email: string | null; twilio_number: string | null; forward_to_cell: string | null; notify_sms: boolean | null }>) {
      const slug = CRM_BROKER_BY_EMAIL[String(row.email ?? '').trim().toLowerCase()]
      if (!slug) continue
      out.bySlug[slug] = { twilioNumber: row.twilio_number ?? null, forwardToCell: row.forward_to_cell ?? null, smsOptIn: row.notify_sms === true }
      const t10 = last10(row.twilio_number)
      if (t10) out.byTwilioLast10[t10] = slug
    }
    return out
  },
  // v3: cache-key bump on the 2026-07-13 notify_sms flip (Matt → true, so
  // new-lead broker-alert SMS pings start on deploy, not after the 1d TTL).
  // v2 was the 2026-07-02 primary-number fix (Matt → +15417033095, Paul →
  // +15415023436) so the deploy orphans stale entries instead of serving the
  // temp/wrong lines for up to the 1d TTL.
  ['crm-broker-telephony-v3'],
  { revalidate: CACHE_WINDOWS.brokers, tags: [cacheTag.brokers] }
)
