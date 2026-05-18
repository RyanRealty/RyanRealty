import type { Metadata } from 'next'
import PulseHero from '@/components/pulse/PulseHero'
import PulseFeed from '@/components/pulse/PulseFeed'
import {
  getPulseFeed,
  getPulseCitySnapshots,
  getPulseRegionSnapshot,
} from '@/app/actions/pulse-feed'
import { PULSE_DEFAULT_CITIES } from '@/lib/pulse-config'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Market Pulse',
  description:
    'Live activity from the Central Oregon market. Every new listing, sold home, pending, and price drop. Filter by city and scroll.',
  alternates: { canonical: `${siteUrl}/pulse` },
  openGraph: {
    title: 'Central Oregon Market Pulse | Ryan Realty',
    description:
      'New listings, sold homes, price drops, and pending sales across Bend, Redmond, Sisters, Sunriver, and the rest of Central Oregon. Updated continuously.',
    url: `${siteUrl}/pulse`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty Market Pulse' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Central Oregon Market Pulse | Ryan Realty',
    description:
      'Live MLS activity from Central Oregon: new listings, sold homes, price drops. Filter by city.',
    images: [defaultOgImage],
  },
}

export const dynamic = 'force-dynamic'

export default async function PulsePage() {
  const defaultCities = [...PULSE_DEFAULT_CITIES]
  const [{ items, nextOffset }, regionSnapshot, citySnapshots] = await Promise.all([
    getPulseFeed({ offset: 0, limit: 12 }),
    getPulseRegionSnapshot(),
    getPulseCitySnapshots(defaultCities),
  ])

  return (
    <main className="min-h-screen bg-background">
      <PulseHero regionSnapshot={regionSnapshot} />
      <PulseFeed
        initialItems={items}
        initialNextOffset={nextOffset}
        defaultCities={defaultCities}
        citySnapshots={citySnapshots}
        regionSnapshot={regionSnapshot}
      />
    </main>
  )
}
