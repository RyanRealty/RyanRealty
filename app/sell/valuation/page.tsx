/**
 * /sell/valuation — written CMA intake. Stage then one cream sheet:
 * address field, then what goes into the number.
 *
 * Capture contract unchanged: ValuationValueForm posts submitValuationRequest.
 */

import type { Metadata } from 'next'
import { getSurfaceImage } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { CONTACT } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3Quiet,
  V3Stage,
  V3SectionTracker,
} from '@/components/site/v3'
import { SellCapture } from '../_v3/SellCapture'
import { ValuationValueForm } from '../_v3/ValuationValueForm'
import '../_v3/valuation-stage.css'
import {
  VALUATION_ROUTE,
  VALUATION_FORM_ANCHOR,
  VALUATION_STAGE_EYEBROW,
  SELL_POSTER,
  VALUE_STEPS,
  VALUATION_FAQ_ITEMS,
  FORM_ANCHOR,
  ROUTE_PATH,
} from '../_v3/sell-constants'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Home Valuation in Central Oregon',
    description:
      'A written comparative market analysis for your Central Oregon home. Three closed comps, three active comps, and the list-price range those six support. Free, no listing agreement.',
    path: VALUATION_ROUTE,
    ogImage: SELL_POSTER,
    keywords: [
      'home valuation Bend Oregon',
      'Central Oregon CMA',
      'what is my home worth Bend',
      'Ryan Realty valuation',
    ],
  })
}

export default async function SellValuationPage() {
  const heroSrc = await getSurfaceImage('hero', {
    geoTags: ['tetherow'],
    seed: VALUATION_ROUTE,
    fallback: SELL_POSTER,
  })
  const posterSrc = heroSrc ?? SELL_POSTER

  return (
    <>
      <main className={`${V3_ROOT_CLASS} valuation-page`}>
        <V3SectionTracker />
        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Sell', url: ROUTE_PATH },
                { name: 'Home valuation', url: VALUATION_ROUTE },
              ],
            },
            {
              type: 'webPage',
              name: 'Home valuation in Central Oregon',
              description:
                'A written comparative market analysis for your Central Oregon home. Three closed comps, three active comps, and the list-price range those six support.',
              url: VALUATION_ROUTE,
              aboutOrganization: true,
            },
            {
              type: 'service',
              name: 'Value my home',
              serviceType: 'Comparative market analysis',
              description:
                'A written comparative market analysis for a Central Oregon home. Three closed comps, three active comps, and the list-price range those six support.',
              url: VALUATION_ROUTE,
              areaServed: 'Bend, Oregon',
              providerOrganization: true,
            },
            { type: 'faqPage', items: [...VALUATION_FAQ_ITEMS] },
          ]}
        />
        <V3Breadcrumb
          tone="on-media"
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Sell', href: ROUTE_PATH },
            { label: 'Home valuation' },
          ]}
        />

        <V3Stage
          headingLevel={1}
          height="compact"
          className="valuation-stage-poster"
          eyebrow={VALUATION_STAGE_EYEBROW}
          headline="Home valuation in Central Oregon"
          posterSrc={posterSrc}
          action={{ label: 'Value my home', href: VALUATION_FORM_ANCHOR, variant: 'ghost' }}
        />

        <SellCapture
          id="valuation-form"
          headingId="valuation-form-heading"
          className="valuation-value-sheet"
          eyebrow="Free. No listing agreement."
          heading="Get your home's value"
        >
          <ValuationValueForm />
          <div className="valuation-method">
            <V3Heading id="how-we-value" level={2}>
              What goes into the number
            </V3Heading>
            <dl className="valuation-method-list">
              {VALUE_STEPS.map((step) => (
                <div key={step.title}>
                  <dt>{step.title}</dt>
                  <dd>{step.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </SellCapture>

        <V3Quiet
          ariaLabel="Valuation questions"
          items={[
            ...VALUATION_FAQ_ITEMS.map((item) => ({
              kind: 'prose' as const,
              term: item.question,
              body: item.answer,
            })),
            {
              kind: 'prose' as const,
              term: 'If you decide to list',
              body: 'The listing fee is 3% of the sale price. Photos in 48 hours, on the MLS in 5 to 7 business days, and a written report every week.',
            },
            { label: 'See the listing plan', href: `${ROUTE_PATH}#listing-plan` },
            { label: 'Value my home', href: `${ROUTE_PATH}${FORM_ANCHOR}` },
            { label: 'Talk to a broker', href: '/contact?inquiry=Selling' },
            { label: `Call ${CONTACT.phoneDirect}`, href: `tel:${CONTACT.phoneDirectTel}` },
          ]}
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
