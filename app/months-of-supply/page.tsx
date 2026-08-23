/**
 * /months-of-supply - the canonical, citable definition of "months of supply"
 * for Central Oregon real estate, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. Market
 * destinations open on Instrument. Three of the six patterns, no two adjacent alike:
 * Breadcrumb (chrome) -> Instrument level 1 (the term and the live region figures)
 * -> Quiet (the definition, the formula, the thresholds) -> Ledger (the city rows)
 * -> Instrument level 2 (the worked identity) -> Quiet (questions and doors) ->
 * Footer (chrome, outside main).
 *
 * THE PAGE CONTRACT, carried across unchanged: `export const metadata` through
 * pageMetadata (same title, description, path, keywords), revalidate 300, the route,
 * and the JSON-LD MEANING - BreadcrumbList, Article, DefinedTerm, FAQPage, the same
 * four payloads with the same fields. Only the EMITTER moved: PageBreadcrumb used to
 * emit BreadcrumbList and FAQBlock used to emit FAQPage, and V3Breadcrumb and V3Quiet
 * carry no structured data of their own, so both now come out of the page's own
 * MetadataBlock from the same arrays the sections render. The BreadcrumbList payload
 * is byte-identical: BreadcrumbNav dropped any crumb with no href, so the current
 * page was never in the list, and it still is not.
 *
 * MetadataBlock stays on the flat legacy register and V3SectionTracker on the KB
 * register deliberately: both are wiring, neither is visual language, and the barrel
 * ships no equivalent. Those two imports are this page's entire remaining non-v3
 * count (5 -> 2).
 *
 * THE TRACKER IS NEW, and it is not a contract change dressed up as one. This page
 * had none. Opening the v3 token scope puts it inside ci:kb-page-contract (G52),
 * whose contract is SEO metadata plus a RENDERED section tracker, so the honest way
 * to migrate is to satisfy the contract rather than to migrate out from under it.
 *
 * The four invariants this file is written to hold:
 *
 *  1. THE TWO CLAUSES ARE NEVER RETYPED. MOS_METHODOLOGY_CLAUSE and
 *     MOS_THRESHOLD_CLAUSE are imported from lib/market/classify.ts and printed
 *     verbatim - as the two definition rows, inside BOTH live traces (region and
 *     city), and as the head of the market-type FAQ answer. Both traces carry
 *     them because both sections publish a months-of-supply figure and a verdict
 *     derived from it, and neither is an attribute of the active-listing
 *     population the query filtered on: a trace has to cover every column its
 *     section prints, not only the column the filter names. No threshold number
 *     and no formula sentence appears in page copy or in
 *     app/months-of-supply/_v3/. CLAUDE.md section 0 designates that module the
 *     single source; ci:market-formula enforces that no page publishes a
 *     competing one.
 *  2. ONE DERIVATION PER GEOGRAPHY, AND IT CLASSIFIES THE RAW VALUE. marketVerdict
 *     reads the stored months_of_supply; formatMonthsOfSupply rounds it only to
 *     display it, and refuses to let the rounded digits cross a threshold the raw
 *     value does not cross. Rounding BEFORE classifying is what that ordering
 *     prevents: 4.02 naively prints "4.0" beside "seller's market" while
 *     lib/market/classify.ts calls it balanced.
 *  3. ONE TRACE PER QUERY, ONE STAMP PER TRACE. Two populations sit on this page -
 *     the region row (geo_type='region', geo_slug='central-oregon') and the city
 *     rows (geo_type='city', geo_label in MOS_CITY_LABELS) - and neither section
 *     borrows the other's figures or the other's clock. The worked identity shares
 *     the region's stamp because it is the region's own two numbers rearranged.
 *  4. ABSENT IS NOT ZERO (CLAUDE.md section 0). A geography whose row did not come
 *     back prints no row and no fabricated number; a row that came back with no
 *     published months of supply states that fact from its own data, in the city
 *     section, rather than being rendered as a figure this page cannot source.
 *     The two cases are written as two different sentences because they are two
 *     different claims about the read - "returned no market row" and "returned a
 *     row with no published months of supply" - and a page must never let one
 *     stand in for the other.
 *
 * DELETED BY THIS MIGRATION, each stated with where the information went:
 *  - PageBreadcrumb -> V3Breadcrumb; its BreadcrumbList moved to MetadataBlock.
 *  - SiteFooter -> V3Footer with V3_FOOTER_COLUMNS, rendered outside <main>.
 *  - FAQBlock -> the closing V3Quiet; its FAQPage moved to MetadataBlock, same items,
 *    same order. FAQBlock's `intro` became that block's `note`, so it now reads under
 *    the questions instead of above them.
 *  - The twelve components/site/primitives imports (Body, Caption, Container,
 *    DisplayHeading, Eyebrow, H1, H2, Section, Stack, TabularNumber, TextLink,
 *    BadgePill) and the three hand-rolled `rounded-[14px] border ...` card shells
 *    (Formula, Thresholds, and the per-geography figure card), with the comment
 *    justifying them to ci:shadcn-burndown. The patterns carry the geometry.
 *  - The BadgePill verdict chip and its VERDICT_TONE success/neutral/warning map. The
 *    verdict WORD survives - as the region Instrument's third figure and as each city
 *    row's detail - and the barrel does not color a verdict, because a green pill on
 *    "seller's market" is an opinion about who that is good news for.
 *  - The em-dash placeholder a null months of supply used to render. A figure this
 *    page cannot source is a figure it does not print (see invariant 4). The metric,
 *    its filter, its window and its units are unchanged; only the empty rendering is.
 *  - The "See the full market report" H2 and its lead sentence. The sentence and all
 *    three of its links survive as rows in the closing Quiet block.
 *  - The "The formula" H2. That section is now the definition V3Quiet, headed "What
 *    months of supply measures", whose first two rows carry the "Formula" and
 *    "Thresholds" terms the deleted cards were captioned with, printing the same two
 *    imported clauses.
 *  - The "Right now" H2, its lede ("Pulled live from the same feed every market report
 *    on this site reads from. Refreshed every 10 to 15 minutes from Oregon Data
 *    Share."), and the per-card "Refreshed <stamp> · market_pulse_live, Oregon Data
 *    Share" caption. Each pattern now states its own provenance from its own query.
 *    The region Instrument's `source` names market_pulse_live through Oregon Data
 *    Share and its `updated` prints that row's real timestamp, and the city Ledger
 *    does the same from the city rows' own clock (invariant 3). The 10-to-15-minute
 *    cadence still ships verbatim in FAQ 4, "Where does the number on this page come
 *    from?".
 *  - The per-card link "See the full <geography> market report", one per figure card.
 *    Both destinations survive as controls, not as sentences: /housing-market/central-
 *    oregon is the region Instrument's action ("Central Oregon market report") and
 *    every one of its three figures, and /housing-market/bend is the Bend row itself,
 *    since a Ledger row IS its door. Both also keep a labelled row in the closing
 *    Quiet block, where the pre-v3 page listed them a second time.
 *  - The words "active single-family listings" beside the CITY count, which the Ledger
 *    row shortens to "<n> for sale" to hold one column at 390. The population is not
 *    dropped, it moves one line down: the city trace names "active single-family
 *    listings, one row per city" under the same section. The REGION count keeps the
 *    full phrase as its figure label, because an Instrument label has the room.
 *  - The worked example's narrative paragraph ("Rearranging the formula on the two
 *    live figures above ... closings across the full six-month window."). Its four
 *    numbers all survive in the level-2 Instrument: active count and months of supply
 *    inside the headline identity, the implied monthly pace and the implied six-month
 *    total as its two labelled figures. Its H2, "The math behind today's number", is
 *    that Instrument's eyebrow, so the words survive one level down. The printed
 *    identity shortened "closed in the trailing six months" to "closed in six months"
 *    to hold one headline line. MOS_METHODOLOGY_CLAUSE, in that Instrument's own
 *    source trace, still names the six-month window.
 *  - The `.catch(() => null)` / `.catch(() => [])` on both DAL calls. Both functions
 *    are makeResilientCached with a documented fallback (null and []), so a swallow
 *    here would only hide a real outage behind a confident empty page.
 *  - The `// @no-parity` header comment. It was inert prose no gate reads (zero
 *    matches for `no-parity` across scripts/), and no parity.json names this route.
 * Nothing was orphaned: every deleted component has other consumers.
 *
 * ONE PRIMARY PER VIEWPORT (PUBLIC_UI.md section 1), AND THE COUNT IS OF VISIBLE FILLED
 * CONTROLS. The first migration wave demoted this page's ask to ghost on the premise
 * that "the sticky public header carries a filled valuation CTA at every scroll
 * position". That premise is FALSE at 390 and the demotion went with it. Measured on
 * this route in a 390x844 browser: every one of the chrome's six valuation anchors
 * computes to a zero box or an invisible ancestor, because at that width the CTA lives
 * inside the collapsed menu. A page that leans on it ships a first viewport with no ask.
 *
 * So the opening Instrument's action is PRIMARY, and it is the page's own. Measured in
 * the same pass, the first viewport at 390 contains exactly one visible filled control
 * from the page: a.v3-btn--primary "Central Oregon market report", 245x44 at y=674,
 * background rgb(16,39,66). Nothing else on the route is filled - the city Ledger's
 * action takes V3Ledger's ghost default, V3Quiet renders no button, and V3Footer's rows
 * are plain anchors. (The cookie-consent overlay paints its own filled "Accept all" at
 * y=804. That is transient site chrome behind a dismissal, not one of this page's asks.)
 *
 * The page's own copy carries no valuation link, and none is added: a glossary entry is
 * not an ask, and the pre-v3 page carried none either. The one /sell#get-value on the
 * rendered route is the shared footer's projection of lib/site-nav.ts VALUATION_FORM
 * through V3_FOOTER_COLUMNS - site chrome on every v3 route, not this page's control,
 * and not this route's to rewrite. Any valuation link added to this page's own copy
 * later goes through valuationHref('/months-of-supply') (lib/site/valuation-href.ts) so
 * the lead keeps its `?from=` attribution, never as a bare href.
 */

import type { Metadata } from 'next'
import { getRegionPulse, getMarketPulseCitySnapshots } from '@/lib/data'
import {
  getPublicPlaceSegments,
  publicSegmentBrowseHref,
  publicSegmentNoun,
} from '@/lib/data/market-truth/public-segments'
import {
  MOS_METHODOLOGY_CLAUSE,
  MOS_THRESHOLD_CLAUSE,
  marketVerdict,
} from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatDateTime } from '@/lib/format/date'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  MOS_CITY_LABELS,
  MOS_CITY_REPORT,
  MOS_DEFINITION_PARAGRAPHS,
  MOS_FAQ_FIRST,
  MOS_FAQ_NOTE,
  MOS_FAQ_REST,
  MOS_MARKET_TYPE_ANSWER_TAIL,
  MOS_MARKET_TYPE_QUESTION,
  MOS_METADATA_DESCRIPTION,
  MOS_METADATA_KEYWORDS,
  MOS_REGION_REPORT,
  MOS_RELATED_INTRO,
  MOS_RELATED_LINKS,
  MOS_SAME_FORMULA_EVERYWHERE,
  MOS_FAQ_TITLE,
  type MosFaq,
} from './_v3/mos-constants'

export const revalidate = 300

// Metadata - unchanged from the pre-v3 page, field for field.
export const metadata: Metadata = pageMetadata({
  title: 'Months of supply, defined',
  description: MOS_METADATA_DESCRIPTION,
  path: '/months-of-supply',
  keywords: MOS_METADATA_KEYWORDS,
})

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

/**
 * The freshness stamp, preformatted here because no primitive in the barrel parses
 * or formats a date. formatDateTime already renders in the brand timezone
 * (America/Los_Angeles) in exactly this shape, so this page does not hand-roll a
 * second copy. It returns an em dash for an unusable value, which would claim a
 * refresh that has no timestamp, so that case returns undefined and the clause is
 * dropped from the trace instead.
 */
function refreshStamp(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  if (Number.isNaN(new Date(iso).getTime())) return undefined
  return `${formatDateTime(iso)} PT`
}

export default async function MonthsOfSupplyPage() {
  // Data, all through the DAL (G8). Nothing is fetched that this page does not render.
  //   regionPulse   - market_pulse_live, geo_type='region', geo_slug='central-oregon',
  //                   property_type='A'. lib/data/market/getRegionPulse.ts.
  //   citySnapshots - market_pulse_live, geo_type='city', geo_label in MOS_CITY_LABELS,
  //                   property_type='A'. lib/data/market/getMarketPulseSnapshot.ts.
  const [regionPulse, citySnapshots, publicSegments] = await Promise.all([
    getRegionPulse(),
    getMarketPulseCitySnapshots([...MOS_CITY_LABELS]),
    getPublicPlaceSegments({ geoType: 'region', geoSlug: 'central-oregon' }),
  ])

  // Invariant 2, region. The verdict classifies the STORED value and
  // formatMonthsOfSupply rounds only to display it.
  const regionMos = regionPulse?.monthsOfSupply ?? null
  const regionVerdict = marketVerdict(regionMos)
  const regionStamp = refreshStamp(regionPulse?.updatedAt)

  // Every region figure is a door into the region report, which is the page that
  // publishes the row these three numbers come from.
  const regionFigures: V3InstrumentFigure[] = []
  if (regionMos != null) {
    regionFigures.push({
      value: v3Text(formatMonthsOfSupply(regionMos)),
      label: v3Text('months of supply in Central Oregon'),
      href: MOS_REGION_REPORT,
    })
  }
  if (regionPulse != null && regionPulse.activeCount != null && regionPulse.activeCount > 0) {
    regionFigures.push({
      value: v3Text(regionPulse.activeCount.toLocaleString('en-US')),
      label: v3Text('active single-family listings'),
      href: MOS_REGION_REPORT,
    })
  }
  if (regionVerdict.kind !== 'unknown') {
    regionFigures.push({
      value: v3Text(capitalize(regionVerdict.label)),
      label: v3Text('Central Oregon today'),
      href: MOS_REGION_REPORT,
    })
  }
  for (const row of publicSegments) {
    if (row.monthsOfSupply == null || row.activeCount == null || row.activeCount <= 0) continue
    regionFigures.push({
      value: v3Text(formatMonthsOfSupply(row.monthsOfSupply)),
      label: v3Text(`${publicSegmentNoun(row.segment, row.activeCount)} · months of supply`),
      href: publicSegmentBrowseHref(null, row.segment),
    })
  }
  const [firstRegionFigure, ...restRegionFigures] = regionFigures

  // The region trace: the query, then the two canonical clauses, printed verbatim.
  const regionTrace =
    'Detached months of supply is the region HUD overlay. Extra product-type months of supply are Market Truth mt-v1, sample-gated. ' +
    MOS_METHODOLOGY_CLAUSE +
    ' ' +
    MOS_THRESHOLD_CLAUSE

  // The worked identity: the formula rearranged on the two live region figures
  // already on screen. An exact identity of those numbers, not a second source. It
  // needs a months of supply above zero, because inverting a zero divides by it.
  const worked =
    regionPulse &&
    regionPulse.activeCount != null &&
    regionPulse.activeCount > 0 &&
    regionMos != null &&
    regionMos > 0
      ? {
          active: regionPulse.activeCount,
          mos: regionMos,
          avgMonthlyClosings: Math.round((regionPulse.activeCount / regionMos) * 10) / 10,
          impliedSixMonthTotal: Math.round((regionPulse.activeCount / regionMos) * 6),
        }
      : null

  // City rows. A city earns a row when the live query returned one AND that row
  // carries a months of supply, because the Ledger's value column is a figure and a
  // figure this page cannot source is a figure it does not print. Invariant 4.
  const snapshotByLabel = new Map(citySnapshots.map((s) => [s.geo_label, s]))
  const cityRows: V3LedgerFigureRow[] = []
  const rowed = new Set<string>()
  for (const label of MOS_CITY_LABELS) {
    const snapshot = snapshotByLabel.get(label)
    if (!snapshot || snapshot.months_of_supply == null) continue
    const verdict = marketVerdict(snapshot.months_of_supply)
    rowed.add(label)
    cityRows.push({
      href: MOS_CITY_REPORT[label],
      when: v3Text(
        snapshot.active_count != null
          ? `${snapshot.active_count.toLocaleString('en-US')} for sale`
          : 'active count unpublished',
      ),
      what: v3Text(label),
      detail:
        verdict.kind === 'unknown' ? undefined : v3Text(capitalize(verdict.label)),
      value: v3Text(formatMonthsOfSupply(snapshot.months_of_supply)),
      id: label.toLowerCase(),
    })
  }
  const [firstCityRow, ...restCityRows] = cityRows

  // A covered city that earned no row states the reason it has no figure, from its own
  // data. Two cases, and they are not the same claim: no row came back at all, or a row
  // came back with no published months of supply.
  //
  // THESE SENTENCES RENDER INSIDE THE CITY SECTION, NEVER IN THE CLOSING QUIET BLOCK.
  // The second case prints a live active count, and the Quiet pattern takes no `source`
  // and no `updated` - its own contract reads "a number belongs in an Instrument with
  // its source line, not here" (components/site/v3/V3Quiet.tsx). Printed there, this
  // count would be the only city figure on the page and would carry neither the city
  // query's trace nor the city query's clock, against invariant 3. So it goes where
  // that trace and that stamp already are: the Ledger's `note` when the list has rows,
  // and the Ledger's `emptyMessage` when it does not. Both branches below pass `source`
  // and `updated` - V3LedgerProps variant 3 allows a trace on a zero-row Ledger for
  // exactly this reason ("A zero-row query is a fact worth printing").
  const cityFootnotes = MOS_CITY_LABELS.filter((label) => !rowed.has(label)).map(
    (label) => {
      const snapshot = snapshotByLabel.get(label)
      if (!snapshot) return `${label} returned no market row in the latest sync`
      if (snapshot.active_count == null) return `${label} has no published active single-family count`
      return `${label} shows ${snapshot.active_count.toLocaleString('en-US')} active with no published months of supply`
    },
  )
  const cityFootnoteSentence =
    cityFootnotes.length > 0 ? `${cityFootnotes.join('. ')}.` : undefined

  // The city Ledger's own stamp, from the city rows themselves. The region row
  // refreshes on its own schedule, so borrowing its timestamp would date one query's
  // figures with another query's clock. Invariant 3.
  const cityRefreshedAt = citySnapshots
    .map((s) => s.updated_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1)
  const cityStamp = refreshStamp(cityRefreshedAt)

  // The city trace, one per query (invariant 3), covering every column the section
  // publishes rather than only the population the filter named. `when` prints an
  // active count, which the filter phrase covers; `value` prints months of supply and
  // `detail` prints the verdict derived from it, and neither is an attribute of active
  // listings - so the same two imported clauses the region trace carries are appended
  // here. Same string in both branches, because it is the same query either way.
  const cityTrace =
    'market_pulse_live through Oregon Data Share, active single-family listings, one row per city. ' +
    MOS_METHODOLOGY_CLAUSE +
    ' ' +
    MOS_THRESHOLD_CLAUSE

  // The definition block. The two canonical clauses are printed here verbatim, under
  // the labels the pre-v3 cards carried.
  const definitionItems: V3QuietItem[] = []
  if (!firstRegionFigure) {
    definitionItems.push({
      kind: 'prose',
      term: 'No live figure right now',
      body: 'The Central Oregon market row did not return on this refresh, so this page is not printing a months of supply, an inventory count, or a verdict. The formula and the thresholds below are unchanged.',
    })
  }
  definitionItems.push(
    { kind: 'prose', body: MOS_DEFINITION_PARAGRAPHS },
    { kind: 'prose', term: 'Formula', body: MOS_METHODOLOGY_CLAUSE },
    { kind: 'prose', term: 'Thresholds', body: MOS_THRESHOLD_CLAUSE },
    { kind: 'prose', term: 'Every page, one formula', body: MOS_SAME_FORMULA_EVERYWHERE },
  )

  // The four questions, in their original order. Question 2 opens with the canonical
  // threshold sentence and continues with its tail, so the visible answer and the
  // FAQPage JSON-LD read the one sentence the rest of the site prints.
  const faqs: MosFaq[] = [
    MOS_FAQ_FIRST,
    {
      question: MOS_MARKET_TYPE_QUESTION,
      answer: MOS_THRESHOLD_CLAUSE + MOS_MARKET_TYPE_ANSWER_TAIL,
    },
    ...MOS_FAQ_REST,
  ]

  // The closing block's rows: the questions, then the outbound doors the pre-v3
  // "See the full market report" section carried, then any city with no live figure.
  const closingItems: V3QuietItem[] = [
    ...faqs.map((item) => ({ kind: 'prose' as const, term: item.question, body: item.answer })),
    { kind: 'prose', term: 'See the full market report', body: MOS_RELATED_INTRO },
    ...MOS_RELATED_LINKS.map((link) => ({ label: link.label, href: link.href })),
  ]

  const site = getCanonicalSiteUrl()
  const pageUrl = `${site}/months-of-supply`
  const definitionText = `${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}`

  // JSON-LD. BreadcrumbList + Article + FAQPage from MetadataBlock, DefinedTerm from
  // the hand-written script below. Same four payloads the pre-v3 page emitted.
  // BreadcrumbNav filtered out any crumb with no href, so "Months of supply" was
  // never a list item and still is not. dateModified is the real market_pulse_live
  // updated_at, never now().
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Housing market', url: '/housing-market' },
      ],
    },
    {
      type: 'article',
      headline: 'Months of supply, defined',
      description: definitionText,
      url: '/months-of-supply',
      dateModified: regionPulse?.updatedAt || undefined,
    },
    { type: 'faqPage', items: faqs },
  ]

  // DefinedTerm - hand-written because lib/site/json-ld.ts's SchemaInput union has no
  // 'definedTerm' case, and that file is shared. Payload unchanged.
  const definedTermJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: 'Months of supply',
    alternateName: 'MoS',
    description: definitionText,
    url: pageUrl,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'Ryan Realty real estate glossary',
      url: `${site}/months-of-supply`,
    },
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermJsonLd) }}
        />

        <V3SectionTracker />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Housing market', href: '/housing-market' },
            { label: 'Months of supply' },
          ]}
        />

        {firstRegionFigure ? (
          // D9 leftover on purpose (A27): the term plus today's region MoS is a
          // singleton status. getPriceHistory has no months-of-supply series.
          <V3Instrument
            id="months-of-supply"
            level={1}
            eyebrow={v3Text('Real estate glossary')}
            headline={v3Text('Months of supply')}
            figures={[firstRegionFigure, ...restRegionFigures]}
            source={v3Text(regionTrace)}
            updated={regionStamp ? v3Text(regionStamp) : undefined}
            // PRIMARY, and stated rather than defaulted. This is the page's one
            // visible filled control at every width (see the header): at 390 the
            // chrome's own CTA is inside the collapsed menu and has no box.
            action={{
              label: v3Text('Central Oregon market report'),
              href: MOS_REGION_REPORT,
              variant: 'primary',
            }}
          />
        ) : null}

        {/* When the region row is missing this block carries the h1, so the page
            still opens with the term it exists to define. */}
        <V3Quiet
          id="definition"
          eyebrow={firstRegionFigure ? 'Definition' : 'Real estate glossary'}
          heading={firstRegionFigure ? 'What months of supply measures' : 'Months of supply'}
          headingLevel={firstRegionFigure ? 2 : 1}
          items={definitionItems}
        />

        {firstCityRow ? (
          // D9 leftover: each city is a door. A line through cities invents a
          // sequence, and getPriceHistory has no MoS series to plot.
          <V3Ledger
            id="by-city"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Months of supply by city')}
            /* A covered city with no figure names itself here, under this section's
               own source line and stamp, because the sentence carries a live count. */
            note={
              cityFootnoteSentence
                ? v3Text(`Not in the list: ${cityFootnoteSentence}`)
                : undefined
            }
            rows={[firstCityRow, ...restCityRows]}
            source={v3Text(cityTrace)}
            updated={cityStamp ? v3Text(cityStamp) : undefined}
            action={{ label: v3Text('All cities and towns'), href: '/housing-market' }}
          />
        ) : (
          <V3Ledger
            id="by-city"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Months of supply by city')}
            rows={[]}
            /* Why the list is empty, per city, from that city's own row - not the
               generic sentence, which cannot tell "no row came back" from "a row came
               back without the figure". The count inside it is traced and stamped by
               the same two props the populated branch passes. `updated` is present
               only when a row actually came back, so a stamp never claims a refresh
               the query did not return. */
            emptyMessage={v3Text(
              cityFootnoteSentence ??
                'No city returned a live single-family months of supply on this refresh.',
            )}
            source={v3Text(cityTrace)}
            updated={cityStamp ? v3Text(cityStamp) : undefined}
            action={{ label: v3Text('All cities and towns'), href: '/housing-market' }}
          />
        )}

        {worked ? (
          // D9 leftover on purpose (A27): the worked identity rearranges two
          // live numbers. It is not a time series.
          <V3Instrument
            id="worked-example"
            level={2}
            eyebrow={v3Text('The math behind today’s number')}
            headline={v3Text(
              `${worked.active.toLocaleString('en-US')} active ÷ (${worked.impliedSixMonthTotal.toLocaleString('en-US')} closed in six months ÷ 6) = ${formatMonthsOfSupply(worked.mos)} months of supply`,
            )}
            figures={[
              {
                value: v3Text(worked.avgMonthlyClosings.toFixed(1)),
                label: v3Text('closings a month, implied'),
                href: MOS_REGION_REPORT,
              },
              {
                value: v3Text(worked.impliedSixMonthTotal.toLocaleString('en-US')),
                label: v3Text('closings across the six-month window'),
                href: MOS_REGION_REPORT,
              },
            ]}
            source={v3Text(
              'the two live Central Oregon figures above, rearranged through the same formula. An exact identity of those two numbers, not a separately sourced count. ' +
                MOS_METHODOLOGY_CLAUSE,
            )}
            updated={regionStamp ? v3Text(regionStamp) : undefined}
          />
        ) : null}

        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading={MOS_FAQ_TITLE}
          note={MOS_FAQ_NOTE}
          items={closingItems}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
