/**
 * Team page (/team) — Wave 3 site-v2 rebuild.
 *
 * Composed from @/components/site/* blocks + @/lib/data DAL. No legacy
 * components/broker/* or app/actions/agents.
 *
 * DATA ACCURACY (CLAUDE.md §0): the broker grid renders ONLY verified
 * getBrokers() data (name, title, Oregon license #, transparent headshot,
 * direct phone, email). No invented bios, stats, rankings, or "track record"
 * claims.
 */

import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site/page-metadata'
import { getBrokers } from '@/lib/data/brokers/getBrokers'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import { BrokerProfileRow } from '@/components/site/BrokerProfileRow'
import { CTABar } from '@/components/site/CTABar'
import { Body, Container, Eyebrow, H2, Section, Stack } from '@/components/site/primitives'

export const metadata: Metadata = pageMetadata({
  title: 'Our team · Ryan Realty, Bend Oregon',
  description:
    'Meet the three licensed brokers at Ryan Realty. A small, independent Bend brokerage serving buyers and sellers across Central Oregon.',
  path: '/team',
  ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'Ryan Realty team',
    'Bend Oregon real estate brokers',
    'Matt Ryan',
    'Central Oregon broker',
  ],
})

export default async function TeamPage() {
  const brokers = await getBrokers()

  return (
    <main className="min-h-screen bg-background">
      <div className="bg-background border-b border-border py-3">
        <Container>
          <BreadcrumbNav
            items={[{ label: 'Home', href: '/' }, { label: 'Team' }]}
            tone="on-light"
          />
        </Container>
      </div>

      <HeroBlock
        headline="Three brokers. That's it."
        lede="Three licensed brokers, all active in Oregon. The broker you meet is the broker who works your deal from offer to close."
        photo={{
          src: '/brand/hero/hero-old-mill-master-4k.jpg',
          alt: 'Old Mill District drone view of Bend, Oregon, with the Deschutes River and the Cascade mountains.',
          priority: true,
        }}
        minHeight={440}
      />

      <Section padding="default" tone="default" divider>
        <Container>
          <Stack gap="tight" className="mb-10 max-w-prose">
            <Eyebrow>The team</Eyebrow>
            <H2>Small by design. Local by choice.</H2>
            <Body size="default" tone="muted" className="leading-relaxed">
              Ryan Realty is a three-broker shop. You work with the same person from the first
              showing to the closing table. Call any broker directly using the number on their card.
            </Body>
          </Stack>

          {/* Large broker profiles — verified bio, specialties, license, and
              direct contact for each broker, straight from public.brokers. */}
          <div className="flex flex-col gap-12 md:gap-16">
            {brokers.map((broker) => (
              <BrokerProfileRow key={broker.slug} broker={broker} />
            ))}
          </div>

        </Container>
      </Section>

      <CTABar
        eyebrow="Ready to talk"
        title="Have a question for the team?"
        body="Call any broker directly, or schedule a time to talk. No scripts, no hand-offs."
        primary={{ href: '/contact', label: 'Schedule a call' }}
        secondary={{ href: 'tel:5412136706', label: '541.213.6706' }}
        tone="navy"
      />
    </main>
  )
}
