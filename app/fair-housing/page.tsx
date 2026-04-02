import type { Metadata } from 'next'
import Link from 'next/link'
import EqualHousing from '@/components/legal/EqualHousing'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
const HUD_URL = 'https://www.hud.gov/program_offices/fair_housing_equal_opp'
const HUD_PHONE = '1-800-669-9777'

export const metadata: Metadata = {
  title: 'Fair Housing',
  description: 'Ryan Realty commitment to Equal Housing Opportunity and fair housing laws.',
  alternates: { canonical: `${siteUrl}/fair-housing` },
  openGraph: {
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

export default function FairHousingPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <EqualHousing size="large" className="text-primary" />
      </div>

      <section className="mt-10 space-y-6 text-sm text-primary">
        <div>
          <h2 className="text-lg font-semibold">Equal Housing Opportunity</h2>
          <p className="mt-2">
            Ryan Realty is committed to compliance with the Fair Housing Act and all applicable state and local laws. We do not discriminate on the basis of race, color, religion, sex, national origin, familial status, or disability.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Fair Housing Act</h2>
          <p className="mt-2">
            The Fair Housing Act prohibits discrimination in the sale, rental, or financing of housing based on: race, color, religion, sex, national origin, familial status, and disability. We support these protections and treat every client and visitor with equal respect and service.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Oregon law</h2>
          <p className="mt-2">
            Oregon law provides additional protected classes. We comply with all Oregon fair housing and civil rights requirements.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">If you believe you have been discriminated against</h2>
          <p className="mt-2">
            The U.S. Department of Housing and Urban Development (HUD) investigates fair housing complaints. You may contact HUD:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <a href={HUD_URL} target="_blank" rel="noopener noreferrer" className="text-accent-foreground underline hover:no-underline">
                HUD Fair Housing
              </a>
            </li>
            <li>
              <a href={`tel:${HUD_PHONE.replace(/\D/g, '')}`} className="text-accent-foreground underline hover:no-underline">
                {HUD_PHONE}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Our commitment</h2>
          <p className="mt-2">
            Ryan Realty is dedicated to equal opportunity in housing and to serving all clients fairly and without discrimination.
          </p>
        </div>
      </section>

      <p className="mt-10 text-center">
        <Link href="/" className="text-accent-foreground underline hover:no-underline">Back to home</Link>
      </p>
    </main>
  )
}
