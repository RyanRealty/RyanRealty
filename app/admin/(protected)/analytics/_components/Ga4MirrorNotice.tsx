/**
 * The label every admin GA4 panel carries while GA4's session-level figures
 * are shaped by the Measurement Protocol page-view mirror (visibility audit
 * 2026-09-22, TRACK-1), plus the latest daily tracking-health verdict when it
 * failed (owner directive 2026-09-23).
 *
 * Mounted on: /admin/operations (DashboardGA4Panel; the page's GA4 sessions
 * tile carries the same caveat in its label), /admin/reports/traffic-sources,
 * /admin/reports/lead-flow (GA4 sessions are its funnel denominator), and
 * /admin/analytics Overview + Acquisition. When the mirror is
 * retired or starts carrying session + traffic-source fields, update
 * lib/analytics/ga4-mirror.ts and this notice stops rendering by itself.
 */
import { VerdictLine } from '@/components/admin/v2'
import { createServiceClient } from '@/lib/supabase/service'
import { GA4_MP_PAGE_VIEW_MIRROR_SINCE, isGa4PageViewMirrorOn } from '@/lib/analytics/ga4-mirror'
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

export async function Ga4MirrorNotice() {
  const today = new Date().toISOString().slice(0, 10)
  const mirrorOn = isGa4PageViewMirrorOn(today)
  const health = await readLatestHealth()
  const healthFailed = health !== null && !health.ok
  if (!mirrorOn && !healthFailed) return null

  return (
    <div style={{ display: 'grid', gap: 6, margin: '0 0 14px' }}>
      {mirrorOn ? (
        <VerdictLine tone="attention">
          <b>
            GA4 sessions, users, new users, engagement, bounce, session length and source / medium are not
            measured visitor behaviour.
          </b>{' '}
          Since {GA4_MP_PAGE_VIEW_MIRROR_SINCE} the site re-sends first-party page views to GA4 without
          session or traffic-source data, so GA4 counts sessions it never saw and files most of them under
          (not set). Read traffic and sources from first-party visitor_sessions. GA4 page views and event
          counts are still real.
        </VerdictLine>
      ) : null}
      {healthFailed && health ? (
        <VerdictLine tone="attention">
          <b>GA4 tracking check failed for {health.date}.</b>{' '}
          {health.failures.length > 0 ? health.failures.join(' ') : 'See the tracking_health_ok row for detail.'}
        </VerdictLine>
      ) : null}
    </div>
  )
}
