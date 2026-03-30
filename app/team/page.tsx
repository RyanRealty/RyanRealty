import type { Metadata } from 'next'
import { getAgentsForIndex } from '@/app/actions/agents'
import { getBrokerageSettings } from '@/app/actions/brokerage'
import BrokerCard from '@/components/broker/BrokerCard'
import BrokerSocialProofCta from '@/components/broker/BrokerSocialProofCta'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import { listingsBrowsePath } from '@/lib/slug'
import { generateBreadcrumbSchema } from '@/lib/structured-data'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const brokerage = await getBrokerageSettings()
  const name = brokerage?.name ?? 'Ryan Realty'
  return {
    title: `Our Team | ${name} — Central Oregon Real Estate`,
    description: `Meet the brokers at ${name}. Expert real estate agents serving Bend, Redmond, Sisters, Sunriver, and Central Oregon.`,
    alternates: { canonical: `${siteUrl}/team` },
    openGraph: {
      title: `Our Team | ${name}`,
      description: `Meet the brokers at ${name}. Your Central Oregon real estate experts.`,
      url: `${siteUrl}/team`,
      siteName: name,
      type: 'website',
      images: [{ url: `${siteUrl}/api/og?type=default`, width: 1200, height: 630, alt: `Our Team | ${name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [`${siteUrl}/api/og?type=default`],
    },
  }
}

export default async function TeamPage() {
  const [agents, brokerage] = await Promise.all([
    getAgentsForIndex(),
    getBrokerageSettings(),
  ])
  const brokerageName = brokerage?.name ?? 'Ryan Realty'

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `Our Team | ${brokerageName}`,
            description: `Meet the brokers at ${brokerageName}. Central Oregon real estate experts.`,
            url: `${siteUrl}/team`,
            publisher: { '@type': 'Organization', name: brokerageName },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': ['LocalBusiness', 'RealEstateAgent'],
            name: brokerageName,
            url: siteUrl,
            areaServed: {
              '@type': 'GeoCircle',
              geoMidpoint: { '@type': 'GeoCoordinates', latitude: 44.0582, longitude: -121.3153 },
              geoRadius: '80000',
            },
            employee: agents.map((agent) => ({
              '@type': 'Person',
              name: agent.display_name,
              jobTitle: agent.title ?? 'Real Estate Agent',
              url: `${siteUrl}/team/${agent.slug}`,
              ...(agent.photo_url ? { image: agent.photo_url } : {}),
            })),
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
            ])
          ),
        }}
      />
      <ContentPageHero
        title="Our Team"
        subtitle={`The people behind ${brokerageName}. Local experts ready to help you find or sell your next home in Central Oregon.`}
        imageUrl={CONTENT_HERO_IMAGES.team}
        ctas={[
          { label: 'View Listings', href: listingsBrowsePath(), primary: true },
          { label: 'Contact Us', href: '/contact', primary: false },
        ]}
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        {agents.length === 0 ? (
          <p className="text-muted-foreground">Team profiles are being updated. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <BrokerCard key={agent.id} agent={agent} basePath="team" />
            ))}
          </div>
        )}
      </section>
      <BrokerSocialProofCta
        title="Work With a Proven Local Team"
        subtitle="Each broker page includes reviews, track record, and direct contact options so buyers and sellers can move forward with confidence."
        primaryCtaHref="/contact"
        primaryCtaLabel="Talk to Ryan Realty"
        secondaryCtaHref="/reviews"
        secondaryCtaLabel="Read More Reviews"
        ctaContext="team_index"
      />
    </main>
  )
}
