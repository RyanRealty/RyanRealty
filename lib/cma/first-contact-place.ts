/**
 * The place the first message points at, resolved before the letter is composed.
 *
 * Matt 2026-09-09: "We need to make sure those links always work. You can't just
 * have some bullshit link." A /subdivisions/<slug> link goes into the letter only
 * when that plat renders, decided the way the page decides it
 * (app/subdivisions/[slug]/page.tsx loadSubdivisionCore): a polygon in
 * `boundaries`, a registry plat with counted inventory, or live SFR homes under
 * the MLS name. A registry community or a marketing → area redirect is its own
 * page. Anything else drops to the wider place (the Bend neighborhood when the
 * subject sits in one, else the city). A read that fails counts as "not
 * verified", and an unverified link is left out.
 *
 * The counts are the ones the subdivision page prints (`getSubdivisionCounts`,
 * market_metric, publishable-gated), so the letter and the page never disagree.
 */

import { cmaCityHref, cmaNeighborhoodHref, cmaSubdivisionHref } from '@/lib/cma/cma-place-links'
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import { getPlatPublicInventory } from '@/lib/data/geo/plat-public-inventory'
import { getSubdivisionCounts } from '@/lib/data/market-truth/subdivision-counts'
import { getPlatUnsoldOutcome } from '@/lib/data/subdivisions/getPlatUnsoldOutcomes'
import { getSubdivisionBoundarySlugs } from '@/lib/data/subdivisions/getSubdivisionBoundarySlugs'
import { getSubdivisionSalesHistory } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'

export type FirstContactSubdivisionPlace = {
  label: string
  href: string
  /** Closed sales in the last twelve months, as the page's instrument prints them. Null when withheld. */
  closed12mo: number | null
  /**
   * How many came off the market without selling in the same twelve months
   * (SITE-55) — the page's own figure, from the same MV, so the letter and the
   * page can never disagree. null when the read missed; 0 when nothing failed,
   * which is a fact the letter is allowed to state.
   */
  unsold12mo: number | null
  active: number | null
  pending: number | null
  /**
   * The page's "Closed sales in {name}" figures, off the same read
   * (`getSubdivisionSalesHistory`, single-family by MLS plat name): this year to
   * date and the lifetime count since the first recorded year. Null when the
   * read had nothing.
   */
  history: { thisYear: number; closedThisYear: number | null; closedSince: number; sinceYear: number } | null
}

export type FirstContactPlace = {
  subdivision: FirstContactSubdivisionPlace | null
  wider: { label: string; href: string } | null
}

export const EMPTY_FIRST_CONTACT_PLACE: FirstContactPlace = { subdivision: null, wider: null }

function trim(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s || null
}

function subdivisionSlugFromHref(href: string): string | null {
  const m = href.match(/\/subdivisions\/([^/?#]+)/)
  return m ? m[1]! : null
}

/**
 * The plat page's own render decision, mirrored read for read: a polygon,
 * counted registry inventory, or live SFR homes under the MLS name.
 */
export async function platPageRenders(slug: string): Promise<boolean> {
  try {
    const slugs = await getSubdivisionBoundarySlugs()
    if (slugs.includes(slug)) return true
  } catch {
    // fall through to the other paths
  }
  try {
    const inventory = await getPlatPublicInventory(slug)
    if (inventory && inventory.listingKeys.length > 0) return true
  } catch {
    // fall through
  }
  try {
    const tiles = await getListingTiles({
      subdivision: slug.replace(/-/g, ' '),
      propertySubType: 'Single Family Residence',
      status: 'active',
      limit: 1,
    })
    if (tiles.length > 0) return true
  } catch {
    // an unanswered read is not a page
  }
  return false
}

export async function resolveFirstContactPlace(input: {
  city?: string | null
  subdivision?: string | null
  neighborhoodName?: string | null
  neighborhoodSlug?: string | null
}): Promise<FirstContactPlace> {
  const city = trim(input.city)
  const subdivision = trim(input.subdivision)
  const nName = trim(input.neighborhoodName)
  const nSlug = trim(input.neighborhoodSlug)

  // The wider place: a mapped Bend neighborhood, else the city page.
  const citySlug = city ? city.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
  const nKey = nSlug ? nSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
  const inNabe = Boolean(city && nName && nKey && nKey !== citySlug)
  const nHref = inNabe ? cmaNeighborhoodHref(city, nSlug) : null
  const cityHref = cmaCityHref(city)
  const wider = inNabe && nHref && nName ? { label: nName, href: nHref } : city && cityHref ? { label: city, href: cityHref } : null

  const href = subdivision ? cmaSubdivisionHref(subdivision) : null
  if (!subdivision || !href) return { subdivision: null, wider }

  const slug = subdivisionSlugFromHref(href)
  if (!slug) {
    // A registry community or an area redirect: its own page, no plat counts.
    return { subdivision: { label: subdivision, href, closed12mo: null, unsold12mo: null, active: null, pending: null, history: null }, wider }
  }

  const renders = await platPageRenders(slug)
  if (!renders) return { subdivision: null, wider }

  let closed12mo: number | null = null
  let active: number | null = null
  let pending: number | null = null
  try {
    const counts = await getSubdivisionCounts(slug)
    closed12mo = counts.closedCount
    active = counts.activeCount
    pending = counts.pendingCount
  } catch {
    // Counts are optional. The link is what must hold.
  }
  // SITE-55: the same MV the plat page reads for its "what did not sell"
  // section, so the letter's count and the page's count are one number.
  // A read miss is null (say nothing); a plat with no row is 0 (nothing came
  // off unsold), which the letter is allowed to state as the clean case.
  let unsold12mo: number | null = null
  try {
    // null = the view does not cover this plat, so the letter says nothing;
    // a row with 0 = measured and clean, which the letter may state.
    const outcome = await getPlatUnsoldOutcome(slug)
    unsold12mo = outcome ? outcome.unsoldCount : null
  } catch {
    // Optional, like the counts. The link is what must hold.
  }
  let history: FirstContactSubdivisionPlace['history'] = null
  try {
    const rows = await getSubdivisionSalesHistory(slug)
    if (rows.length > 0) {
      const thisYear = new Date().getFullYear()
      const closedSince = rows.reduce((n, r) => n + r.closedCount, 0)
      const sinceYear = Math.min(...rows.map((r) => r.year))
      const current = rows.find((r) => r.year === thisYear)
      history = { thisYear, closedThisYear: current ? current.closedCount : null, closedSince, sinceYear }
    }
  } catch {
    // Same: optional.
  }
  return { subdivision: { label: subdivision, href, closed12mo, unsold12mo, active, pending, history }, wider }
}
