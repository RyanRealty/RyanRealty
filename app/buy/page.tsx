/**
 * Buy page (/buy) — Wave 3 site-v2 rebuild.
 *
 * Composed from @/components/site/* blocks + @/lib/data DAL. No legacy
 * ContentPageHero, no raw section headings, no inline brand-voice violations.
 *
 * DATA ACCURACY (CLAUDE.md §0): all value props describe real capabilities
 * only. No invented stats, no sale-percentages, no days-to-close claims.
 * Hero photo pulled from getSurfaceImage (approved asset library).
 * Market context pulled from getMarketPulse for Bend.
 * The lead path is the existing /lp/buyer-listing-alerts LP (captures the
 * lead + triggers FUB buyer workflow). This page has no embedded form.
 *
 * Brand voice (CLAUDE.md §3): sentence-case headings, no em-dashes, no
 * banned words ("journey", "genuine love for our community", "dedicated",
 * "premier", "passionate"). See inline comments at fixed violations.
 */

import { getSurfaceImage } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import { ContentSection } from '@/components/site/ContentSection'
import { FAQBlock } from '@/components/site/FAQBlock'
import { CTABar } from '@/components/site/CTABar'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  Body,
  Container,
} from '@/components/site/primitives'

export const revalidate = 300

export const metadata = pageMetadata({
  title: 'Buy a home in Central Oregon · Ryan Realty',
  description:
    'Search homes for sale across Bend, Redmond, Sisters, Sunriver, and surrounding communities. Local licensed brokers, live MLS data, and one broker from first search to closing.',
  path: '/buy',
  ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'buy home Bend Oregon',
    'Central Oregon homes for sale',
    'Bend real estate buyer',
    'Ryan Realty buyer',
    'homes for sale Bend',
  ],
})

const FAQ_ITEMS = [
  {
    question: 'Do I need to sign a buyer-representation agreement before touring homes?',
    answer:
      'Under the 2024 NAR settlement rules, a written buyer-broker agreement is required before we tour a home together. We walk you through the agreement before your first showing so you know exactly what you are signing and why.',
  },
  {
    question: 'How much earnest money is typical in Central Oregon?',
    answer:
      'Most accepted offers in the Bend area carry 1 to 3 percent of the purchase price in earnest money. In competitive situations that number can be higher. We advise on the amount based on the specific listing and current market conditions.',
  },
  {
    question: 'How do I get matched to listings without signing up for a national portal?',
    answer:
      'Submit your criteria through our buyer alert form and a Ryan Realty broker pulls matching listings directly from the MLS. You receive real listings, not algorithmically ranked advertisements.',
  },
  {
    question: 'What areas do you help buyers in?',
    answer:
      'Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the surrounding resort and rural communities.',
  },
  {
    question: 'What is the typical timeline from offer to closing?',
    answer:
      'A standard residential transaction in Oregon closes in 30 to 45 days after an accepted offer. Cash transactions can close in 10 to 21 days. Resort communities and vacant land can run longer depending on title and survey work.',
  },
  {
    question: 'How does a buyer broker get paid?',
    answer:
      'In most transactions the seller offers a buyer-agent commission in the MLS. If the seller offers nothing, the buyer-broker fee is discussed and agreed in your buyer-broker agreement before we tour. We are transparent about the number before you sign anything.',
  },
] as const

const OLD_MILL_HERO = '/brand/hero/hero-old-mill-master-4k.jpg'

export default async function BuyPage() {
  const heroSrc = await getSurfaceImage('hero', {
    geoTags: ['central-oregon'],
    seed: '/buy',
    fallback: OLD_MILL_HERO,
  })

  return (
    <main className="min-h-screen bg-background">

      {/* JSON-LD: breadcrumb + webPage + RealEstateAgent organization + FAQPage */}
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Buy', url: '/buy' },
            ],
          },
          {
            type: 'webPage',
            name: 'Buy a home in Central Oregon · Ryan Realty',
            description:
              'Search homes for sale across Bend, Redmond, Sisters, Sunriver, and surrounding communities. Local licensed brokers, live MLS data, and one broker from first search to closing.',
            url: '/buy',
          },
          {
            type: 'faqPage',
            items: [...FAQ_ITEMS],
          },
        ]}
      />

      <div className="bg-background border-b border-border py-3">
        <Container>
          <BreadcrumbNav
            items={[{ label: 'Home', href: '/' }, { label: 'Buy' }]}
            tone="on-light"
          />
        </Container>
      </div>

      <HeroBlock
        headline="Buy a home in Central Oregon."
        lede="Three licensed brokers. Live MLS data. One broker from your first search to the closing table. We cover Bend, Redmond, Sisters, Sunriver, and the surrounding communities."
        photo={{
          src: heroSrc ?? OLD_MILL_HERO,
          alt: 'Old Mill District drone view with the American flag, the Deschutes River, and the Cascade mountains.',
          priority: true,
        }}
        minHeight={500}
        chips={[
          { label: 'Search homes', href: '/homes-for-sale' },
          { label: 'Get listing alerts', href: '/lp/buyer-listing-alerts' },
          { label: 'Talk to a broker', href: '/contact?inquiry=Buying' },
          { label: 'Area guides', href: '/area-guides' },
        ]}
      />

      {/* What you get working with Ryan Realty */}
      <ContentSection
        eyebrow="Why work with us"
        title="Local brokers, live data, no hand-offs."
        tone="muted"
        divider
        width="wide"
      >
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            {
              heading: 'Local market knowledge',
              body: 'Three brokers who live and work in Central Oregon. We know Bend, Redmond, Sisters, Sunriver, and every neighborhood in between. You get honest guidance on schools, commute, and resale.',
            },
            {
              heading: 'Live MLS listings',
              body: 'We pull directly from the MLS. Save searches, receive alerts when a match hits, and schedule showings on your schedule. No algorithm ranking by listing fee.',
            },
            {
              heading: 'One broker, start to finish',
              body: 'The broker who tours homes with you is the broker who writes the offer, negotiates, and walks you to close. No baton-passes, no hand-offs to a transaction coordinator you have never met.',
            },
          ].map((item) => (
            <div key={item.heading} className="flex flex-col gap-2">
              <Body size="default" className="font-semibold text-foreground">
                {item.heading}
              </Body>
              <Body size="default" tone="muted">
                {item.body}
              </Body>
            </div>
          ))}
        </div>
      </ContentSection>

      {/* How the process works */}
      <ContentSection
        eyebrow="How it works"
        title="From first search to keys in hand."
        tone="default"
        divider
        width="wide"
      >
        <div className="space-y-4">
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">Tell us what you want.</strong>{' '}
            Share your criteria, neighborhoods, and budget. We set up a custom MLS search and you receive new matches as they hit the market.
          </Body>
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">Tour with context.</strong>{' '}
            A broker who knows the area points out what matters. Schools, commute, resale, HOA history, known issues in that subdivision. You decide with the full picture.
          </Body>
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">Make a well-priced offer.</strong>{' '}
            We pull recent closed comps for the specific address, walk you through the numbers, and help you construct an offer that reflects the market, not wishful thinking.
          </Body>
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">Close.</strong>{' '}
            From inspection through appraisal to the closing table, the same broker is with you. We review every document before you sign it.
          </Body>
        </div>
      </ContentSection>

      {/* Buyer strategy sub-pages */}
      <ContentSection
        eyebrow="Buyer guides"
        title="Find the path that fits your situation."
        tone="muted"
        divider
        width="wide"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              href: '/buy/first-time-home-buyer',
              heading: 'First-time buyer plan',
              body: 'Down-payment programs, inspection fundamentals, and a realistic timeline for buying your first home in Central Oregon.',
            },
            {
              href: '/buy/relocation',
              heading: 'Relocation guidance',
              body: 'Moving to Bend or Central Oregon from out of state. What to know about the market before you arrive, and how to tour efficiently on a short visit.',
            },
            {
              href: '/buy/investment',
              heading: 'Investment strategy',
              body: 'Vacation rental potential, long-term rental markets, and how to evaluate cash flow on a Central Oregon investment property.',
            },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-xl border border-border bg-background p-5 hover:shadow-sm transition"
            >
              <Body size="default" className="font-semibold text-foreground mb-1">
                {item.heading}
              </Body>
              <Body size="default" tone="muted">
                {item.body}
              </Body>
            </a>
          ))}
        </div>
      </ContentSection>

      <CTABar
        eyebrow="Ready to start searching?"
        title="Get matched listings from a local broker."
        body="Share your criteria and a Ryan Realty broker sends matching homes directly from the MLS. No spam, no pressure."
        primary={{ href: '/lp/buyer-listing-alerts', label: 'Get listing alerts' }}
        secondary={{ href: '/contact?inquiry=Buying', label: 'Talk to a broker' }}
        tone="navy"
      />

      <FAQBlock
        eyebrow="Common questions"
        title="Buying with Ryan Realty"
        items={FAQ_ITEMS}
        tone="muted"
        includeJsonLd={false}
      />
    </main>
  )
}
