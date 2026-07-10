/**
 * /api/cron/crm-health-check — proactive CRM vital alarms (Contact-360 Phase 9.6).
 *
 * Every 30 minutes this gathers the same vitals the 9.5 health board shows and
 * hands them to the PURE evaluateHealthRules (lib/crm/health-rules.ts). For each
 * firing alarm it queues a deduped crm_broker_alert (via queueBrokerHealthAlert
 * in lib/crm/broker-alerts.ts) so a silently-broken mirror, a stale inbound
 * webhook, an A2P regression, a stalled delta sync, or cratered lead volume
 * PAGES the broker (mac-mini relay -> iMessage today, Twilio once A2P verifies)
 * instead of going unnoticed. The dedupe cooldown keeps a persistently-broken
 * vital from texting on every run.
 *
 * This route is G1-exempt (the DAL-boundary gate skips app/api/**), so the vital
 * reads are computed inline here rather than via lib/data. The decision logic
 * lives entirely in the pure helper, which is unit-tested.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (isValidCronAuth).
 * Schedule: vercel.json — every 30 minutes.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isValidCronAuth } from '@/lib/auth/cron-auth'
import { getA2pCampaignStatus, getAccountType } from '@/lib/crm/twilio'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { evaluateHealthRules, type HealthSignals } from '@/lib/crm/health-rules'
import { validateSegment, type CrmNode } from '@/lib/crm/segment-ast'
import { buildCrmPeopleQuery } from '@/lib/data/crm/buildCrmPeopleQuery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Business hours in Pacific time (the broker's market): 8a to 8p, any day. */
const BUSINESS_HOUR_START = 8
const BUSINESS_HOUR_END = 20
/** How far back to look for the last inbound contact + outbound send attempts. */
const INBOUND_LOOKBACK_HOURS = 24
const SEND_LOOKBACK_HOURS = 24
/** Re-page cadence for a still-firing alarm (matches the cron interval x N). */
const ALERT_COOLDOWN_MINUTES = 360

/**
 * Every EXACT geographic term in a segment: subdivision conditions still on the
 * default eq operator, plus neighborhood slugs. These are the 593f5fe4-class
 * inputs — a `subdivision contains` condition is the fixed form and is skipped.
 */
function exactGeoTerms(node: CrmNode): string[] {
  // A group is the only node shape with `type`; conditions are bare records. A
  // 'not' group NEGATES its child — a negated geo condition is not a positive
  // audience term, so it contributes nothing.
  if ('type' in node) return node.op === 'not' ? [] : node.nodes.flatMap(exactGeoTerms)
  if (node.field === 'subdivision' && (node.op === undefined || node.op === 'eq')) return [node.value]
  if (node.field === 'neighborhood') return [node.value]
  return []
}

/**
 * Live undercount signals for every saved view carrying an exact geographic
 * condition. exactCount goes through the ONE compiler (buildCrmPeopleQuery,
 * countOnly, unscoped) so it equals what the CRM UI shows; signalCount probes
 * crm_people.subdivision with the same contains-ilike the compiler emits for
 * the fixed form. Degrades to [] on any error so a read blip never blocks the
 * other health rules.
 */
async function gatherGeoSmartLists(
  sb: ReturnType<typeof createServiceClient>,
): Promise<HealthSignals['geoSmartLists']> {
  try {
    const { data, error } = await sb.from('crm_saved_views').select('id,name,ast').limit(100)
    if (error || !data) return []
    const out: HealthSignals['geoSmartLists'] = []
    for (const row of data) {
      let terms: string[]
      try {
        terms = exactGeoTerms(validateSegment(row.ast))
      } catch {
        continue // a corrupt AST is getCrmSavedViews' problem, not this rule's
      }
      if (terms.length === 0) continue

      const { query } = buildCrmPeopleQuery(sb, validateSegment(row.ast), null, { countOnly: true })
      const exact = await query
      let signalCount = 0
      for (const term of terms) {
        const probe = term.replace(/-/g, ' ').trim()
        if (!probe) continue
        const { count } = await sb
          .from('crm_people')
          .select('id', { count: 'exact', head: true })
          .eq('deleted', false)
          .ilike('subdivision', `%${probe}%`)
        signalCount = Math.max(signalCount, count ?? 0)
      }
      out.push({ id: row.id, name: row.name, exactCount: exact.count ?? 0, signalCount })
    }
    return out
  } catch {
    return []
  }
}

/** True when the wall-clock hour in Pacific is inside business hours. */
function isBusinessHoursPacific(now: Date): boolean {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    hour12: false,
  }).format(now)
  // Intl can return '24' for midnight in some runtimes; normalize to 0..23.
  const hour = Number(hourStr) % 24
  return hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END
}

export async function GET(request: Request) {
  if (!isValidCronAuth(request.headers.get('authorization'), process.env.CRON_SECRET?.trim())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  const now = new Date()
  const sb = createServiceClient()

  const inboundSince = new Date(now.getTime() - INBOUND_LOOKBACK_HOURS * 3600 * 1000).toISOString()
  const sendSince = new Date(now.getTime() - SEND_LOOKBACK_HOURS * 3600 * 1000).toISOString()
  const leadSince = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()

  // ── Gather the vitals (each read independent; one failure does not block the
  // others — a read error degrades to the "unknown" value that rule already
  // handles as stale/null rather than silently passing). ────────────────────
  const [
    lastInbound,
    smsOut24h,
    newLeads24h,
    a2pStatus,
  ] = await Promise.all([
    // Most recent inbound contact (sms_in / call / voicemail) timeline row.
    sb
      .from('crm_timeline')
      .select('ts')
      .in('kind', ['sms_in', 'call', 'voicemail'])
      .gte('ts', inboundSince)
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Outbound SMS send attempts in the window (sms_out timeline rows).
    sb
      .from('crm_timeline')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'sms_out')
      .gte('ts', sendSince),
    // New leads created in the trailing 24h (any source).
    sb
      .from('crm_people')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', leadSince),
    // Live A2P campaign status (network call; null on any failure).
    getA2pCampaignStatus().catch(() => null),
  ])

  const hoursSinceLastInbound =
    lastInbound.data?.ts != null
      ? (now.getTime() - new Date(lastInbound.data.ts as string).getTime()) / 3600000
      : null

  // Twilio reachability: only meaningful when creds are configured. A null here
  // means "not configured" (skip the rule); false means the account ping failed.
  const twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim())
  const twilioReachable = twilioConfigured ? (await getAccountType()) !== null : null

  const geoSmartLists = await gatherGeoSmartLists(sb)

  const signals: HealthSignals = {
    businessHours: isBusinessHoursPacific(now),
    hoursSinceLastInbound,
    a2pStatus,
    smsSendAttempts24h: smsOut24h.count ?? 0,
    newLeads24h: newLeads24h.count ?? 0,
    twilioReachable,
    geoSmartLists,
  }

  const { alarms } = evaluateHealthRules(signals)

  // Queue a deduped broker alert per firing alarm. queueBrokerHealthAlert
  // suppresses a same-key re-alert inside the cooldown window so a still-broken
  // vital does not text every run.
  let queued = 0
  for (const alarm of alarms) {
    const ok = await queueBrokerHealthAlert({
      key: alarm.key,
      body: alarm.message,
      cooldownMinutes: ALERT_COOLDOWN_MINUTES,
    })
    if (ok) queued++
  }

  return NextResponse.json({
    ok: true,
    checked_at: now.toISOString(),
    signals,
    alarms,
    alarms_firing: alarms.length,
    alerts_queued: queued,
    duration_ms: Date.now() - startMs,
  })
}
