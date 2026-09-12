/**
 * Route-local: the community node's figure sets and its outbound edges.
 *
 * It lives beside the route rather than inside it because the route is under the
 * ci:file-size-budget floor and the gate's own instruction when a file approaches
 * it is to split, not to re-baseline.
 *
 * NOTHING HERE FETCHES. Every input is already loaded and already guarded by the
 * page. This module only decides which figures are honest to print, what sentence
 * says where they came from, and which doors the closing block carries.
 *
 * REWRITTEN 2026-08-26 for the leftover-HUD world. The pulse-world builders
 * (resolveLivePair, buildLiveFigures, buildLiveTrace, buildClosedFigures) left
 * with the barrel migration: community market figures come off leftoverHudKpis
 * through the shared leftoverMarketFigures builder, and the stats-cache closed
 * figures those builders printed are the alias-join under-count
 * lib/market/geo-grain-trust.ts documents at this grain. What lives here is
 * the closing block: the outbound edges and the recorded documents in Quiet's
 * own vocabulary.
 */

import {
  documentKindLabel,
  recordingLabel,
  type PlaceDocument,
} from '@/lib/data/places/getPlaceDocuments'
import { type V3QuietItem } from '@/components/site/v3'
import { homesForSalePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import type { PublishedPlaceHoa } from '@/lib/market/publish-place-hoa'

export type CommunityFaqItem = { question: string; answer: string; source?: string | null }

/**
 * D103 (2026-08-27). Two populations on this page share the word "single-family"
 * and print two different counts: the Field's listed set (`listedCount`) counts
 * every property type filed under the community's named subdivisions (the RETS
 * bucket PropertyType='A' — condos, townhomes and manufactured homes included,
 * not detached homes only), while the Dataset/FAQ's `detachedCount` is the
 * measured single-family-only subset the market Instrument's figures use. Both
 * numbers were true and nothing on the page said they measured different
 * things. This appends one sentence to the "how many are for sale" FAQ answer —
 * read by both the visible closing Quiet block and the FAQPage JSON-LD, since
 * both render the SAME `faqs` array buildMarketFaq returns — naming both counts
 * from the page's own live variables. Never hardcoded, and a no-op when either
 * count is absent or they already agree.
 */
export function reconcileListedVsDetachedFaq(
  faqs: readonly CommunityFaqItem[],
  input: { placeName: string; listedCount: number; detachedCount: number | null },
): CommunityFaqItem[] {
  const { listedCount, detachedCount, placeName } = input
  if (listedCount <= 0 || detachedCount == null || detachedCount <= 0 || listedCount === detachedCount) {
    return [...faqs]
  }
  const note = listedVsDetachedNote({ placeName, listedCount, detachedCount })
  if (!note) return [...faqs]
  return faqs.map((item) => {
    if (!item.question.startsWith('How many single-family homes are for sale')) return item
    // The prose path is one answer string, so the two lines join here; the
    // figured path renders them as the two paragraphs they are.
    return { ...item, answer: [item.answer, ...note].join(' ') }
  })
}

/**
 * The reconciling sentence itself, so the prose FAQ path above and the figured
 * answer path (lib/site/place-answers.ts, SITE-08) say it in ONE wording. Two
 * copies of a sentence that explains why two counts differ is how a page ends
 * up explaining it two different ways. Null when there is nothing to reconcile.
 *
 * TWO LINES, NOT ONE (SITE-08 pass 2). The first cut packed both counts into a
 * single clause — "The 25 homes listed for Tetherow on this page count every
 * property type across its named subdivisions. This answer's 17 is the
 * single-family…" — and the evaluator read it exactly as it was built: two
 * numbers fighting for the same sentence, on a section whose whole premise is
 * claim first. Each count now gets its own short line, this answer's number
 * first, because that is the one the reader just opened.
 */
export function listedVsDetachedNote(input: {
  placeName: string
  listedCount: number
  detachedCount: number | null
}): string[] | null {
  const { placeName, listedCount, detachedCount } = input
  if (listedCount <= 0 || detachedCount == null || detachedCount <= 0 || listedCount === detachedCount) {
    return null
  }
  return [
    // "this page's market figures", NOT "every figure on this page" (2026-09-11).
    //
    // The old wording was a universal claim the page itself contradicts. The
    // Atlas on a community route is passed `atlasView.dots` UNFILTERED — every
    // property type — where the city route passes houses only, and its own
    // header says so: Tetherow's map reads "every active and pending mark is a
    // live MLS listing" against Bend's "every active and pending DETACHED
    // mark". Live on /communities/tetherow, that map published 28 for sale
    // beside this sentence's claim that every figure on the page measures
    // single-family. A sentence written to reconcile two counts must not
    // overclaim about a third.
    //
    // Narrowed rather than extended to name the map: the map carries its own
    // trace already, and asserting here what the map draws would couple this
    // wording to a component this file cannot see.
    `That ${detachedCount.toLocaleString('en-US')} is single-family only, which is the population this page's market figures measure.`,
    `${placeName} also has ${listedCount.toLocaleString('en-US')} homes listed across its named subdivisions when every property type is counted.`,
  ]
}

/**
 * D103 (2026-08-27). The FAQ's HOA answer and the character block's measured
 * HOA median are built by different call sites; when the page-wide resolved
 * `hoa` is a MEASURED figure, the generic "start around $X" estimate language
 * market-faq.ts prints is the wrong claim for an actual measurement, and it
 * carries no basis. This replaces that one answer's text with the measured
 * figure and its basis, so the visible answer and the FAQPage JSON-LD (both
 * fed the same `faqs` array) name the same number the character block
 * measured. A no-op for 'master' and 'estimate' resolutions, whose text
 * already matches the number market-faq.ts independently computed for the
 * same reason a page-wide `hoa.annual` is threaded into `hoaMasterAnnual`.
 */
export function reconcilePlaceHoaFaq(
  faqs: readonly CommunityFaqItem[],
  hoa: PublishedPlaceHoa | null,
): CommunityFaqItem[] {
  if (!hoa || hoa.kind !== 'measured' || !hoa.basis) return [...faqs]
  return faqs.map((item) => {
    if (!item.question.endsWith('have an HOA?')) return item
    return {
      ...item,
      answer:
        `Yes. Annual HOA dues run $${hoa.annual.toLocaleString('en-US')}, the ${hoa.basis}. ` +
        `Exact fees vary by lot, phase, and membership level. Verify current amounts with the HOA before any purchase.`,
      // §0. This row publishes a dollar figure, so it owes the same visible
      // trace the cited rows carry. It was the only number on the page with
      // its basis in the prose and no source line (evaluator, 2026-09-08).
      source: `regional MLS, the ${hoa.basis}`,
    }
  })
}


/**
 * The closing block: the verified questions, then every destination this node
 * owes the graph (the IA lock records them as its exits). A door is
 * offered only when the thing behind it exists.
 *
 * TWO LABELS CARRY A CLAIM, SO BOTH ARE WRITTEN TO WHAT IS ACTUALLY BEHIND THEM.
 *
 * The browse door said "Every <community> home for sale". It is not: that route
 * filters on the literal MLS SubdivisionName and this page counts alias-aware, so
 * on 2026-08-12 /communities/tetherow published 36 while /homes-for-sale/bend/
 * tetherow published 30, a gap this page's own markup proves, since it links
 * 19504 Century Drive under the subdivision "Roald West", counted in the 36 and
 * absent from the 30. The door stays, because a Tetherow-filtered search is a
 * real and useful node. The word "every" goes, because only the alias-aware set
 * on this page is every one. Alias-awareness on the browse route is the real fix
 * and is reported to the orchestrator, since that route is not this unit's.
 *
 * The alerts door is new and it is a restoration, not an addition: the block this
 * sheet replaced ended its success state with "Sign in to manage alerts", and
 * V3Sheet renders prose, not links, so the route to manage a subscription an
 * email-capture form just created has to be a door here.
 *
 * THE SELL DOOR CARRIES ITS ORIGIN. `/sell#get-value` written bare drops
 * `?from=<path>`, which app/lp/seller-home-value/actions.ts turns into the CRM
 * source attribution, so the lead still arrives and just stops saying which
 * community page produced it, invisible in QA, and completed valuations per page
 * is this program's KPI. lib/site/valuation-href.ts is the one way to build it
 * (PUBLIC_UI.md §3), and `pagePath` is what it carries.
 */
/**
 * A Quiet item that also declares which kind of destination it is, for
 * V3Answers' grouped exit fold. `group` is only meaningful on link rows; the
 * prose rows in documentItems ("About these documents") carry it harmlessly and
 * are dropped by the caller's href filter, exactly as before.
 */
export type ExploreEdge = V3QuietItem & { group?: string }

/** Tag a Quiet item with its destination kind without disturbing its shape. */
function withGroup(item: V3QuietItem, group: string): ExploreEdge {
  return { ...item, group }
}

export function buildExploreEdges(input: {
  communityName: string
  cityName: string
  citySlug: string | null
  /** Place-filtered Homes URL (city + community slug). */
  browseHref: string
  /** Place-filtered Market URL for this community. */
  communityMarketHref: string
  cityReportHref: string
  /** This page's own path, e.g. '/communities/tetherow'. The valuation origin. */
  pagePath: string
  /**
   * The verified questions used to render V3Answers, kept in the signature so
   * the two lists cannot drift: the answers block and the edges block are built
   * from one call, and a caller cannot render the doors while forgetting the
   * questions they close.
   *
   * They are no longer folded INTO this array. Both used to sit inside one
   * V3Quiet with the recorded documents and twenty navigation doors — three
   * jobs under one heading, 3,405px at 1440 and 4,250px at 375, with 49 list
   * rows and not one disclosure. A question set belongs in the primitive built
   * for question sets.
   */
  faqs: readonly { question: string, answer: string }[]
  /** The recorded governing documents, already shaped as Quiet items. They sit
   *  between the answers and the outbound edges — legal content is one of the
   *  things Quiet is FOR (PUBLIC_UI §3), and a Ledger here would be this
   *  route's sixth pattern, which stays a lock break even under the 2026-08-26
   *  exception. */
  documentItems: readonly V3QuietItem[]
  golfCourses: readonly { slug: string, name: string }[]
  /** Registry resort list. Quiet doors, not a second hardcoded set. */
  resortItems: readonly V3QuietItem[]
}): ExploreEdge[] {
  const { citySlug, cityName } = input
  // EVERY DOOR SAYS WHAT KIND OF DESTINATION IT IS.
  //
  // Folding the set fixed its height and not its shape: two evaluator rounds
  // opened the fold and found 41 undifferentiated hairline rows here, and 31 on
  // the compound-plat member of the same class — governing documents, golf
  // courses, sibling resorts and generic site links interleaved. TASTE calls
  // that a table wearing hairlines, and the second round proved it systemic.
  // The groups already existed in the reading order below; they were simply not
  // named. V3Answers renders them in first-appearance order, so naming them
  // moves no door.
  return [
    ...input.documentItems.map((item) => withGroup(item, 'Recorded documents')),
    { label: `Search ${input.communityName} homes`, href: input.browseHref, group: input.communityName },
    { label: `${input.communityName} market report`, href: input.communityMarketHref, group: input.communityName },
    { label: 'Manage your listing alerts', href: '/login?returnUrl=%2Faccount%2Fsaved-searches', group: input.communityName },
    ...(citySlug ? [{ label: `${cityName} homes for sale`, href: homesForSalePath(cityName), group: cityName }] : []),
    { label: `${cityName} market report`, href: input.cityReportHref, group: cityName },
    ...(citySlug ? [{ label: `About ${cityName}`, href: `/cities/${citySlug}`, group: cityName }] : []),
    ...(citySlug ? [{ label: `Open houses in ${cityName}`, href: `/open-houses/${citySlug}`, group: cityName }] : []),
    ...input.golfCourses.map((c) => ({
      label: `${c.name} golf course`,
      href: `/central-oregon/golf/${c.slug}`,
      group: 'Golf',
    })),
    // The resort doors name their own group (their registry city), so they are
    // passed through; only one that carries none falls back to the generic set.
    ...input.resortItems.map((item) =>
      (item as ExploreEdge).group ? (item as ExploreEdge) : withGroup(item, 'Nearby resorts'),
    ),
    { label: 'Every Central Oregon community', href: '/communities', group: 'Around the site' },
    { label: 'Central Oregon housing market', href: '/housing-market', group: 'Around the site' },
    { label: 'Value my home', href: valuationHref(input.pagePath), group: 'Around the site' },
    { label: 'Talk to a broker', href: '/contact', group: 'Around the site' },
  ]
}

/* -------------------------------------------------------------------------- */
/* Recorded documents, as Quiet items                                          */
/* -------------------------------------------------------------------------- */

/**
 * The recorded governing documents as Quiet link items. The subdivision and
 * neighborhood nodes mount V3PlaceDocuments (Pattern 3: Ledger); this route
 * cannot — Stage, Field, Instrument, Quiet, and Sheet are already its five
 * patterns under the 2026-08-26 exception, and a sixth is a lock break — so
 * the same data renders in Quiet's own vocabulary: a hairline list of legal
 * doors. The honesty rules are V3PlaceDocuments' (PLACE_CONTENT_RULES R7),
 * carried item for item: every document names its recording reference and its
 * county in the label, and the closing caveat states that later amendments may
 * exist, because Oregon records carry no cross-reference chaining an amendment
 * to what it amends. Empty input returns nothing — there was no query for this
 * place to come back empty.
 */
export function communityDocumentItems(
  displayName: string,
  documents: readonly PlaceDocument[],
): V3QuietItem[] {
  if (documents.length === 0) return []
  const items: V3QuietItem[] = documents.map((d) => ({
    kind: 'link' as const,
    id: d.id,
    label: `${displayName} ${documentKindLabel(d.kind)}, ${recordingLabel(d)}, ${d.county} County (PDF)`,
    href: d.url,
  }))
  const hasRecorded = documents.some((d) => d.recordingType !== 'association-published')
  items.push({
    kind: 'prose',
    term: 'About these documents',
    body:
      (hasRecorded
        ? `Documents with a book, page or instrument number are copies of instruments recorded in ${documents[0]!.county} County, Oregon. `
        : '') +
      'Oregon records are indexed by party, not by subdivision, so later amendments may exist that are not listed here. Confirm the current set with a title company before relying on any of them.',
  })
  return items
}

