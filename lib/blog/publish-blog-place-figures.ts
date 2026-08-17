/**
 * Intra-page place figures on a blog post.
 *
 * A moving-to-Redmond post printed three Bend drive times (15 / 18-22 / 20)
 * and an airport "five minutes" next to "five- to ten-minute", then a live-
 * sounding $100k-$150k-below-Bend claim next to a mid-2025 price table
 * (fleet 154056f672766e8786ab617fec90d627).
 *
 * Drive ranges are the article's own most specific SoR, rewritten everywhere
 * the same trip is named. The median gap is the live pulse pair, not the
 * table. Mid-2025 home-type rows stay labeled as mid-2025.
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md: city pulse uses geo_type=city and the
 * space-form slug (redmond, bend).
 */
import { formatPrice } from '@/lib/format/money'

export const BLOG_REDMOND_BEND_DRIVE = { minMinutes: 18, maxMinutes: 22 } as const
export const BLOG_REDMOND_AIRPORT_DRIVE = { minMinutes: 5, maxMinutes: 10 } as const

export type BlogPlaceFigurePulse = {
  medianListPrice: number | null
}

export type PublishedBlogMedianGap = {
  redmond: number
  bend: number
  gap: number
  sentence: string
}

export function blogClaimsPlaceFigures(html: string): boolean {
  if (!html.trim()) return false
  return (
    /below Bend/i.test(html) ||
    /minutes to Bend/i.test(html) ||
    /drive between Redmond and Bend/i.test(html) ||
    /five minutes from the airport/i.test(html)
  )
}

export function publishBlogMedianGap(
  redmond: BlogPlaceFigurePulse | null,
  bend: BlogPlaceFigurePulse | null,
): PublishedBlogMedianGap | null {
  const redmondPrice = redmond?.medianListPrice
  const bendPrice = bend?.medianListPrice
  if (
    redmondPrice == null ||
    bendPrice == null ||
    !Number.isFinite(redmondPrice) ||
    !Number.isFinite(bendPrice)
  ) {
    return null
  }
  const gap = bendPrice - redmondPrice
  if (gap <= 0) return null
  return {
    redmond: redmondPrice,
    bend: bendPrice,
    gap,
    sentence: `The median list price in Redmond is ${formatPrice(redmondPrice)}, ${formatPrice(gap)} below Bend's ${formatPrice(bendPrice)}.`,
  }
}

export function rewriteBlogPlaceFigures(
  html: string,
  gap: PublishedBlogMedianGap | null,
): string {
  if (!html.trim()) return html
  const drive = `${BLOG_REDMOND_BEND_DRIVE.minMinutes} to ${BLOG_REDMOND_BEND_DRIVE.maxMinutes}`
  const driveHyphen = `${BLOG_REDMOND_BEND_DRIVE.minMinutes}- to ${BLOG_REDMOND_BEND_DRIVE.maxMinutes}-minute`
  const airport = `${BLOG_REDMOND_AIRPORT_DRIVE.minMinutes} to ${BLOG_REDMOND_AIRPORT_DRIVE.maxMinutes}`
  let next = html

  next = next.replace(/about 15 minutes to Bend's east side/gi, `${drive} minutes to Bend's east side`)
  next = next.replace(/is a 20-minute drive/gi, `is an ${driveHyphen} drive`)
  next = next.replace(
    /The 20-minute drive between Redmond and Bend/gi,
    `The ${driveHyphen} drive between Redmond and Bend`,
  )
  next = next.replace(/living five minutes from the airport/gi, `living ${airport} minutes from the airport`)

  if (gap) {
    next = next.replace(
      /The median home price in Redmond runs about \$100,000 to \$150,000 below Bend's median\./gi,
      gap.sentence,
    )
  }

  return next
}
