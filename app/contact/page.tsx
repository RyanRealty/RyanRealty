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
 *   - The Office block: name, "Central Oregon", call-or-text tel link, service
 *     area sentence, and the "Meet the team" link.
 *   - The hero copy + both CTAs (Meet the Team / View Listings).
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
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { listingsBrowsePath } from '@/lib/slug'
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
    getFubPersonIdFromCookie(),
  ])
  const pageUrl = `${getCanonicalSiteUrl()}/contact`
  const pageTitle = 'Contact Us | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })
  // Listing tour/question CTAs land here with ?listingKey= (and intent=question).
  // Default to a buyer/property inquiry and carry the listing through to FUB.
  const defaultInquiry = params.inquiry ?? (params.listingKey ? 'Buying' : undefined)
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
        {/* Hero — CMS-overridable title + subtitle, in the KB Amboqia display.
            The two CTAs (Meet the Team / View Listings) are preserved below. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Talk to a broker"
          titleTop={contactTitleTop}
          titleBottom={contactTitleBottom}
          lead="Questions about buying, selling, or just exploring? Reach out and we will get back to you quickly."
          showSearch={false}
          videoSrc={null}
          posterSrc="/images/hero/hero-old-mill-master-4k.jpg"
        />

        {/* CTA row preserved from the prior hero. */}
        <section className="section" id="contact-cta" aria-label="Team and listings">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <Link
                href="/team"
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                Meet the team <span className="arr">→</span>
              </Link>
              <Link
                href={listingsBrowsePath()}
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                View listings <span className="arr">→</span>
              </Link>
            </div>
          </div>
        </section>

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
                  Send a message
                </span>
                <ContactForm defaultInquiryType={defaultInquiry} listingKey={params.listingKey} />
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
                <p className="mt-6 text-sm leading-relaxed" style={{ color: 'var(--navy-70)' }}>
                  Serving Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and surrounding
                  communities across Central Oregon.
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

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
