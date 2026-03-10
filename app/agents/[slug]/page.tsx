import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getAgentBySlug,
  getAgentActiveListings,
  getAgentSoldListings,
  getAgentReviews,
  getBrokerGalleryImages,
} from '@/app/actions/agents'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { trackPageView } from '@/lib/followupboss'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import BrokerHero from '@/components/broker/BrokerHero'
import BrokerBio from '@/components/broker/BrokerBio'
import BrokerStats from '@/components/broker/BrokerStats'
import BrokerListings from '@/components/broker/BrokerListings'
import BrokerSoldHistory from '@/components/broker/BrokerSoldHistory'
import BrokerReviews from '@/components/broker/BrokerReviews'
import BrokerGallery from '@/components/broker/BrokerGallery'
import BrokerContactForm from '@/components/broker/BrokerContactForm'
import BrokerShare from '@/components/broker/BrokerShare'
import BrokerPageTracker from '@/components/broker/BrokerPageTracker'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const broker = await getAgentBySlug(slug)
  if (!broker) return { title: 'Agent Not Found' }
  const title = `${broker.display_name} — Real Estate Agent | Ryan Realty, Central Oregon`
  const description =
    broker.bio?.slice(0, 155) ??
    `${broker.display_name}, ${broker.title ?? 'Real Estate Agent'} at Ryan Realty. ${broker.soldCount24Mo} transactions. Contact for Central Oregon real estate.`
  const canonical = `${siteUrl}/agents/${slug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: 'Ryan Realty', type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export const dynamic = 'force-dynamic'

export default async function AgentDetailPage({ params }: Props) {
  const { slug } = await params
  const broker = await getAgentBySlug(slug)
  if (!broker) notFound()

  const session = await getSession()
  const pageUrl = `${siteUrl}/agents/${slug}`
  const pageTitle = `${broker.display_name} — Real Estate Agent | Ryan Realty`
  if (session?.user?.email) {
    trackPageView({ user: session.user, pageUrl, pageTitle }).catch(() => {})
  }

  const [
    listings,
    soldListings,
    reviews,
    galleryImages,
    savedKeys,
    likedKeys,
    prefs,
  ] = await Promise.all([
    getAgentActiveListings(broker.license_number, 24),
    getAgentSoldListings(broker.license_number, 12),
    getAgentReviews(broker.id, 100),
    getBrokerGalleryImages(broker.id),
    session?.user ? getSavedListingKeys() : Promise.resolve([]),
    session?.user ? getLikedListingKeys() : Promise.resolve([]),
    session?.user ? getBuyingPreferences().catch(() => null) : Promise.resolve(null),
  ])

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  const firstName = broker.display_name.split(' ')[0] ?? broker.display_name

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'RealEstateAgent',
            name: broker.display_name,
            jobTitle: broker.title ?? 'Real Estate Agent',
            image: broker.photo_url ?? undefined,
            telephone: broker.phone ?? undefined,
            email: broker.email ?? undefined,
            areaServed: { '@type': 'Place', name: 'Central Oregon' },
            ...(broker.avgRating != null &&
              broker.reviewCount > 0 && {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: broker.avgRating,
                  reviewCount: broker.reviewCount,
                },
              }),
            url: `${siteUrl}/agents/${slug}`,
          }),
        }}
      />

      <BrokerPageTracker
        brokerName={broker.display_name}
        brokerSlug={slug}
        listingCount={broker.activeCount}
        reviewCount={broker.reviewCount}
      />

      <BrokerHero broker={broker} />
      <BrokerBio broker={broker} />
      <BrokerStats broker={broker} />
      <BrokerListings
        broker={broker}
        listings={listings}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        displayPrefs={displayPrefs}
      />
      <BrokerSoldHistory brokerFirstName={firstName} soldListings={soldListings} />
      <BrokerReviews
        brokerFirstName={firstName}
        avgRating={broker.avgRating}
        reviewCount={broker.reviewCount}
        reviews={reviews}
      />
      {galleryImages.length > 0 && <BrokerGallery images={galleryImages} />}
      <BrokerContactForm
        brokerId={broker.id}
        brokerSlug={slug}
        brokerFirstName={firstName}
        brokerEmail={broker.email}
      />
      <BrokerShare
        brokerFirstName={firstName}
        brokerName={broker.display_name}
        slug={slug}
        transactionCount={broker.soldCount24Mo}
      />
    </main>
  )
}
