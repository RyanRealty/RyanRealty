/**
 * Brokerage profile page (/about) — Wave 3 site-v2 rebuild.
 *
 * Composed exclusively from @/components/site/* blocks + @/lib/data DAL.
 * No legacy components.
 *
 * DATA ACCURACY (CLAUDE.md §0): every claim on this page is verified.
 *   - getBrokers() — public.brokers (24h cache): the three brokers, titles, license #s.
 *   - Ryan Realty LLC, Bend, Oregon. Founded 2023 (OREA business license 201253677, 2023-06-21).
 *   - Matt Ryan, Principal Broker, OR #201206613. Phone 541.213.6706. ryan-realty.com.
 *   - Service area: Central Oregon (verified registry).
 *   - The brand "four rules" come from design_system/ryan-realty brand voice.
 * NO testimonials are shown: there is no verified client-review source wired yet,
 * and fabricated reviews are a compliance + accuracy violation. Add a real source
 * (GBP reviews) before re-introducing a TestimonialBlock.
 */

import { pageMetadata } from '@/lib/site/page-metadata'
import { getBrokers } from '@/lib/data/brokers/getBrokers'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import { ContentSection } from '@/components/site/ContentSection'
import { BrokerCard } from '@/components/site/BrokerCard'
import { FAQBlock } from '@/components/site/FAQBlock'
import { CTABar } from '@/components/site/CTABar'
import {
  Body,
  Container,
  Eyebrow,
  Grid,
  H2,
  H3,
  Section,
  Stack,
} from '@/components/site/primitives'

const ROUTE_PATH = '/about'

export const metadata = pageMetadata({
  title: 'Ryan Realty · Bend, Oregon',
  description:
    'A small, independent Bend brokerage founded in 2023. Three licensed brokers serving Central Oregon buyers and sellers, with transparent market data and no high-pressure scripts.',
  path: ROUTE_PATH,
  ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'Ryan Realty',
    'Bend Oregon real estate',
    'Central Oregon brokerage',
    'licensed broker',
    'Matt Ryan',
  ],
})

// Four rules — verbatim from the design_system brand voice guidelines.
const VALUES = [
  {
    title: 'Direct.',
    body: 'Short sentences. Active voice. One idea per line. If a clause can be cut without losing meaning, we cut it.',
  },
  {
    title: 'Specific.',
    body: 'Neighborhood names, not "the area." Real dollar amounts, not "competitively priced." The broker’s name, not "our team of experts."',
  },
  {
    title: 'Kind.',
    body: 'Directness is not coldness. We use "you" and "your." We acknowledge the situation. We do not condescend or pressure.',
  },
  {
    title: 'Honest, even when it is inconvenient.',
    body: 'If a market is soft, we say so. If a home is priced high, we show you the comps. If we do not know, we tell you. Trust is the product.',
  },
] as const

// FAQ — verified facts only. No invented service levels, no unverifiable claims.
const FAQ_ITEMS = [
  {
    question: 'How many brokers work at Ryan Realty?',
    answer:
      'Three: Matt Ryan (Principal Broker, OR #201206613), Paul Stevenson, and Rebecca Ryser Peterson. All are licensed and active in Oregon.',
  },
  {
    question: 'When was Ryan Realty founded?',
    answer:
      'Ryan Realty opened in 2023 as an independent brokerage based in Bend, Oregon.',
  },
  {
    question: 'Will I work with the same broker from start to finish?',
    answer:
      'Yes. Ryan Realty does not use a hand-off model. The broker you first talk to is the broker who works your purchase or sale through to close.',
  },
  {
    question: 'What areas do you serve?',
    answer:
      'Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the surrounding resort communities including Tetherow, Pronghorn, Eagle Crest, and Brasada Ranch. We are licensed in Oregon.',
  },
  {
    question: 'How do I get a home valuation?',
    answer:
      'Request one through the home value form at ryan-realty.com. A broker prepares a comparative market analysis using recent comparable sales and gives you an honest price range for your home.',
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
        headline="A small Bend brokerage, built on straight answers."
        lede="Ryan Realty opened in 2023. Three licensed brokers serving Central Oregon. The broker you meet is the broker who closes your deal."
        photo={{
          src: '/brand/hero/hero-old-mill-master-4k.jpg',
          alt: 'Old Mill District drone view with the American flag, the Deschutes River, and the Cascade mountains.',
          priority: true,
        }}
        minHeight={440}
      />

      <ContentSection
        eyebrow="Our story"
        title="An independent brokerage, by design."
        width="wide"
      >
        <Stack gap="default">
          <Body size="default" tone="muted" className="leading-[1.65]">
            Ryan Realty is a small, independent brokerage in Bend, opened in 2023. Three licensed
            brokers, all active in Oregon. The broker you meet is the broker who works your deal
            from the first conversation to the closing table.
          </Body>
          <Body size="default" tone="muted" className="leading-[1.65]">
            We lead with the numbers. The same live market data on this site (active inventory,
            median price, days on market, months of supply) is what we put in front of you when it
            is time to price a listing or write an offer. When we do not think we can sell a home
            well, we say so.
          </Body>
          <Body size="default" tone="muted" className="leading-[1.65]">
            We serve Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, and the surrounding resort
            communities across Central Oregon. We are licensed in Oregon and keep our work inside
            the region we know.
          </Body>
        </Stack>
      </ContentSection>

      <Section padding="default" tone="muted" divider>
        <Container>
          <Stack gap="tight" className="mb-8 max-w-[60ch]">
            <Eyebrow>What we do differently</Eyebrow>
            <H2>Four rules we hold to.</H2>
          </Stack>
          <Grid cols={2} gap="default">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-card border border-border rounded-[14px] p-7 shadow-sm">
                <H3 className="mb-2">{v.title}</H3>
                <Body size="default" tone="muted" className="leading-[1.6]">
                  {v.body}
                </Body>
              </div>
            ))}
          </Grid>
        </Container>
      </Section>

      <Section padding="default" tone="default" divider>
        <Container>
          <Stack gap="tight" className="mb-10 max-w-[60ch]">
            <Eyebrow>Meet the team</Eyebrow>
            <H2>Three brokers. All licensed. All active.</H2>
            <Body size="default" tone="muted" className="leading-[1.6]">
              Each broker you meet is the broker who works your deal from offer to close.
            </Body>
          </Stack>
          <Grid cols={3} gap="default">
            {brokers.map((broker) => (
              <div key={broker.slug} className="bg-card border border-border rounded-[14px] p-6 shadow-sm">
                <BrokerCard broker={broker} variant="featured" ctaHref="/contact" ctaLabel="Schedule a call" />
              </div>
            ))}
          </Grid>
        </Container>
      </Section>

      <FAQBlock
        eyebrow="Common questions"
        title="Working with Ryan Realty"
        items={FAQ_ITEMS}
        tone="muted"
      />

      <CTABar
        eyebrow="Ready to talk"
        title="Have a question on buying or selling in Central Oregon?"
        body="Call us directly or schedule a time to talk. No scripts, no pressure, no hand-offs."
        primary={{ href: '/contact', label: 'Schedule a call' }}
        secondary={{ href: 'tel:5412136706', label: '541.213.6706' }}
        tone="navy"
      />
    </main>
  )
}
