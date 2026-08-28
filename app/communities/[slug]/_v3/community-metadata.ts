/**
 * Route-local: the community node's metadata and its structured data, both
 * unchanged in meaning from the KB page.
 *
 * It lives beside the route rather than inside it because the route is under the
 * ci:file-size-budget floor and the gate's own instruction when a file approaches
 * it is to split, not to re-baseline. This module builds the INPUT; the route
 * still calls `pageMetadata` itself, which is what sets `alternates.canonical`
 * for every caller by construction, and what ci:seo-routes, check-seo-authoring,
 * and lib/seo-route-contracts.test.ts each read off the route file.
 *
 * §0 NO COUNT IN THE DESCRIPTION. An earlier version interpolated an active
 * count here and it fell through to the parent CITY's, so three-rivers read
 * "1000 homes for sale" (Bend's, row-capped) and sunriver 121 against a body
 * showing 102. Re-deriving a count in metadata is out (the SEO-58 incident).
 */

import type { pageMetadata } from '@/lib/site/page-metadata'
import { isCanonicalCommunitySlug } from '@/lib/communities/canonical-community-slug'
import { preferPlaceHero } from '@/lib/geo-images'
import type { SchemaInput, StatValue } from '@/lib/site/json-ld'

/**
 * How each variable buildMarketFaq can emit reads inside a sentence. The keys are
 * the exact `name` strings lib/site/market-faq.ts pushes into datasetVariables, so
 * a variable that is added there and not named here still ships — it falls back to
 * its own lowercased name rather than being silently dropped from the sentence.
 */
const VARIABLE_PHRASE: Record<string, string> = {
  'Median List Price': 'median list price',
  'Active Listings': 'active inventory',
  'Months of Supply': 'months of supply',
  'Median Days to Pending': 'median days to pending',
  'Median Days on Market': 'median days on market',
  'Homes Sold (12 months)': 'homes sold in the last 12 months',
}

/**
 * THE DESCRIPTION NAMES EXACTLY THE VARIABLES THE PAYLOAD CARRIES, because a
 * machine-readable sentence is a claim and a claim may not outrun its payload.
 *
 * The hardcoded version read "Median list price, active inventory, months of
 * supply, and median days to pending" on every community. It was false the moment
 * the 2026-08-12 repair started dropping months of supply wherever the pulse row's
 * own active count is not the count this page publishes, and it was false in the
 * limit on vandevert-ranch, whose Dataset carried one variable — Homes Sold (12
 * months) — under a sentence naming four other metrics. Same defect class as a
 * wrong number: the reader here is a crawler, and it cannot see the figures.
 *
 * The opener is deliberately not "Live": the emitted set is sometimes closed-sale
 * variables only, and "live" would be a second claim the payload does not carry.
 *
 * Route-local for now. Every Dataset emitter fed by buildMarketFaq has the same
 * exposure, and the durable home for this is beside that builder — reported to the
 * P9 orchestrator rather than reached across route boundaries here.
 */
function datasetDescription(
  name: string,
  cityName: string,
  variables: ReadonlyArray<StatValue>,
): string {
  const phrases = variables.map((v) => VARIABLE_PHRASE[v.name] ?? v.name.toLowerCase())
  // Two items read "a and b", never "a, and b": the Oxford comma needs three.
  const list =
    phrases.length === 1
      ? phrases[0]
      : phrases.length === 2
        ? `${phrases[0]} and ${phrases[1]}`
        : `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`
  const sentence = list.charAt(0).toUpperCase() + list.slice(1)
  return `Single-family home market data for ${name} in ${cityName}, Oregon. ${sentence}. Sourced from the regional MLS via Ryan Realty.`
}

/** Curated KB hero photos. Verified to exist under public/images/kb/. */
const KB_HERO: Record<string, string> = {
  tetherow: '/images/kb/tetherow-golf-aerial.jpg',
  'broken-top': '/images/kb/broken-top.jpg',
  'northwest-crossing': '/images/kb/northwest-crossing.jpg',
  'caldera-springs': '/images/kb/caldera-springs.jpg',
  'three-rivers': '/images/kb/three-rivers.jpg',
  'vandevert-ranch': '/images/kb/vandevert-ranch.jpg',
}

/** Curated community photos. Verified to exist under public/images/communities/. */
const COMMUNITY_HERO: Record<string, string> = {
  'broken-top': '/images/communities/broken-top.jpg',
  'caldera-springs': '/images/communities/caldera-springs.jpg',
  'northwest-crossing': '/images/communities/northwest-crossing.jpg',
  'three-rivers': '/images/communities/three-rivers.jpg',
  'vandevert-ranch': '/images/communities/vandevert-ranch.jpg',
}

export function communityMetadataInput(input: {
  slug: string
  name: string
  city: string
  heroImageUrl?: string | null
}): Parameters<typeof pageMetadata>[0] {
  const { slug, name, city } = input

  // Every community gets a community-specific OG image. Priority: curated KB
  // hero photo, then curated community folder photo, then the generated card,
  // which renders the name and city on the brand background so no community
  // falls through to the generic /api/og?type=default card.
  // A COMPOUND SLUG IS NEVER CANONICAL, so it must not compete in the index.
  // Communities live at their bare registry slug (/communities/tetherow);
  // `<city>-<name>` is a legacy shape that middleware canonicalises when the
  // name IS a registered community (resolveCanonicalCommunitySlug). What
  // survives to render is a compound slug whose name is NOT one — either a real
  // plat like bend-parks-at-broken-top, which duplicates
  // /subdivisions/parks-at-broken-top, or a slug naming nothing at all. Both
  // used to answer with index,follow and a self-referential canonical, so
  // /communities/<city>-<anything> minted an unbounded supply of thin indexable
  // pages. Proved 2026-08-26 with the never-registered control
  // /communities/bend-some-ordinary-plat.
  //
  // The hop cannot be a redirect. The edge resolver is synchronous and DB-free
  // by contract (a page-body redirect cannot emit a 3xx under Next 16 streaming
  // — scripts/check-streamed-redirect.mjs), so it cannot tell a real plat from a
  // typo, and 308-ing a typo to a 404 is worse than answering it. A 404 is worse
  // still: an earlier attempt to make the junk-slug guard reject these instead
  // read a degraded cache as absence and 404-ed /communities/tetherow itself.
  //
  // So the page still answers, it just stops competing: noindex, and nothing
  // else. (§0 — a degraded read is not evidence, in either direction.)
  const compoundNonCommunity = !isCanonicalCommunitySlug(slug)

  const ogImage = preferPlaceHero(
    input.heroImageUrl,
    KB_HERO[slug] ??
      COMMUNITY_HERO[slug] ??
      `/api/og?type=community&name=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}`,
  )

  return {
    // Title <= 60 chars — community override, not the global template. Format:
    // "[Community] Homes for Sale | [City], OR". cleanTitle in page-metadata.ts
    // strips any trailing brand suffix and caps at 60.
    title: `${name} Homes for Sale | ${city}, OR`,
    // NO OPEN HOUSES IN THIS SENTENCE. The KB page carried an open-house list and
    // this one does not: KbOpenHouses was removed as city-scoped (parity.json
    // removedComponents) and what remains is a door to /open-houses/<city>. A
    // description promising a section the page does not carry is the same defect
    // class as a wrong figure, one field over.
    //
    // What is left is what EVERY community page renders under every branch: the
    // Field, which shows the homes or states why there are none, and the market
    // figures with their trace. The authored knowledge is deliberately not named
    // here — a community with no config and no prose renders no knowledge block,
    // and this sentence cannot see which one it is describing. It is also capped
    // at 155 by shareDescription, and the longest registry name lands at 121.
    description: `Active single-family homes in ${name}, ${city}, Oregon. Live inventory and market data from the regional MLS.`,
    // Self-canonical even when noindex. A cross-canonical was the first shape
    // of this fix and it is a footgun: noindex plus rel=canonical pointing
    // elsewhere is a conflicting pair, and the canonical TARGET can inherit the
    // noindex. The noindex alone does the job, and it is the half that cannot
    // hurt /subdivisions/<plat>.
    path: `/communities/${slug}`,
    noindex: compoundNonCommunity,
    ogImage,
  }
}

/**
 * The JSON-LD payloads, in the order the page emits them: BreadcrumbList, Place,
 * the market Dataset, and FAQPage.
 *
 * FAQPage MOVED HERE, and it moved because its old emitter left. The KB page
 * emitted it from inside FAQBlock, and the v3 Quiet block that renders the
 * questions carries no structured data of its own, so a migration that only
 * swapped the section would have dropped the payload silently — the single
 * biggest AI-citation lever, gone with a green build. It is built from the SAME
 * `faqs` array the section renders, so the visible text and the markup cannot
 * diverge.
 *
 * Dataset and FAQPage are conditional on having something true to say: no
 * variables means no Dataset, no questions means no FAQPage, and neither is ever
 * filled with a placeholder. The Dataset's DESCRIPTION is derived from the same
 * variables it publishes (datasetDescription above), so the sentence a crawler
 * reads names the metrics the payload actually carries.
 */
export function buildCommunitySchemas(input: {
  slug: string
  name: string
  cityName: string
  citySlug: string | null
  /** True when the page renders a real map, which is what hasMap asserts. */
  hasMap: boolean
  /** Registry centre as [lng, lat], never hardcoded. (§0) */
  centerLonLat?: readonly [number, number] | null
  datasetVariables: ReadonlyArray<StatValue>
  asOfIso: string | null
  asOfLabel: string | null
  faqs: readonly { question: string; answer: string }[]
}): SchemaInput[] {
  const { slug, name, cityName, citySlug } = input

  // containedInPlace is the CITY, not the community itself, which would read
  // "Sunriver contained in Sunriver". (§0)
  const containedInPlace = cityName !== name ? cityName : 'Deschutes County'
  const geo = input.centerLonLat
    ? { lat: input.centerLonLat[1], lng: input.centerLonLat[0] }
    : undefined

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Communities', url: '/communities' },
        ...(cityName ? [{ name: cityName, url: citySlug ? `/cities/${citySlug}` : '/cities' }] : []),
        { name, url: `/communities/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Place',
      name,
      description: `${name}, a community in ${cityName}, Oregon. Homes for sale and live single-family market data.`,
      url: `/communities/${slug}`,
      geo,
      address: { city: cityName, state: 'OR', country: 'US' },
      containedInPlace,
      hasMap: input.hasMap ? `/communities/${slug}` : undefined,
      additionalProperty: input.datasetVariables.length > 0 ? input.datasetVariables : undefined,
    },
  ]

  if (input.datasetVariables.length > 0) {
    schemas.push({
      type: 'dataset',
      name: `${name} real estate market statistics${input.asOfLabel ? `, ${input.asOfLabel}` : ''}`,
      description: datasetDescription(name, cityName, input.datasetVariables),
      url: `/communities/${slug}`,
      dateModified: input.asOfIso ?? undefined,
      spatialCoverageName: `${name}, ${cityName}, OR`,
      variableMeasured: input.datasetVariables,
    })
  }

  if (input.faqs.length > 0) schemas.push({ type: 'faqPage', items: input.faqs })

  return schemas
}
