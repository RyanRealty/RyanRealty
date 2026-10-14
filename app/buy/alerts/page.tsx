/**
 * /buy/alerts: new-listing and price-cut email signup for Central Oregon.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, on the components/site/v3
 * barrel. Rhythm: Breadcrumb on the media, Stage (Central Oregon photograph,
 * the H1, the signup slab as the fold's one ask, the three live Bend figures
 * on the band), Steps (what lands in the inbox, in order), Ledger (the newest
 * Bend listings on the dial: the set the alert sends), Answers (the FAQ with
 * the page's doors), Quiet (sources), Footer. No two adjacent patterns alike.
 *
 * 2026-10-14 (Matt: "these are supposed to be landing pages"). The page used
 * to open on a cream column of prose and a six-field form. It now opens the
 * way /sell does: the ask on the photograph, the figures on the band, and
 * live houses under it.
 *
 * H1 and meta are the fallback without a same-day claim: the send engine is
 * the hourly cron GET /api/cron/saved-search-alerts (`0 * * * *` in
 * vercel.json). Town, price, and bed filters are real (filters.city / cities /
 * minPrice / maxPrice / beds in submitSearchAlertSignup); meta still omits
 * "price and beds" per the approved fallback.
 */
import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCityListings, getPriceDrops } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  V3Answers,
  V3Breadcrumb,
  V3Button,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3ListingDial,
  V3Quiet,
  V3SectionTracker,
  V3SourceLine,
  V3Stage,
  V3Steps,
  MetadataBlock,
  type V3Answer,
  type V3QuietItem,
  type V3StageFigure,
} from '@/components/site/v3'
import {
  BUY_ALERTS_COPY,
  BUY_ALERTS_LINKS,
  BUY_ALERTS_POSTER,
  ROUTE_PATH,
} from './_v3/buy-alerts-constants'
import { buyAlertsCopy, countLabel, fill } from './_v3/buy-alerts-copy'
import { BUY_ALERTS_DIAL_SUB_TYPE, buyAlertsDialItems } from './_v3/buy-alerts-dial'
import { loadBuyAlertsFacts } from './_v3/buy-alerts-facts'
import { BuyAlertsSignup } from './_v3/BuyAlertsSignup.client'
import './_v3/buy-alerts.css'

export const revalidate = 3600

const MLS_SOURCE_NAME = 'Oregon Data Share'
/** Fewer than this and the dial is a lonely pair; the section keeps its words. */
const DIAL_MIN = 3

const factsForPage = cache(() => loadBuyAlertsFacts(getPriceDrops))

/**
 * The set the alert would send: single-family homes in Bend, newest listed
 * first, through the same tile read the city pages use. A failed read shows
 * no dial rather than a wrong one (§0).
 */
const newestForPage = cache(async () => {
  const tiles = await getCityListings('Bend', {
    sort: 'listed-newest',
    limit: 24,
    propertyType: 'A',
    propertySubType: BUY_ALERTS_DIAL_SUB_TYPE,
  }).catch((): ListingTile[] => [])
  // The read's own moment, for the "new" badge window; read once per request
  // here rather than in render (react-hooks/purity).
  return { tiles, nowMs: Date.now() }
})

export async function generateMetadata(): Promise<Metadata> {
  const copy = buyAlertsCopy(await factsForPage())
  return pageMetadata({
    title: copy.title,
    description: copy.meta,
    path: ROUTE_PATH,
    ogImage: BUY_ALERTS_POSTER,
  })
}

export default async function BuyAlertsPage() {
  const [facts, newestRead] = await Promise.all([factsForPage(), newestForPage()])
  const copy = buyAlertsCopy(facts)
  const newest = buyAlertsDialItems(newestRead.tiles, newestRead.nowMs)

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: BUY_ALERTS_COPY.breadcrumbHome, url: '/' },
        { name: BUY_ALERTS_COPY.breadcrumbHomes, url: BUY_ALERTS_LINKS.homes },
        { name: BUY_ALERTS_COPY.breadcrumbHere, url: ROUTE_PATH },
      ],
    },
    { type: 'faqPage', items: copy.faqs },
    {
      type: 'webPage',
      name: copy.title,
      description: copy.meta,
      url: ROUTE_PATH,
    },
  ]

  // The band: the three live Bend facts this page already reads, each a door.
  // Two is the floor for a strip (V3Stage); under that the fold carries none.
  const figures: V3StageFigure[] = []
  if (facts.newCount30d != null && facts.leftoverStamp) {
    figures.push({
      value: countLabel(facts.newCount30d),
      label: BUY_ALERTS_COPY.figureNew,
      href: BUY_ALERTS_LINKS.bendHomes,
    })
  }
  if (facts.dropsCount != null && facts.dropsStamp) {
    figures.push({
      value: countLabel(facts.dropsCount),
      label: BUY_ALERTS_COPY.figureDrops,
      href: BUY_ALERTS_LINKS.bendDrops,
    })
  }
  if (facts.monthsSupply != null && facts.leftoverStamp) {
    figures.push({
      value: formatMonthsOfSupply(facts.monthsSupply),
      label: BUY_ALERTS_COPY.figureMos,
      href: '/months-of-supply',
    })
  }
  const figureSource = fill(BUY_ALERTS_COPY.figureSource, {
    leftoverStamp: facts.leftoverStamp ? ` as of ${facts.leftoverStamp}` : '',
    dropsStamp: facts.dropsStamp ? ` as of ${facts.dropsStamp}` : '',
  })

  const steps = [
    { title: BUY_ALERTS_COPY.stepTownsTitle, body: BUY_ALERTS_COPY.stepTownsBody },
    { title: BUY_ALERTS_COPY.stepWatchTitle, body: BUY_ALERTS_COPY.stepWatchBody },
    { title: BUY_ALERTS_COPY.stepEmailTitle, body: BUY_ALERTS_COPY.stepEmailBody },
    { title: BUY_ALERTS_COPY.stepDropsTitle, body: BUY_ALERTS_COPY.stepDropsBody },
    { title: BUY_ALERTS_COPY.stepStopTitle, body: BUY_ALERTS_COPY.stepStopBody },
  ]

  const questions: V3Answer[] = copy.faqs.map((faq, i) => ({
    question: faq.question,
    body: faq.answer,
    open: i === 0,
    ...(faq.question === BUY_ALERTS_COPY.faqDropsQ
      ? { action: { label: BUY_ALERTS_COPY.linkBendDrops, href: BUY_ALERTS_LINKS.bendDrops } }
      : faq.question === BUY_ALERTS_COPY.faqFreeQ
        ? { action: { label: BUY_ALERTS_COPY.linkBook, href: BUY_ALERTS_LINKS.book } }
        : {}),
  }))

  const doors = [
    { label: BUY_ALERTS_COPY.linkPriceDrops, href: BUY_ALERTS_LINKS.priceDrops },
    { label: BUY_ALERTS_COPY.linkHomes, href: BUY_ALERTS_LINKS.homes },
    { label: BUY_ALERTS_COPY.linkOpenHouses, href: BUY_ALERTS_LINKS.openHouses },
    { label: BUY_ALERTS_COPY.linkNewConstruction, href: BUY_ALERTS_LINKS.newConstruction },
    { label: BUY_ALERTS_COPY.linkLeverage, href: BUY_ALERTS_LINKS.leverage },
    { label: BUY_ALERTS_COPY.linkBook, href: BUY_ALERTS_LINKS.book },
  ]

  const sourceItems: V3QuietItem[] = []
  if (copy.volume) {
    sourceItems.push({
      label: BUY_ALERTS_COPY.linkBendCity,
      href: BUY_ALERTS_LINKS.bendCity,
      detail: `${BUY_ALERTS_COPY.sourceVolume}${copy.leftoverStamp ? `, as of ${copy.leftoverStamp}` : ''}.`,
    })
  }
  if (copy.dropsCount) {
    sourceItems.push({
      label: BUY_ALERTS_COPY.linkBendDrops,
      href: BUY_ALERTS_LINKS.bendDrops,
      detail: `${BUY_ALERTS_COPY.sourceDrops}${copy.dropsStamp ? `, as of ${copy.dropsStamp}` : ''}.`,
    })
  }
  if (facts.monthsSupply != null) {
    sourceItems.push({
      label: BUY_ALERTS_COPY.sourceMos,
      href: '/months-of-supply',
      detail: copy.leftoverStamp ? `As of ${copy.leftoverStamp}.` : undefined,
    })
  }
  sourceItems.push(
    { kind: 'prose', body: copy.source },
    // The second ask: back to the slab, so a reader who scrolled past the
    // fold still has one filled door to the alert at the foot of the page.
    { label: BUY_ALERTS_COPY.startAlerts, href: '#signup', lead: true, detail: copy.formCadence },
    { label: BUY_ALERTS_COPY.linkFairHousing, href: BUY_ALERTS_LINKS.fairHousing },
    { label: BUY_ALERTS_COPY.linkPrivacy, href: BUY_ALERTS_LINKS.privacy },
  )

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          tone="on-media"
          trail={[
            { label: BUY_ALERTS_COPY.breadcrumbHome, href: '/' },
            { label: BUY_ALERTS_COPY.breadcrumbHomes, href: BUY_ALERTS_LINKS.homes },
            { label: BUY_ALERTS_COPY.breadcrumbHere },
          ]}
        />

        <V3Stage
          id="answer"
          headingLevel={1}
          height="tall"
          overlayStrength="deep"
          eyebrow={copy.eyebrow}
          headline={copy.h1}
          posterSrc={BUY_ALERTS_POSTER}
          inventory={
            figures.length >= 2
              ? { figures, source: figureSource, sourceName: MLS_SOURCE_NAME }
              : undefined
          }
        >
          <BuyAlertsSignup />
        </V3Stage>

        <V3Steps
          id="how"
          eyebrow={BUY_ALERTS_COPY.howEyebrow}
          heading={BUY_ALERTS_COPY.howHeading}
          promise={BUY_ALERTS_COPY.howPromise}
          facts={[
            { term: BUY_ALERTS_COPY.howFactSource, value: BUY_ALERTS_COPY.howFactSourceValue },
            { term: BUY_ALERTS_COPY.howFactCadence, value: BUY_ALERTS_COPY.howFactCadenceValue },
            { term: BUY_ALERTS_COPY.howFactCost, value: BUY_ALERTS_COPY.howFactCostValue },
            { term: BUY_ALERTS_COPY.howFactStop, value: BUY_ALERTS_COPY.howFactStopValue },
          ]}
          steps={steps}
        />

        <section id="newest" className="buy-alerts-dial" aria-labelledby="newest-heading">
          <div>
            <V3Heading id="newest-heading" level={2}>
              {BUY_ALERTS_COPY.newestHeading}
            </V3Heading>
            <p className="buy-alerts-dial__lede">{BUY_ALERTS_COPY.newestLede}</p>
          </div>
          {newest.length >= DIAL_MIN ? (
            <V3ListingDial
              id="newest-dial"
              label={BUY_ALERTS_COPY.newestLabel}
              countLabel={fill(BUY_ALERTS_COPY.newestCount, { count: countLabel(newest.length) })}
              listings={newest}
              className="buy-alerts-dial__dial"
            />
          ) : null}
          <div className="buy-alerts-dial__why">
            <p>{copy.whatYouGet}</p>
            {copy.volume ? <p>{copy.volume}</p> : null}
            <p>
              {copy.dropsCount ? (
                <>
                  {copy.dropsCount}
                  {copy.dropsMedian ? `, ${copy.dropsMedian}` : '.'}{' '}
                </>
              ) : null}
              {copy.leverage}{' '}
              <Link href={BUY_ALERTS_LINKS.leverage}>{BUY_ALERTS_COPY.seeWhy}</Link>.
            </p>
            {copy.leverageMos ? <p>{copy.leverageMos}</p> : null}
            <V3SourceLine
              sourceName={MLS_SOURCE_NAME}
              asOf={copy.leftoverStamp ?? copy.dropsStamp}
              source={figureSource}
            />
          </div>
          <p className="buy-alerts-dial__more">
            <V3Button href={BUY_ALERTS_LINKS.bendHomes} variant="ghost">
              {BUY_ALERTS_COPY.newestSeeAll}
            </V3Button>
          </p>
        </section>

        <V3Answers
          id="questions"
          heading={copy.questionsHeading}
          questions={questions}
          doors={doors}
          doorsLabel={copy.nextHeading}
          note={copy.source}
        />

        <V3Quiet id="sources" heading={copy.sourcesHeading} items={sourceItems} />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
