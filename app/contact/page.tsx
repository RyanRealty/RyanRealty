/**
 * /contact - write a broker, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * About destinations open on Quiet + Sheet. Order: Quiet (how to reach us),
 * Sheet (the form, same submitContactForm fields), Ledger (brokers), Quiet
 * (FAQ and edges).
 *
 * THE PAGE CONTRACT, carried across: export const metadata, ContactPage +
 * BreadcrumbList + FAQPage JSON-LD, getPageContent, getSession,
 * getPersonIdFromCookie, listing tile for ?listingKey=, V3SectionTracker
 * pageType="info".
 *
 * D11: no virtue names. No invented quote.
 */

import type { Metadata } from 'next'
import { getPageContent } from '@/app/actions/site-pages'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { getBrokers, getListingTiles } from '@/lib/data'
import { formatListingAsk, publishListingAsk } from '@/lib/listing/publish-listing-ask'
import { listingTileHref } from '@/lib/slug'
import { generateBreadcrumbSchema, generateFAQSchema } from '@/lib/structured-data'
import { CONTACT } from '@/lib/brand/contact'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { ContactSheet } from './_v3/ContactSheet.client'
import { CONTACT_FAQ_ITEMS } from './_v3/contact-constants'
import { brokerLedgerRow, TEAM_RANK } from '@/app/team/_v3/team-constants'

const contactOgImage = `${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')}/api/og?type=default`

type PageProps = { searchParams: Promise<{ inquiry?: string; listingKey?: string; intent?: string }> }

export const metadata: Metadata = {
  title: 'Contact · Call, text, or write',
  description:
    'Call, text, or email Ryan Realty about buying or selling in Central Oregon. A broker replies within one business day.',
  alternates: { canonical: `${getCanonicalSiteUrl()}/contact` },
  openGraph: {
    title: 'Contact · Ryan Realty',
    url: `${getCanonicalSiteUrl()}/contact`,
    type: 'website',
    images: [{ url: contactOgImage, width: 1200, height: 630, alt: 'Contact Ryan Realty' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [contactOgImage],
  },
}

export default async function ContactPage({ searchParams }: PageProps) {
  // Session + identity-bridge reads kept (they pin this route's dynamic
  // rendering mode); the FUB page-view mirror they fed was deleted with the
  // FUB decommission. First-party visitor_sessions covers page views now.
  const [params, pageContent, brokers] = await Promise.all([
    searchParams,
    getPageContent('contact'),
    getBrokers(),
    getSession(),
    getPersonIdFromCookie(),
  ])
  const defaultInquiry = params.inquiry ?? (params.listingKey ? 'Buying' : undefined)
  const intent =
    params.intent === 'tour' ? ('tour' as const) : params.intent === 'question' ? ('question' as const) : undefined

  const listingKeyParam = params.listingKey?.trim()
  const listingTile = listingKeyParam
    ? await (async () => {
        const key = listingKeyParam
        const [byKey, byNumber] = await Promise.all([
          getListingTiles({ listingKeys: [key], status: 'all', limit: 1 }).catch(() => []),
          getListingTiles({ listNumbers: [key], status: 'all', limit: 1 }).catch(() => []),
        ])
        return byKey[0] ?? byNumber[0] ?? null
      })()
    : null

  const cmsTitle = pageContent?.title?.trim() ?? ''
  const contactTitle = !cmsTitle || /^contact(\s+us)?$/i.test(cmsTitle) ? 'Call, text, or write' : cmsTitle

  const publishedAsk = listingTile ? publishListingAsk(listingTile.listPrice) : null
  const listingSummary = listingTile
    ? [
        [listingTile.streetNumber, listingTile.streetName, listingTile.streetSuffix].filter(Boolean).join(' '),
        listingTile.city,
        publishedAsk ? formatListingAsk(publishedAsk.ask) : '',
        listingTile.beds != null ? `${listingTile.beds} bd` : '',
        listingTile.baths != null ? `${listingTile.baths} ba` : '',
      ]
        .filter((part) => part && part.trim())
        .join(', ')
    : undefined

  const orderedBrokers = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )
  const brokerRows = orderedBrokers
    .map((b) => brokerLedgerRow(b))
    .filter((row): row is V3LedgerPlainRow => row !== null)
  const [firstBroker, ...restBrokers] = brokerRows

  const baseUrl = getCanonicalSiteUrl()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact Ryan Realty',
    url: `${baseUrl}/contact`,
  }
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: 'Contact', url: `${baseUrl}/contact` },
  ])
  const faqJsonLd = generateFAQSchema([...CONTACT_FAQ_ITEMS])

  const listingHref = listingTile ? listingTileHref(listingTile) : null
  const introItems: V3QuietItem[] = [
    ...(listingHref
      ? [{ label: listingSummary || 'The listing you asked about', href: listingHref }]
      : []),
    { label: 'Call or text', href: `tel:${CONTACT.phoneFubTel}` },
    { label: CONTACT.email.primary, href: `mailto:${CONTACT.email.primary}` },
    { label: 'Broker profiles', href: '/team' },
  ]

  const faqItems: V3QuietItem[] = [
    ...CONTACT_FAQ_ITEMS.map((item) => ({
      kind: 'prose' as const,
      term: item.question,
      body: item.answer,
    })),
    { label: 'Broker profiles', href: '/team' },
    { label: 'About Ryan Realty', href: '/about' },
    { label: 'Client reviews', href: '/reviews' },
    { label: 'Value my home', href: valuationHref('/contact') },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} />

        <V3Quiet
          id="contact"
          eyebrow="Ryan Realty · Central Oregon"
          heading={contactTitle}
          headingLevel={1}
          items={introItems}
        />

        <ContactSheet
          defaultInquiryType={defaultInquiry}
          listingKey={params.listingKey}
          intent={intent}
          listingSummary={listingSummary || undefined}
        />

        {firstBroker ? (
          <V3Ledger
            id="office"
            eyebrow={v3Text('Who answers')}
            heading={v3Text('The brokers')}
            note={v3Text('Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and the surrounding communities.')}
            rows={[firstBroker, ...restBrokers]}
            action={{ label: v3Text('Broker profiles'), href: '/team' }}
          />
        ) : (
          <V3Ledger
            id="office"
            eyebrow={v3Text('Who answers')}
            heading={v3Text('The brokers')}
            rows={[]}
            emptyMessage={v3Text('Broker profiles did not return in this refresh.')}
            action={{ label: v3Text('Broker profiles'), href: '/team' }}
          />
        )}

        <V3Quiet id="faq" eyebrow="Common questions" heading="Before you write" items={faqItems} />
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
