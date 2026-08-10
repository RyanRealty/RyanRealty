import type { Metadata } from 'next'
import Link from 'next/link'
import { H1, H2 } from '@/components/site/primitives'
import SiteFooter from '@/components/site/SiteFooter'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
const contactEmail = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL ?? 'info@ryan-realty.com'

export const metadata: Metadata = {
  title: 'Accessibility',
  description: 'How ryan-realty.com aims to meet WCAG 2.1 Level AA, and how to report a barrier.',
  alternates: { canonical: `${siteUrl}/accessibility` },
  openGraph: {
    title: 'Accessibility statement | Ryan Realty',
    description: 'How ryan-realty.com aims to meet WCAG 2.1 Level AA, and how to report a barrier.',
    url: `${siteUrl}/accessibility`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

export default function AccessibilityPage() {
  return (
    <>
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <H1 className="text-2xl tracking-tight text-primary">Accessibility statement</H1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: March 2026</p>

      <section className="mt-8 space-y-6 text-sm text-primary">
        <div>
          <H2 className="text-lg text-foreground">What we aim for</H2>
          <p className="mt-2">
            We build this site so people with disabilities can use it. We aim for Web Content Accessibility Guidelines (WCAG) 2.1 Level AA where we can.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">What we do on the page</H2>
          <p className="mt-2">
            Semantic HTML, keyboard navigation, color contrast that holds up, and descriptive links and labels. We avoid content that flashes in a way that could trigger seizures. Meaningful images get text alternatives where it helps.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Known limitations</H2>
          <p className="mt-2">
            Some third-party content, such as maps or embedded tools, may not be fully accessible. We keep improving pages and components. If you hit a barrier, tell us.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Reporting accessibility issues</H2>
          <p className="mt-2">
            If you cannot use any part of this site, or you have a fix in mind, email us:
          </p>
          <p className="mt-2">
            <a href={`mailto:${contactEmail}`} className="text-primary underline hover:no-underline">{contactEmail}</a>
          </p>
          <p className="mt-2">
            We will reply and fix what we can.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Third-party audits</H2>
          <p className="mt-2">
            We may hire third-party accessibility audits from time to time. The date of the most recent audit, when one has been done, will sit here. Right now we rely on internal review and what you report.
          </p>
        </div>
      </section>

      <p className="mt-10">
        <Link href="/" className="text-accent underline hover:no-underline">Back to home</Link>
      </p>
    </main>
    <SiteFooter />
    </>
  )
}
