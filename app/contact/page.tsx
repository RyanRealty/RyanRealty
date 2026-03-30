import type { Metadata } from 'next'
import Link from 'next/link'
import ContactForm from './ContactForm'
import { getPageContent } from '@/app/actions/site-pages'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import { listingsBrowsePath } from '@/lib/slug'
import { generateBreadcrumbSchema, generateFAQSchema } from '@/lib/structured-data'

const contactOgImage = `${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.vercel.app').replace(/\/$/, '')}/api/og?type=default`

type PageProps = { searchParams: Promise<{ inquiry?: string }> }

export const metadata: Metadata = {
  title: 'Contact Us | Ryan Realty',
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
  const defaultInquiry = params.inquiry ?? undefined
  const contactTitle = pageContent?.title?.trim() || 'Contact Us'
  const contactSubtitle = pageContent?.body_html?.trim() || '<p>Have a question or ready to get started? Reach out and we\'ll respond as soon as we can.</p>'
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
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title={contactTitle}
        subtitle="Questions about buying, selling, or just exploring? We're here to help. Reach out and we'll get back to you quickly."
        imageUrl={CONTENT_HERO_IMAGES.contact}
        ctas={[
          { label: 'Meet the Team', href: '/team', primary: false },
          { label: 'View Listings', href: listingsBrowsePath(), primary: false },
        ]}
      />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <ContactForm defaultInquiryType={defaultInquiry} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-primary">Office</h2>
            <p className="mt-2 text-muted-foreground">
              Ryan Realty<br />
              Central Oregon
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Hours and full address can be updated in your site settings or Google Business Profile for NAP consistency.
            </p>
            <div className="mt-6">
              <Link href="/team" className="font-medium text-primary hover:underline">
                Meet the team
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
