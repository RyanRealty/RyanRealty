/**
 * /contact — Contact Ryan Realty (Central Oregon).
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior ContentPageHero + two-column layout. Every piece of
 * content is preserved:
 *   - The ContactForm (interactive: name/email/phone/inquiry-select/message,
 *     server action submit, fbq + trackEvent on success, listingKey carry-
 *     through, and the load-bearing <SmsConsentDisclosure>). Untouched logic.
 *   - The getPageContent('contact') DAL call (CMS title override).
 *   - The default-inquiry derivation from ?inquiry / ?listingKey / ?intent.
 *   - The session + FUB page-view tracking side-effect.
 *   - ContactPage + BreadcrumbList + FAQPage JSON-LD (all three preserved).
 *   - The Office block: name, "Central Oregon", call-or-text tel link, email,
 *     service area sentence, the visible response-time promise, the three
 *     broker portraits, and the "Meet the team" link.
 *   - The hero copy. (The floating Meet-the-team / View-listings CTA pair was
 *     removed per design-audit P3 — it duplicated the office-card link.)
 *
 * Only the presentation changed — the page now wears the KB shell (KbNav,
 * KbHero, KbFooter, SmoothScrollProvider, KbSectionTracker) and the Amboqia
 * display / hard-edge cream surfaces of the rest of the migrated site.
 *
 * SEO: export const metadata (canonical + OG + Twitter) preserved. JSON-LD
 * preserved. PAGE CONTRACT: KB design + SEO + tracking (KbSectionTracker
 * pageType="info").
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import ContactForm from './ContactForm'
import { getPageContent } from '@/app/actions/site-pages'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { getListingTiles } from '@/lib/data'
import { formatPrice } from '@/lib/format/money'
import { listingTileHref } from '@/lib/slug'
import { generateBreadcrumbSchema, generateFAQSchema } from '@/lib/structured-data'
import { CONTACT } from '@/lib/brand/contact'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const contactOgImage = `${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')}/api/og?type=default`

type PageProps = { searchParams: Promise<{ inquiry?: string; listingKey?: string; intent?: string }> }

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Ryan Realty. Office address, phone, email, and contact form for buying or selling in Central Oregon.',
  alternates: { canonical: `${getCanonicalSiteUrl()}/contact` },
  openGraph: {
    title: 'Contact Us | Ryan Realty',
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
  const [params, pageContent, session, fubPersonId] = await Promise.all([
    searchParams,
    getPageContent('contact'),
    getSession(),
    getPersonIdFromCookie(),
  ])
  const pageUrl = `${getCanonicalSiteUrl()}/contact`
  const pageTitle = 'Contact Us | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })
  // Listing tour/question CTAs land here with ?listingKey= (+ intent=tour|question).
  // Default to a buyer/property inquiry and carry the listing through to FUB.
  const defaultInquiry = params.inquiry ?? (params.listingKey ? 'Buying' : undefined)
  const intent = params.intent === 'tour' ? 'tour' as const : params.intent === 'question' ? 'question' as const : undefined
  // Show the buyer WHICH home their tour/question is about (design-audit P1 —
  // the hottest intent moment used to land on a blank generic form).
  const listingTile = params.listingKey
    ? (await getListingTiles({ listingKeys: [params.listingKey], status: 'all', limit: 1 }).catch(() => []))[0] ?? null
    : null
  const contactTitle = pageContent?.title?.trim() || 'Contact Us'
  // Split the last word onto the hero's second display line ("Contact" / "Us").
  const contactTitleWords = contactTitle.split(/\s+/)
  const contactTitleTop = contactTitleWords.length > 1 ? contactTitleWords.slice(0, -1).join(' ') : contactTitle
  const contactTitleBottom = contactTitleWords.length > 1 ? contactTitleWords[contactTitleWords.length - 1] : ''
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
  const faqJsonLd = generateFAQSchema([
    {
      question: 'What areas does Ryan Realty serve?',
      answer: 'Ryan Realty serves Central Oregon including Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and surrounding communities.',
    },
    {
      question: 'How do I schedule a showing?',
      answer: 'Fill out the contact form on this page or call us directly. A broker will reach out within one business day to arrange a showing at your convenience.',
    },
    {
      question: 'How quickly will I hear back after contacting Ryan Realty?',
      answer: 'We aim to respond to all inquiries within one business day. For urgent needs, call us directly for the fastest response.',
    },
  ])

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="info" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Contact' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — CMS-overridable title + subtitle, in the KB Amboqia display. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Talk to a broker"
          titleTop={contactTitleTop}
          titleBottom={contactTitleBottom}
          lead="Questions about buying, selling, or just exploring? Reach out and we will get back to you quickly."
          showSearch={false}
          cta={{ href: '#contact-form', label: 'Send a message' }}
          ctaSecondary={null}
          videoSrc={null}
          posterSrc="/images/hero/hero-old-mill-master-4k.jpg"
        />

        {/* The floating Meet-the-team / View-listings CTA pair above the form was
            removed (design-audit P3) — it duplicated the office card's link and
            diluted the one action that matters here, the form. */}

        {/* Form + Office — the prior two-column layout, restyled in KB. The form
            (interactive, with SMS consent) and the office details are preserved.
            The form is boxed in a hard navy edge; the office is the ledger. */}
        <section className="section" id="contact-form" aria-label="Contact form and office">
          <div className="wrap">
            <div className="grid gap-10 lg:grid-cols-2">
              <div
                className="bg-card p-6 sm:p-8"
                style={{ border: 'var(--edge) solid var(--navy)' }}
              >
                <span className="sec-index" style={{ display: 'block', marginBottom: '14px' }}>
                  {intent === 'tour' ? 'Schedule a tour' : intent === 'question' ? 'Ask about this home' : 'Send a message'}
                </span>
                {listingTile ? (
                  <Link
                    href={listingTileHref(listingTile)}
                    className="mb-5 flex items-center gap-4 p-3"
                    style={{ border: '1px solid var(--navy-12)' }}
                  >
                    {listingTile.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={listingTile.photoUrl}
                        alt={[listingTile.streetNumber, listingTile.streetName, listingTile.streetSuffix].filter(Boolean).join(' ')}
                        className="h-16 w-24 shrink-0 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-16 w-24 shrink-0" style={{ background: 'var(--navy)' }} aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold" style={{ color: 'var(--navy)' }}>
                        {[listingTile.streetNumber, listingTile.streetName, listingTile.streetSuffix].filter(Boolean).join(' ')}
                        {listingTile.city ? `, ${listingTile.city}` : ''}
                      </p>
                      <p className="mono-num text-sm" style={{ color: 'var(--navy-70)' }}>
                        {listingTile.listPrice != null ? formatPrice(listingTile.listPrice) : ''}
                        {listingTile.beds != null ? ` · ${listingTile.beds} bd` : ''}
                        {listingTile.baths != null ? ` · ${listingTile.baths} ba` : ''}
                      </p>
                    </div>
                  </Link>
                ) : null}
                <ContactForm
                  defaultInquiryType={defaultInquiry}
                  listingKey={params.listingKey}
                  intent={intent}
                  hideListingNote={!!listingTile}
                />
              </div>
              <div>
                <span className="sec-index" style={{ display: 'block', marginBottom: '14px' }}>
                  Office
                </span>
                <h2 className="font-display" style={{ fontSize: 'clamp(2rem,6vw,3.2rem)', lineHeight: 0.95 }}>
                  Ryan Realty
                </h2>
                <p className="mt-3" style={{ color: 'var(--navy-70)' }}>
                  Central Oregon
                </p>
                <div className="mt-6">
                  <p className="mono-num text-xs uppercase tracking-wider" style={{ color: 'var(--navy-70)' }}>
                    Call or text
                  </p>
                  <a
                    href={`tel:${CONTACT.phoneFubTel}`}
                    className="font-display text-2xl hover:underline"
                    style={{ color: 'var(--navy)' }}
                  >
                    {CONTACT.phoneFub}
                  </a>
                </div>
                <div className="mt-4">
                  <p className="mono-num text-xs uppercase tracking-wider" style={{ color: 'var(--navy-70)' }}>
                    Email
                  </p>
                  <a
                    href="mailto:matt@ryan-realty.com"
                    className="text-base font-semibold hover:underline"
                    style={{ color: 'var(--navy)' }}
                  >
                    matt@ryan-realty.com
                  </a>
                </div>
                <p className="mt-6 text-sm leading-relaxed" style={{ color: 'var(--navy-70)' }}>
                  Serving Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and surrounding
                  communities across Central Oregon.
                </p>
                {/* The response promise used to live only in the invisible FAQPage
                    JSON-LD — surfaced visibly per design-audit P2 (same approved copy). */}
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--navy-70)' }}>
                  We aim to respond to all inquiries within one business day. For urgent needs,
                  call us directly for the fastest response.
                </p>
                {/* The people who answer — transparent broker portraits float on the
                    cream surface (never boxed, per the design-system composite rule). */}
                <div className="mt-8 flex items-end gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/brokers/ryan-matt.png" alt="Matt Ryan, Principal Broker" className="h-28 w-auto" loading="lazy" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/brokers/stevenson-paul.png" alt="Paul Stevenson, Broker" className="h-28 w-auto" loading="lazy" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/brokers/peterson-rebecca.png" alt="Rebecca Peterson, Broker" className="h-28 w-auto" loading="lazy" />
                </div>
                <p className="mt-2 text-sm" style={{ color: 'var(--navy-70)' }}>
                  Matt Ryan · Paul Stevenson · Rebecca Peterson
                </p>
                <div className="sec-cta">
                  <Link href="/team" className="btn alt">
                    Meet the team <span className="arr">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* hideCta: the footer's "Let's talk" band asks the visitor to get in
            touch — redundant on the contact page itself (design-audit P3). */}
        <KbFooter towns={[]} hideCta />
      </SmoothScrollProvider>
    </main>
  )
}
