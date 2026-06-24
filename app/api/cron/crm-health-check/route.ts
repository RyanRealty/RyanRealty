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

  const signals: HealthSignals = {
    businessHours: isBusinessHoursPacific(now),
    hoursSinceLastInbound,
    a2pStatus,
    smsSendAttempts24h: smsOut24h.count ?? 0,
    newLeads24h: newLeads24h.count ?? 0,
    twilioReachable,
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
