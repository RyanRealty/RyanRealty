/**
 * Sell page (/sell) — Wave 3 site-v2 rebuild.
 *
 * Composed from @/components/site/* blocks + @/lib/data DAL. No legacy
 * components/layout/* or components/broker/* or CMS getPageContent.
 *
 * DATA ACCURACY (CLAUDE.md §0): the value props describe real capabilities
 * (live market data, a local licensed broker, a CMA with comparable sales,
 * one broker start-to-finish). NO invented results, "results you can verify"
 * claims, sale-percentages, or days-to-sell stats (D99). The current-market
 * line is live getMarketPulse data for Bend, classified by the canonical
 * months-of-supply thresholds. The lead path is the existing
 * /lp/seller-home-value LP, which captures the lead and triggers the FUB
 * seller workflow. This page has no form of its own.
 */

import { getMarketPulse } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import { ContentSection } from '@/components/site/ContentSection'
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
  TextLink,
} from '@/components/site/primitives'

export const revalidate = 300

export const metadata = pageMetadata({
  title: 'Sell your home · Ryan Realty, Central Oregon',
  description:
    'List your Central Oregon home with Ryan Realty. Pricing from live market data, marketing from a local licensed broker, and one broker from valuation to close. Request a free home valuation.',
  path: '/sell',
  ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'sell home Bend Oregon',
    'Central Oregon home valuation',
    'list home Bend',
    'Ryan Realty seller',
  ],
})

const VALUE_PROPS = [
  {
    title: 'Priced on real data',
    body: 'We price your home against recent comparable sales and current active inventory, the same live market data shown across this site. You see the comps we use.',
  },
  {
    title: 'Marketed by a local broker',
    body: 'Your listing is handled by a licensed Ryan Realty broker who works the Central Oregon market every day, with professional photography and full MLS syndication.',
  },
  {
    title: 'One broker, start to finish',
    body: 'The broker who prices and lists your home is the broker who markets, negotiates, and closes it. No hand-offs, no call center.',
  },
] as const

const FAQ_ITEMS = [
  {
    question: 'What does a home valuation cost?',
    answer:
      'Nothing. A broker prepares a comparative market analysis at no cost and no obligation.',
  },
  {
    question: 'How do you decide on a list price?',
    answer:
      'We use recent comparable sales and current active inventory in your area, the same market data shown across this site. You see the comparable sales we base the price on.',
  },
  {
    question: 'Will I work with the same broker the whole time?',
    answer:
      'Yes. The broker who lists your home is the broker who markets, negotiates, and closes it. Ryan Realty does not use a hand-off model.',
  },
  {
    question: 'What areas do you list homes in?',
    answer:
      'Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the surrounding communities.',
  },
] as const

function marketType(mos: number): string {
  if (mos <= 4) return "a seller's market"
  if (mos < 6) return 'a balanced market'
  return "a buyer's market"
}

export default async function SellPage() {
  const pulse = await getMarketPulse({ geoType: 'city', geoSlug: 'bend' }).catch(() => null)

  const sellerActive = pulse?.activeCount ?? 0
  const mosRaw = typeof pulse?.monthsOfSupply === 'number' ? pulse.monthsOfSupply : null
  const sellerMos = mosRaw === null ? null : Math.round(mosRaw * 10) / 10
  const hasMos = mosRaw === null ? false : true
  const showMarket = Boolean(pulse) && (sellerActive > 0 || hasMos)
  const marketLead =
    (sellerActive > 0
      ? `${sellerActive} single-family homes are for sale in Bend`
      : 'The Bend single-family market') +
    (mosRaw === null ? '' : `, with ${sellerMos} months of supply, which is ${marketType(mosRaw)}`) +
    '. See the full market picture before you list.'

  return (
    <main className="min-h-screen bg-background">
      <div className="bg-background border-b border-border py-3">
        <Container>
          <BreadcrumbNav items={[{ label: 'Home', href: '/' }, { label: 'Sell' }]} tone="on-light" />
        </Container>
      </div>

      <HeroBlock
        headline="Sell your Central Oregon home."
        lede="Pricing from live market data, marketing from a local licensed broker, and one broker who works your sale from valuation to close. Start with a free home valuation."
        photo={{
          src: '/brand/hero/hero-old-mill-master-4k.jpg',
          alt: 'Old Mill District drone view with the Deschutes River and the Cascade mountains.',
          priority: true,
        }}
        minHeight={460}
      />

      <Section padding="default" tone="default" divider>
        <Container>
          <Stack gap="tight" className="mb-8 max-w-[52ch]">
            <Eyebrow>Why list with us</Eyebrow>
            <H2>A small brokerage that prices on numbers, not adjectives.</H2>
          </Stack>
          <Grid cols={3} gap="default">
            {VALUE_PROPS.map((v) => (
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

      <ContentSection eyebrow="How it works" title="From first call to closing table." tone="muted" width="wide">
        <Stack gap="default">
          <Body size="default" tone="muted" className="leading-[1.65]">
            1. Request a valuation. Share your home details and your timeline.
          </Body>
          <Body size="default" tone="muted" className="leading-[1.65]">
            2. A broker prepares a comparative market analysis using recent comparable sales and a
            walk-through of your home, then gives you an honest price range.
          </Body>
          <Body size="default" tone="muted" className="leading-[1.65]">
            3. We agree on a price and a marketing plan: photography, MLS syndication, and the local
            channels that reach Central Oregon buyers.
          </Body>
          <Body size="default" tone="muted" className="leading-[1.65]">
            4. We list, market, negotiate the offers, and work the transaction through to close.
          </Body>
        </Stack>
      </ContentSection>

      {showMarket ? (
        <Section padding="default" tone="default" divider>
          <Container>
            <Stack gap="tight" className="max-w-[60ch]">
              <Eyebrow>The Bend market right now</Eyebrow>
              <Body size="default" tone="muted" className="leading-[1.6]">
                {marketLead}
              </Body>
              <TextLink href="/housing-market">
                View Central Oregon market data
              </TextLink>
            </Stack>
          </Container>
        </Section>
      ) : null}

      <CTABar
        eyebrow="What is your home worth?"
        title="Get a free home valuation."
        body="A broker prepares a comparative market analysis with recent comparable sales and an honest price range. No cost, no obligation."
        primary={{ href: '/lp/seller-home-value', label: 'Get a home valuation' }}
        secondary={{ href: '/contact?inquiry=Selling', label: 'Talk to a broker' }}
        tone="navy"
      />

      <FAQBlock eyebrow="Common questions" title="Selling with Ryan Realty" items={FAQ_ITEMS} tone="muted" />
    </main>
  )
}
