import type { Metadata } from 'next'
import { getAgentsForIndex } from '@/app/actions/agents'
import BrokerCard from '@/components/broker/BrokerCard'
import { fetchPlacePhoto } from '@/lib/photo-api'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Our Agents | Ryan Realty — Central Oregon Real Estate',
  description:
    'Meet the real estate agents at Ryan Realty. Expert brokers serving Bend, Redmond, Sisters, Sunriver, and Central Oregon.',
  alternates: { canonical: `${siteUrl}/agents` },
  openGraph: {
    title: 'Our Agents | Ryan Realty',
    description: 'Meet the real estate agents at Ryan Realty. Expert brokers serving Central Oregon.',
    url: `${siteUrl}/agents`,
    siteName: 'Ryan Realty',
    type: 'website',
  },
}

export default async function AgentsIndexPage() {
  const [agents, heroPhoto] = await Promise.all([
    getAgentsForIndex(),
    Promise.resolve(null as { url: string; attribution?: string } | null),
  ])

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Our Agents | Ryan Realty',
            description: 'Meet the real estate agents at Ryan Realty. Expert brokers serving Central Oregon.',
            url: `${siteUrl}/agents`,
            publisher: { '@type': 'Organization', name: 'Ryan Realty' },
          }),
        }}
      />
      <section
        className="relative px-4 py-12 sm:px-6 sm:py-16"
        style={heroPhoto?.url ? { backgroundImage: `url(${heroPhoto.url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <div className="absolute inset-0 bg-primary/85" aria-hidden />
        <div className="relative mx-auto max-w-7xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Our Agents
          </h1>
          <p className="mt-3 text-lg text-muted">
            Experienced brokers ready to help you buy or sell in Central Oregon.
          </p>
          {heroPhoto?.attribution && (
            <p className="mt-4 text-xs text-white/60">
              {heroPhoto.attribution}
            </p>
          )}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        {agents.length === 0 ? (
          <p className="text-muted-foreground">No agents to display. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <BrokerCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
