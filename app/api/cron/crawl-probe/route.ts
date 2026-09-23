/**
 * /api/cron/crawl-probe: the daily crawl-surface monitor.
 *
 * WHY (visibility audit 2026-09-22, gsc-trend-7 / SEO-2 / SEO-9): the one
 * sustained click loss in the Search Console record (-30%, 2026-07-27..08-23)
 * lined up with sitemap and deploy outages that agents found weeks later by
 * reading GSC (124348def, aa56d308d, 996ece96a, 0dbf2f1cc), and the sitemaps
 * broke twice more after that (09-09, 09-16). This route makes the same class
 * of break a next-morning page instead of a five-week ranking loss.
 *
 * Each run (lib/crawl-probe/run.ts):
 *   1. Fetches /sitemap.xml and every child as Googlebot: 200 inside 20 s,
 *      URL count within 5% of the probe's last count (or, with no earlier run,
 *      a Search Console submitted count Google downloaded in the last 2 days),
 *      every URL unique, on the canonical host, and not a known redirect source.
 *   2. Fetches up to 10 URLs per page class, rotating daily, as Googlebot at
 *      concurrency 8: fails any 5xx, redirect, 4xx, noindex, foreign canonical,
 *      or fetch over 5 s.
 *   3. Parses every inline script on the homepage and requires the GTM loader
 *      (lib/analytics/inline-script-check.mjs, the one parser, built for
 *      deploy:verify to import as well).
 *   4. Reads Search Console: the Sitemaps API per sitemap, and URL Inspection
 *      for the first two sampled URLs per class (the API's own "indexed" count
 *      is no longer populated, so the indexed side comes from inspection).
 *   5. Writes one row per check to marketing_channel_daily, surfaced in
 *      site_signal with source='crawl_probe' (lib/data/crawl-probe/rows.ts),
 *      and on any failure queues ONE deduped ops alert to the owner through
 *      queueBrokerHealthAlert, the same internal channel crm-health-check uses.
 *      It never messages a client.
 *
 * Schedule: daily 11:55 UTC (vercel.json). :55 sits in the clear window after
 * the :26 sitemap warm and outside the :32-:54 listing_tile_mv_src refresh
 * (see app/api/cron/warm-sitemaps/route.ts), so a slow page is the page, not
 * the refresh.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (requireCronAuth).
 * ?notify=0 runs every check and writes the rows without queueing the alert
 * (manual verification runs).
 *
 * Status: 200 whenever the probe ran, whatever it found (findings are the
 * alert, not a red cron). A probe that throws is recorded as a failed run and
 * alerted like any other break. 500 only when the rows could not be written,
 * which means the monitor itself is broken.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { crashedProbeReport, runCrawlProbe, toCrawlProbeRows, type CrawlProbeReport } from '@/lib/crawl-probe/run'
import { createGscClient } from '@/lib/crawl-probe/gsc'
import { readCrawlProbeBaseline, upsertCrawlProbeRows } from '@/lib/data/crawl-probe/rows'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** One text per half day at most while a break persists; the cron is daily, so in practice one per run. */
const ALERT_COOLDOWN_MINUTES = 720

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const notify = new URL(request.url).searchParams.get('notify') !== '0'
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const sb = createServiceClient()

  const baseline = await readCrawlProbeBaseline(sb, date)
  if (baseline.error) console.error('[crawl-probe] baseline read failed:', baseline.error)

  let report: CrawlProbeReport
  try {
    report = await runCrawlProbe({
      origin: getCanonicalSiteUrl(),
      now,
      baseline: baseline.counts,
      gsc: createGscClient(),
      gtmContainerId: process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim() || null,
    })
  } catch (err) {
    // A monitor that dies quietly is the failure this route exists to end:
    // record the crash as a failed run and alert on it like any other break.
    report = crashedProbeReport(now, err)
  }

  const write = await upsertCrawlProbeRows(sb, toCrawlProbeRows(report), new Date())
  if (write.error) console.error('[crawl-probe] row write failed:', write.error)

  let alerted = false
  if (report.alert && notify) {
    // Loaded only when there is something to say, so a healthy run never
    // touches the alert module.
    const { queueBrokerHealthAlert } = await import('@/lib/crm/broker-alerts')
    alerted = await queueBrokerHealthAlert({
      key: 'crawl-probe',
      body: report.alert,
      cooldownMinutes: ALERT_COOLDOWN_MINUTES,
    })
  }

  const s = report.summary.data
  console.log(
    `[crawl-probe] ${report.summary.status} ${String(s.failed)}/${String(s.checks)} failed in ${report.durationMs} ms; ` +
      `rows ${write.written}${write.error ? ' (WRITE FAILED)' : ''}; alert ${alerted ? 'queued' : notify ? 'not queued' : 'suppressed (notify=0)'}`,
  )
  if (report.alert) console.log(`[crawl-probe] alert body:\n${report.alert}`)

  return NextResponse.json(
    {
      ok: write.error == null,
      passed: report.summary.status === 'pass',
      date,
      durationMs: report.durationMs,
      summary: s,
      baseline: {
        children: Object.fromEntries(baseline.counts),
        error: baseline.error,
      },
      rows: { written: write.written, error: write.error },
      alert: { body: report.alert, notify, queued: alerted },
      failedChecks: report.checks.filter((c) => c.status === 'fail'),
      sitemapChecks: report.checks.filter((c) => c.metric === 'sitemap_index' || c.metric === 'sitemap_child'),
    },
    { status: write.error ? 500 : 200, headers: { 'cache-control': 'no-store' } },
  )
}
