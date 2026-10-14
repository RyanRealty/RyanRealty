/**
 * /tools/seller-net-sheet: what a Bend seller nets, with a server-rendered
 * worked example at Bend's 12-month median and a live calculator on top
 * (SEO & AEO Desk brief 2026-10-08, AIV #3).
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, on the components/site/v3
 * barrel. Order: Breadcrumb, the answer (H1 and the answer block), Sheet
 * (calculator island), the worked example, Questions, Sources, Quiet, Footer.
 *
 * SERVER-RENDERING RULE: the answer block, the worked-example table, the notes,
 * and the FAQ are server HTML outside the island, so a crawler reads them with
 * JavaScript off. The example is computed here with the same
 * lib/tools/seller-net-sheet.ts functions the island runs, from the live
 * 12-month median (the same Market Truth cell /housing-market/bend and /sell
 * print). `?price=` pre-fills the calculator only; the example never moves with
 * it. If the median cell is withheld, the example falls back to the dated
 * figures the cost-to-sell guide prints (lib/blog/cost-to-sell-inputs.ts).
 *
 * SoftwareApplication stays a page-level script, like the mortgage calculator
 * (ci:ai-structured-data pins the literal on this file). The breadcrumb runs
 * Home, Sell, Seller net sheet: /tools has no page.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { getMetric } from '@/lib/data/market-truth/getMetric'
import { COST_TO_SELL_INPUTS } from '@/lib/blog/cost-to-sell-inputs'
import { zonedDateKey } from '@/lib/format/date'
import { pageMetadata } from '@/lib/site/page-metadata'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { addDays, netSheetExample, NET_SHEET_LIMITS, type NetSheetExample } from '@/lib/tools/seller-net-sheet'
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
import { CalculatorSheet } from '../mortgage-calculator/_v3/CalculatorSheet'
import { NetSheetCalculator } from './_v3/NetSheetCalculator.client'
import { netSheetCopy, type NetSheetCopy } from './_v3/net-sheet-copy'
import { NET_SHEET_LINKS, NET_SHEET_SOURCES, ROUTE_PATH } from './_v3/net-sheet-constants'
import './_v3/net-sheet.css'

type Props = {
  searchParams: Promise<{ price?: string }>
}

type Median = { price: number; asOf: string; live: boolean }

/** Bend's single-family median sale price, last 12 months, and the day it was computed (Pacific). */
async function bendMedian(): Promise<Median> {
  const fallback: Median = {
    price: COST_TO_SELL_INPUTS.medianSalePrice,
    asOf: COST_TO_SELL_INPUTS.figuresAsOf,
    live: false,
  }
  try {
    const cell = await getMetric({
      stat: 'median_close',
      geoType: 'city',
      geoSlug: 'bend',
      segment: 'detached',
      windowMonths: 12,
    })
    if (!cell?.isPublishable || cell.value == null || !(cell.value > 0) || !cell.provenance.computedAt) return fallback
    return { price: Math.round(cell.value), asOf: zonedDateKey(cell.provenance.computedAt), live: true }
  } catch {
    return fallback
  }
}

async function loadExample(): Promise<{ example: NetSheetExample; copy: NetSheetCopy }> {
  const median = await bendMedian()
  const example =
    netSheetExample(median.price, median.asOf) ??
    netSheetExample(COST_TO_SELL_INPUTS.medianSalePrice, COST_TO_SELL_INPUTS.figuresAsOf)
  if (!example) throw new Error('seller-net-sheet: the worked example could not be computed')
  return { example, copy: netSheetCopy(example) }
}

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await loadExample()
  return pageMetadata({
    title: 'Seller Net Sheet Calculator for Bend, Oregon',
    description: copy.metaDescription,
    path: ROUTE_PATH,
  })
}

/** A `?price=` pre-fill inside the calculator's range, or null. */
function priceParam(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number(raw.replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n) || n < NET_SHEET_LIMITS.priceMin || n > NET_SHEET_LIMITS.priceMax) return null
  return Math.round(n)
}

export default async function SellerNetSheetPage({ searchParams }: Props) {
  const [sp, { example, copy }] = await Promise.all([searchParams, loadExample()])
  const calcPrice = priceParam(sp.price) ?? example.low.price
  const today = zonedDateKey(new Date())
  const defaultClosingDate = addDays(today, 30) ?? example.closingDate

  const siteUrl = getCanonicalSiteUrl()
  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Seller net sheet calculator for Bend, Oregon',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    url: `${siteUrl}${ROUTE_PATH}`,
    description:
      "Estimate what you'd net selling a home in Bend and Deschutes County, Oregon: listing fee, buyer's-agent compensation, owner's title policy at the Oregon filed rate, escrow, lien search, recording, property-tax proration, and loan payoff.",
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    provider: { '@id': `${siteUrl}#organization` },
  }

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Sell', url: NET_SHEET_LINKS.sell },
        { name: 'Seller net sheet', url: ROUTE_PATH },
      ],
    },
    { type: 'faqPage', items: copy.faqs },
  ]

  const nextItems: V3QuietItem[] = [
    { label: 'Every seller cost in Bend, explained', href: NET_SHEET_LINKS.costToSell },
    { label: 'Bend housing market', href: NET_SHEET_LINKS.bendMarket },
    { label: 'Sell with Ryan Realty', href: NET_SHEET_LINKS.sell },
    { label: 'Get a written valuation', href: NET_SHEET_LINKS.valuation },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Sell', href: NET_SHEET_LINKS.sell },
            { label: 'Seller net sheet' },
          ]}
        />

        <section id="answer" className="v3-net-section v3-net-section--lead" aria-labelledby="net-sheet-heading">
          <V3Eyebrow>Bend, Oregon · before you list</V3Eyebrow>
          <V3Heading level={1} id="net-sheet-heading">
            Seller net sheet for Bend, Oregon
          </V3Heading>
          <p className="v3-net-answer">{copy.answer}</p>
          <p className="v3-net-answer-source">
            {`Median: Oregon Data Share MLS, single-family homes in Bend, as of ${copy.asOfLabel} (`}
            <Link href={NET_SHEET_LINKS.bendMarket}>Bend housing market</Link>
            {
              '). Title: Oregon Title Insurance Rating Organization filed rates (Sept 1, 2025). Escrow: Deschutes County Title rate card (revised March 2023), so ask for a current quote. Recording: Deschutes County Clerk (July 1, 2026). '
            }
            <Link href={NET_SHEET_LINKS.costToSell}>Every line explained</Link>.
          </p>
        </section>

        <CalculatorSheet id="calculator" headingId="calculator-heading" eyebrow="Estimate" heading="Your net sheet">
          <NetSheetCalculator defaultPrice={calcPrice} defaultClosingDate={defaultClosingDate} />
        </CalculatorSheet>

        <section id="worked-example" className="v3-net-section" aria-labelledby="worked-example-heading">
          <V3Heading level={2} id="worked-example-heading">
            A worked example at Bend&apos;s median price
          </V3Heading>
          <p>
            {copy.intro.replace(" because it's negotiated offer by offer.", ' because ')}
            <Link href={NET_SHEET_LINKS.buyerAgent}>it&apos;s negotiated offer by offer</Link>.
          </p>
          <table className="v3-net-table">
            <caption>{copy.caption}</caption>
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col">{copy.lowHeader}</th>
                <th scope="col">{copy.highHeader}</th>
              </tr>
            </thead>
            <tbody>
              {copy.rows.map((row) => (
                <tr key={row.line} className={row.total ? 'v3-net-table__total' : undefined}>
                  <th scope="row">{row.line}</th>
                  {row.span ? (
                    <td colSpan={2} className="v3-net-table__note">
                      {row.low}
                    </td>
                  ) : (
                    <>
                      <td>{row.low}</td>
                      <td>{row.high}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p>{copy.taxNote}</p>
          <p>{copy.whereFrom}</p>
          <p>
            More on <Link href={NET_SHEET_LINKS.propertyTax}>property taxes in Deschutes County</Link>,{' '}
            <Link href={NET_SHEET_LINKS.hoaGuide}>HOA transfer fees</Link>, and{' '}
            <Link href={NET_SHEET_LINKS.withholding}>Oregon withholding for sellers</Link>.
          </p>
        </section>

        <section id="questions" className="v3-net-section" aria-labelledby="questions-heading">
          <V3Heading level={2} id="questions-heading">
            Questions
          </V3Heading>
          <dl className="v3-net-faq">
            {copy.faqs.map((faq) => (
              <div key={faq.question}>
                <dt>{faq.question}</dt>
                <dd>{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="sources" className="v3-net-section" aria-labelledby="sources-heading">
          <V3Heading level={2} id="sources-heading">
            Sources
          </V3Heading>
          <ul className="v3-net-sources">
            <li>
              {`Ryan Realty, `}
              <Link href={NET_SHEET_LINKS.bendMarket}>Bend housing market</Link>
              {` (Oregon Data Share MLS), as of ${copy.asOfLabel}`}
            </li>
            {NET_SHEET_SOURCES.map((s) => (
              <li key={s.href}>
                {`${s.label}: `}
                <a href={s.href} target="_blank" rel="noopener nofollow">
                  {s.linkText}
                </a>
              </li>
            ))}
            <li>
              {'Oregon Department of Revenue, FY 2025-26 average effective rate for Deschutes County, via our '}
              <Link href={NET_SHEET_LINKS.propertyTax}>property-tax guide</Link>
            </li>
          </ul>
        </section>

        <V3Quiet id="next" heading="Next step" items={nextItems} />
      </main>

      {/* Outside <main> on purpose: a <footer> inside <main> is not a contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
