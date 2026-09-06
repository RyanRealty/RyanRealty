// @data-free. Same capture as /sell, more room. Chrome fill XOR the form. No Stage ghost.
/**
 * /sell/valuation - the written-CMA leftover, on the components/site/v3 barrel.
 *
 * Same SellValueForm as /sell (submitSellerLPForm). The form sits in a Sheet
 * under a compact Stage, not on the photograph and not next to a Stage ghost.
 * Chrome fills Value my home on /sell/* leaves. 375: Stage is H1 only so the
 * header is not a second filled control stacked on a ghost.
 */

import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { CONTACT } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Stage,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { SellCapture } from '../_v3/SellCapture'
import { SellValueForm } from '../_v3/SellValueForm'
import '../_v3/sell-stage.css'
import {
  VALUATION_ROUTE,
  VALUATION_FORM_ANCHOR,
  VALUATION_STAGE_EYEBROW,
  SELL_POSTER,
  VALUE_STEPS,
  VALUATION_FAQ_ITEMS,
  ROUTE_PATH,
} from '../_v3/sell-constants'

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

export default function SellValuationPage() {
  return (
    <>
      <main className={`${V3_ROOT_CLASS} sell-valuation`}>
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
          className="sell-stage-valuation"
          eyebrow={VALUATION_STAGE_EYEBROW}
          headline="Home valuation in Central Oregon"
          posterSrc={SELL_POSTER}
        />

        <SellCapture
          id="valuation-form"
          headingId="valuation-form-heading"
          eyebrow="Free. No listing agreement."
          ariaLabel="Value my home"
          placement="page"
        >
          <SellValueForm pagePath={VALUATION_ROUTE} formId="get-value" />
        </SellCapture>

        <V3Quiet
          id="how-we-value"
          eyebrow="How the number is built"
          heading="What goes into the number"
          items={[
            ...VALUE_STEPS.map((step) => ({
              kind: 'prose' as const,
              term: step.title,
              body: step.body,
            })),
            ...VALUATION_FAQ_ITEMS.map((item) => ({
              kind: 'prose' as const,
              term: item.question,
              body: item.answer,
            })),
            {
              kind: 'prose',
              term: 'If you decide to list',
              body: 'The listing fee is 3% of the sale price. Photos in 48 hours, on the MLS in 5 to 7 business days, and a written report every week.',
            },
            { label: 'See the listing plan', href: `${ROUTE_PATH}#listing-plan` },
            { label: 'Value my home', href: VALUATION_FORM_ANCHOR },
            { label: 'Talk to a broker', href: '/contact?inquiry=Selling' },
            { label: `Call ${CONTACT.phoneDirect}`, href: `tel:${CONTACT.phoneDirectTel}` },
          ]}
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
