/**
 * Every SENTENCE this route publishes about a figure, in one place.
 *
 * WHY THIS FILE IS SEPARATE FROM neighborhood-sections.ts. That file shapes
 * figures into barrel props. This one writes the prose that CLAIMS something
 * about those figures — the SERP description, the empty-state reason, the note
 * under the listed rows, the no-pulse branch's Q&A, and the two structured-data
 * descriptions. Those are the strings that go wrong in a way a type cannot
 * catch: a claim that names a population the payload does not carry, or a count,
 * or a door that does not exist. Keeping them together means the rule they all
 * obey is written once and is visible from every one of them.
 *
 * THE RULE: NO CLAIM MAY OUTRUN ITS PAYLOAD. A sentence naming a metric only
 * ships when that metric is in the payload beside it; a sentence naming a
 * population only ships on the branch that read that population; and a sentence
 * describing a control only ships when the control exists. Every function here
 * takes the payload as its argument for that reason — none of them can be called
 * without the thing they describe.
 *
 * THE TWO POPULATIONS, restated because every function here has to pick one:
 *
 *  - THE PULSE BRANCH is market_pulse_live, whose active_count narrows
 *    PropertyType A to the 'Single Family Residence' subtype inside the recorded
 *    polygon. Its figures may be called single-family.
 *  - THE NO-PULSE BRANCH is getNeighborhoodBySlug's own read of listing_tile_mv,
 *    matched on the neighborhood NAME and kept at every residential inventory
 *    type (lib/inventory-filters.ts isResidentialInventoryType). Its figures may
 *    NOT be called single-family, and before this file existed they were: the
 *    meta description and the whole visible Q&A, the FAQPage markup and the
 *    Dataset variables all published that count under the words "single-family",
 *    on the one branch where it is not.
 */
import type { SchemaInput, StatValue } from '@/lib/site/json-ld'
import type { MarketFaqResult } from '@/lib/site/market-faq'
import { formatPrice } from '@/lib/format/money'
import { A_BUCKET_PROSE, fmtK, SFR_SUB_TYPE } from './neighborhood-sections'

/** What the no-pulse branch counts, in the words every sentence about it uses. */
const RESIDENTIAL_SET = 'active residential listings'

export type PlaceCounts = { activeCount: number; medianPrice: number | null }
export type PulseCounts = { activeCount: number; medianListPrice: number | null }

/* -------------------------------------------------------------------------- */
/* The SERP description                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The meta description, on the SAME branch and the SAME figure the level-1
 * Instrument publishes.
 *
 * IT USED TO BE NEITHER. It printed getNeighborhoodBySlug's all-residential-type
 * count under the words "single-family homes for sale", which is the one thing
 * that count is not, and on every neighborhood carrying a pulse row it also
 * disagreed with the page's own H1 figure (Southern Crossing: 2 in the pulse row
 * against roughly 16 in the name-matched residential set). A SERP snippet has no
 * room for a source line, so the only honest description is the page's own
 * headline figure in the page's own words — which is why generateMetadata now
 * reads the same pulse row the page reads rather than describing a population
 * the page never displays.
 *
 * A count of zero prints no count. market_pulse_live.active_count reaches this
 * function through a `?? 0` in the DAL, so a zero here can be a real zero or a
 * null column, and the two are not the same claim (invariant 3).
 */
export function neighborhoodDescription(
  place: { name: string; cityName: string } & PlaceCounts,
  pulse: PulseCounts | null,
): string {
  const count = pulse ? pulse.activeCount : place.activeCount
  const median = pulse ? pulse.medianListPrice : place.medianPrice
  const noun = pulse ? 'single-family homes' : 'homes'
  const where = `${place.name}, ${place.cityName}`

  if (count <= 0) {
    const head = pulse
      ? `Active single-family homes in ${where}, Oregon.`
      : `Active homes in ${where}, Oregon, every residential property type.`
    return `${head} List prices and days on market, pulled live.`
  }

  const scope = pulse ? '' : ', every residential property type'
  const price = median != null && median > 0 ? ` Median list price ${fmtK(median)}.` : ''
  return `${count} ${noun} for sale in ${where}${scope}.${price} Live market data from the regional MLS.`
}

/* -------------------------------------------------------------------------- */
/* The Field's two sentences                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Which of four facts is true when the in-boundary list is empty. Three of them
 * are degraded reads and say so; the fourth is the only one that fires on a
 * healthy read, and it names the population the Field actually counted.
 *
 * IT NAMED THE WRONG ONE. The healthy branch read "No active single-family
 * listing sits inside the recorded {place} boundary right now" over a set that
 * is PropertyType A — the bucket the page's own source line says holds
 * townhouses and condominiums too. On a boundary holding one townhouse and no
 * single-family home, that sentence was true of a population this section does
 * not count and false of the one it does.
 */
export function fieldEmptyMessage(
  placeName: string,
  read: { boundaryOk: boolean; hasPolygon: boolean; tilesOk: boolean },
): string {
  if (!read.boundaryOk) {
    return `The ${placeName} boundary did not answer on this refresh, so this is not a claim that nothing is for sale here.`
  }
  if (!read.hasPolygon) {
    return `No recorded boundary polygon exists for ${placeName}, so no in-boundary set can be drawn.`
  }
  if (!read.tilesOk) {
    return `The listing index did not answer for the ${placeName} boundary on this refresh, so this is not a claim that nothing is for sale here.`
  }
  return `No active listing sits inside the recorded ${placeName} boundary right now. This section counts ${A_BUCKET_PROSE}, not the ${SFR_SUB_TYPE} subtype alone.`
}

/**
 * The note under the listed rows, which exists only to reconcile two numbers a
 * reader can see: how many rows are listed, and how many the boundary holds.
 *
 * IT USED TO PROMISE A DOOR THAT DOES NOT EXIST. "The 24 highest-priced are
 * listed. The figure above opens the full set." — V3FieldProps.count carries
 * value, label, source and updatedAt and no href, and V3Figure renders no
 * anchor, so nothing above it opens anything. Read instead as the Instrument's
 * headline figure the sentence was still false: that figure links to the
 * city-wide browse path over a different population, not this boundary's set.
 *
 * `listed` is the number of ROWS, not the number of tiles: a tile with no
 * listing key is dropped before render (it has no door to open), so counting
 * tiles here would name rows that are not on the page. `total` prints only when
 * the caller says the count is honest — at the RPC's pin cap the true total is
 * higher than what was returned, and an understated denominator is a wrong
 * number, not a partial one.
 */
export function fieldFootNote(listed: number, total: number, totalIsHonest: boolean): string | undefined {
  if (listed <= 0 || total <= listed) return undefined
  return totalIsHonest
    ? `The ${listed} highest-priced of the ${total} homes inside the boundary are listed here.`
    : `The ${listed} highest-priced homes inside the boundary are listed here.`
}

/* -------------------------------------------------------------------------- */
/* The no-pulse branch's Q&A                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The verified Q&A and Dataset variables for the branch that has NO pulse row.
 *
 * WHY buildMarketFaq CANNOT BE CALLED HERE. It is the single derivation for this
 * geography's figures and verdict, and it is the right call on the pulse branch.
 * But its prose is written for the single-family population: "There are N active
 * single-family listings in {place}" and "The median list price for a
 * single-family home in {place} is $X". Handing it the no-pulse branch's numbers
 * published the all-residential-type count under those words in three places at
 * once — the visible Q&A rows, the FAQPage JSON-LD, and the Dataset
 * variableMeasured — on the same page, in the same section, whose own source
 * line says that count is NOT the single-family subtype. One number, two
 * contradictory names, on a licensed broker's surface.
 *
 * So this branch gets its own pair, built once and fed to all three surfaces the
 * same way buildMarketFaq's are, naming the population it actually read. It
 * states no verdict: months of supply exists only on the pulse row, so there is
 * no classification to make here and none is invented (invariant 2).
 *
 * The variable is named "Active Residential Listings", not "Active Listings",
 * because the two branches publish different populations and a machine reading
 * both should not be told they are the same measure. There is no asOf stamp for
 * the same reason the Instrument prints none on this branch: the read carries
 * no refresh timestamp, and a date this page made up is worse than no date.
 */
export function fallbackFaqSet(placeName: string, cityName: string, place: PlaceCounts): MarketFaqResult {
  const faqs: MarketFaqResult['faqs'] = []
  const datasetVariables: StatValue[] = []

  if (place.activeCount > 0) {
    faqs.push({
      question: `How many homes are for sale in ${placeName}?`,
      answer:
        `There are ${place.activeCount.toLocaleString('en-US')} ${RESIDENTIAL_SET} in ${placeName}, ${cityName}. ` +
        `That count covers every residential property type, not the ${SFR_SUB_TYPE} subtype alone.`,
    })
    datasetVariables.push({ name: 'Active Residential Listings', value: place.activeCount })
  }

  if (place.medianPrice != null && place.medianPrice > 0) {
    faqs.push({
      question: `What is the median home price in ${placeName}?`,
      answer: `The median list price across the ${RESIDENTIAL_SET} in ${placeName}, ${cityName} is ${formatPrice(place.medianPrice)}.`,
    })
    datasetVariables.push({ name: 'Median List Price', value: Math.round(place.medianPrice), unitText: 'USD' })
  }

  return { faqs, datasetVariables, asOfIso: null, asOfLabel: null }
}

/* -------------------------------------------------------------------------- */
/* The two structured-data descriptions                                        */
/* -------------------------------------------------------------------------- */

/**
 * The Dataset description, DERIVED from the variables actually emitted.
 *
 * It was a hardcoded sentence promising "median list price, active inventory,
 * and market statistics" for "single-family home market data", published beside
 * whatever variableMeasured happened to survive the guards — including on the
 * no-pulse branch, where the figures are not single-family at all. A
 * machine-readable sentence naming metrics the payload does not carry is the
 * same defect class as a wrong number, so the sentence is now built from the
 * payload and cannot name anything absent from it.
 *
 * It also names no single population, because the payload does not have one:
 * months of supply divides an active count by a closed series, and days to
 * pending is measured on sales that closed. Each figure's population is stated
 * on the page beside it, and this sentence says so rather than picking one.
 */
export function datasetDescription(
  placeName: string,
  cityName: string,
  variables: readonly StatValue[],
): string {
  const list = variables.map((v) => v.name.toLowerCase()).join(', ')
  return (
    `Live market statistics for ${placeName} in ${cityName}, Oregon, sourced from the regional MLS ` +
    `through Ryan Realty. This dataset carries ${list}. Each figure's population and method are ` +
    `stated on the page beside it.`
  )
}

/**
 * The Place description, on the branch that produced the figures. The pulse
 * branch publishes single-family inventory and says so; the no-pulse branch
 * publishes every residential property type and says that instead.
 */
export function placeDescription(placeName: string, cityName: string, hasPulse: boolean): string {
  return hasPulse
    ? `Active single-family homes and live market data for ${placeName} in ${cityName}, Oregon.`
    : `Active residential listings of every property type, and live market data, for ${placeName} in ${cityName}, Oregon.`
}

/* -------------------------------------------------------------------------- */
/* The four structured-data payloads                                           */
/* -------------------------------------------------------------------------- */

/**
 * BreadcrumbList, the Neighborhood Place, the market Dataset, and the FAQPage —
 * assembled next to the sentences that describe them, because the defect this
 * file exists to stop is a description drifting from its payload. Emitted from
 * the page through MetadataBlock, which stays the only emitter: the barrel's
 * primitives carry no structured data of their own, so one derivation feeds the
 * visible copy and the markup.
 *
 * Two guards, both of them "absent is not zero": the Dataset ships only when
 * there is at least one variable to measure, and the FAQPage only when there is
 * at least one question. An empty payload under a full description is the same
 * defect as a wrong number.
 *
 * `hasMap` ships when PlaceFieldMap is in the Field slot (pins or a recorded
 * polygon). It left when this route had only V3Field's relative plot.
 */
export function neighborhoodSchemas(args: {
  placeName: string
  cityName: string
  citySlug: string
  neighborhoodSlug: string
  hasPulse: boolean
  /** True when the Field slot holds a Google map. */
  hasMap: boolean
  /** In-boundary pins, for the Place centroid. Unchanged from the KB page. */
  pins: ReadonlyArray<{ lat: number; lng: number }>
  faqs: MarketFaqResult['faqs']
  datasetVariables: readonly StatValue[]
  asOfIso: string | null
  asOfLabel: string | null
}): SchemaInput[] {
  const { placeName, cityName, citySlug, neighborhoodSlug, datasetVariables } = args
  const url = `/cities/${citySlug}/${neighborhoodSlug}`

  const withCoords = args.pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  const geo =
    withCoords.length > 0
      ? {
          lat: withCoords.reduce((a, p) => a + p.lat, 0) / withCoords.length,
          lng: withCoords.reduce((a, p) => a + p.lng, 0) / withCoords.length,
        }
      : undefined

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
        { name: cityName, url: `/cities/${citySlug}` },
        { name: placeName, url },
      ],
    },
    {
      type: 'place',
      placeType: 'Neighborhood',
      name: placeName,
      description: placeDescription(placeName, cityName, args.hasPulse),
      url,
      address: { city: cityName, state: 'OR', country: 'US' },
      containedInPlace: cityName,
      geo,
      hasMap: args.hasMap ? url : undefined,
      additionalProperty: datasetVariables.length > 0 ? datasetVariables : undefined,
    },
  ]

  if (datasetVariables.length > 0) {
    schemas.push({
      type: 'dataset',
      name: `${placeName} real estate market statistics${args.asOfLabel ? `, ${args.asOfLabel}` : ''}`,
      description: datasetDescription(placeName, cityName, datasetVariables),
      url,
      dateModified: args.asOfIso ?? undefined,
      spatialCoverageName: `${placeName}, ${cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  // The KB page emitted FAQPage from inside FAQBlock. V3Quiet carries no
  // structured data of its own, so the same payload is emitted from the same
  // array the block renders.
  if (args.faqs.length > 0) schemas.push({ type: 'faqPage', items: args.faqs })

  return schemas
}
