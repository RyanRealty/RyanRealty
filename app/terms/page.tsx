import type { Metadata } from 'next'
import Link from 'next/link'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service and use for Ryan Realty website and MLS data.',
  alternates: { canonical: `${siteUrl}/terms` },
  openGraph: {
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: March 2026</p>

      <section className="mt-8 space-y-4 text-sm text-primary">
        <div>
          <h2 className="text-lg font-semibold">Acceptance of terms</h2>
          <p className="mt-2">
            By using this website, you agree to these Terms of Service. If you do not agree, do not use the site.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Account registration</h2>
          <p className="mt-2">
            You may create an account to save searches, save listings, and receive notifications. You are responsible for keeping your credentials secure and for all activity under your account.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">MLS data usage</h2>
          <p className="mt-2">
            Listing data is provided for your personal, non-commercial use. You may not copy, scrape, or use the data for commercial purposes, resale, or redistribution. Data is subject to Oregon Data Share (ODS) and MLS rules.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Property information disclaimer</h2>
          <p className="mt-2">
            Property information is not guaranteed accurate. Square footage, lot size, and other details may be approximate. You should verify all information independently (e.g., with the listing agent, inspections, and public records) before relying on it.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Automated valuations (CMA)</h2>
          <p className="mt-2">
            Any automated valuation or comparative market analysis (CMA) provided on this site is an estimate only and is not an appraisal. Do not use it as the sole basis for pricing or purchase decisions.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">User conduct</h2>
          <p className="mt-2">
            You may not scrape the site, use bots for bulk data collection, harass other users or agents, or use the site for any unlawful purpose. Commercial use of listing data without permission is prohibited.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Intellectual property</h2>
          <p className="mt-2">
            Our content (text, layout, branding) is owned by Ryan Realty or our licensors. MLS data is owned by the applicable MLS. You may not copy or republish our content without permission.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Third-party links</h2>
          <p className="mt-2">
            We may link to third-party sites. We are not responsible for their content or privacy practices.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Limitation of liability</h2>
          <p className="mt-2">
            To the fullest extent permitted by law, Ryan Realty and its agents are not liable for any indirect, incidental, or consequential damages arising from your use of the site or reliance on any information provided here.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Indemnification</h2>
          <p className="mt-2">
            You agree to indemnify and hold harmless Ryan Realty and its agents from any claims or damages arising from your use of the site or violation of these terms.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Governing law and disputes</h2>
          <p className="mt-2">
            These terms are governed by the laws of the State of Oregon. Disputes will be resolved in the courts of Oregon.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Termination</h2>
          <p className="mt-2">
            We may suspend or terminate your access at any time for violation of these terms or for any other reason.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="mt-2">
            Questions? Contact us at{' '}
            <Link href="/contact" className="text-accent-foreground underline hover:no-underline">
              our contact page
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
