import type { Metadata } from 'next'
import { getAgentsForIndex } from '@/app/actions/agents'
import BrokerCard from '@/components/broker/BrokerCard'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

export const dynamic = 'force-dynamic'

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
  const agents = await getAgentsForIndex()

  return (
    <main className="min-h-screen bg-[var(--background)]">
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
      <section className="bg-[var(--brand-navy)] px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Our Agents
          </h1>
          <p className="mt-3 text-lg text-[var(--brand-cream)]">
            Experienced brokers ready to help you buy or sell in Central Oregon.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        {agents.length === 0 ? (
          <p className="text-[var(--text-secondary)]">No agents to display. Check back soon.</p>
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
