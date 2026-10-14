/**
 * The caveat every admin Google Analytics panel carries when its window
 * reaches back before GA4's traffic figures were reliable, plus the latest
 * daily tracking-health verdict when it failed (owner directive 2026-09-23).
 *
 * WHAT CHANGED (2026-10-14). The notice used to say GA4 sessions and sources
 * were never measured behaviour, on every panel, forever. Since 2026-10-09 the
 * server page-view relay (lib/analytics/ga4-mirror.ts) only covers visitors who
 * have not allowed analytics cookies, and from 2026-10-12 GA4 traffic sources
 * are reliable (Unassigned fell to a minority). So the notice now shows only
 * when the panel's window starts before GA4_TRAFFIC_RELIABLE_FROM, and says it
 * in plain words.
 *
 * Mounted on: /admin/operations (DashboardGA4Panel, 30-day window),
 * /admin/reports/traffic-sources, /admin/reports/lead-flow, and the
 * /admin/analytics Google Analytics + Sources tabs. Each passes its window's
 * first and last day; without them the notice assumes the last 30 days.
 */
import { VerdictLine } from '@/components/admin/v2'
import { createServiceClient } from '@/lib/supabase/service'
import {
  GA4_LEAD_SOURCE_RELIABLE_FROM,
  GA4_MIRROR_ESSENTIAL_ONLY_SINCE,
  GA4_TRAFFIC_RELIABLE_FROM,
  ga4WindowNeedsTrafficCaveat,
} from '@/lib/analytics/ga4-mirror'
import { HEALTH_METRIC } from '@/lib/analytics/ga4-tracking-health'

type LatestHealth = { date: string; ok: boolean; failures: string[] }

/** Latest ga4 tracking_health_ok row (written daily by the GA4 snapshot cron). */
async function readLatestHealth(): Promise<LatestHealth | null> {
  try {
    const { data, error } = await createServiceClient()
      .from('marketing_channel_daily')
      .select('date,value,metadata')
      .eq('channel', 'ga4')
      .eq('scope', 'account')
      .eq('scope_id', '')
      .eq('metric', HEALTH_METRIC)
      .order('date', { ascending: false })
      .limit(1)
    if (error || !data?.[0]) return null
    const row = data[0] as { date: string; value: number; metadata: { failures?: unknown } | null }
    const failures = Array.isArray(row.metadata?.failures) ? row.metadata.failures.map(String) : []
    return { date: String(row.date), ok: Number(row.value) > 0, failures }
  } catch {
    // A label must never take the panel down with it.
    return null
  }
}

/** "2026-10-12" → "Oct 12, 2026". */
function day(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
}

export async function Ga4MirrorNotice({ startDate, endDate }: { startDate?: string; endDate?: string } = {}) {
  const from = startDate ?? thirtyDaysAgo()
  const trafficCaveat = ga4WindowNeedsTrafficCaveat(from, endDate)
  const leadCaveat = from < GA4_LEAD_SOURCE_RELIABLE_FROM && !trafficCaveat
  const health = await readLatestHealth()
  const healthFailed = health !== null && !health.ok
  if (!trafficCaveat && !leadCaveat && !healthFailed) return null

  return (
    <div style={{ display: 'grid', gap: 6, margin: '0 0 14px' }}>
      {trafficCaveat ? (
        <VerdictLine tone="attention">
          <b>Google Analytics visits before {day(GA4_TRAFFIC_RELIABLE_FROM)} are inflated.</b> Until{' '}
          {day(GA4_MIRROR_ESSENTIAL_ONLY_SINCE)} our server also sent every page view to Google Analytics without saying
          where the visit came from, so those days show extra visits, mostly filed as Unassigned, and their sources,
          engagement and visit length are off. Since then it only does that for visitors who have not allowed analytics
          cookies. From {day(GA4_TRAFFIC_RELIABLE_FROM)} the sources are reliable, and leads carry their source from{' '}
          {day(GA4_LEAD_SOURCE_RELIABLE_FROM)}. Page views and event counts were always real. For every visitor, use the
          Website tab.
        </VerdictLine>
      ) : leadCaveat ? (
        <VerdictLine tone="attention">
          <b>Google Analytics leads carry their source from {day(GA4_LEAD_SOURCE_RELIABLE_FROM)}.</b> Leads before then
          show as Unassigned in Google Analytics. The CRM has the source for every lead.
        </VerdictLine>
      ) : null}
      {healthFailed && health ? (
        <VerdictLine tone="attention">
          <b>The Google Analytics tracking check failed for {health.date}.</b>{' '}
          {health.failures.length > 0 ? health.failures.join(' ') : 'The daily check recorded no detail.'}
        </VerdictLine>
      ) : null}
    </div>
  )
}
