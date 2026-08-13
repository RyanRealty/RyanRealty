// @data-free. Leftover written-CMA intake. No live figures. Capture is ValuationForm.
/**
 * /sell/valuation - the written-CMA leftover, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Sell-family leftover.
 * Three of the six patterns, no two adjacent alike: Breadcrumb, Stage, Sheet
 * (ValuationForm), Quiet, Footer.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through
 * pageMetadata (title "Home Valuation in Central Oregon", keywords may keep
 * search-demand "what is my home worth Bend"), MetadataBlock breadcrumb
 * JSON-LD, V3SectionTracker pageType="sell-valuation", the route, and the
 * capture contract. ValuationForm still calls submitValuationRequest with the
 * same field names. This page is a second intake beside /sell#get-value. The
 * lease keeps it. It does not 301 it. E-CUT owns that cut.
 *
 * D11: visible CTA/headline is "Value my home" / "Get your home's value".
 * Title and H1 stay search-first. Breadcrumb is "Home valuation", not
 * "What's your home worth".
 *
 * KB-era deletions: KbHero, KbBreadcrumb, KbFooter, SmoothScrollProvider,
 * primitives H2/H3/Eyebrow/Body/CTAButton, shadcn Card, the sticky mobile
 * bar. Method steps and the 3% close survive as Quiet prose and doors.
 */

import type { Metadata } from 'next'
import ValuationForm from '@/app/home-valuation/ValuationForm'
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
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="sell-valuation" />
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
          eyebrow={VALUATION_STAGE_EYEBROW}
          headline="Home valuation in Central Oregon"
          posterSrc={SELL_POSTER}
          action={{ label: 'Value my home', href: VALUATION_FORM_ANCHOR, variant: 'ghost' }}
        />

        <SellCapture
          id="valuation-form"
          headingId="valuation-form-heading"
          eyebrow="Free. No listing agreement."
          heading="Get your home's value"
        >
          <ValuationForm />
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
