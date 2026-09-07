import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { getMarketTrend } from '@/lib/data/market/getMarketTrend'
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
 * cache rows the market pages read. Bend and Redmond (Matt 2026-09-07).
 * Schedule in vercel.json: the 3rd of the month, 15:00 UTC, so the month's
 * closings have settled and the cache has refreshed.
 *
 * Query params for a backfill or a check, same auth:
 *   ?month=YYYY-MM   build that month instead of the previous one
 *   ?dry=1           build and validate, write nothing, return the post bodies
 */
export const dynamic = 'force-dynamic'

const METHODOLOGY = 'v3-2026-05-07'

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
      const [trend, snapshot] = await Promise.all([
        getMarketTrend('city', city.slug, 24),
        getCityReportSnapshot(city.label).catch(() => null),
      ])
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
        methodology: METHODOLOGY,
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
