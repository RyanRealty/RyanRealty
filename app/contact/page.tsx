/**
 * /contact - write a broker, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Order: Quiet (H1 and the one true line), V3Doors #reach as a REACH CONTROL
 * (one call door at display scale carrying the live hours, then text, email
 * and the calendar as lighter links), ContactAsk (the whole form at once),
 * AboutFaces (who answers, with their photographs), V3Answers.
 *
 * SITE-48 (2026-09-09) changed two of those. The taste table scored this page
 * 49 with the verdict "the fold is a text hero on top of a four-times-repeated
 * link row with zero interaction", and its open list carried "Brokers roster:
 * a flat hairline row; give it visual weight (larger headshots, a specialty
 * line)". So the doors have a hierarchy and a live state, and the brokers band
 * is the same AboutFaces roster /team and /about use rather than a second,
 * flatter way of listing the same three people (TASTE.md consistency).
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
import { formatDate } from '@/lib/format/date'
import { generateBreadcrumbSchema, generateFAQSchema } from '@/lib/structured-data'
import { BRAND, CONTACT } from '@/lib/brand/contact'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Answers,
  splitQuietItems,
  V3Quiet,
  V3SectionTracker,
  type V3QuietItem,
  V3Doors,
  V3OnDuty,
  V3SourceLine,
} from '@/components/site/v3'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { ContactAsk } from './_v3/ContactAsk.client'
import { CONTACT_FAQ_ITEMS } from './_v3/contact-constants'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'

const contactOgImage = `${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')}/api/og?type=default`

type PageProps = { searchParams: Promise<{ inquiry?: string; listingKey?: string; intent?: string }> }

export const metadata: Metadata = {
  title: 'Contact · Call, text, or write',
  description:
    'Call, text, or email Ryan Realty about buying or selling in Central Oregon. Local experts who answer you personally.',
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
  // rendering mode); the CRM page-view mirror they fed was deleted with the
  // CRM decommission. First-party visitor_sessions covers page views now.
  const [params, pageContent, brokers, companySettings] = await Promise.all([
    searchParams,
    getPageContent('contact'),
    getBrokers(),
    // The published hours behind the reach control's live state. This is the
    // SAME row /book fills its calendar from, so a reader who doubts the line
    // can check it in one tap. See components/site/v3/V3OnDuty.view.ts for why
    // the state is hours and not a reply-time figure.
    getCrmCompanySettings().catch(() => null),
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
  /* The same faces /team and /about publish. No record figures here: this is a
     dynamic route (getSession pins it), and the per-broker MLS reads belong on
     the two cached pages that exist to carry them. */
  const faces: AboutFace[] = orderedBrokers
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

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
    // The H1 lives on this Quiet; with no rows it would not render at all
    // (V3Quiet returns null on empty items — evaluator B2). One true line.
    { kind: 'prose' as const, body: 'Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and the surrounding communities. Local experts who take care of you from the first call through closing.' },
    {
      kind: 'prose' as const,
      term: 'Office',
      body: `${BRAND.address.street}, ${BRAND.address.city}, ${BRAND.address.region} ${BRAND.address.postalCode}`,
    },
    // The four reaches (call, text, email, schedule) live ONCE, in V3Doors
    // below. The separate evaluator (2026-09-08) read them here and again in
    // the doors as two builders' sections stacked, not a page.
    ...(listingHref
      ? [{ label: listingSummary || 'The listing you asked about', href: listingHref }]
      : []),
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

  /* The live state on the reach control, and its section 0 trace.
     WHAT THIS IS NOT: a response-time figure. SITE-09 removed the "one
     business day" promise from this page and left the speed claim empty on
     purpose. Read on 2026-09-09, getResponseClockReport() over its 28-day
     window returned a median whose every counted touch predates the
     provenance stamp — the exact condition /admin/crm prints "unproven" for —
     and 2 of 8 in-hours site submits answered by a person. Neither ships: one
     is not proven and the other is a backlog, not a promise.
     WHAT IT IS: our published hours against the clock, from the same
     crm_company_settings.booking_hours rows that fill /book's calendar, so a
     reader can check the claim in one tap. Empty hours render nothing. */
  const hoursBlocks = companySettings?.booking_hours ?? []
  const hoursTimeZone = companySettings?.time_zone || 'America/Los_Angeles'
  const hoursLive =
    hoursBlocks.length > 0 ? (
      <>
        <V3OnDuty blocks={hoursBlocks} timeZone={hoursTimeZone} nowIso={new Date().toISOString()} />
        {/* No `asOf` stamp on this one. The state above is as of NOW — that is
            what makes it live — and "as of <the day the row was last edited>"
            beside it reads as a stale figure, besides wrapping onto a line of
            its own behind a stray middot at 375. The row's own edit date is
            inside the trace, where it belongs. */}
        <V3SourceLine
          sourceName={v3Text('Ryan Realty booking hours')}
          source={v3Text(
            `Ryan Realty booking hours, public.crm_company_settings.booking_hours — ${hoursBlocks
              .map((b) => `${b.days.join(', ')} ${b.start_time} to ${b.end_time}`)
              .join('; ')}, evaluated in ${hoursTimeZone} against the clock at page render. Hours row last edited ${companySettings?.updated_at ? formatDate(companySettings.updated_at) : 'unknown'}. These are the same windows the /book calendar offers time from (lib/booking/slots.ts), so the state above is checkable in one tap. It is a statement of published hours only: this page makes no claim about how fast anyone replies, because the CRM response clock's median is still unproven (SITE-09).`,
          )}
        />
      </>
    ) : null

  // Split once, here, so the discarded third bucket is visible rather than
  // vanishing inside a JSX spread: `prose` holds passages with no question to
  // sit under, and this page has none. If one ever arrives it belongs in a
  // Quiet block beside this one, not silently deleted.
  const contactAnswers = splitQuietItems(faqItems)

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
        {/* The reach control, above the form: a visitor who wants a human
            should not have to find a form field first.

            SITE-48: this was four equal bordered cells with an arrow each —
            the card-grid silhouette, with the same phone number printed twice
            and nothing live behind any of them. Calling is the fastest reach,
            so calling is the one door, at display scale, carrying the live
            state; text, email and the calendar sit beside it as the lighter
            alternatives they are. */}
        <V3Doors
          id="reach"
          name={v3Text('Reach a broker')}
          doors={[
            {
              kicker: v3Text('Call or text'),
              label: v3Text(CONTACT.phoneDirect),
              fact: v3Text('One number for the whole brokerage'),
              href: `tel:${CONTACT.phoneDirectTel}`,
              primary: true,
              live: hoursLive,
            },
            {
              kicker: v3Text('Text'),
              // The number is printed once, on the door above. The taste table
              // named "the same phone number restated twice" by name.
              label: v3Text('Send a text'),
              fact: v3Text('Same line as the call'),
              href: `sms:${CONTACT.phoneDirectTel}`,
            },
            {
              kicker: v3Text('Email'),
              label: v3Text(CONTACT.email.primary),
              // SITE-09: no duration on this door. The mailbox has no response
              // clock on it — the form does — so it names where the mail lands
              // instead of promising a time it cannot keep.
              fact: v3Text("Straight to Matt's inbox"),
              href: `mailto:${CONTACT.email.primary}`,
            },
            {
              kicker: v3Text('Schedule'),
              label: v3Text('Book a time'),
              fact: v3Text('Open slots on the calendar'),
              href: '/book',
            },
          ]}
        />

        <ContactAsk
          defaultInquiryType={defaultInquiry}
          listingKey={params.listingKey}
          intent={intent}
          listingSummary={listingSummary || undefined}
        />

        {faces.length > 0 ? (
          <AboutFaces
            people={faces}
            heading="Who answers"
            headingLevel={2}
            eyebrow="Ryan Realty · Bend"
            claim="Three licensed Oregon brokers, all of them here. Whichever one you reach is the one who works your deal, from the first call through closing."
          />
        ) : null}

        {/* The questions fold; the four doors stay in the flow, which is what
            V3Answers does under its own six-door ceiling. */}
        <V3Answers
          id="faq"
          eyebrow="Common questions"
          heading="Before you write"
          questions={contactAnswers.questions}
          doors={contactAnswers.doors}
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
