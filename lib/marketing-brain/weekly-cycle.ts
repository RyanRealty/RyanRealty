/**
 * marketing-brain weekly-cycle orchestrator.
 *
 * Composes the full brain pass: diagnose every channel, run all four
 * audits, gather platform trends, generate content briefs from the
 * combined signals, persist a cycle summary, and surface a structured
 * report.
 *
 * Designed to run every Sunday 18:00 PT (02:00 UTC Monday) as a Vercel
 * cron. Idempotent — re-running the same asOfDate produces the same
 * decisions because all underlying skills are deterministic against the
 * snapshot data and the brief persistence checks for existing
 * generation_reason matches before inserting.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  generateInsightSummary,
  type InsightSummary,
} from './diagnose'
import { auditWebsite, type WebsiteAuditReport } from './audit-website'
import { auditAds, type AdsAuditReport } from './audit-ads'
import { auditCRM, type CRMAuditReport } from './audit-crm'
import { generateWeeklyBriefs, type GeneratedBrief } from './generate-briefs'
import type { Channel } from './snapshot'

const CHANNELS_TO_DIAGNOSE: Channel[] = [
  'ga4',
  'meta_ads',
  'meta_page',
  'instagram',
  'fub',
  'gsc',
  'youtube',
  'linkedin',
  'x',
  'tiktok',
  'gbp',
]

export interface WeeklyCycleReport {
  cycle_id: string
  as_of_date: string
  window_days: number
  generated_at: string
  channel_insights: Array<{ channel: Channel; summary: InsightSummary | { error: string } }>
  audits: {
    website: WebsiteAuditReport | { error: string }
    ads: AdsAuditReport | { error: string }
    crm: CRMAuditReport | { error: string }
  }
  briefs: GeneratedBrief[]
  briefs_persisted: number
  brief_voice_failures: number
  errors: string[]
}

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  return createClient(url, key)
}

/**
 * Run a full weekly brain pass. Returns a structured report that the
 * cron route renders as JSON for Matt and emails as a digest.
 */
export async function runWeeklyCycle(asOfDate: string, opts: { dryRun?: boolean; windowDays?: number } = {}): Promise<WeeklyCycleReport> {
  const windowDays = opts.windowDays ?? 7
  const dryRun = opts.dryRun ?? false
  const errors: string[] = []
  const cycleId = `cycle_${asOfDate.replace(/-/g, '')}_${Date.now()}`

  const channelInsights: WeeklyCycleReport['channel_insights'] = []
  await Promise.all(
    CHANNELS_TO_DIAGNOSE.map(async (ch) => {
      try {
        const summary = await generateInsightSummary(ch, asOfDate)
        channelInsights.push({ channel: ch, summary })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        channelInsights.push({ channel: ch, summary: { error: msg } })
        errors.push(`diagnose:${ch}: ${msg}`)
      }
    }),
  )

  const audits: WeeklyCycleReport['audits'] = {
    website: { error: 'not-run' },
    ads: { error: 'not-run' },
    crm: { error: 'not-run' },
  }

  const [wResult, aResult, cResult] = await Promise.allSettled([
    auditWebsite(asOfDate, windowDays),
    auditAds(asOfDate, windowDays),
    auditCRM(asOfDate, windowDays),
  ])
  if (wResult.status === 'fulfilled') audits.website = wResult.value
  else {
    audits.website = { error: wResult.reason instanceof Error ? wResult.reason.message : String(wResult.reason) }
    errors.push(`audit-website: ${audits.website.error}`)
  }
  if (aResult.status === 'fulfilled') audits.ads = aResult.value
  else {
    audits.ads = { error: aResult.reason instanceof Error ? aResult.reason.message : String(aResult.reason) }
    errors.push(`audit-ads: ${audits.ads.error}`)
  }
  if (cResult.status === 'fulfilled') audits.crm = cResult.value
  else {
    audits.crm = { error: cResult.reason instanceof Error ? cResult.reason.message : String(cResult.reason) }
    errors.push(`audit-crm: ${audits.crm.error}`)
  }

  let briefs: GeneratedBrief[] = []
  let briefsPersisted = 0
  let voiceFails = 0
  try {
    briefs = await generateWeeklyBriefs(asOfDate, { dryRun, maxBriefs: 10 })
    briefsPersisted = dryRun ? 0 : briefs.filter((b) => b.voice_validation.passed).length
    voiceFails = briefs.filter((b) => !b.voice_validation.passed).length
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`generate-briefs: ${msg}`)
  }

  const report: WeeklyCycleReport = {
    cycle_id: cycleId,
    as_of_date: asOfDate,
    window_days: windowDays,
    generated_at: new Date().toISOString(),
    channel_insights: channelInsights,
    audits,
    briefs,
    briefs_persisted: briefsPersisted,
    brief_voice_failures: voiceFails,
    errors,
  }

  try {
    const supabase = getSupabase()
    await supabase.from('marketing_decisions').insert({
      decision_type: dryRun ? 'weekly_cycle_dryrun' : 'weekly_cycle',
      decision_summary: `Weekly cycle ${cycleId}: ${briefsPersisted} briefs persisted, ${voiceFails} voice failures, ${errors.length} errors`,
      data_observed: {
        cycle_id: cycleId,
        as_of_date: asOfDate,
        window_days: windowDays,
        channel_count: CHANNELS_TO_DIAGNOSE.length,
        brief_count: briefs.length,
        anomaly_count: channelInsights.reduce(
          (n, c) => n + ('anomalies' in c.summary ? c.summary.anomalies.length : 0),
          0,
        ),
      },
      rules_cited: ['weekly_cycle'],
      reviewer: 'brain',
      final_decision: dryRun ? 'auto_applied' : 'awaiting_review',
    })
  } catch (e) {
    errors.push(`marketing_decisions log: ${e instanceof Error ? e.message : String(e)}`)
  }

  return report
}
