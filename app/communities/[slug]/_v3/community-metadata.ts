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
 * §0 / SEO-58. Do not re-derive an active count from a city row. A count in
 * the title or description must be the listed set this page body publishes,
 * or omitted. Mountain High is the one title that names that listed count.
 */

import type { pageMetadata } from '@/lib/site/page-metadata'
import { shareDescription } from '@/lib/share-metadata'
import { isCanonicalCommunitySlug } from '@/lib/communities/canonical-community-slug'
import { isSelfCityCommunity } from '@/lib/communities/self-city-community'
import { preferPlaceHero } from '@/lib/geo-images'
import {
  listingItemListFromHomes,
  type ListingItemListHome,
  type SchemaInput,
  type StatValue,
} from '@/lib/site/json-ld'
import { formatCount } from '@/lib/format/count'
import {
  communityStockMixSentence,
  type CommunitySerpStock,
  type PlaceBuyerGroup,
} from './community-stock-types'

export type { CommunitySerpStock, PlaceBuyerGroup }

/**
 * SITE-177. One distinctive clause per resort so Tetherow / Broken Top /
 * Black Butte Ranch cannot be byte-identical except the place name. Facts
 * already on the page body (course, setting, city). No HOA dollars. No
 * inventory count — that rides in `stock` when it equals the listed set.
 */
const COMMUNITY_SERP_SETTING: Record<string, string> = {
  'brasada-ranch': 'High-desert resort around Brasada Canyons golf.',
  tetherow: 'West Bend golf community on a David McLay Kidd course.',
  'broken-top': 'Gated west Bend community around a Weiskopf and Morrish course.',
  // SITE-184: the opener became "Black Butte Ranch, Oregon homes for sale."
  // (the query the page wins), four characters longer than "in Sisters,
  // Oregon.", so the clause lost "forest" to stay inside shareDescription's
  // 155 without truncating "Live MLS inventory." Same two facts: golf, Cascades.
  'black-butte-ranch': 'Golf resort with two courses under the Cascades.',
  'mountain-high': 'South Bend neighborhood around the public Old Back Nine.',
  'eagle-crest': 'Redmond golf resort along the Deschutes River canyon.',
  'caldera-springs': 'Sunriver resort around Caldera Links and a wildlife preserve.',
  sunriver: 'Ponderosa resort south of Bend along the Deschutes.',
  'juniper-preserve': 'High-desert Bend resort around Nicklaus and Fazio golf.',
  pronghorn: 'High-desert Bend resort around Nicklaus and Fazio golf.',
  crosswater: 'Private Sunriver golf community along the Deschutes.',
  'northwest-crossing': 'Walkable west Bend neighborhood of shops, trails, and homes.',
  'awbrey-glen': 'Gated northwest Bend golf community on Awbrey Butte.',
  'widgi-creek': 'South Bend golf community along the Deschutes.',
  'vandevert-ranch': 'Sunriver-area ranch community of custom homes on acreage.',
  'three-rivers': 'Deschutes-side community south of Sunriver.',
  'mt-bachelor-village': 'West Bend resort village toward Mt. Bachelor.',
  'inn-of-the-7th-mountain': 'West Bend resort lodging and homes toward Mt. Bachelor.',
  'rivers-edge': 'North Bend golf community along the Deschutes.',
  'crooked-river-ranch': 'Crook County ranch community above the Crooked River canyon.',
}

export function communitySerpTitle(input: {
  slug: string
  name: string
  city: string
  listedCount?: number | null
}): string {
  const { name, city, slug, listedCount } = input
  // A self-city community's /cities/<slug> page is titled "{place} real
  // estate" (publishCityRealEstateTitle), so this page keeps the inventory
  // title and the two never share a title again (SITE-187 / SITE-184). A
  // compound slug is noindex and not a registered community: unchanged.
  if (isSelfCityCommunity(slug) || !isCanonicalCommunitySlug(slug)) {
    return `${name} Homes for Sale | ${city}, OR`
  }
  // Mountain High GSC: title at pos 5–15 with 0 CTR. Name the on-page listed
  // count, or omit a count. Never a parent-city leak (SEO-58).
  const homes =
    slug === 'mountain-high' && listedCount != null && listedCount > 0
      ? `${formatCount(listedCount)} ${listedCount === 1 ? 'Home' : 'Homes'} for Sale`
      : 'Homes for Sale'
  // "{name} real estate" is the other query for the same URL: Tetherow first
  // (Matt 2026-09-22), every registered community since (Matt 2026-09-24).
  // The heading stays "{name} homes for sale".
  return `${name} real estate | ${homes} | ${city}, OR`
}

export function communitySerpDescription(input: {
  slug: string
  name: string
  city: string
  types?: readonly PlaceBuyerGroup[]
  listedCount?: number | null
}): string {
  const { slug, name, city } = input
  const types = input.types ?? []
  const mix = communityStockMixSentence(types)
  const setting = COMMUNITY_SERP_SETTING[slug]
  const counted =
    slug === 'mountain-high' && input.listedCount != null && input.listedCount > 0
  // SITE-187 / SITE-184: a self-city community would read "Sunriver in
  // Sunriver, Oregon." or "Black Butte Ranch in Sisters, Oregon." The opener
  // names the inventory query the page wins instead. The helper, not a
  // name-equals-city test: Black Butte Ranch's registry city is Sisters.
  const selfCity = name.trim().toLowerCase() === city.trim().toLowerCase() || isSelfCityCommunity(slug)
  // SITE-203: "{name} homes for sale" is the query the page owns (its H1),
  // and the buyers guide and the market report both outranked this page for
  // it while the description opened "{name} in {city}, Oregon." The opener
  // now says the query; the setting clause and the mix follow as before.
  const opener = counted
    ? `${formatCount(input.listedCount)} ${input.listedCount === 1 ? 'home' : 'homes'} for sale in ${name}, ${city}.`
    : slug === 'tetherow'
      ? `${name} real estate in ${city}, Oregon.`
      : selfCity
        ? `${name}, Oregon homes for sale.`
        : `${name} homes for sale in ${city}, Oregon.`
  const skipMix = counted && types.length <= 1
  const compose = (withMix: boolean) =>
    [opener, setting, withMix ? mix : null, 'Live MLS inventory.']
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(' ')
  const full = compose(!skipMix)
  // The whole sentence set or the set without the mix: shareDescription
  // truncates past 155 characters, and a description that ends mid-word
  // ("Live…") is worse than one that leaves the mix to the page body.
  if (shareDescription(full) === full) return full
  return compose(false)
}

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
  /**
   * SITE-177. Types and listed count from the same DAL set the Field renders.
   * Lots or cabins are named only when those groups are present. A count is
   * interpolated only when it is this listed set (SEO-58).
   */
  stock?: CommunitySerpStock
  /**
   * SITE-28. True when no real place name resolved for a compound slug, so the
   * page renders CommunityUnavailable instead of a community. The title and
   * description must then name NO place: the whole defect was
   * "Oll Homes for Sale | Prineville, OR" over a body about nothing, and a
   * refusal that keeps the old <title> has not fixed anything a crawler reads.
   *
   * `noindex` is deliberately NOT forced here. Every compound non-community
   * slug is already noindex by construction below, and a refusal is only ever
   * reachable on a compound slug, so the emitted robots value is byte-identical
   * to what shipped before this item — which is what SITE-28's accept test
   * requires. Forcing it would be the same value written a second way.
   */
  refused?: boolean
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

  if (input.refused) {
    return {
      // No place name, in either field: the URL resolved to no community, and
      // the page body says exactly that. Same shape as
      // SUBDIVISION_UNAVAILABLE_METADATA one route over.
      title: 'No community at this address',
      description:
        'This address does not resolve to a named community in Central Oregon. Browse communities, recorded subdivisions, or homes for sale.',
      path: `/communities/${slug}`,
      noindex: compoundNonCommunity,
      // NO ogImage. The generated card is /api/og?type=community&name=<name>,
      // which would paint the withheld MLS token onto a shareable image — the
      // defect, one surface over. Omitting it falls back to the site default
      // card, which names no place. A curated KB/community photo is never
      // reached here either: a refusing slug has no curated entry by
      // construction (those are keyed by registry slug).
    }
  }

  return {
    // Title format: "[Community] real estate | Homes for Sale | [City], OR";
    // a self-city community (Sunriver, Black Butte Ranch) and a compound slug
    // keep "[Community] Homes for Sale | [City], OR". Mountain High names the
    // on-page listed count when stock carries it. H1 stays "{Place} homes for sale".
    title: communitySerpTitle({
      slug,
      name,
      city,
      listedCount: input.stock?.listedCount,
    }),
    // Unique per community. Names lots or cabins only when `stock.types`
    // includes those groups — the same listed set the Field renders. Capped
    // at 155 by shareDescription.
    description: communitySerpDescription({
      slug,
      name,
      city,
      types: input.stock?.types,
      listedCount: input.stock?.listedCount,
    }),
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
 * the market Dataset, FAQPage, live-home ItemList, and amenity ItemList.
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
  /**
   * SITE-116. Authored amenities as an ItemList when the page renders #amenities.
   * Each item's URL is a recorded public URL, a published amenity blog, or the
   * section anchor — never an invented place.
   */
  amenityItems?: ReadonlyArray<{ name: string; url: string }>
  /**
   * SITE-176. Photographed homes on #homes (price + street + canonical listing
   * URL). Empty inventory withholds the ItemList.
   */
  homes?: ReadonlyArray<ListingItemListHome>
  /** SITE-177. Same listed mix the Field and the meta description publish. */
  stock?: CommunitySerpStock
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
      description: communitySerpDescription({
        slug,
        name,
        city: cityName,
        types: input.stock?.types,
        listedCount: input.stock?.listedCount,
      }),
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

  const homeList = listingItemListFromHomes(`Homes for sale in ${name}`, input.homes ?? [])
  if (homeList) schemas.push(homeList)

  if (input.amenityItems && input.amenityItems.length > 0) {
    schemas.push({
      type: 'itemList',
      name: `${name} amenities`,
      items: input.amenityItems,
    })
  }

  return schemas
}
