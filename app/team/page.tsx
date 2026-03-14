import type { Metadata } from 'next'
import { getAgentsForIndex } from '@/app/actions/agents'
import { getBrokerageSettings } from '@/app/actions/brokerage'
import BrokerCard from '@/components/broker/BrokerCard'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'

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
      <ContentPageHero
        title="Our Team"
        subtitle={`The people behind ${brokerageName}. Local experts ready to help you find or sell your next home in Central Oregon.`}
        imageUrl={CONTENT_HERO_IMAGES.team}
        ctas={[
          { label: 'View Listings', href: '/listings', primary: true },
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
    </main>
  )
}
