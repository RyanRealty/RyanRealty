/**
 * Weekly pipeline-health digest for Matt only.
 *
 * Schedule: 0 15 * * 1  (Monday 15:00 UTC = 08:00 PT during DST).
 *
 * Aggregates the prior 7 days:
 *   1. Count new leads by audience (seller, buyer, unknown) — from crm_people,
 *      outreach-list rows (Farm/Import/Sphere/Expired/FSBO) partitioned out via
 *      leadSourceTaxonomy so bulk prospecting batches never read as leads.
 *   2. Count new leads by source (top 10) — same partitioned rows.
 *   3. Pull totals: conversations + active deals + pipeline value from crm_*,
 *      appointments from crm_appointments.
 *   4. Compose one key insight (e.g. expired-listing detection cadence), plus
 *      an outreach-adds note when a prospecting batch landed this week.
 *
 * Every figure traces to our own crm_* tables. The FUB smart-list and
 * appointment fetches were deleted 2026-07-14: FUB API access was
 * decommissioned 2026-06-24 (getFubApiKey() is hardcoded undefined — see
 * lib/crm/fub-env.ts), so those calls could only ever return a fabricated
 * zero/empty, which the data-accuracy mandate forbids. The smart-list section
 * of the email now renders its honest empty state ("No smart list data.").
 *
 * Brand voice §4.7. Sentence case, no em-dashes, no banned cliches.
 * Auth: Bearer $CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import {
  WeeklyPipelineDigestEmail,
  type AudienceCount,
  type SourceCount,
  type SmartListMovement,
} from '@/lib/digest-email-templates'
import { getWeeklyPipelineDigest, summarizeWeeklyLeads } from '@/lib/data/crm/getBrokerDigest'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

/**
 * Appointments in the window from crm_appointments — the same source and
 * person-linked filter getOverviewReport uses, so the digest agrees with
 * /admin/crm/reporting. Exact database COUNT(*) via head:true.
 */
async function countAppointmentsThisWeek(
  supabase: ReturnType<typeof getServiceSupabase>,
  sinceIso: string,
  untilIso: string,
): Promise<number> {
  if (!supabase) return 0
  try {
    const { count, error } = await supabase
      .from('crm_appointments')
      .select('id', { count: 'exact', head: true })
      .not('person_id', 'is', null)
      .gte('start_at', sinceIso)
      .lte('start_at', untilIso)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

async function buildKeyInsight(supabase: ReturnType<typeof getServiceSupabase>, sinceIso: string): Promise<string> {
  if (!supabase) return 'No insight available this week.'
  try {
    void supabase
    const { getExpiredListingsForDigest } = await import('@/lib/data')
    const data = await getExpiredListingsForDigest({ sinceIso, limit: 100 })
    const rows = Array.isArray(data) ? data : []
    if (rows.length === 0) {
      return 'No expired listings detected this week.'
    }
    // Compute average hours from detected_at to alert_sent_at when present.
    const deltas: number[] = []
    for (const r of rows as Array<{ detected_at?: string; alert_sent_at?: string }>) {
      if (!r.detected_at || !r.alert_sent_at) continue
      const a = new Date(r.detected_at).getTime()
      const b = new Date(r.alert_sent_at).getTime()
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
        deltas.push((b - a) / 3600000)
      }
    }
    const total = rows.length
    if (deltas.length === 0) {
      return `Expired-listing detection caught ${total} new this week.`
    }
    const avg = deltas.reduce((s, x) => s + x, 0) / deltas.length
    return `Expired-listing detection caught ${total} new this week. Average ${avg.toFixed(1)} hours from detection to alert.`
  } catch {
    return 'No insight available this week.'
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === 'true'

  const fromEnv = process.env.RESEND_FROM?.trim() || 'Matt Ryan <matt@ryan-realty.com>'
  // Recipients: the Company Settings "Weekly Report Recipients" list (spec
  // §15/§1.7) when configured; otherwise the env/owner fallback. Fail soft to
  // the fallback so a settings-read failure never skips the digest.
  let configuredRecipients: string[] = []
  try {
    configuredRecipients = (await getCrmCompanySettings()).weekly_report_recipients
  } catch {
    configuredRecipients = []
  }
  const recipient: string | string[] = configuredRecipients.length
    ? configuredRecipients
    : process.env.WEEKLY_DIGEST_EMAIL?.trim() || 'matt@ryan-realty.com'

  const now = new Date()
  // Monday-of-this-week label
  const day = now.getUTCDay() // 0=Sun, 1=Mon
  const daysBackToMon = day === 0 ? 6 : day - 1
  const monday = new Date(now.getTime() - daysBackToMon * 86400000)
  const weekOfDate = monday.toISOString().slice(0, 10)
  const sinceIso = new Date(now.getTime() - 7 * 86400000).toISOString()

  const supabase = getServiceSupabase()

  // Pull data in parallel — every section reads our own crm_* tables. Leads
  // (outreach-partitioned) + deals + conversations via getWeeklyPipelineDigest;
  // appointments via crm_appointments.
  const [crm, appointments, keyInsight] = await Promise.all([
    getWeeklyPipelineDigest({ weekStartIso: sinceIso }),
    countAppointmentsThisWeek(supabase, sinceIso, now.toISOString()),
    buildKeyInsight(supabase, sinceIso),
  ])

  const leadSummary = summarizeWeeklyLeads(crm.newLeads)
  const deals = crm.activeDeals
  const conversations = crm.conversations

  const newLeadsByAudience: AudienceCount[] = leadSummary.byAudience
  const newLeadsBySource: SourceCount[] = leadSummary.bySource

  // FUB smart lists are gone (decommissioned 2026-06-24); the email template
  // renders "No smart list data." for an empty array — honest, not a zero-fill.
  const smartListMovement: SmartListMovement[] = []

  // Surface outreach-list adds as a plain note so a Farm/expired/FSBO batch is
  // visible without being counted as leads.
  const outreachNote =
    crm.outreachAdded > 0
      ? ` ${crm.outreachAdded} ${crm.outreachAdded === 1 ? 'contact was' : 'contacts were'} added from outreach lists this week and ${crm.outreachAdded === 1 ? 'is' : 'are'} not counted as leads.`
      : ''

  const subject = `Ryan Realty pipeline, week of ${weekOfDate}`
  const payload = {
    weekOfDate,
    newLeadsByAudience,
    newLeadsBySource,
    smartListMovement,
    totals: {
      conversations,
      appointments,
      activeDeals: deals.count,
      pipelineValue: deals.value,
    },
    keyInsight: `${keyInsight}${outreachNote}`,
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, subject, payload })
  }

  const sent = await sendEmail({
    to: recipient,
    from: fromEnv,
    subject,
    replyTo: 'matt@ryan-realty.com',
    react: WeeklyPipelineDigestEmail(payload),
  })

  return NextResponse.json({
    ok: !sent.error,
    subject,
    emailId: sent.id,
    error: sent.error,
    payload,
  })
}
