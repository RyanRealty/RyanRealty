/**
 * Brokerage profile page (/about) — site-v2.
 *
 * Voice (CLAUDE.md §3 + feedback-voice-no-overt-statements): understated.
 * Do NOT overtly state categories/virtues/obvious credentials ("independent
 * brokerage by design", "all licensed and active", a mascot moment). Let the
 * concrete, verified facts carry it.
 *
 * DATA ACCURACY (CLAUDE.md §0): every claim is verified.
 *   - getBrokers() — public.brokers: the three brokers.
 *   - Ryan Realty LLC, Bend, Oregon. Founded June 2023 (OREA 201253677, 2023-06-21).
 *   - Matt Ryan, Principal Broker OR #201206613; served in the fire service before
 *     founding; mentor Hjalmar "Red" Erickson — both from Matt's verified broker bio.
 *   - CityGrid counts are live geo_snapshot_mv data.
 * NO testimonials (no verified review source wired).
 */

import { pageMetadata } from '@/lib/site/page-metadata'
import { getBrokers } from '@/lib/data/brokers/getBrokers'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import { ContentSection } from '@/components/site/ContentSection'
import { BrokerCard } from '@/components/site/BrokerCard'
import { FAQBlock } from '@/components/site/FAQBlock'
import CityGrid from '@/components/site/CityGrid'
import CtaDuo from '@/components/site/CtaDuo'
import { Body, Container, Eyebrow, Grid, H2, Section, Stack, TextLink } from '@/components/site/primitives'

const ROUTE_PATH = '/about'

export const metadata = pageMetadata({
  title: 'Ryan Realty · Bend, Oregon',
  description:
    'A small Bend brokerage. Matt Ryan opened Ryan Realty in 2023; today three brokers cover Central Oregon. The broker you call is the one who closes your deal.',
  path: ROUTE_PATH,
  ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'Ryan Realty',
    'Bend Oregon real estate',
    'Central Oregon brokerage',
    'Matt Ryan',
  ],
})

// FAQ — verified facts only.
const FAQ_ITEMS = [
  {
    question: 'Who are the brokers?',
    answer:
      'Matt Ryan (Principal Broker, OR #201206613), Paul Stevenson, and Rebecca Ryser Peterson.',
  },
  {
    question: 'When did Ryan Realty start?',
    answer: 'Matt Ryan opened Ryan Realty in June 2023, based in Bend, Oregon.',
  },
  {
    question: 'Will I work with the same broker from start to finish?',
    answer:
      'Yes. The broker you first talk to is the broker who works your purchase or sale through to close. There is no hand-off to a junior agent or a transaction desk.',
  },
  {
    question: 'What areas do you cover?',
    answer:
      'Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the surrounding resort communities including Tetherow, Pronghorn, Eagle Crest, and Brasada Ranch.',
  },
  {
    question: 'How do I get a home valuation?',
    answer:
      'Request one through the home value form. A broker prepares a comparative market analysis from recent comparable sales and gives you a price range, with the comps that support it.',
  },
] as const

export default async function AboutPage() {
  const brokers = await getBrokers()

  return (
    <main className="min-h-screen bg-background">
      <div className="bg-background border-b border-border py-3">
        <Container>
          <BreadcrumbNav
            items={[{ label: 'Home', href: '/' }, { label: 'Ryan Realty' }]}
            tone="on-light"
          />
        </Container>
      </div>

      <HeroBlock
        headline="A small brokerage in Bend, Oregon."
        lede="Matt Ryan opened Ryan Realty in 2023. Today it is three brokers covering Central Oregon. The broker you call is the one who works your sale or purchase through to closing."
        photo={{
          src: '/brand/hero/hero-old-mill-master-4k.jpg',
          alt: 'Old Mill District drone view of Bend, Oregon, with the Deschutes River and the Cascade mountains.',
          priority: true,
        }}
        minHeight={440}
      />

      <ContentSection eyebrow="Our story" title="How Ryan Realty started." width="wide">
        <Stack gap="default">
          <Body size="default" tone="muted" className="leading-relaxed">
            Matt Ryan founded Ryan Realty in June 2023, after years in the fire service. He works to
            the standard his mentor, Hjalmar &ldquo;Red&rdquo; Erickson, set: the job is about the
            people on the other side of the table, not the transaction.
          </Body>
          <Body size="default" tone="muted" className="leading-relaxed">
            We lead with the numbers. The active inventory, median price, days on market, and months
            of supply you see on this site are the same figures we put in front of you when it is
            time to price a listing or write an offer. When the data does not support a price, we
            say so.
          </Body>
        </Stack>
      </ContentSection>

      <CityGrid
        eyebrow="Service area"
        title="Where we work"
        subtitle="The Central Oregon cities and resort communities we cover. Active counts update daily."
      />

      <Section padding="default" tone="muted" divider>
        <Container>
          <Stack gap="tight" className="mb-10 max-w-prose">
            <Eyebrow>The team</Eyebrow>
            <H2>The brokers</H2>
            <Body size="default" tone="muted" className="leading-relaxed">
              Three brokers, each reachable directly. <TextLink href="/team" underline="on-hover">See full profiles</TextLink>.
            </Body>
          </Stack>
          <Grid cols={3} gap="default">
            {brokers.map((broker) => (
              <div key={broker.slug} className="bg-card border border-border rounded-[14px] p-6 shadow-sm">
                <BrokerCard broker={broker} variant="featured" ctaHref="/contact" ctaLabel="Get in touch" />
              </div>
            ))}
          </Grid>
        </Container>
      </Section>

      <FAQBlock
        eyebrow="Common questions"
        title="Working with Ryan Realty"
        items={FAQ_ITEMS}
        tone="default"
      />

      <CtaDuo />
    </main>
  )
}
