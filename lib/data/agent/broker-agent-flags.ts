/**
 * lib/data/agent/broker-agent-flags.ts — DAL for the per-broker SMS-agent
 * pilot flag (public.brokers.sms_agent_enabled, R1.4).
 *
 * This is the pilot mechanism (R5.2 — Matt-only first) AND the lost-phone
 * deregistration: flipping a broker's flag off is a one-step kill switch for
 * that broker's agent thread, independent of the global BROKER_SMS_AGENT_ENABLED
 * env kill switch. Default false on every row (migration
 * 20260801051000_broker_sms_agent_tables.sql) — a broker is opted OUT until
 * explicitly enabled.
 *
 * brokers.slug (e.g. 'matthew-ryan') is not the CRM slug the agent contract
 * uses ('matt' | 'rebecca' | 'paul' — lib/agent/types.ts BrokerSlug). Resolve
 * through email, the same join key lib/data/crm/getBrokerTelephony.ts uses.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_BROKER_BY_EMAIL, CRM_BROKERS } from '@/lib/crm/constants'
import type { BrokerSlug } from '@/lib/agent/types'

export function isSmsAgentBrokerSlug(slug: string): slug is BrokerSlug {
  return (CRM_BROKERS as readonly string[]).includes(slug)
}

/** Site-wide kill switch. Per-broker flags do nothing while this is off. */
export function isBrokerSmsAgentEnvEnabled(): boolean {
  return process.env.BROKER_SMS_AGENT_ENABLED === 'true'
}

const EMAIL_BY_BROKER_SLUG: Partial<Record<BrokerSlug, string>> = (() => {
  const out: Partial<Record<BrokerSlug, string>> = {}
  for (const [email, slug] of Object.entries(CRM_BROKER_BY_EMAIL)) {
    out[slug as BrokerSlug] = email
  }
  return out
})()

/** Fail-closed: DB unreachable, no email mapping, or the flag itself is
 *  false/null all resolve to "not enabled" — never fail open on a pilot gate. */
export async function isAgentEnabledForBroker(slug: BrokerSlug): Promise<boolean> {
  const email = EMAIL_BY_BROKER_SLUG[slug]
  if (!email) return false
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('brokers')
    .select('sms_agent_enabled')
    .ilike('email', email)
    .eq('is_active', true)
    .maybeSingle()
  if (error) {
    console.error('[isAgentEnabledForBroker]', error.message)
    return false
  }
  return (data as { sms_agent_enabled?: boolean | null } | null)?.sms_agent_enabled === true
}

/** Flip the pilot flag. Used by the admin toggle, R5.2 pilot enrollment,
 *  and the STOP/PAUSE keyword path. */
export async function setAgentEnabled(slug: BrokerSlug, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const email = EMAIL_BY_BROKER_SLUG[slug]
  if (!email) return { ok: false, error: `no email mapping for broker slug "${slug}"` }
  const sb = createServiceClient()
  const { error } = await sb.from('brokers').update({ sms_agent_enabled: enabled }).ilike('email', email)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
