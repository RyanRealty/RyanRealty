import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getAgentBySlug,
  getAgentActiveListings,
  getAgentSoldListings,
  getAgentPendingListings,
  getAgentReviews,
  getBrokerGalleryImages,
} from '@/app/actions/agents'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getFubPersonIdFromCookie } from '../../actions/fub-identity-bridge'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import { getBrokerageSettings } from '@/app/actions/brokerage'
import BrokerHero from '@/components/broker/BrokerHero'
import BrokerBio from '@/components/broker/BrokerBio'
import BrokerStats from '@/components/broker/BrokerStats'
import BrokerListings from '@/components/broker/BrokerListings'
import BrokerPendingListings from '@/components/broker/BrokerPendingListings'
import BrokerSoldHistory from '@/components/broker/BrokerSoldHistory'
import BrokerReviews from '@/components/broker/BrokerReviews'
import BrokerGallery from '@/components/broker/BrokerGallery'
import BrokerContactForm from '@/components/broker/BrokerContactForm'
import BrokerShare from '@/components/broker/BrokerShare'
import BrokerPageTracker from '@/components/broker/BrokerPageTracker'
import BrokerSocialProofCta from '@/components/broker/BrokerSocialProofCta'
import { generateBreadcrumbSchema } from '@/lib/structured-data'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [broker, brokerage] = await Promise.all([getAgentBySlug(slug), getBrokerageSettings()])
  if (!broker) return { title: 'Team Member Not Found' }
  const siteName = brokerage?.name ?? 'Ryan Realty'
  const title = `${broker.display_name} | ${siteName} — Central Oregon Real Estate`
  const description =
    broker.bio?.slice(0, 155) ??
    `${broker.display_name}, ${broker.title ?? 'Real Estate Agent'} at ${siteName}. ${broker.soldCount24Mo} transactions. Contact for Central Oregon real estate.`
  const canonical = `${siteUrl}/team/${slug}`
  const ogImage = `${siteUrl}/api/og?type=broker&id=${encodeURIComponent(slug)}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      type: 'profile',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${broker.display_name} | ${siteName}` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export const revalidate = 60

export default async function TeamMemberPage({ params }: Props) {
  const { slug } = await params
  const broker = await getAgentBySlug(slug)
  if (!broker) notFound()

  const [session, fubPersonId] = await Promise.all([getSession(), getFubPersonIdFromCookie()])
  const pageUrl = `${siteUrl}/team/${slug}`
  const brokerage = await getBrokerageSettings()
  const siteName = brokerage?.name ?? 'Ryan Realty'
  const pageTitle = `${broker.display_name} | ${siteName}`
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  const hasLicenseId = Boolean(broker.license_number?.trim())

  const [
    listings,
    soldListings,
    pendingListings,
    reviews,
    galleryImages,
    savedKeys,
    likedKeys,
    prefs,
  ] = await Promise.all([
    hasLicenseId
      ? getAgentActiveListings(broker.license_number!, 24, broker.email)
      : Promise.resolve([]),
    hasLicenseId
      ? getAgentSoldListings(broker.license_number!, 24, broker.email)
      : Promise.resolve([]),
    hasLicenseId
      ? getAgentPendingListings(broker.license_number!, 24, broker.email)
      : Promise.resolve([]),
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
  const brokerHeroFallback =
    null
  const firstName = broker.display_name.split(' ')[0] ?? broker.display_name

  return (
    <main className="min-h-screen bg-background">
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
            worksFor: {
              '@type': ['LocalBusiness', 'RealEstateAgent'],
              name: siteName,
              url: siteUrl,
            },
            ...(broker.avgRating != null &&
              broker.reviewCount > 0 && {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: broker.avgRating,
                  reviewCount: broker.reviewCount,
                },
              }),
            url: `${siteUrl}/team/${slug}`,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Team', url: `${siteUrl}/team` },
              { name: broker.display_name, url: `${siteUrl}/team/${slug}` },
            ])
          ),
        }}
      />

      <BrokerPageTracker
        brokerName={broker.display_name}
        brokerSlug={slug}
        listingCount={broker.activeCount}
        reviewCount={broker.reviewCount}
      />

      <BrokerHero broker={broker} basePath="team" fallbackImageUrl={brokerHeroFallback} />
      <BrokerBio broker={broker} />
      {hasLicenseId && (
        <>
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
          <BrokerPendingListings
            broker={broker}
            listings={pendingListings}
            savedKeys={session?.user ? savedKeys : []}
            likedKeys={session?.user ? likedKeys : []}
            signedIn={!!session?.user}
            userEmail={session?.user?.email ?? null}
            displayPrefs={displayPrefs}
          />
          <BrokerSoldHistory brokerFirstName={firstName} soldListings={soldListings} />
        </>
      )}
      <BrokerReviews
        brokerFirstName={firstName}
        avgRating={broker.avgRating}
        reviewCount={broker.reviewCount}
        reviews={reviews}
      />
      <BrokerSocialProofCta
        title={`What Clients Say About Working With ${firstName}`}
        subtitle={`Top brokerages keep trust and proof visible at every step. Review real feedback, then choose your next step with ${firstName}.`}
        primaryCtaHref="#contact"
        primaryCtaLabel={`Schedule With ${firstName}`}
        secondaryCtaHref="#reviews"
        secondaryCtaLabel={`Read ${firstName}'s Reviews`}
        ctaContext="broker_profile"
        brokerSlug={slug}
      />
      {galleryImages.length > 0 && <BrokerGallery images={galleryImages} />}
      <BrokerContactForm
        brokerId={broker.id}
        brokerSlug={slug}
        brokerFirstName={firstName}
      />
      <BrokerShare
        brokerFirstName={firstName}
        brokerName={broker.display_name}
        slug={slug}
        transactionCount={broker.soldCount24Mo}
        basePath="team"
      />
    </main>
  )
}
