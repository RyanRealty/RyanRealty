/**
 * /buy/alerts: new-listing and price-cut email signup for Central Oregon.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, on the components/site/v3
 * barrel. Order: Breadcrumb, the answer (H1 and live proof), Sheet (signup),
 * Questions, Sources, Quiet, Footer.
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
import { getPriceDrops } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Eyebrow,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3Quiet,
  V3SectionTracker,
  MetadataBlock,
  type V3QuietItem,
} from '@/components/site/v3'
import { CalculatorSheet } from '@/app/tools/mortgage-calculator/_v3/CalculatorSheet'
import {
  BUY_ALERTS_COPY,
  BUY_ALERTS_LINKS,
  BUY_ALERTS_TOWN_LINKS,
  ROUTE_PATH,
} from './_v3/buy-alerts-constants'
import { buyAlertsCopy } from './_v3/buy-alerts-copy'
import { loadBuyAlertsFacts } from './_v3/buy-alerts-facts'
import { BuyAlertsSignup } from './_v3/BuyAlertsSignup.client'
import './_v3/buy-alerts.css'

export const revalidate = 3600

const factsForPage = cache(() => loadBuyAlertsFacts(getPriceDrops))

export async function generateMetadata(): Promise<Metadata> {
  const copy = buyAlertsCopy(await factsForPage())
  return pageMetadata({
    title: copy.title,
    description: copy.meta,
    path: ROUTE_PATH,
  })
}

export default async function BuyAlertsPage() {
  const copy = buyAlertsCopy(await factsForPage())

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

  const nextItems: V3QuietItem[] = [
    { label: BUY_ALERTS_COPY.linkPriceDrops, href: BUY_ALERTS_LINKS.priceDrops },
    { label: BUY_ALERTS_COPY.linkHomes, href: BUY_ALERTS_LINKS.homes },
    { label: BUY_ALERTS_COPY.linkOpenHouses, href: BUY_ALERTS_LINKS.openHouses },
    { label: BUY_ALERTS_COPY.linkNewConstruction, href: BUY_ALERTS_LINKS.newConstruction },
    { label: BUY_ALERTS_COPY.linkLeverage, href: BUY_ALERTS_LINKS.leverage },
    { label: BUY_ALERTS_COPY.linkBook, href: BUY_ALERTS_LINKS.book },
    { label: BUY_ALERTS_COPY.linkFairHousing, href: BUY_ALERTS_LINKS.fairHousing },
    { label: BUY_ALERTS_COPY.linkPrivacy, href: BUY_ALERTS_LINKS.privacy },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: BUY_ALERTS_COPY.breadcrumbHome, href: '/' },
            { label: BUY_ALERTS_COPY.breadcrumbHomes, href: BUY_ALERTS_LINKS.homes },
            { label: BUY_ALERTS_COPY.breadcrumbHere },
          ]}
        />

        <section id="answer" className="buy-alerts-section buy-alerts-section--lead" aria-labelledby="buy-alerts-heading">
          <V3Eyebrow>{copy.eyebrow}</V3Eyebrow>
          <V3Heading id="buy-alerts-heading" level={1}>
            {copy.h1}
          </V3Heading>
          <p className="buy-alerts-lede">{copy.whatYouGet}</p>

          <V3Heading id="inbox-heading" level={2}>
            {BUY_ALERTS_COPY.inboxHeading}
          </V3Heading>
          <ul className="buy-alerts-inbox">
            <li>{BUY_ALERTS_COPY.inboxNew}</li>
            <li>{BUY_ALERTS_COPY.inboxDrops}</li>
            <li>{BUY_ALERTS_COPY.inboxCalls}</li>
            <li>{BUY_ALERTS_COPY.inboxUnsub}</li>
          </ul>

          <V3Heading id="why-heading" level={2}>
            {BUY_ALERTS_COPY.whyHeading}
          </V3Heading>
          {copy.volume ? <p className="buy-alerts-proof">{copy.volume}</p> : null}
          <p className="buy-alerts-proof">
            {copy.dropsCount ? (
              <>
                {copy.dropsCount}
                {copy.dropsMedian ? `, ${copy.dropsMedian}` : '.'}{' '}
              </>
            ) : null}
            {copy.leverage}{' '}
            <Link href={BUY_ALERTS_LINKS.leverage}>{BUY_ALERTS_COPY.seeWhy}</Link>.
          </p>
          {copy.leverageMos ? <p className="buy-alerts-proof">{copy.leverageMos}</p> : null}

          <V3Heading id="pick-towns-heading" level={2}>
            {BUY_ALERTS_COPY.pickTownsHeading}
          </V3Heading>
          <p className="buy-alerts-town-links">
            {BUY_ALERTS_TOWN_LINKS.map((town, i) => (
              <span key={town.href}>
                {i > 0 ? ' · ' : ''}
                <Link href={town.href}>{town.label}</Link>
              </span>
            ))}
          </p>
          <p className="buy-alerts-proof">
            {BUY_ALERTS_COPY.saveSearchBefore}{' '}
            <Link href={BUY_ALERTS_LINKS.homes}>{BUY_ALERTS_COPY.saveSearchLink}</Link>{' '}
            {BUY_ALERTS_COPY.saveSearchAfter}
          </p>
          <p className="buy-alerts-source">{copy.source}</p>
        </section>

        <CalculatorSheet
          id="signup"
          headingId="signup-heading"
          eyebrow={copy.signupEyebrow}
          heading={copy.signupHeading}
        >
          <BuyAlertsSignup />
        </CalculatorSheet>

        <section id="questions" className="buy-alerts-section" aria-labelledby="questions-heading">
          <V3Heading id="questions-heading" level={2}>
            {copy.questionsHeading}
          </V3Heading>
          <dl className="buy-alerts-faq">
            {copy.faqs.map((faq) => (
              <div key={faq.question}>
                <dt>{faq.question}</dt>
                <dd>{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="sources" className="buy-alerts-section" aria-labelledby="sources-heading">
          <V3Heading id="sources-heading" level={2}>
            {copy.sourcesHeading}
          </V3Heading>
          <ul className="buy-alerts-sources">
            {copy.volume ? (
              <li>
                {BUY_ALERTS_COPY.sourceVolume}
                {copy.leftoverStamp ? `, as of ${copy.leftoverStamp}` : ''}:{' '}
                <Link href={BUY_ALERTS_LINKS.bendCity}>{BUY_ALERTS_COPY.linkBendCity}</Link>
              </li>
            ) : null}
            {copy.dropsCount ? (
              <li>
                {BUY_ALERTS_COPY.sourceDrops}
                {copy.dropsStamp ? `, as of ${copy.dropsStamp}` : ''}:{' '}
                <Link href={BUY_ALERTS_LINKS.bendDrops}>{BUY_ALERTS_COPY.linkBendDrops}</Link>
              </li>
            ) : null}
            {copy.leverageMos ? (
              <li>
                {BUY_ALERTS_COPY.sourceMos}
                {copy.leftoverStamp ? `, as of ${copy.leftoverStamp}` : ''}:{' '}
                <Link href="/months-of-supply">{BUY_ALERTS_COPY.sourceMos}</Link>
              </li>
            ) : null}
            <li>
              {copy.source} <Link href={BUY_ALERTS_LINKS.fairHousing}>{BUY_ALERTS_COPY.linkFairHousing}</Link>
              {' · '}
              <Link href={BUY_ALERTS_LINKS.privacy}>{BUY_ALERTS_COPY.linkPrivacy}</Link>
            </li>
          </ul>
        </section>

        <V3Quiet id="edges" heading={copy.nextHeading} items={nextItems} />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
