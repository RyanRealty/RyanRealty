import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { getPublicDetachedMonthly, leftoverMonthlyToCacheShape } from '@/lib/data/market-truth/public-monthly'
import { getCityReportSnapshot } from '@/lib/data/market/getCityReportSnapshot'
import { publishBlogPost } from '@/lib/data/blog/blogPostWrites'
import {
  MONTHLY_REPORT_CITIES,
  buildMonthlyCityReport,
  findMonth,
  previousMonth,
  sameMonthLastYear,
} from '@/lib/blog/monthly-city-report'

/**
 * Cron: one blog post per city for the previous calendar month, from the same
 * Market Truth detached series the market page charts (getPublicDetachedMonthly,
 * the series behind "Median sale price by month" on /housing-market/<city>) and
 * the same live block the page's hero reads. Bend and Redmond (Matt 2026-09-07).
 *
 * Not the stats cache: on 2026-09-07 the cache's Bend August median ($705,000)
 * and the page's charted August median ($749,500) disagreed, and a report that
 * prints a number its own market page contradicts is a §0 failure. One metric,
 * one number, so the report reads what the page reads and refuses when that
 * series has no row for the month.
 * Schedule in vercel.json: the 3rd of the month, 15:00 UTC, so the month's
 * closings have settled and the cache has refreshed.
 *
 * Query params for a backfill or a check, same auth:
 *   ?month=YYYY-MM   build that month instead of the previous one
 *   ?dry=1           build and validate, write nothing, return the post bodies
 */
export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const url = new URL(request.url)
  const month = url.searchParams.get('month') ?? previousMonth(new Date())
  const dry = url.searchParams.get('dry') === '1'
  const builtAt = new Date().toISOString()
  const results: Array<Record<string, unknown>> = []

  for (const city of MONTHLY_REPORT_CITIES) {
    try {
      const currentMonthKey = builtAt.slice(0, 7)
      const [series, snapshot] = await Promise.all([
        getPublicDetachedMonthly({ geoType: 'city', geoSlug: city.slug, currentMonthKey }),
        getCityReportSnapshot(city.label).catch(() => null),
      ])
      const trend = leftoverMonthlyToCacheShape(series).map((row) => ({ ...row, medianDom: null, endOfPeriodInventory: null }))
      const built = buildMonthlyCityReport({
        city,
        month,
        current: findMonth(trend, month),
        priorYear: findMonth(trend, sameMonthLastYear(month)),
        live: snapshot?.live
          ? {
              activeCount: snapshot.live.activeCount,
              monthsOfSupply: snapshot.live.monthsOfSupply,
              medianDaysToPending: snapshot.live.medianDaysToPending,
              refreshedAt: snapshot.live.refreshedAt,
            }
          : null,
        builtAt,
        sourceLabel: `the same monthly series the ${city.label} market page charts`,
      })
      if (!built.ok) {
        results.push({ city: city.slug, month, ok: false, reason: built.reason })
        continue
      }
      if (dry) {
        results.push({ city: city.slug, month, ok: true, dry: true, post: built.post })
        continue
      }
      const published = await publishBlogPost({
        slug: built.post.slug,
        title: built.post.title,
        content: built.post.content,
        excerpt: built.post.excerpt,
        category: built.post.category,
        tags: built.post.tags,
        seoTitle: built.post.seoTitle,
        seoDescription: built.post.seoDescription,
      })
      results.push(
        published.ok
          ? { city: city.slug, month, ok: true, slug: published.slug, created: published.created, url: `/blog/${published.slug}` }
          : { city: city.slug, month, ok: false, reason: published.reason },
      )
    } catch (e) {
      results.push({ city: city.slug, month, ok: false, reason: e instanceof Error ? e.message : String(e) })
    }
  }
  const ok = results.every((r) => r.ok)
  return NextResponse.json({ ok, month, results }, { status: ok ? 200 : 500 })
}
