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
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { getBrokers } from '@/lib/data/brokers/getBrokers'
import { getSurfaceImage, getReviews } from '@/lib/data'
import { ReviewsBlock } from '@/components/site/ReviewsBlock'
import { MarketingStandardBlock } from '@/components/site/MarketingStandardBlock'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import { BrokerProfileRow } from '@/components/site/BrokerProfileRow'
import { CTABar } from '@/components/site/CTABar'
import { Body, Container, Eyebrow, H2, Section, Stack } from '@/components/site/primitives'
import { CONTACT } from '@/lib/brand/contact'

export const metadata: Metadata = pageMetadata({
  title: 'Our team · Ryan Realty, Bend Oregon',
  description:
    'Work directly with a Ryan Realty broker in Bend, Oregon. Cinematic video, 3D tours, and data-backed pricing on every Central Oregon listing, from first call to closing.',
  path: '/team',
  ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'Ryan Realty team',
    'Bend Oregon real estate brokers',
    'Matt Ryan',
    'Central Oregon broker',
  ],
})

const OLD_MILL_HERO = '/brand/hero/hero-old-mill-master-4k.jpg'

export default async function TeamPage() {
  const [brokers, heroSrc, reviews] = await Promise.all([
    getBrokers(),
    // Distinct approved hero so /team does not reuse the homepage Old Mill banner.
    getSurfaceImage('hero', { geoTags: ['central-oregon'], seed: '/team', fallback: OLD_MILL_HERO }),
    getReviews(6),
  ])

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock
        schemas={[
          {
            type: 'webPage',
            pageType: 'CollectionPage',
            aboutOrganization: true,
            name: 'The Ryan Realty Team',
            description:
              'The licensed Oregon brokers behind Ryan Realty in Bend, serving buyers and sellers across Central Oregon.',
            url: '/team',
          },
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Team', url: '/team' },
            ],
          },
        ]}
      />
      <div className="bg-background border-b border-border py-3">
        <Container>
          <BreadcrumbNav
            items={[{ label: 'Home', href: '/' }, { label: 'Team' }]}
            tone="on-light"
          />
        </Container>
      </div>

      <HeroBlock
        headline="The marketing your home deserves."
        lede="Every Ryan Realty listing gets cinematic video, a 3D walkthrough, and a price built from live Central Oregon market data. You work directly with the broker who does it, from the first call to the closing table."
        photo={{
          src: heroSrc ?? OLD_MILL_HERO,
          alt: 'Central Oregon high desert and Cascade mountains around Bend.',
          priority: true,
        }}
        minHeight={440}
      />

      <MarketingStandardBlock tone="default" />

      <Section padding="default" tone="muted" divider>
        <Container>
          <Stack gap="tight" className="mb-10 max-w-prose">
            <Eyebrow>The team</Eyebrow>
            <H2>Work with the broker who lists your home</H2>
            <Body size="default" tone="muted" className="leading-relaxed">
              You work directly with the same broker from the first conversation to the closing table.
              No hand-offs to a junior agent, no transaction desk. Call any broker directly using the
              number on their card.
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

      <ReviewsBlock data={reviews} eyebrow="Client reviews" title="What our clients say" tone="muted" max={6} />

      <CTABar
        eyebrow="Ready to talk"
        title="Have a question for the team?"
        body="Call any broker directly, or schedule a time to talk. No scripts, no hand-offs."
        primary={{ href: '/contact', label: 'Schedule a call' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: CONTACT.phoneDirect }}
        tone="navy"
      />
    </main>
  )
}
