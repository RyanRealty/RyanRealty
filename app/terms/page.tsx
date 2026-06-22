import type { Metadata } from 'next'
import Link from 'next/link'
import { H1, H2 } from '@/components/site/primitives'

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
      <H1 className="text-2xl tracking-tight text-primary">Terms of Service</H1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: May 2026</p>

      <section className="mt-8 space-y-4 text-sm text-primary">
        <div>
          <H2 className="text-lg text-foreground">Acceptance of terms</H2>
          <p className="mt-2">
            By using this website, you agree to these Terms of Service. If you do not agree, do not use the site.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Account registration</H2>
          <p className="mt-2">
            You may create an account to save searches, save listings, and receive notifications. You are responsible for keeping your credentials secure and for all activity under your account.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">MLS data usage</H2>
          <p className="mt-2">
            Listing data is provided for your personal, non-commercial use. You may not copy, scrape, or use the data for commercial purposes, resale, or redistribution. Data is subject to Oregon Data Share (ODS) and MLS rules.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Property information disclaimer</H2>
          <p className="mt-2">
            Property information is not guaranteed accurate. Square footage, lot size, and other details may be approximate. You should verify all information independently (e.g., with the listing agent, inspections, and public records) before relying on it.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Automated valuations (CMA)</H2>
          <p className="mt-2">
            Any automated valuation or comparative market analysis (CMA) provided on this site is an estimate only and is not an appraisal. Do not use it as the sole basis for pricing or purchase decisions.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">User conduct</H2>
          <p className="mt-2">
            You may not scrape the site, use bots for bulk data collection, harass other users or agents, or use the site for any unlawful purpose. Commercial use of listing data without permission is prohibited.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Intellectual property</H2>
          <p className="mt-2">
            Our content (text, layout, branding) is owned by Ryan Realty or our licensors. MLS data is owned by the applicable MLS. You may not copy or republish our content without permission.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Third-party links</H2>
          <p className="mt-2">
            We may link to third-party sites. We are not responsible for their content or privacy practices.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Limitation of liability</H2>
          <p className="mt-2">
            To the fullest extent permitted by law, Ryan Realty and its agents are not liable for any indirect, incidental, or consequential damages arising from your use of the site or reliance on any information provided here.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Indemnification</H2>
          <p className="mt-2">
            You agree to indemnify and hold harmless Ryan Realty and its agents from any claims or damages arising from your use of the site or violation of these terms.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Governing law and disputes</H2>
          <p className="mt-2">
            These terms are governed by the laws of the State of Oregon. Disputes will be resolved in the courts of Oregon.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Termination</H2>
          <p className="mt-2">
            We may suspend or terminate your access at any time for violation of these terms or for any other reason.
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Ryan Realty Social: content publishing application</H2>
          <p className="mt-2">
            Ryan Realty operates an application named <strong>Ryan Realty Social</strong> that publishes original real-estate content (market reports, listing videos, neighborhood guides, news commentary) from this website to third-party platforms, including TikTok, Instagram, Facebook, YouTube, LinkedIn, X, Threads, Pinterest, and Google Business Profile, on behalf of Ryan Realty and its participating brokerage agents.
          </p>
          <p className="mt-2">
            Ryan Realty Social does not collect user data from these third-party platforms. It does not post on behalf of website visitors, customers, or any user other than the brokerage and its authorized agents. Use of Ryan Realty Social is governed by these Terms of Service in addition to the platform-specific terms of each connected service (TikTok Developer Terms, Meta Platform Terms, YouTube API Services Terms, LinkedIn API Terms, etc.). Connected platform tokens are stored encrypted and used solely to publish Ryan Realty&rsquo;s own content. We do not access, scrape, or sell any platform user&rsquo;s data through this application.
          </p>
          <p className="mt-2">
            For questions about the Ryan Realty Social application, including content removal requests, contact us at the address below.
          </p>
        </div>

        <div id="sms">
          <H2 className="text-lg text-foreground">Text messaging (SMS) program</H2>
          <p className="mt-2">
            If you provide your phone number on one of our forms and check the SMS consent box, you agree to receive text messages from Ryan Realty related to your request, including property and home-value updates, scheduling, and replies from our team. Consent to receive text messages is not a condition of any purchase or service.
          </p>
          <p className="mt-2">
            Message frequency varies. Message and data rates may apply. Reply <strong>STOP</strong> at any time to unsubscribe, or <strong>HELP</strong> for help. Mobile carriers are not liable for delayed or undelivered messages. We honor STOP and HELP keywords automatically.
          </p>
          <p className="mt-2">
            No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging originator opt-in data and consent are not shared with any third parties. Full details are in our{' '}
            <Link href="/privacy#sms" className="text-accent-foreground underline hover:no-underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div>
          <H2 className="text-lg text-foreground">Contact</H2>
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
