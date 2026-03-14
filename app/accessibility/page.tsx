import type { Metadata } from 'next'
import Link from 'next/link'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const contactEmail = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL ?? 'info@ryanrealty.com'

export const metadata: Metadata = {
  title: 'Accessibility',
  description: 'Ryan Realty commitment to web accessibility and how to report issues.',
  alternates: { canonical: `${siteUrl}/accessibility` },
  robots: 'noindex, follow',
}

export default function AccessibilityPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Accessibility Statement</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: March 2026</p>

      <section className="mt-8 space-y-6 text-sm text-primary">
        <div>
          <h2 className="text-lg font-semibold">Our commitment</h2>
          <p className="mt-2">
            Ryan Realty is committed to ensuring our website is accessible to people with disabilities. We aim to conform to Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA where practicable.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Measures we take</h2>
          <p className="mt-2">
            We use semantic HTML, keyboard navigation support, sufficient color contrast, and descriptive links and labels. We avoid content that flashes in a way that could trigger seizures and provide text alternatives for meaningful images where appropriate.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Known limitations</h2>
          <p className="mt-2">
            Some third-party content (e.g., maps or embedded tools) may not be fully accessible. We are continually improving our pages and components. If you encounter a barrier, we want to hear from you.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Reporting accessibility issues</h2>
          <p className="mt-2">
            If you have trouble accessing any part of this site or have suggestions for improvement, please contact us:
          </p>
          <p className="mt-2">
            <a href={`mailto:${contactEmail}`} className="text-accent underline hover:no-underline">{contactEmail}</a>
          </p>
          <p className="mt-2">
            We will respond and work to address the issue where feasible.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Third-party audits</h2>
          <p className="mt-2">
            We may engage third-party accessibility audits from time to time. The date of the most recent audit (when performed) will be noted here. Currently we rely on internal review and user feedback to improve accessibility.
          </p>
        </div>
      </section>

      <p className="mt-10">
        <Link href="/" className="text-accent underline hover:no-underline">Back to home</Link>
      </p>
    </main>
  )
}
