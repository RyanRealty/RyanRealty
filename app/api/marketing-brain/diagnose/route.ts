/**
 * marketing-brain diagnose: manual-trigger HTTP endpoint.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (same as ingestor routes).
 *
 * Query params:
 *   channel  - optional. One of the Channel literals. If omitted, runs for
 *              all channels that have data in the past 7 days.
 *   asOfDate - optional YYYY-MM-DD. Defaults to yesterday.
 *
 * Returns InsightSummary (single channel) or InsightSummary[] (all channels).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron, parseDateRange } from '@/lib/marketing-brain/snapshot'
import type { Channel } from '@/lib/marketing-brain/snapshot'
import { generateInsightSummary } from '@/lib/marketing-brain/diagnose'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const ALL_CHANNELS: Channel[] = [
  'meta_ads',
  'meta_page',
  'instagram',
  'ga4',
  'gsc',
  'fub',
  'youtube',
  'linkedin',
  'x',
  'tiktok',
  'gbp',
  'threads',
  'nextdoor',
  'pinterest',
  'email',
]

/**
 * Discover which channels have any data in the trailing 7 days so we skip
 * channels that have never been ingested rather than returning empty summaries.
 */
async function channelsWithRecentData(asOfDate: string): Promise<Channel[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')

  const supabase = createClient(url, key)
  const sevenDaysAgo = new Date(`${asOfDate}T00:00:00Z`)
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6)
  const windowStart = sevenDaysAgo.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('channel')
    .gte('date', windowStart)
    .lte('date', asOfDate)

  if (error) throw new Error(`channelsWithRecentData: ${error.message}`)

  const present = new Set((data ?? []).map((r) => r.channel as Channel))
  return ALL_CHANNELS.filter((c) => present.has(c))
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Resolve asOfDate (we only need the endDate — ignore startDate for diagnose)
  let asOfDate: string
  try {
    const range = parseDateRange(request)
    asOfDate = range.endDate
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'invalid date' },
      { status: 400 }
    )
  }

  // Allow override via ?asOfDate= in addition to the parseDateRange convention
  const overrideDate = new URL(request.url).searchParams.get('asOfDate')?.trim()
  if (overrideDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
      return NextResponse.json({ error: 'asOfDate must be YYYY-MM-DD' }, { status: 400 })
    }
    asOfDate = overrideDate
  }

  const channelParam = new URL(request.url).searchParams.get('channel')?.trim() as
    | Channel
    | undefined

  try {
    if (channelParam) {
      if (!ALL_CHANNELS.includes(channelParam)) {
        return NextResponse.json(
          { error: `Unknown channel: ${channelParam}` },
          { status: 400 }
        )
      }
      const summary = await generateInsightSummary(channelParam, asOfDate)
      return NextResponse.json(summary)
    }

    // No channel specified: run for all channels with recent data
    const activeChannels = await channelsWithRecentData(asOfDate)
    const summaries = await Promise.all(
      activeChannels.map((ch) =>
        generateInsightSummary(ch, asOfDate).catch((e) => ({
          channel: ch,
          as_of_date: asOfDate,
          headline: `Error: ${e instanceof Error ? e.message : String(e)}`,
          deltas: [],
          anomalies: [],
          recommended_actions: [],
        }))
      )
    )

    return NextResponse.json(summaries)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
