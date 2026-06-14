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
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { HeroBlock } from '@/components/site/HeroBlock'
import { BrokerProfileRow } from '@/components/site/BrokerProfileRow'
import { FAQBlock } from '@/components/site/FAQBlock'
import { CTABar } from '@/components/site/CTABar'
import { CONTACT } from '@/lib/brand/contact'
import { Body, Container, Eyebrow, H2, Section, Stack } from '@/components/site/primitives'

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

// Agent-choice intent FAQ ("bend oregon realtor", "bend real estate agent" —
// target-query benchmark 2026-06-10). DATA ACCURACY: every answer reuses facts
// already approved on live /team and /about copy. No new claims.
const TEAM_FAQ_ITEMS = [
  {
    question: 'What does working directly with a broker mean?',
    answer:
      'You work with one broker from the first call to the closing table. There is no hand-off to a junior agent or a transaction desk, and the broker who prices your home is the one who answers your calls.',
  },
  {
    question: 'What does my listing get?',
    answer:
      'Every Ryan Realty listing gets cinematic video, a 3D walkthrough, and a price built from live Central Oregon market data. The same treatment at every price point.',
  },
  {
    question: 'Which areas do Ryan Realty brokers cover?',
    answer:
      'Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, and Terrebonne, plus the resort communities including Tetherow, Pronghorn, Eagle Crest, and Brasada Ranch.',
  },
  {
    question: 'How do I start?',
    answer:
      `Call ${CONTACT.phoneDirect} or schedule a time through the contact page. You talk directly with a broker, not a call center.`,
  },
] as const

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
      <PageBreadcrumb trail={[{ label: 'Team' }]} />

      <HeroBlock
        headline="The broker you call is the broker you get."
        lede="No hand-offs, no transaction desk, no junior agent learning on your deal. Meet the brokers who represent Ryan Realty clients across Bend, Redmond, Sisters, and Central Oregon."
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

      <FAQBlock
        eyebrow="Choosing a broker"
        title="Working with a Bend broker"
        items={TEAM_FAQ_ITEMS}
        tone="default"
      />

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
