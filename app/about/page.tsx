/**
 * Brokerage profile page (/about) — KB (kinetic-brutalist) design, Phase 9
 * of the KB convergence program (docs/KB_CONVERGENCE_ROADMAP.md).
 *
 * Reuses the SAME section library as the homepage, city, and community pages
 * (components/site/kb/*) — single source of truth, never forked (ci:kb-single-source G50).
 * KbNav + KbFooter carry the chrome. HideChrome should suppress the default
 * SiteHeader/SiteFooter for this route (SKIPPED — shared-component change,
 * orchestrator to handle).
 *
 * Voice (CLAUDE.md §3 + VOICE.md Five Laws): show, don't say. No stated virtues,
 * no headcount/smallness positioning, no overt category claims. Every claim is
 * a verified fact.
 *
 * DATA ACCURACY (CLAUDE.md §0):
 *   - Ryan Realty LLC, Bend, Oregon. Founded June 2023 (OREA 201253677, 2023-06-21).
 *   - Matt Ryan, Principal Broker OR #201206613; fire service before founding;
 *     mentor Hjalmar "Red" Erickson — from Matt's verified broker bio.
 *   - Reviews: TESTIMONIALS from lib/testimonials.ts (verified Google GBP, 24 reviews,
 *     5.0 average, pulled 2026-06-13 via GBP API). Mapped to KbReview shape.
 *   - Region pulse: getRegionPulse() for KbSell data numbers.
 *   - Blog posts: getRecentBlogPosts() for KbArticles.
 *   - Service area: getCitiesForIndex() (geo_snapshot_mv) for the KbExploreTowns ledger.
 *   - FAQ: verified-facts-only FAQ_ITEMS rendered by FAQBlock (+ FAQPage JSON-LD).
 *   - Hero photo: getSurfaceImage('hero', central-oregon) with Old Mill fallback.
 *
 * PAGE CONTRACT (docs/KB_CONVERGENCE_ROADMAP.md):
 *   KB design + SEO (pageMetadata + MetadataBlock JSON-LD: Organization/AboutPage/
 *   Breadcrumb + FAQPage) + tracking (KbSectionTracker). Every figure live (§0).
 *
 * Section stack: KbNav · KbBreadcrumb · KbHero · KbAbout · KbExploreTowns ·
 *   KbTestimonials · KbTeam · KbArticles · KbSell · FAQBlock · KbFooter.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/about/parity.json (KB set).
 */

import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { getSurfaceImage, getRecentBlogPosts, getRegionPulse } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbAbout } from '@/components/site/kb/KbAbout'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { FAQBlock } from '@/components/site/FAQBlock'
import { TESTIMONIALS } from '@/lib/testimonials'
import type { KbReview, KbTownItem } from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

const ROUTE_PATH = '/about'
const OLD_MILL_HERO = '/images/hero/hero-old-mill-master-4k.jpg'

// Service-area ledger — the Central Oregon cities we cover, with live active
// counts + median from getCitiesForIndex (geo_snapshot_mv, §0). Reuses the
// homepage town set + photography so the KB Explore ledger matches the brand.
const TOWN_ORDER = ['bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'terrebonne'] as const
const TOWN_IMG: Record<string, string> = {
  bend: '/images/kb/bend-drake-park-aerial.jpg',
  redmond: '/images/kb/redmond-downtown-aerial.jpg',
  sisters: '/images/kb/sisters-downtown-three-peaks.jpg',
  sunriver: '/images/kb/sunriver-deschutes-river.jpg',
  'la-pine': '/images/kb/vandevert-ranch.jpg',
  terrebonne: '/images/kb/smith-rock-terrebonne.jpg',
}

// FAQ — verified facts only (no testimonial language, no stated virtues).
// FAQBlock renders the visible <dl> AND the schema.org FAQPage JSON-LD.
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

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'About Ryan Realty · Bend, Oregon',
    description:
      'Ryan Realty markets Central Oregon homes with cinematic video, 3D tours, and data-backed pricing. Based in Bend, Oregon, founded June 2023. The broker you call is the one who closes your sale.',
    path: ROUTE_PATH,
    ogImage: '/images/hero/hero-old-mill-master-4k.jpg',
    keywords: [
      'Ryan Realty',
      'Bend Oregon real estate',
      'Central Oregon brokerage',
      'Matt Ryan broker',
    ],
  })
}

export const revalidate = 3600

export default async function AboutPage() {
  const [heroSrc, blogPosts, regionPulse, cities] = await Promise.all([
    withTimeoutFallback(
      getSurfaceImage('hero', {
        geoTags: ['central-oregon'],
        seed: ROUTE_PATH,
        fallback: OLD_MILL_HERO,
      }),
      OLD_MILL_HERO,
      3500,
      'about:hero',
    ),
    withTimeoutFallback(
      getRecentBlogPosts({ limit: 3 }),
      [],
      3000,
      'about:blog',
    ),
    withTimeoutFallback(
      getRegionPulse(),
      null,
      3000,
      'about:regionPulse',
    ),
    withTimeoutFallback(
      getCitiesForIndex(),
      [],
      3000,
      'about:cities',
    ),
  ])

  // Service-area towns — KbExploreTowns ledger fed by the live city snapshot
  // (geo_snapshot_mv via getCitiesForIndex). Restores the old CityGrid
  // "Where we work" section in KB style; renders null when empty.
  const cityBySlug = new Map(cities.map((c) => [c.slug, c]))
  const towns: KbTownItem[] = TOWN_ORDER.map((slug) => {
    const c = cityBySlug.get(slug)
    if (!c) return null
    return {
      name: c.name,
      activeCount: c.activeCount,
      medianPrice: c.medianPrice,
      href: `/cities/${slug}`,
      img: TOWN_IMG[slug],
    }
  }).filter((t): t is KbTownItem => t !== null)

  // Map TESTIMONIALS (KbReview-compatible) — verified Google reviews, verbatim.
  const reviews: KbReview[] = TESTIMONIALS.slice(0, 8).map((t) => ({
    quote: t.quote,
    author: t.author,
  }))

  // Blog articles for KbArticles.
  const articlePosts = blogPosts.map((p) => ({
    title: p.title,
    href: `/blog/${p.slug}`,
    excerpt: p.excerpt,
    imageUrl: p.heroImageUrl,
    dateLabel: p.publishedAt
      ? new Date(p.publishedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null,
  }))

  // KbSell data from the region pulse (live Central Oregon figures).
  const sellData = {
    medianListPrice: regionPulse?.medianListPrice ?? null,
    medianDaysToPending: regionPulse?.medianDaysToPending ?? null,
    soldCount30d: regionPulse?.soldCount30d ?? null,
  }

  // About section — the origin story and what every listing gets.
  // Concrete facts only. No stated virtues (VOICE.md Law 1 + Law 4).
  const aboutParagraphs = [
    'Matt Ryan founded Ryan Realty in June 2023, after years in the fire service. He works to the standard his mentor, Hjalmar “Red” Erickson, set: the job is about the people on the other side of the table, not the transaction.',
    'Every listing gets cinematic video, a 3D walkthrough, and a price built from live Central Oregon market data. The active inventory, median price, days on market, and months of supply you see on this site are the same figures we put in front of you when it is time to price a listing or write an offer. When the data does not support a price, we say so.',
    'The broker you first speak to is the broker who works your purchase or sale through to close. No hand-off.',
  ]

  // Quick-facts ledger — verified identifiers and founding date.
  const aboutFacts = [
    { label: 'Founded', value: 'June 2023' },
    { label: 'License', value: 'OREA 201253677' },
    { label: 'Principal Broker', value: 'OR #201206613' },
    { label: 'Based in', value: 'Bend, Oregon' },
    { label: 'Service area', value: 'Central Oregon' },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="about" />
      <MetadataBlock
        schemas={[
          {
            type: 'webPage',
            pageType: 'AboutPage',
            aboutOrganization: true,
            name: 'About Ryan Realty',
            description:
              'Ryan Realty is based in Bend, Oregon. We cover Bend, Redmond, Sisters, Sunriver, and the surrounding Central Oregon communities.',
            url: '/about',
          },
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'About', url: '/about' },
            ],
          },
        ]}
      />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'About' },
        ]}
      />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: null,
            medianListPrice: null,
            medianDaysToPending: null,
          }}
          eyebrow="Ryan Realty · Bend, Oregon"
          titleTop="Homes here deserve"
          titleBottom="more than a sign."
          lead="Every home we list across Central Oregon gets cinematic video, a 3D walkthrough, and a price built from live market data."
          showSearch={false}
          videoSrc={null}
          posterSrc={heroSrc ?? OLD_MILL_HERO}
        />

        <KbAbout
          eyebrow="Ryan Realty · Founded 2023"
          heading="How we got here."
          paragraphs={aboutParagraphs}
          facts={aboutFacts}
        />

        <KbExploreTowns
          towns={towns}
          eyebrow="Service area"
          title="Where we work."
          sectionId="service-area"
          cta={{ href: '/homes-for-sale', label: 'Search homes across Central Oregon' }}
        />

        <KbTestimonials reviews={reviews} />

        <KbTeam />

        {articlePosts.length > 0 ? (
          <KbArticles
            posts={articlePosts}
            eyebrow="Guides and insights"
            heading="Central Oregon real estate, explained."
            subtitle="Local housing news, neighborhood deep dives, and buyer and seller guides for Bend and Central Oregon."
          />
        ) : null}

        <KbSell data={sellData} eyebrow="Sell with us" />

        <FAQBlock
          eyebrow="Common questions"
          title="Working with Ryan Realty"
          items={FAQ_ITEMS}
          tone="muted"
        />

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
