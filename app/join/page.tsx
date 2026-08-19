/**
 * /join - broker recruiting, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Opens on Stage (owned office photo, one line, one action) because this page
 * has an owned asset and ci:kb-breadcrumb-overlay pairs V3Stage with
 * tone="on-media". Then Ledger (listing support doors) then Quiet (how it
 * works, FAQ, edges). No valuation ask. Footer columns drop /sell#get-value.
 *
 * THE PAGE CONTRACT, carried across: export const metadata, revalidate 3600,
 * getSurfaceImage, webPage + BreadcrumbList + FAQPage JSON-LD,
 * V3SectionTracker pageType="join".
 *
 * D11: no virtue names. No invented quote. No invented split.
 */

import { getSurfaceImage } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { CONTACT } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3Stage,
  V3SectionTracker,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import {
  HOW_IT_WORKS,
  JOIN_CONTACT_HREF,
  JOIN_FAQ_ITEMS,
  LISTING_SUPPORT,
  OLD_MILL_HERO,
  joinFooterColumns,
} from './_v3/join-constants'
import { JoinCtaTracker } from './_v3/JoinCtaTracker.client'

export const revalidate = 3600

export const metadata = pageMetadata({
  title: 'Join Ryan Realty · brokers, Central Oregon',
  description:
    'Every listing you bring gets a listing film, a 3D walkthrough, pricing from live MLS data, and a written seller report every week. You keep the client from first call to close. Split is set with you.',
  path: '/join',
  ogImage: '/images/office/ryan-realty-bend-office-interior-01.jpg',
  keywords: [
    'real estate broker jobs Bend Oregon',
    'join brokerage Central Oregon',
    'Bend real estate careers',
    'Ryan Realty broker',
  ],
})

export default async function JoinPage() {
  const heroSrc = await getSurfaceImage('hero', {
    geoTags: ['central-oregon'],
    seed: '/join',
    fallback: OLD_MILL_HERO,
  })

  const supportRows: V3LedgerPlainRow[] = LISTING_SUPPORT.map((item, index) => ({
    href: item.href,
    when: v3Text(String(index + 1).padStart(2, '0')),
    what: v3Text(item.title),
    detail: v3Text(item.body),
    id: item.title,
  }))
  const [firstSupport, ...restSupport] = supportRows

  const quietItems: V3QuietItem[] = [
    ...HOW_IT_WORKS.map((item) => ({
      kind: 'prose' as const,
      term: item.lead,
      body: item.body,
    })),
    { label: 'Central Oregon housing market', href: '/housing-market' },
    ...JOIN_FAQ_ITEMS.map((item) => ({
      kind: 'prose' as const,
      term: item.question,
      body: item.answer,
    })),
    { label: 'Talk about joining', href: JOIN_CONTACT_HREF },
    { label: `Call ${CONTACT.phoneDirect}`, href: `tel:${CONTACT.phoneDirectTel}` },
    { label: 'Listing marketing plan', href: '/sell#marketing-plan' },
    { label: 'Broker profiles', href: '/team' },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <JoinCtaTracker />
        <MetadataBlock
          schemas={[
            {
              type: 'webPage',
              name: 'Join Ryan Realty',
              description:
                'Broker recruiting for Ryan Realty, a Bend, Oregon brokerage that markets every listing and keeps each broker with their client from first call to closing.',
              url: '/join',
            },
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Join the team', url: '/join' },
              ],
            },
            {
              type: 'faqPage',
              items: [...JOIN_FAQ_ITEMS],
            },
          ]}
        />
        <V3Breadcrumb
          tone="on-media"
          belowNav
          trail={[{ label: 'Home', href: '/' }, { label: 'Join the team' }]}
        />

        <V3Stage
          id="join"
          headingLevel={1}
          eyebrow="Join Ryan Realty · Brokers"
          headline="Film, 3D, and a weekly report"
          posterSrc={heroSrc ?? OLD_MILL_HERO}
          action={{ label: 'Talk about joining', href: JOIN_CONTACT_HREF }}
        />

        {firstSupport ? (
          <V3Ledger
            id="listing-support"
            eyebrow={v3Text('What your listings get')}
            heading={v3Text('The brokerage runs the marketing')}
            note={v3Text(
              'Same plan on every listing, the one a seller can read on the sell page. Produced for you.',
            )}
            rows={[firstSupport, ...restSupport]}
            action={{
              label: v3Text('Talk about joining'),
              href: JOIN_CONTACT_HREF,
              variant: 'ghost',
            }}
          />
        ) : null}

        <V3Quiet
          id="how-it-works"
          eyebrow="How the brokerage works"
          heading="One broker on the deal"
          items={quietItems}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={joinFooterColumns(V3_FOOTER_COLUMNS)} />
    </>
  )
}
