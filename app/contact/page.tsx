/**
 * /contact - write a broker, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Order: ContactFold (Quiet H1 + sourced reviews figure, ContactReach as one
 * Call door at display scale with live hours plus Text/Email/Schedule as one
 * Button Group, ContactAsk as the one ask in the first viewport), one Matt
 * face via AboutFaces, V3Answers.
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
import { getBrokers, getListingTiles, getReviews } from '@/lib/data'
import { formatListingAsk, publishListingAsk } from '@/lib/listing/publish-listing-ask'
import { listingTileHref, teamPath } from '@/lib/slug'
import { formatDate } from '@/lib/format/date'
import { generateBreadcrumbSchema, generateFAQSchema } from '@/lib/structured-data'
import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
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
import { ContactFold } from './_v3/ContactFold'
import { ContactHoursLive } from './_v3/ContactHoursLive.client'
import { ContactReach } from './_v3/ContactReach'
import { CONTACT_FAQ_ITEMS } from './_v3/contact-constants'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'

const contactOgImage = `${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')}/api/og?type=default`

/** SITE-63 proof variants — pick via ?taste_variant=; losers deleted after Matt picks. */
const CONTACT_VARIANTS = ['quiet-doors', 'call-figure', 'faces-first'] as const
type ContactVariant = (typeof CONTACT_VARIANTS)[number]

type PageProps = {
  searchParams: Promise<{ inquiry?: string; listingKey?: string; intent?: string; taste_variant?: string }>
}

function resolveContactVariant(raw: string | undefined): ContactVariant {
  if (raw && (CONTACT_VARIANTS as readonly string[]).includes(raw)) return raw as ContactVariant
  return 'quiet-doors'
}

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Contact · Call, text, or write — 115 NW Oregon Ave #2, Bend',
  description:
    'Call, text, or email Ryan Realty at 115 NW Oregon Ave #2, Bend. One number for the brokerage, a form that sends now, and the three brokers who answer.',
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
  const [params, pageContent, brokers, companySettings, , , reviewSummary] = await Promise.all([
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
    // The 5.0 on the principal broker's door (SITE-40): the same cached read
    // /reviews and /about make; a failed read prints no figure, never a fallback.
    getReviews(6).catch(() => null),
  ])
  const variant = resolveContactVariant(params.taste_variant)
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
    mainEntity: {
      '@type': ['RealEstateAgent', 'LocalBusiness'],
      name: BRAND.name,
      telephone: CONTACT.phoneDirect,
      email: CONTACT.email.primary,
      address: {
        '@type': 'PostalAddress',
        streetAddress: BRAND.address.street,
        addressLocality: BRAND.address.city,
        addressRegion: BRAND.address.region,
        postalCode: BRAND.address.postalCode,
        addressCountry: BRAND.address.country,
      },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: CONTACT.phoneDirect,
        email: CONTACT.email.primary,
        contactType: 'sales',
        areaServed: 'US-OR',
        availableLanguage: ['English'],
      },
    },
  }
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: 'Contact', url: `${baseUrl}/contact` },
  ])
  const faqJsonLd = generateFAQSchema([...CONTACT_FAQ_ITEMS])

  const listingHref = listingTile ? listingTileHref(listingTile) : null
  const introItems: V3QuietItem[] = [
    // H1 lives on this Quiet; with no rows it would not render (empty items
    // return null). One true line, and the sourced review figure in the column
    // that used to be void — not a second broker door that repeats AboutFaces
    // and the chevron row already used by V3Doors.
    {
      kind: 'prose' as const,
      body:
        reviewSummary && reviewSummary.count > 0
          ? `${reviewSummary.averageRating.toFixed(1)} from ${reviewSummary.count} Google reviews of Ryan Realty.`
          : 'Local experts who take care of you from the first call through closing.',
      ...(reviewSummary && reviewSummary.count > 0
        ? {
            figure: {
              value: reviewSummary.averageRating.toFixed(1),
              label: `${reviewSummary.count} reviews`,
              unit: 'of 5',
              source:
                'Google Business Profile reviews of Ryan Realty — every non-hidden review row in public.reviews, ratings averaged to a tenth, read live at render.',
              sourceName: 'Google reviews',
            },
          }
        : {}),
    },
    {
      label: BRAND.address.street,
      detail: `${BRAND.address.city}, ${BRAND.address.region} ${BRAND.address.postalCode}`,
      href: BRAND.social.googleBusinessProfile,
    },
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

  /* Published hours against the clock, from crm_company_settings.booking_hours
     — the same rows that fill /book. Empty still paints the hours product
     (V3OnDuty allowEmpty). No reply-time figure. */
  const hoursBlocks = companySettings?.booking_hours ?? []
  const hoursTimeZone = companySettings?.time_zone || 'America/Los_Angeles'
  const hoursLive = (
    <>
      <V3OnDuty
        blocks={hoursBlocks}
        timeZone={hoursTimeZone}
        nowIso={new Date().toISOString()}
        allowEmpty
      />
      {hoursBlocks.length > 0 ? (
        <V3SourceLine
          sourceName={v3Text('Ryan Realty booking hours')}
          source={v3Text(
            `Ryan Realty booking hours, public.crm_company_settings.booking_hours — ${hoursBlocks
              .map((b) => `${b.days.join(', ')} ${b.start_time} to ${b.end_time}`)
              .join('; ')}, evaluated in ${hoursTimeZone} at page render. Hours row last edited ${companySettings?.updated_at ? formatDate(companySettings.updated_at) : 'unknown'}. Same windows the /book calendar offers. Published hours only.`,
          )}
        />
      ) : null}
    </>
  )
  const mattFace =
    faces.find((face) => face.href === teamPath(BROKERS.matt.slug)) ?? faces[0] ?? null

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

        {/* SITE-63 variants stay on ?taste_variant= until Matt picks.
            Default (quiet-doors) is SITE-80 ContactFold. Losers stay on disk. */}
        {variant === 'faces-first' && faces.length > 0 ? (
          <AboutFaces
            people={faces}
            heading={contactTitle}
            headingLevel={1}
            size="roster"
            eyebrow="Ryan Realty · Bend"
            claim="Three licensed Oregon brokers, all of them here. Call the number below — whichever one you reach is the one who works your deal."
          />
        ) : null}

        {variant === 'call-figure' ? (
          <V3Quiet
            id="contact"
            eyebrow="Ryan Realty · Central Oregon"
            heading={contactTitle}
            headingLevel={1}
            items={[
              {
                kind: 'prose' as const,
                body: 'One number for the whole brokerage. Local experts who take care of you from the first call through closing.',
              },
              {
                label: 'Call or text',
                detail: hoursLive ? undefined : 'Bend office line',
                href: `tel:${CONTACT.phoneDirectTel}`,
                mark: 'person' as const,
                lead: true,
                figure: {
                  value: CONTACT.phoneDirect,
                  unit: 'call or text · one line',
                  source:
                    'Ryan Realty published direct line (lib/brand/contact CONTACT.phoneDirect). Hours state when present is public.crm_company_settings.booking_hours evaluated at render — published hours only.',
                  sourceName: 'Ryan Realty',
                },
              },
              {
                label: 'Email',
                detail: CONTACT.email.primary,
                href: `mailto:${CONTACT.email.primary}`,
                weight: 'secondary' as const,
              },
              {
                label: 'Book a time',
                detail: 'Open slots on the calendar',
                href: '/book',
                weight: 'secondary' as const,
              },
              ...(listingHref
                ? [{ label: listingSummary || 'The listing you asked about', href: listingHref }]
                : []),
            ]}
          />
        ) : null}

        {variant === 'faces-first' ? (
          <>
            <V3Quiet
              id="contact"
              eyebrow="Ryan Realty · Central Oregon"
              heading="Reach the brokerage"
              headingLevel={2}
              items={[
                {
                  kind: 'prose' as const,
                  body: 'Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and the surrounding communities.',
                },
                ...(listingHref
                  ? [{ label: listingSummary || 'The listing you asked about', href: listingHref }]
                  : []),
              ]}
            />
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
                  kicker: v3Text('Email'),
                  label: v3Text(CONTACT.email.primary),
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
          </>
        ) : null}

        {variant === 'call-figure' ? (
          <>
            {hoursLive ? <div id="reach">{hoursLive}</div> : null}
            <ContactAsk
              defaultInquiryType={defaultInquiry}
              listingKey={params.listingKey}
              intent={intent}
              listingSummary={listingSummary || undefined}
            />
          </>
        ) : null}

        {variant === 'quiet-doors' ? (
          <ContactFold
            reach={
              <>
                <V3Quiet
                  id="contact"
                  eyebrow="Ryan Realty · Central Oregon"
                  heading={contactTitle}
                  headingLevel={1}
                  items={introItems}
                />
                {mattFace ? (
                  <AboutFaces
                    people={[mattFace]}
                    heading="Who answers"
                    headingLevel={2}
                    size="compact"
                    sectionId="who-answers"
                    eyebrow="Ryan Realty · Bend"
                    claim="Meet the team for every broker who answers."
                  />
                ) : null}
                <ContactReach id="reach" hours={<ContactHoursLive>{hoursLive}</ContactHoursLive>} />
              </>
            }
            write={
              <ContactAsk
                defaultInquiryType={defaultInquiry}
                listingKey={params.listingKey}
                intent={intent}
                listingSummary={listingSummary || undefined}
              />
            }
          />
        ) : null}

        {variant !== 'faces-first' && variant !== 'quiet-doors' && faces.length > 0 ? (
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
