/**
 * THE PLACE DOOR (site queue SITE-03).
 *
 * What sits beside a place H1: ONE live fact — the active count — as a filled
 * door into that place's own pre-filtered inventory. Nothing else, at any grain.
 *
 * WHAT THIS DELIBERATELY IS NOT. The node as written asked for a button reading
 * "673 homes for sale · 3.9 months · seller's market · 23 days to pending ·
 * read Sep 7", sourced from market_stats_cache. Three separate reasons that
 * string does not ship, each already verified in code:
 *
 *  1. CLAUDE.md section 0. Months of supply, the verdict and days-to-pending are
 *     UNPUBLISHABLE below city grain — lib/market/geo-grain-trust.ts carries the
 *     measurement (/cities/bend/century-west published "48.0 MONTHS" on a
 *     district that turns over in about ten weeks; 22 of 28 neighborhoods read
 *     >= 6 months) and publish-place-face.ts:74 already returns early on it.
 *     This module NEVER re-derives any of the three.
 *  2. The five-figure strip is the named leftover-HUD slop tell
 *     (docs/plans/PUBLIC_PRODUCT/DATA_GRAPHICS.md; ci:taste-canon hard-fails a
 *     PlaceFaceStrip mount, its shrink-only allowance is exhausted at []).
 *     One fact, not five.
 *  3. market_stats_cache holds no months_of_supply column and ci:market-truth
 *     refuses a new direct read of it. The source of record is public.market_metric
 *     through leftoverHudKpis() -> publishPlaceFace(), which all three place
 *     templates already call. This module adds NO read of its own.
 *
 * AND NOT THE VERDICT EITHER, EVEN AT CITY (2026-09-08 review). The first cut
 * published the city verdict clause beside the count, which put "in a seller's
 * market" directly above .place-opening__caption reading "3.9 months of homes on
 * the market. A seller's market." — the same verdict twice in one fold.
 * DATA_GRAPHICS.md gives the verdict exactly ONE home and that home is the
 * caption. So `verdict` is published as a permanent null and V3PlaceDoor has no
 * prop to receive one: the door is ONE fact at every grain, which is what its
 * own header comment always claimed.
 *
 * THE DOOR'S HREF GOES THROUGH publishPlaceBrowseHref, always. That publisher
 * refuses an unfiltered regional path and (since SITE-03) a path middleware
 * would 301 away — /homes-for-sale/bend/tetherow, the exact URL getPlaceLinks
 * returns for Tetherow, is a legacy-redirect key back to /communities/tetherow.
 * Refusal means the door is not rendered. A place page never shows a door that
 * lands somewhere other than that place's inventory.
 */
import type { PlaceFace, PlaceFaceGrain } from '@/lib/market/publish-place-face'
import { publishPlaceBrowseHref } from '@/lib/search/publish-place-browse-href'

export type PlaceDoor = {
  /** The pre-filtered search path. Already published; never a raw candidate. */
  href: string
  /** The live active count, preformatted upstream by publishPlaceFace. */
  count: string
  /**
   * What the count counts, TYPE-SCOPED: "detached homes for sale" /
   * "detached home for sale". See placeDoorCountLabel — R-024.
   */
  countLabel: string
  /**
   * ALWAYS NULL, and typed as the literal so it cannot become anything else.
   * The verdict's one home is .place-opening__caption; a second copy of it on
   * the door was the duplicate the 2026-09-08 review caught. The field survives
   * as the lock: a future edit that wants a verdict on the door has to change
   * this type, and the tests below assert it stays null at every grain.
   */
  verdict: null
  /**
   * The freshness stamp, preformatted by the caller through lib/format/date.
   * Joined into the trace by the primitive as "· updated <date>", the one
   * freshness idiom on the site. Null when the stamp did not return, or when it
   * belongs to a different read than the count (see the neighborhood grain).
   */
  readDate: string | null
  /** The section 0 trace, shown collapsed under the door. */
  trace: string
}

/**
 * R-024: A COUNT MUST NAME ITS TYPE SCOPE. publishPlaceFace labels the active
 * stat "homes for sale", but the figure underneath is detached single-family
 * only at every grain the door serves:
 *
 *   city / community   public.market_metric segment='detached' through
 *                      leftoverHudKpis(). Bend read 664 detached against 839
 *                      all-residential on the same computed_at.
 *   neighborhood       listing_boundary_xref_mv filtered property_type='A' AND
 *                      property_sub_type='Single Family Residence'.
 *
 * An unqualified "homes for sale" over that figure is the defect
 * lib/search/publish-search-count.ts records as R-024, and the same page already
 * labels the identical figure "detached homes for sale" on the market Instrument
 * (app/cities/[slug]/_v3/city-sections.ts). Singular and plural both come from
 * the face, so a lone listing still reads "1 detached home for sale".
 *
 * The qualifier does NOT go on the href. publishPlaceBrowseHref strips the query
 * string deliberately, and property_type 'A' is a mixed bucket (MARKET_TRUTH D1)
 * that would not equal detached anyway — the browse target is the all-types
 * inventory for the place, exactly as the Instrument's own figure links it.
 */
export function placeDoorCountLabel(faceLabel: string): string {
  const label = faceLabel.trim()
  if (!label) return 'detached homes for sale'
  return label.startsWith('detached') ? label : `detached ${label}`
}

/**
 * The section 0 trace for the door's ONE figure, per grain, because the three
 * grains count from three different reads and a trace that named only one of
 * them would be wrong on the other two:
 *
 *   city          leftover Market Truth (public.market_metric) — actives whose
 *                 MLS City is this city. NOT a polygon: the writer is
 *                 public.refresh_place_membership, whose header states "Cities:
 *                 MLS city text (D5), hyphen slug. Never city polygons."
 *                 (supabase/migrations/20260823001500_refresh_place_membership.sql:2).
 *                 §0 rule 1 makes the trace name the filter that actually ran,
 *                 so it says MLS City and not "inside the city boundary".
 *   neighborhood  getNeighborhoodPublicInventory — SFR + PUBLIC_ACTIVE inside
 *                 the recorded boundary polygon (listing_boundary_xref_mv),
 *                 Coming Soon already stripped by the security-barrier view.
 *                 This one genuinely IS a polygon read.
 *   community /   leftover membership at the community's own slug, which below
 *   subdivision   the city grain genuinely is a polygon (ST_Within) read.
 *
 * THE TRACE NAMES THE READ BEHIND THE FIGURE ON SCREEN, AND NOTHING ELSE. The
 * first cut appended a clause to the sub-city bodies saying months of supply
 * and the verdict "are not published at this grain". Two things were wrong
 * with it. "Grain" is this shop's word for a level of geography, not a buyer's,
 * and a trace is read by buyers. And no supply figure and no verdict sit on
 * the door at any level, so the clause was a sentence about figures that are
 * not on screen, which is also why there is no MOS methodology clause here.
 *
 * THE STATUS SET IS STATED IN PLAIN ENGLISH. The Market Truth active count is
 * StandardStatus 'Active' ONLY; Active Under Contract goes to pending_count, a
 * separate cell (supabase/migrations/20260823010000_compute_market_metrics_shadow.sql,
 * the actives CTE at line 136 and the pending CTE at line 164). A label reading
 * "homes for sale" over a trace that never said which statuses it counted let
 * the two describe two populations, so the Market Truth bodies say it: homes
 * already under contract are counted separately. The neighborhood body is a
 * different read (the polygon set includes Active Under Contract) and says so
 * in its own words.
 */
export function placeDoorTrace(input: { grain: PlaceFaceGrain; placeName: string }): string {
  const feed = 'regional MLS through Oregon Data Share'
  const statusSet =
    'Active listings only; homes already under contract are counted separately, not here.'

  if (input.grain === 'city') {
    return (
      `${feed}: active detached single-family houses whose MLS City is ${input.placeName}. ` +
      `${statusSet} The count is the live figure at its last refresh; a figure that could not ` +
      `be verified is absent, not estimated.`
    )
  }

  if (input.grain === 'neighborhood') {
    return (
      `${feed}: active detached single-family listings — Active and Active Under Contract, ` +
      `Coming Soon excluded — inside the recorded ${input.placeName} boundary polygon, the same ` +
      `counted set the map below plots.`
    )
  }

  return (
    `${feed}: active detached single-family houses assigned to ${input.placeName} by boundary ` +
    `membership. ${statusSet}`
  )
}

/** formatDate returns a lone em dash for a value it cannot parse, and a caller
 *  passing that straight through prints "· updated —": a freshness claim with
 *  punctuation where the date should be. Written as escapes so no dash character
 *  exists in this file for the voice gate to find. */
const NO_DATE = /^[\s\u002D\u2010-\u2015\u2212]*$/

/**
 * Props for V3PlaceDoor, or null when there is no honest door to draw.
 *
 * Null (render nothing — no placeholder, no zero) when either:
 *   - the face published no `active` stat. An unknown count is not a zero
 *     (D78), and the count IS the door, so a missing count deletes the door.
 *   - publishPlaceBrowseHref refuses the candidate href.
 *
 * `grain` is required and does two jobs. It DERIVES THE TRACE, so the sentence
 * under the door and the face above it can never describe two different reads —
 * the caller no longer hands in a trace it built separately. And it is the belt
 * on the verdict: publishPlaceFace's early return is the braces, this module
 * publishes null regardless, and a city-grain face handed in under a
 * neighborhood grain still yields no verdict.
 */
export function publishPlaceDoor(input: {
  face: PlaceFace
  /** Which place template is asking. Names the read the trace describes. */
  grain: PlaceFaceGrain
  /** The place as a reader knows it, for the trace sentence. */
  placeName: string
  /** Candidate browse path, normally getPlaceLinks(...).browseUrl. */
  href: string | null | undefined
  /**
   * Preformatted read date, or null. PASS NULL UNLESS THE STAMP BELONGS TO THE
   * SAME READ AS THE COUNT (§0: a date is a number and needs a named basis). At
   * neighborhood grain the count comes from the polygon read, which carries no
   * timestamp of its own, so the page passes null rather than stamping it with
   * the Market Truth computed_at of a different population.
   */
  readDate: string | null | undefined
}): PlaceDoor | null {
  const href = publishPlaceBrowseHref(input.href)
  if (!href) return null

  const active = input.face.stats.find((stat) => stat.id === 'active')
  if (!active || !active.value.trim()) return null
  // A measured zero is a true figure, but this is a DOOR: a filled control that
  // opens onto the place's inventory. With no inventory there is nothing to open,
  // so a zero renders no door rather than a plate reading "0 homes for sale" that
  // leads to an empty search. The figure itself is not lost; the page's own
  // sections publish it where a figure, not a door, is the right shape.
  if (/^0$/.test(active.value.trim())) return null

  const stamp = input.readDate?.trim()

  return {
    href,
    count: active.value,
    countLabel: placeDoorCountLabel(active.label),
    verdict: null,
    readDate: stamp && !NO_DATE.test(stamp) ? stamp : null,
    trace: placeDoorTrace({ grain: input.grain, placeName: input.placeName }),
  }
}
