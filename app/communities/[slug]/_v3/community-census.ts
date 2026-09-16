/**
 * Route-local: the community node's census — every inventory figure the page
 * prints, each with the three words that scope it (SITE-116 round 3).
 *
 * THE DEFECT THIS ANSWERS. The round-2 evaluator marked the page BLOCKING for
 * "three disagreeing Tetherow inventory totals": the Atlas key's "25 for
 * sale · 4 pending", the homes list's "26 homes on this map", and the alerts
 * figure's "1 house came on in the last 30 days". Every one of them is right.
 * They differ because they count different populations over different
 * windows, and nothing on the page said so in one place.
 *
 * §0 RULE 5 IS THE CONSTRAINT: no number is changed to make the others agree.
 * This module takes the figures the page ALREADY holds — the same variables
 * the sections print — and writes each one's WHAT / WHERE / WHEN in the words
 * a visitor reads. Nothing here fetches, derives, or rounds. A figure the page
 * did not read (null) is absent from the sheet, never zero.
 *
 * THE POPULATIONS, as the DAL defines them:
 *  - Atlas (lib/atlas/build-place-atlas.ts): every active and pending listing
 *    of EVERY property type on the regional MLS whose coordinate falls inside
 *    the recorded boundary polygon. Read from listing_tile_mv via getAtlasTiles.
 *  - Homes list (components/search/PlaceSplitView.tsx → getViewportSearch):
 *    status Active, every property type, subdivision expanded to the
 *    registry's alias set (Tetherow, Triple, Tetherow Resort), inside the
 *    list's map frame and seed polygon.
 *  - Detached houses (leftoverHudKpis.active, market_metric neighborhood
 *    grain): detached single-family houses whose primary membership is this
 *    community, active at the last refresh.
 *  - New in 30 days (getPublicDetachedPace.newCount30d): detached houses
 *    whose membership is this community, listed in the last 30 days.
 *  - Sold in 12 months (leftoverHudKpis.sold12mo ?? closedCount): detached
 *    houses whose membership is this community, closed in the last 12 months.
 */

import type { V3CensusRow } from '@/components/site/v3'
import { formatCount } from '@/lib/format/count'

const FEED = 'live MLS through Oregon Data Share'

export type CommunityCensusInput = {
  placeName: string
  /** The Atlas population's counts, and whether its read completed. */
  atlas: { forSale: number; pending: number; complete: boolean } | null
  /** The homes list's own total, from the same viewport search it renders. */
  homesListCount: number | null
  /** Whether that search hit its display cap (the count is then a floor). */
  homesListCapped?: boolean
  /** The MLS subdivision names the homes list matches (registry alias set). */
  matchNames: readonly string[]
  /** leftoverHudKpis.active — detached houses, membership grain. */
  detachedActive: number | null
  /** getPublicDetachedPace.newCount30d. */
  newCount30d: number | null
  /** leftoverHudKpis.sold12mo ?? publicPace.closedCount. */
  sold12mo: number | null
}

function positive(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

/** "Tetherow, Triple or Tetherow Resort" — the alias set as one clause. */
export function nameList(names: readonly string[]): string {
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  if (clean.length === 0) return ''
  if (clean.length === 1) return clean[0]!
  if (clean.length === 2) return `${clean[0]} or ${clean[1]}`
  return `${clean.slice(0, -1).join(', ')} or ${clean[clean.length - 1]}`
}

export function buildCommunityCensus(input: CommunityCensusInput): V3CensusRow[] {
  const { placeName } = input
  const rows: V3CensusRow[] = []
  const EVERY_TYPE = 'Every property type: houses, condos, townhomes and lots'
  const HOUSES_ONLY = 'Detached single-family houses only'
  const MEMBERSHIP = `homes whose MLS membership is ${placeName}, under any of its subdivision names`

  if (input.atlas && input.atlas.complete) {
    const where = `inside the recorded ${placeName} boundary`
    const atlasSource =
      `${FEED} (listing_tile_mv through getAtlasTiles), listings of every property type whose ` +
      `coordinate falls inside the recorded boundary polygon — the population the map's key counts`
    if (input.atlas.forSale >= 0) {
      rows.push({
        key: 'atlas-for-sale',
        figure: formatCount(input.atlas.forSale),
        noun: 'for sale on the map',
        what: EVERY_TYPE,
        where,
        when: 'active on the MLS right now',
        href: '#atlas',
        hrefLabel: 'The map',
        source: `${atlasSource}, status Active.`,
      })
    }
    if (input.atlas.pending > 0) {
      rows.push({
        key: 'atlas-pending',
        figure: formatCount(input.atlas.pending),
        noun: 'pending on the map',
        what: EVERY_TYPE,
        where,
        when: 'under contract right now',
        href: '#atlas',
        hrefLabel: 'The map',
        source: `${atlasSource}, status Pending or Active Under Contract.`,
      })
    }
  }

  if (positive(input.homesListCount)) {
    const names = nameList(input.matchNames)
    rows.push({
      key: 'homes-list',
      figure: formatCount(input.homesListCount),
      noun: input.homesListCapped ? 'nearest on the homes list' : 'on the homes list',
      what: EVERY_TYPE,
      where: names
        ? `filed by the MLS under ${names}, inside the list's map frame`
        : `filed by the MLS under ${placeName}, inside the list's map frame`,
      when: 'active on the MLS right now',
      href: '#homes',
      hrefLabel: 'The homes list',
      source:
        `${FEED}, the viewport search the homes list runs (getViewportSearch): status Active, every ` +
        `property type, subdivision in {${names || placeName}}, within the list's map frame and seed ` +
        `polygon${input.homesListCapped ? '; the display cap was reached, so this is the nearest set, not the whole' : ''}.`,
    })
  }

  if (positive(input.detachedActive)) {
    rows.push({
      key: 'detached-active',
      figure: formatCount(input.detachedActive),
      noun: input.detachedActive === 1 ? 'house for sale' : 'houses for sale',
      what: HOUSES_ONLY,
      where: MEMBERSHIP,
      when: 'active at the last MLS refresh',
      href: '#faq',
      hrefLabel: 'The answers',
      source:
        `regional MLS through Oregon Data Share, detached single-family houses whose primary membership is ` +
        `${placeName} (market_metric, neighborhood grain), status Active at the last refresh — the count the ` +
        `page's answers and market figures use.`,
    })
  }

  if (positive(input.newCount30d)) {
    rows.push({
      key: 'new-30d',
      figure: formatCount(input.newCount30d),
      noun: input.newCount30d === 1 ? 'house came on' : 'houses came on',
      what: HOUSES_ONLY,
      where: MEMBERSHIP,
      when: 'listed in the last 30 days',
      href: '#alerts',
      hrefLabel: 'The alert',
      source:
        `regional MLS through Oregon Data Share, detached single-family houses whose membership is ${placeName}, ` +
        `counted by the date they listed over the last 30 days (market_metric new_listings_30d).`,
    })
  }

  if (positive(input.sold12mo)) {
    rows.push({
      key: 'sold-12m',
      figure: formatCount(input.sold12mo),
      noun: input.sold12mo === 1 ? 'house sold' : 'houses sold',
      what: HOUSES_ONLY,
      where: MEMBERSHIP,
      when: 'closed in the last 12 months',
      href: '#market',
      hrefLabel: 'Typical price',
      source:
        `regional MLS through Oregon Data Share, detached single-family houses whose membership is ${placeName}, ` +
        `closed in the trailing 12 months (market_metric closed_count).`,
    })
  }

  return rows
}

const SMALL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
function spelled(n: number): string {
  return n >= 0 && n < SMALL.length ? SMALL[n]! : formatCount(n)
}

/**
 * The sheet's one claim sentence, from the rows it prints. Counts what the
 * reader can see; says why the figures differ without restating any of them.
 */
export function communityCensusLede(placeName: string, rows: readonly V3CensusRow[]): string | undefined {
  if (rows.length < 2) return undefined
  const n = spelled(rows.length)
  return (
    `${n[0]!.toUpperCase()}${n.slice(1)} counts of ${placeName} sit on this page, and they differ because they ` +
    `count different things: every property type inside the drawn boundary, every listing the MLS files under ` +
    `${placeName}'s names, or detached houses only. Read the three columns and each figure is exact.`
  )
}
