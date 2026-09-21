// @no-parity — factual 2026-09-16 snapshot + live counts. No Wave-3 mockup / taste class.
/**
 * /new-construction — Bend new-construction communities, list-price bands,
 * and published builder financing. Snapshot researched 2026-09-16 PT.
 * SITE-132: one overview map, scannable savings chips, contact, SEO H1/FAQ.
 *
 * VISUAL THESIS: compact Stage, overview map of recorded NC zones, savings
 * chips, contact, then the affordable SFR shelf (Parkside → Calaveras →
 * Easton), then the rest of the named communities, then financing as Answers.
 * Not a search redirect. /builders still 301s here.
 *
 * Rhythm: Breadcrumb-on-Stage -> Stage -> Atlas -> savings -> contact ->
 * SFR shelf -> SFR ledger -> Horton townhome note -> Answers -> places/guides
 * -> FAQ -> Footer outside main.
 *
 * SITE-152 (Matt 2026-09-21): "There are two maps, and the maps are
 * confusing." Verified 2026-09-21: this route renders exactly ONE <V3Atlas>
 * (the "zones" call below) — full grep of app/new-construction/** and
 * lib/site/bend-new-construction.ts, the file history of this route back to
 * its first commit (ab534f000), and the rendered HTML of both this branch's
 * local build and the live production page (curl, both dated 2026-09-21) all
 * show one "New-construction zones on the map" section. There is no second
 * Atlas/place map to consolidate on THIS route, so none was deleted —
 * deleting the only map to satisfy "consolidate to one" would have been the
 * actual regression (the node's own escape hatch names this case).
 *
 * What most likely reads as "two maps": screenshotted 2026-09-21 at 1440 and
 * 375 (design_system/ryan-realty/ui_kits/new-construction/shots/
 * site152-atlas-1440.png, site152-atlas-375.png). V3Atlas's own
 * touch-accessible chip list — the real tap target on mobile, since a
 * cluster pin can render under 20px and is not reliably tappable
 * (V3Atlas.client.tsx: "the chips carry the reach the map cannot") —
 * renders as its own bordered grid of place-name buttons below the
 * pinned canvas, long enough to fold behind "+ N more". At 375 it reads as a
 * second, separate boxed list under the actual map, not obviously part of
 * the same object. That chip list is load-bearing accessibility, not a
 * duplicate map, and V3Atlas is a SHARED primitive (city/subdivision/
 * community/team/zip pages all call it) — its internal chip/canvas framing
 * is out of this route-scoped node's file ownership to redesign. Flagged as
 * a follow-up task rather than patched here; see the SITE-152 report.
 *
 * The coverage rule below fixes the piece that WAS this route's own doing:
 * the shelf's 3 tabs read as "the whole market" without the page ever
 * stating that the other 35 named communities are one scroll away. See
 * `bendNewConCoverageCounts()` and the shelf/ledger notes + the new
 * `faq-coverage` FAQ entry.
 */
import type { Metadata } from 'next'
import { searchListingsAllCount } from '@/lib/data'
import { formatDate } from '@/lib/format/date'
import { BRAND, CONTACT } from '@/lib/brand/contact'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { pageMetadata } from '@/lib/site/page-metadata'
import {
  BEND_NEW_CON_BROOKSMILL_NOTE,
  BEND_NEW_CON_DISCLAIMER,
  BEND_NEW_CON_FAQ,
  BEND_NEW_CON_FINANCING,
  BEND_NEW_CON_FINANCING_SOURCE,
  BEND_NEW_CON_HEADLINE,
  BEND_NEW_CON_HORTON_TOWNHOME_NOTE,
  BEND_NEW_CON_HORTON_TOWNHOME_SOURCE,
  BEND_NEW_CON_INVENTORY_SOURCE,
  BEND_NEW_CON_LEDE,
  BEND_NEW_CON_SEARCH_HREF,
  BEND_NEW_CON_STEVENS_RANCH_SF,
  BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES,
  bendNewConHortonTownhomeRows,
  bendNewConLeadRows,
  BEND_NEW_CON_SINGLE,
  BEND_NEW_CON_UNSPECIFIED,
  BEND_NEW_CONSTRUCTION_DESCRIPTION,
  BEND_NEW_CONSTRUCTION_H1,
  BEND_NEW_CONSTRUCTION_KEYWORDS,
  BEND_NEW_CONSTRUCTION_PATH,
  BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
  BEND_NEW_CONSTRUCTION_TITLE,
  bendNewConCommunityHref,
  bendNewConCoverageCounts,
  bendNewConRestPrimary,
  bendNewConRowConcessionLine,
  bendNewConRowConcessionReveal,
  bendNewConSeeHomesLabel,
  bendNewConWeight,
  financingHighlight,
  flagLabel,
  type NewConInventoryRow,
} from '@/lib/site/bend-new-construction'
import {
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
  V3Answers,
  V3Atlas,
  V3Breadcrumb,
  V3Doors,
  V3Footer,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  v3Text,
  type V3Answer,
  type V3AnswersDoor,
  type V3LedgerFigureRow,
} from '@/components/site/v3'
import { V3Stage } from '@/components/site/v3/V3Stage'
import { buildNewConLeadShelf } from './_v3/load-lead-shelf'
import {
  loadBendNewConLiveMatch,
  loadLeadShelfTiles,
  loadStevensRanchSfMatch,
  loadStevensRanchTownhomeMatch,
  type BendNewConLiveMatch,
} from './_v3/load-live-matches'
import { aeoHubQuietItems } from '@/lib/seo/aeo-hub-guides'
import { NewConLeadShelf } from './_v3/NewConLeadShelf.client'
import { NewConSavingsChips } from './_v3/NewConSavingsChips'
import { loadNewConOverviewMap } from './_v3/load-overview-map'
import './_v3/new-con-page.css'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: BEND_NEW_CONSTRUCTION_TITLE,
  description: BEND_NEW_CONSTRUCTION_DESCRIPTION,
  path: BEND_NEW_CONSTRUCTION_PATH,
  keywords: BEND_NEW_CONSTRUCTION_KEYWORDS,
  ogType: 'article',
})

function inventoryRow(row: NewConInventoryRow, live: BendNewConLiveMatch): V3LedgerFigureRow {
  const builders = row.builders ?? 'Builder not in sampled details'
  const community = bendNewConCommunityHref(row.name)
  const stevensSf = row.name === 'Stevens Ranch'
  const priceBand = stevensSf ? BEND_NEW_CON_STEVENS_RANCH_SF.priceBand : row.priceBand
  const liveLine =
    live.count != null
      ? `${live.count} live Active new-construction ${live.count === 1 ? 'home matches' : 'homes match'} this search`
      : 'Opens the live new-construction search for this subdivision only'
  /* SITE-151 (Matt 2026-09-21): the concession travels WITH the row instead
     of living only in the page-bottom Financing section. The headline sits
     in the always-visible `detail` line; the full offer, its flags, and its
     source sit in `reveal` alongside the row's other on-hold facts. Rows
     with no attached offer show neither — §0: say nothing rather than
     imply one. */
  const concessionHeadline = bendNewConRowConcessionLine(row.name)
  const concessionDeep = bendNewConRowConcessionReveal(row.name)
  const revealBits = [
    liveLine,
    `${row.active} Active in the 2026-09-16 snapshot`,
    stevensSf
      ? `${BEND_NEW_CON_STEVENS_RANCH_SF.source} Horton SF QMI about ${BEND_NEW_CON_STEVENS_RANCH_SF.qmi}. DAL mixed band ${BEND_NEW_CON_STEVENS_RANCH_SF.dalMixedBand}. This door is Single Family Residence only.`
      : null,
    row.median && !stevensSf ? `Median list ${row.median}` : null,
    row.typical,
    community ? `Community page also at ${community}` : null,
    concessionDeep,
  ].filter((bit): bit is string => Boolean(bit))

  return {
    href: live.href,
    when: v3Text(builders),
    what: v3Text(row.name),
    detail: v3Text(
      [
        row.typical ? `${priceBand} · ${row.typical}` : priceBand,
        concessionHeadline ? `Concession: ${concessionHeadline}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    ),
    value: v3Text(bendNewConSeeHomesLabel(live.count)),
    weight: live.count != null && live.count > 0 ? bendNewConWeight(live.count) : bendNewConWeight(row.active),
    reveal: { line: v3Text(revealBits.join(' · ')) },
  }
}

function financingAnswers(): V3Answer[] {
  return BEND_NEW_CON_FINANCING.map((offer) => {
    const flags = flagLabel(offer.flags)
    const highlight = financingHighlight(offer)
    return {
      id: offer.id,
      question: flags ? `${offer.builder}: ${offer.title} · ${flags}` : `${offer.builder}: ${offer.title}`,
      figure: { value: highlight.value, label: highlight.label },
      body: offer.terms,
      source: BEND_NEW_CON_FINANCING_SOURCE,
      action: offer.sources[0]
        ? { label: offer.sources[0].label, href: offer.sources[0].href }
        : undefined,
    }
  })
}

function financingDoors(): V3AnswersDoor[] {
  return BEND_NEW_CON_FINANCING.flatMap((offer) =>
    offer.sources.map((source) => ({
      label: source.label,
      href: source.href,
      group: offer.builder,
    })),
  )
}

export default async function NewConstructionPage() {
  const site = getCanonicalSiteUrl()
  const pageUrl = `${site}${BEND_NEW_CONSTRUCTION_PATH}`
  const researched = formatDate(BEND_NEW_CONSTRUCTION_RESEARCH_DATE)
  const office = `${BRAND.address.street}, ${BRAND.address.city}`
  const coverage = bendNewConCoverageCounts()
  const restRows = bendNewConRestPrimary()
  const singleRows = BEND_NEW_CON_SINGLE
  const hortonTownhomeRows = bendNewConHortonTownhomeRows()
  const leadRows = bendNewConLeadRows()
  const [
    leadMatches,
    restMatches,
    singleMatches,
    hortonMatches,
    stevensTownhomeMatch,
    tilesByName,
    overview,
  ] = await Promise.all([
    Promise.all(leadRows.map((row) => loadBendNewConLiveMatch(row.name))),
    Promise.all(
      restRows.map((row) =>
        row.name === 'Stevens Ranch'
          ? loadStevensRanchSfMatch()
          : loadBendNewConLiveMatch(row.name),
      ),
    ),
    Promise.all(singleRows.map((row) => loadBendNewConLiveMatch(row.name))),
    Promise.all(hortonTownhomeRows.map((row) => loadBendNewConLiveMatch(row.name))),
    loadStevensRanchTownhomeMatch(),
    Promise.all(leadRows.map((row) => loadLeadShelfTiles(row))),
    loadNewConOverviewMap(),
  ])
  /* SITE-152 (2026-09-21): the Stage's live headline reads the SAME
     de-duplicated searchListingsAll() pull that draws the map's dots, not a
     second, separate searchListingsAllCount() query — the two disagreed by 5
     listings live-verified 2026-09-21 (216 raw MV rows vs 211 de-duplicated
     by street) because searchListingsAllCount() counts the raw materialized
     view and searchListingsAll()'s totalCount does not. One source keeps the
     number at the top of the page and the map below it from ever
     contradicting each other. See load-overview-map.ts `liveTotal`.
     The raw head-count is still pulled directly, once, as a §0 cross-check:
     if it ever drops BELOW the de-duplicated total, or grows apart from it by
     more than the known street-duplicate margin, the de-dup itself likely
     broke and is silently under- or over-counting — worth a server log, not
     worth blocking the render over. */
  const liveBendCount = overview.liveTotal
  if (liveBendCount != null) {
    const rawBendCount = await searchListingsAllCount({
      city: 'Bend',
      newConstruction: true,
      status: 'active',
    }).catch(() => null)
    if (rawBendCount != null && rawBendCount < liveBendCount) {
      console.error(
        `[NewConstructionPage] live-count reconciliation: raw MV head-count (${rawBendCount}) is LESS than the de-duplicated total (${liveBendCount}) it should always exceed or equal.`,
      )
    }
  }
  const restPrimary = restRows.map((row, i) => inventoryRow(row, restMatches[i]!))
  const [firstRest, ...moreRest] = restPrimary
  const [firstSingle, ...restSingle] = singleRows.map((row, i) =>
    inventoryRow(row, singleMatches[i]!),
  )
  const hortonTownhomes = hortonTownhomeRows.map((row, i) => inventoryRow(row, hortonMatches[i]!))
  const [firstHortonTownhome, ...moreHortonTownhomes] = hortonTownhomes
  const lead = await buildNewConLeadShelf(leadRows, tilesByName, leadMatches)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
          { '@type': 'ListItem', position: 2, name: 'Homes for sale', item: `${site}/homes-for-sale` },
          { '@type': 'ListItem', position: 3, name: BEND_NEW_CONSTRUCTION_TITLE, item: pageUrl },
        ],
      },
      {
        '@type': 'Article',
        headline: BEND_NEW_CONSTRUCTION_H1,
        description: BEND_NEW_CONSTRUCTION_DESCRIPTION,
        url: pageUrl,
        datePublished: BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
        dateModified: BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
        author: { '@type': 'Organization', name: BRAND.name, url: site },
        publisher: { '@type': 'Organization', name: BRAND.name, url: site },
      },
      {
        '@type': 'FAQPage',
        mainEntity: BEND_NEW_CON_FAQ.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  }

  return (
    <>
      <main className={`${V3_ROOT_CLASS} newcon-page`}>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <V3SectionTracker />

        <div className="newcon-hero">
          <V3Stage
            id="new-construction"
            headingLevel={1}
            eyebrow="Bend proper · researched 2026-09-16 · live counts today"
            headline={BEND_NEW_CONSTRUCTION_H1}
            posterSrc={lead.posterSrc}
            overlayStrength="standard"
            height="compact"
            bandWhenCompact
            inventory={{
              figures: [
                {
                  value: String(liveBendCount ?? BEND_NEW_CON_HEADLINE.active),
                  label:
                    liveBendCount != null
                      ? 'live Active new homes in Bend'
                      : 'Active new homes on 2026-09-16',
                  href: BEND_NEW_CON_SEARCH_HREF,
                },
                {
                  value: BEND_NEW_CON_HEADLINE.median,
                  label: 'median list 2026-09-16',
                  href: BEND_NEW_CON_SEARCH_HREF,
                },
                {
                  value: BEND_NEW_CON_HEADLINE.priceSpanFold,
                  label: 'list-price span that day',
                  href: BEND_NEW_CON_SEARCH_HREF,
                },
              ],
              source: BEND_NEW_CON_INVENTORY_SOURCE,
              sourceName: 'Ryan Realty listings',
              updatedAt: BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
            }}
            action={{
              label: 'See Bend new construction',
              href: BEND_NEW_CON_SEARCH_HREF,
            }}
          />
          <div className="newcon-hero__crumb absolute inset-x-0 top-0 z-10 bg-navy">
            <V3Breadcrumb
              tone="on-media"
              belowNav={false}
              trail={[
                { label: 'Home', href: '/' },
                { label: 'Homes for sale', href: '/homes-for-sale' },
                { label: 'New construction' },
              ]}
            />
          </div>
        </div>

        {overview.regions.length > 0 || overview.dots.length > 0 ? (
          <V3Atlas
            id="zones"
            headingLevel={2}
            headline={v3Text('New-construction zones on the map')}
            headlineTone="eyebrow"
            claimTone="inventory"
            claimText={
              overview.dots.length > 0
                ? `${overview.dots.length} live Active new-construction homes with a coordinate. ${overview.outlinedNamed} of ${overview.namedTotal} named communities have a recorded plat.`
                : `${overview.outlinedNamed} of ${overview.namedTotal} named communities have a recorded plat. Live homes without coordinates stay on the lists below.`
            }
            keyPlacement="head"
            sourceName="Oregon Data Share"
            dots={overview.dots}
            regions={overview.regions}
            types={overview.types}
            source={overview.source}
            stamp={overview.stamp}
            incomplete={overview.incomplete}
            outlinedOf={overview.namedTotal}
            basemap={overview.basemap}
            fit="regions"
            /* SITE-142 soft 1: default 64px cells left 3-4 overlapping cluster
               pairs at both 375 and 1440 (measured, scratchpad/nc-fit-before.json
               and the pin-overlap probe). 96px clears every 375/360/390 overlap
               and cuts 1440's worst overlap area from 309px^2 to 76px^2 — the
               grid clusterer is not transitive across cell edges (see
               lib/atlas/cluster-pins.ts), so a residual pair or two at 1440 is
               the algorithm's own floor, not a page-level miss. */
            clusterCellPx={96}
          />
        ) : null}

        <NewConSavingsChips />

        <V3Doors
          id="tour"
          name={v3Text('Call, text, or open a builder page')}
          doors={[
            {
              kicker: v3Text('Call'),
              label: v3Text(CONTACT.phoneDirect),
              fact: v3Text(office),
              href: `tel:${CONTACT.phoneDirectTel}`,
              primary: true,
            },
            {
              kicker: v3Text('Text'),
              label: v3Text('Same number'),
              href: `sms:${CONTACT.phoneDirectTel}`,
            },
            {
              kicker: v3Text('Schedule'),
              label: v3Text('Pick a time'),
              href: '/book',
            },
            {
              /* SITE-142 soft 5: this band's own name promised "or open a
                 builder page" but every door was brokerage-only (Call, Text,
                 Schedule, Search) — the finding behind "builder contact =
                 broker block only." The builder pages doors below are the
                 real, sourced destinations (BEND_NEW_CON_FINANCING); this
                 door is the anchor that makes the promise in `name` true at
                 the first contact touchpoint instead of four sections down.
                 Search stays reachable from the Stage CTA above and the
                 ledger actions below, so nothing is lost by trading it here. */
              kicker: v3Text('Builder'),
              label: v3Text('Open a builder page'),
              href: '#builders',
            },
          ]}
        />

        <V3Doors
          id="builders"
          name={v3Text('Published builder pages')}
          doors={[
            {
              kicker: v3Text('Pahlisch'),
              label: v3Text('Golden Key'),
              href: BEND_NEW_CON_FINANCING[0]!.sources[0]!.href,
            },
            {
              kicker: v3Text('D.R. Horton'),
              label: v3Text('Stevens Ranch flyer'),
              href: BEND_NEW_CON_FINANCING[1]!.sources[0]!.href,
            },
            {
              kicker: v3Text('Lennar'),
              label: v3Text('Fall Super Sale'),
              href: BEND_NEW_CON_FINANCING[2]!.sources[0]!.href,
            },
            {
              kicker: v3Text('Hayden'),
              label: v3Text('$0 Down'),
              href: BEND_NEW_CON_FINANCING[4]!.sources[0]!.href,
            },
          ]}
        />

        <NewConLeadShelf
          heading={BEND_NEW_CON_LEDE}
          note={`${coverage.total} named Bend communities were researched 2026-09-16. These ${coverage.shelf} lead with live SFR photos, lowest list band first; the other ${coverage.rest} are below on this page, same order. Not a loan offer. See homes opens every Active new-construction home in that subdivision.`}
          bands={lead.bands}
          seeAllHref={BEND_NEW_CON_SEARCH_HREF}
        />

        {firstRest ? (
          <V3Ledger
            id="for-sale"
            eyebrow={v3Text(`${coverage.ledger} more, lowest SFR band first`)}
            heading={v3Text('Single-family communities')}
            note={v3Text(
              `Same communities as the map above. Parkside, Calaveras, and Easton lead the page with photos; these ${coverage.ledger} continue the same list, lowest SFR list band first, starting with Petrosa and Acadia Pointe, then Horton Stevens Ranch single-family from $579,995. Horton’s townhome communities and the ${coverage.single} communities with one Active home each have their own sections below. Each row opens that subdivision’s live search. Open a row for the snapshot band.`,
            )}
            rows={[firstRest, ...moreRest]}
            source={v3Text(BEND_NEW_CON_INVENTORY_SOURCE)}
            updated={v3Text(researched)}
            encode="bar"
            action={{
              label: v3Text('Open the live search'),
              href: BEND_NEW_CON_SEARCH_HREF,
            }}
            footnote={
              <>
                {BEND_NEW_CON_UNSPECIFIED.note} Band {BEND_NEW_CON_UNSPECIFIED.priceBand}, median{' '}
                {BEND_NEW_CON_UNSPECIFIED.median}. {BEND_NEW_CON_BROOKSMILL_NOTE} Caldera Springs is
                Sunriver. It is not in this Bend table.
              </>
            }
          />
        ) : null}

        {firstHortonTownhome ? (
          <V3Ledger
            id="horton-townhomes"
            eyebrow={v3Text('Also listed')}
            heading={v3Text('Horton townhomes')}
            note={v3Text(BEND_NEW_CON_HORTON_TOWNHOME_NOTE)}
            rows={[
              firstHortonTownhome,
              ...moreHortonTownhomes,
              {
                href: stevensTownhomeMatch.href,
                when: v3Text(BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.builders),
                what: v3Text(BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.name),
                detail: v3Text(
                  `${BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.priceBand} · Horton Express QMI about ${BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.qmi}.`,
                ),
                value: v3Text(bendNewConSeeHomesLabel(stevensTownhomeMatch.count)),
                weight:
                  stevensTownhomeMatch.count != null && stevensTownhomeMatch.count > 0
                    ? bendNewConWeight(stevensTownhomeMatch.count)
                    : 0.25,
                reveal: {
                  line: v3Text(
                    `${
                      stevensTownhomeMatch.count != null
                        ? `${stevensTownhomeMatch.count} live Townhouse new-construction homes match this Stevens Ranch search`
                        : 'Opens live Townhouse new-construction search for Stevens Ranch'
                    } · ${BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.priceBand} on the Horton Express page, 2026-09-16 · ${BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.builderHref}`,
                  ),
                },
              },
            ]}
            source={v3Text(BEND_NEW_CON_HORTON_TOWNHOME_SOURCE)}
            updated={v3Text(researched)}
            encode="bar"
          />
        ) : null}

        {firstSingle ? (
          <V3Ledger
            id="also-listed"
            eyebrow={v3Text('Also listed')}
            heading={v3Text('One Active home')}
            rows={[firstSingle, ...restSingle]}
            source={v3Text(BEND_NEW_CON_INVENTORY_SOURCE)}
            updated={v3Text(researched)}
          />
        ) : null}

        <V3Answers
          id="financing"
          eyebrow="Financing and concessions"
          heading="What builders published that day"
          note={`${BEND_NEW_CON_DISCLAIMER.title}. ${BEND_NEW_CON_DISCLAIMER.description.join(' ')} UNVERIFIED, STALE, NOT DISCLOSED, and CONFLICT sit on the offer they belong to. Horton’s community page and FlippingBook flyer are separate sources.`}
          questions={financingAnswers()}
          doors={financingDoors()}
          doorsLabel="Builder pages"
          sourceKey="bend-new-construction:financing:2026-09-16"
        />

        <V3Quiet
          id="places"
          eyebrow="Places and guides"
          heading="Keep going from here"
          items={[
            { kind: 'link', label: 'Bend', href: '/cities/bend', lead: true },
            { kind: 'link', label: 'Bend neighborhoods', href: '/neighborhoods' },
            { kind: 'link', label: 'Communities', href: '/communities' },
            { kind: 'link', label: 'Subdivisions', href: '/subdivisions' },
            { kind: 'link', label: 'Homes for sale', href: '/homes-for-sale/bend' },
            { kind: 'link', label: 'Market stories', href: '/blog' },
            ...aeoHubQuietItems('buy').slice(0, 4),
          ]}
          note="Place pages and buyer guides sit here, not only in the footer."
        />

        <V3Answers
          id="faq"
          eyebrow="Questions"
          heading="New homes in Bend: short answers"
          questions={BEND_NEW_CON_FAQ.map((item, i) => ({
            id: item.id,
            question: item.question,
            body: item.answer,
            open: i === 0,
            source: BEND_NEW_CON_INVENTORY_SOURCE,
          }))}
          sourceKey="bend-new-construction:faq:2026-09-16"
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
