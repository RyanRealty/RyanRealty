/**
 * Join page (/join) — broker recruiting. Site-v2 rebuild.
 *
 * Replaces the legacy components/layout/ContentPageHero + hand-rolled sections
 * with @/components/site/* blocks + @/lib/data DAL, matching /sell and /about.
 *
 * VOICE (voice_system_v2.md): the recruit is an intelligent professional, not
 * someone to flatter. No smallness positioning (no "small/boutique brokerage",
 * no headcount), no pandering ("we'd love to talk"), no self-described virtues
 * ("integrity", "culture"). The pitch is what the brokerage actually operates:
 * the marketing system every listing gets, the direct-broker model, a principal
 * broker supervising every transaction, and the live-data tooling. Commission
 * split is stated honestly as a conversation, never an invented number.
 *
 * DATA ACCURACY (CLAUDE.md §0): no closing counts, no agent count, no invented
 * split percentage, no production figures. The only specifics are process facts
 * the brokerage operates (48-hour photography, weekly reporting) already stated
 * on /sell, and verifiable named entities (the principal broker, the service
 * area, @ryanrealtybend, ryan-realty.com).
 */

import { getSurfaceImage } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { HeroBlock } from '@/components/site/HeroBlock'
import { ContentSection } from '@/components/site/ContentSection'
import { FAQBlock } from '@/components/site/FAQBlock'
import { CTABar } from '@/components/site/CTABar'
import { CONTACT } from '@/lib/brand/contact'
import {
  Body,
  Container,
  Eyebrow,
  Grid,
  H2,
  Section,
  Stack,
  TextLink,
} from '@/components/site/primitives'

export const revalidate = 3600

export const metadata = pageMetadata({
  title: 'Join Ryan Realty · brokers, Central Oregon',
  description:
    'Bring your listings to a Bend brokerage that markets every one of them: a listing film, a 3D walkthrough, live-data pricing, and a written report every week. You keep your client from first call to closing.',
  path: '/join',
  ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'real estate broker jobs Bend Oregon',
    'join brokerage Central Oregon',
    'Bend real estate careers',
    'Ryan Realty broker',
  ],
})

const OLD_MILL_HERO = '/brand/hero/hero-old-mill-master-4k.jpg'

const LISTING_SUPPORT = [
  {
    title: 'Production handled for you',
    body: 'A listing film, a 3D walkthrough, and professional photography within 48 hours of a signed agreement. Produced by the brokerage, on every listing, at every price point. Not a cost you carry.',
  },
  {
    title: 'Pricing built from live data',
    body: 'A written CMA with three closed comps, three active comps, and the four levers that move the price, built from live MLS data running on ryan-realty.com. Your seller sees every number.',
  },
  {
    title: 'Its own page and full distribution',
    body: 'Every listing gets its own page on ryan-realty.com, full MLS syndication across Central Oregon, and native posts on @ryanrealtybend across Instagram, Facebook, TikTok, and YouTube.',
  },
  {
    title: 'A written report every week',
    body: 'Each week a listing is on the market, the seller gets a written update: showings, online traffic, where the views came from, and feedback. Your clients see the work, in writing.',
  },
]

const FAQ_ITEMS = [
  {
    question: 'Do you take newly licensed brokers?',
    answer:
      'Yes. A new license or twenty years in the business, the first conversation is the same: what you want to build and how the brokerage helps you build it. A principal broker supervises every transaction either way.',
  },
  {
    question: 'What happens to my current clients and pipeline?',
    answer:
      'They come with you. You keep the relationship from the first call to the closing table. Nothing in the model puts a call center or another broker between you and your client.',
  },
  {
    question: 'What is the commission split?',
    answer:
      'It is set with you, based on your business. There is no single published split because there is not one. The first conversation covers the numbers directly.',
  },
  {
    question: 'Do I have to produce my own listing marketing?',
    answer:
      'No. The listing film, the 3D walkthrough, the photography, the listing page, the social posts, and the weekly seller report are produced by the brokerage, on every listing.',
  },
  {
    question: 'Where does Ryan Realty work?',
    answer:
      'Central Oregon only: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the resort communities.',
  },
  {
    question: 'How do I start?',
    answer:
      'Send a note through the contact form or call. The first conversation is with a broker, not a recruiter, and there is no script.',
  },
] as const

export default async function JoinPage() {
  const heroSrc = await getSurfaceImage('hero', {
    geoTags: ['central-oregon'],
    seed: '/join',
    fallback: OLD_MILL_HERO,
  })

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock
        schemas={[
          {
            type: 'webPage',
            name: 'Join Ryan Realty',
            description:
              'Broker recruiting for Ryan Realty, a Bend, Oregon brokerage that markets every listing and keeps each broker with their client from first call to closing.',
            url: '/join',
          },
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Join the team', url: '/join' },
            ],
          },
        ]}
      />

      <PageBreadcrumb trail={[{ label: 'Join the team' }]} />

      <HeroBlock
        headline="Every listing you bring gets the full marketing plan."
        lede="A listing film, a 3D walkthrough, a price built from live MLS data, and a written report every week. Not only on the top of the market. On all of them. You keep your client from the first call to the closing table."
        photo={{
          src: heroSrc ?? OLD_MILL_HERO,
          alt: 'Central Oregon high desert and Cascade mountains around Bend.',
          priority: true,
        }}
        minHeight={500}
        chips={[
          { label: 'Start the conversation', href: '/contact?inquiry=Join%20the%20team' },
          { label: 'See how we market listings', href: '/sell#marketing-plan' },
          { label: 'Meet the brokers', href: '/team' },
        ]}
      />

      <Section padding="default" tone="default" divider>
        <Container>
          <Stack gap="tight" className="mb-10 max-w-2xl">
            <Eyebrow>What your listings get</Eyebrow>
            <H2>The brokerage markets the listing. You work the client.</H2>
            <Body size="large" tone="muted" className="mt-1 leading-[1.6]">
              The same plan runs on every listing, the one a seller can read on
              the sell page. It is produced for you, so the marketing is not a
              line item you cover or a weekend you lose.
            </Body>
          </Stack>
          <Grid cols={2} gap="loose">
            {LISTING_SUPPORT.map((item) => (
              <div
                key={item.title}
                className="rounded-[14px] border border-border bg-card p-6 shadow-sm"
              >
                <h3 className="text-[19px] font-bold leading-snug tracking-[-0.01em] text-foreground">
                  {item.title}
                </h3>
                <Body size="default" tone="muted" className="mt-2 leading-[1.65]">
                  {item.body}
                </Body>
              </div>
            ))}
          </Grid>
        </Container>
      </Section>

      <ContentSection
        eyebrow="How the brokerage works"
        title="One broker on the deal. A principal broker on call."
        tone="muted"
        divider
        width="wide"
      >
        <div className="space-y-4">
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">You keep your client, start to finish.</strong>{' '}
            No call center, no shared lead pool you compete inside, no hand-off
            to a closing coordinator the client never met. The broker who takes
            the call is the broker at the table.
          </Body>
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">A principal broker supervises every transaction.</strong>{' '}
            Matt Ryan is the principal broker. A question on a contingency, a
            contract, or a difficult close gets answered by a licensed principal
            broker, not a queue.
          </Body>
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">Central Oregon is the whole map.</strong>{' '}
            Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville,
            Terrebonne, and the resort communities. The market data on{' '}
            <TextLink href="/housing-market" tone="primary">ryan-realty.com</TextLink>{' '}
            updates from the MLS daily, and it is the same data you price from.
          </Body>
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">The split is a conversation, not a banner.</strong>{' '}
            It is set with you, based on the business you bring and the business
            you want to build. The first conversation covers the numbers
            directly.
          </Body>
        </div>
      </ContentSection>

      <CTABar
        eyebrow="Thinking about a move?"
        title="Start the conversation."
        body="Send a note or call. The first conversation is with a broker, not a recruiter, and there is no script."
        primary={{ href: '/contact?inquiry=Join%20the%20team', label: 'Get in touch' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: `Call ${CONTACT.phoneDirect}` }}
        tone="navy"
      />

      <FAQBlock
        eyebrow="Common questions"
        title="Joining Ryan Realty"
        items={FAQ_ITEMS}
        tone="muted"
      />
    </main>
  )
}
