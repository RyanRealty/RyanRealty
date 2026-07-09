/**
 * Housing market hub — Central Oregon entry / navigation page.
 *
 * Converted to the KB (kinetic-brutalist) design system (Phase 9).
 * Reuses components/site/kb/* AS-IS; no fork.
 *
 * This is the navigation / overview page. The deep region REPORT (price chart +
 * city comparison + narrative) lives at /housing-market/central-oregon. The hub
 * emits the same AI-citable Dataset + FAQPage structured data its child pages do
 * (built from the region pulse the hub already fetches), so the hub is consistent
 * with /housing-market/bend and /housing-market/central-oregon.
 *
 * THE PAGE CONTRACT: KB design + SEO (pageMetadata + MetadataBlock JSON-LD:
 * BreadcrumbList/WebPage/Dataset + FAQPage via FAQBlock) + KbSectionTracker
 * pageType="market-report". Every figure live and traced to a @/lib/data source (§0).
 *
 * Section order:
 *   1. MetadataBlock    — BreadcrumbList + WebPage + Dataset JSON-LD (AI-citability G34)
 *   2. KbNav            — KB chrome
 *   3. KbSectionTracker — page-level analytics (pageType="market-report")
 *   4. KbBreadcrumb     — Home > Housing market
 *   5. SmoothScrollProvider wrapper
 *   6. KbHero           — region eyebrow + glance lede (data-driven)
 *   7. KbExploreTowns   — per-city tiles with live active counts
 *   8. KbArticles       — cross-links to region report + blog posts
 *   9. FAQBlock         — region FAQ (includeJsonLd=true → FAQPage JSON-LD)
 *  10. ContentSection   — curated resource cross-links (region report, reports
 *      index, explorer, communities, guides, area guides) — restored from the
 *      pre-KB hub for internal linking the KB chrome does not otherwise carry
 *  11. KbSell           — seller conversion CTA
 *  12. LeadCaptureBlock — general "ask a broker" inquiry (submitMarketPageInquiry),
 *      restored from the pre-KB hub so a non-seller market question has on-page
 *      capture (KbSell only routes to the seller valuation flow)
 *  13. KbFooter         — full sitemap close
 *
 * Data accuracy (CLAUDE.md §0):
 *   regionPulse   — market_pulse_live, geo_type='region', geo_slug='central-oregon',
 *                   property_type='A'. Freshness 10-15 min. Source: getMarketPulse.
 *   citySnapshots — market_pulse_live, geo_type='city', cityLabels in CITY_LABELS.
 *                   ONE call. Source: getMarketPulseCitySnapshots.
 *   blogPosts     — blog_posts, published, newest first. Source: getRecentBlogPosts.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/market-report/parity.json
 */

import type { Metadata } from 'next'
import {
  getMarketPulse,
  getMarketPulseCitySnapshots,
  getRecentBlogPosts,
} from '@/lib/data'
import { getSurfaceImage } from '@/lib/data/media/getSurfaceImages'
import { buildMarketFaq } from '@/lib/site/market-faq'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { KbTownItem } from '@/components/site/kb/types'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import { ContentSection } from '@/components/site/ContentSection'
import { LeadCaptureBlock } from '@/components/site/LeadCaptureBlock'
import { submitMarketPageInquiry } from '@/app/housing-market/actions'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import '@/components/site/kb/kb.css'

export const revalidate = 300

// ---------------------------------------------------------------------------
// Central Oregon cities — drive the per-city navigation tiles.
// ---------------------------------------------------------------------------

const CITY_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Terrebonne',
]

const CITY_SLUG: Record<string, string> = {
  'Bend': 'bend',
  'Redmond': 'redmond',
  'Sisters': 'sisters',
  'Sunriver': 'sunriver',
  'La Pine': 'la-pine',
  'Tumalo': 'tumalo',
  'Prineville': 'prineville',
  'Terrebonne': 'terrebonne',
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Central Oregon housing market',
    description:
      'Central Oregon housing market hub. Live single-family market data by city, with the full Central Oregon region report and per-city market pages. ' +
      'Updated every 15 minutes from Oregon Data Share.',
    path: '/housing-market',
    keywords: [
      'Central Oregon housing market',
      'Central Oregon real estate',
      'Bend housing market',
      'Redmond housing market',
      'Central Oregon market by city',
      'Ryan Realty',
    ],
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HousingMarketHubPage() {
  // -------------------------------------------------------------------------
  // Data — all via @/lib/data (G8). No @/app/actions/* imports.
  //
  // §0 trace:
  //   regionPulse   — market_pulse_live, geo_type='region', geo_slug='central-oregon',
  //                   property_type='A'. Freshness 10-15 min.
  //   citySnapshots — market_pulse_live, geo_type='city', geo_label IN CITY_LABELS,
  //                   property_type='A'. ONE call replaces legacy per-city fan-out.
  //   blogPosts     — blog_posts, status='published', newest first. Up to 3.
  // -------------------------------------------------------------------------
  const [regionPulse, citySnapshots, blogPosts, heroPhoto] = await Promise.all([
    getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => null),
    getMarketPulseCitySnapshots(CITY_LABELS).catch(() => []),
    getRecentBlogPosts({ limit: 3 }).catch(() => []),
    // design-audit #110: distinct hero photo from /housing-market/central-oregon
    // so the hub and the deep report don't look like the same page at a glance.
    getSurfaceImage('hero', { geoTags: ['central-oregon'], seed: 'housing-market-hub' }).catch(() => null),
  ])

  // -------------------------------------------------------------------------
  // buildMarketFaq — SINGLE source for the FAQ, the FAQPage JSON-LD, and the
  // Dataset variableMeasured, all drawn from the same verified region pulse the
  // hub already fetches. Same pattern as /housing-market/central-oregon so the
  // hub emits the same AI-citable structured data its child page does.
  // Null fields degrade gracefully inside buildMarketFaq (a stat with no value
  // is omitted, never fabricated — §0); the structured-data block never vanishes.
  // §0: Dataset.dateModified = pulse.refreshedAt (real refresh ts from
  // market_pulse_live). Never a hardcoded or derived date.
  // -------------------------------------------------------------------------
  const refreshedAt = regionPulse?.refreshedAt ?? null
  // Pulse-timeout fallback (G52 page-contract): feed buildMarketFaq a
  // pulse-or-fallback input so the Dataset + FAQPage JSON-LD survives a slow or
  // missing region market row instead of vanishing. Same pattern as the child
  // /housing-market/central-oregon page.
  const pulse = regionPulse
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(
    'Central Oregon',
    pulse ?? { activeCount: null, medianListPrice: null, refreshedAt: null },
  )

  // -------------------------------------------------------------------------
  // KbHero lede — data-driven from the region pulse (§0).
  // -------------------------------------------------------------------------
  // KbHero's stat template already renders the count ("N homes for sale …"),
  // the median, and days-to-pending from the data prop — the lede must not
  // repeat them (they rendered twice in one paragraph).
  const ledeParts: string[] = []
  if (regionPulse && regionPulse.activeCount > 0) {
    ledeParts.push('across Central Oregon.')
  }
  if (regionPulse?.monthsOfSupply != null) {
    // Classify the RAW value, not the rounded display value — rounding
    // first (the old `Math.round(x*10)/10` then comparing THAT to the
    // threshold) could flip a genuinely-balanced 4.05 into "seller's
    // market" once it rounded to 4.0 (design-audit P2, CLAUDE.md §0).
    const raw = regionPulse.monthsOfSupply
    let verdict = 'balanced market'
    if (raw <= 4) verdict = "seller's market"
    else if (raw >= 6) verdict = "buyer's market"
    ledeParts.push(`${formatMonthsOfSupply(raw)} months of supply: ${verdict}.`)
  }
  const lede =
    ledeParts.join(' ') ||
    'Live single-family market data across Central Oregon cities, updated every 15 minutes.'

  // -------------------------------------------------------------------------
  // City tiles — KbExploreTowns from getMarketPulseCitySnapshots (§0).
  // Each tile links to /housing-market/<city-slug> (city market report).
  // Fill in any label that returned no snapshot row (zero active = no row).
  // -------------------------------------------------------------------------
  const coveredSlugs = new Set<string>()
  const cityTowns: KbTownItem[] = citySnapshots
    .filter((s) => CITY_SLUG[s.geo_label] !== undefined)
    .map((s) => {
      const slug = CITY_SLUG[s.geo_label] as string
      coveredSlugs.add(s.geo_label)
      return {
        name: s.geo_label,
        href: `/housing-market/${slug}`,
        activeCount: s.active_count,
        medianPrice: s.median_list_price,
        img: '',
      }
    })

  // Cities with zero active listings may not return a snapshot row — add them
  // so every city always appears as a tile (activeCount: 0 renders as "0 active").
  for (const label of CITY_LABELS) {
    if (!coveredSlugs.has(label) && CITY_SLUG[label]) {
      cityTowns.push({
        name: label,
        href: `/housing-market/${CITY_SLUG[label] as string}`,
        activeCount: 0,
        medianPrice: null,
        img: '',
      })
    }
  }

  // -------------------------------------------------------------------------
  // Blog / guide articles (KbArticles). Falls back gracefully to empty.
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // JSON-LD schemas — BreadcrumbList + WebPage + Dataset.
  // FAQPage is emitted by FAQBlock (includeJsonLd=true) below (G34), so the hub
  // carries the same AI-citable structured data as /housing-market/central-oregon.
  // §0: dateModified is the real refreshedAt from market_pulse_live, never now().
  // -------------------------------------------------------------------------
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Housing market', url: '/housing-market' },
      ],
    },
    {
      type: 'webPage',
      name: 'Central Oregon housing market',
      description:
        'Central Oregon housing market hub: live single-family market data by city, the region report, and per-city market pages.',
      url: '/housing-market',
    },
  ]

  if (datasetVariables.length > 0 && refreshedAt) {
    schemas.push({
      type: 'dataset',
      name: `Central Oregon, Oregon real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description:
        'Live single-family home market data for Central Oregon. ' +
        'Includes region median list price, active inventory, months of supply, and median days to pending. ' +
        'Sourced from Oregon Data Share via Ryan Realty.',
      url: '/housing-market',
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: 'Central Oregon, OR',
      variableMeasured: datasetVariables,
    })
  }

  return (
    <main className="kb-root">
      {/* AI-citability structured data: BreadcrumbList + WebPage + Dataset.
          KbBreadcrumb has no JSON-LD of its own. FAQPage emitted by FAQBlock. */}
      <MetadataBlock schemas={schemas} />

      <KbNav />
      <KbSectionTracker pageType="market-report" />

      {/* Breadcrumb visual — Home > Housing market */}
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Housing market' },
        ]}
      />

      <SmoothScrollProvider>
        {/* Hero — region eyebrow + data-driven glance lede (§0) */}
        <KbHero
          data={{
            activeCount: regionPulse?.activeCount ?? null,
            medianListPrice: regionPulse?.medianListPrice ?? null,
            medianDaysToPending: regionPulse?.medianDaysToPending ?? null,
          }}
          eyebrow="Central Oregon · Oregon"
          titleTop="Central Oregon"
          titleBottom="housing market"
          lead={lede}
          posterSrc={heroPhoto ?? undefined}
        />

        {/* City tiles — per-city active counts from ONE getMarketPulseCitySnapshots
            call (§0). Each tile links to that city's full market report. */}
        {cityTowns.length > 0 ? (
          <KbExploreTowns
            towns={cityTowns}
            eyebrow="Central Oregon"
            title="Market by city"
            sectionId="cities"
            cta={{ href: '/cities', label: 'Every Central Oregon city' }}
          />
        ) : null}

        {/* Guide articles + region report cross-link — recent published blog posts. */}
        {articlePosts.length > 0 ? (
          <KbArticles
            posts={articlePosts}
            eyebrow="Guides and insights"
            heading="Central Oregon real estate, explained"
            subtitle="Local housing data, neighborhood deep dives, and buyer and seller guides for Central Oregon."
          />
        ) : null}

        {/* FAQ — region Q&A from buildMarketFaq (single source with the Dataset
            vars above). includeJsonLd=true auto-emits the FAQPage JSON-LD (G34),
            matching the structured data on /housing-market/central-oregon. */}
        {faqs.length > 0 ? (
          <section id="faq" aria-label="Central Oregon real estate questions">
            <FAQBlock
              items={faqs}
              eyebrow="Common questions"
              title="Central Oregon real estate questions"
              intro="Direct answers based on live MLS data."
              includeJsonLd={true}
              tone="muted"
            />
          </section>
        ) : null}

        {/* Resource cross-links — curated internal links the KB chrome does not
            otherwise surface on this page (region report, reports index, the open
            data explorer, communities, guides, area guides). Restored from the
            pre-KB hub so the region report and these sibling routes keep their
            inbound link from the hub (internal-linking / SEO value). */}
        <ContentSection
          eyebrow="More resources"
          title="Explore Central Oregon real estate"
          tone="default"
          divider
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: '/housing-market/central-oregon', label: 'Central Oregon region report' },
              { href: '/housing-market/reports', label: 'Market report index' },
              { href: '/housing-market/explore', label: 'Open data explorer' },
              { href: '/cities', label: 'All Central Oregon cities' },
              { href: '/communities', label: 'Communities and neighborhoods' },
              { href: '/homes-for-sale', label: 'Browse homes for sale' },
              { href: '/guides', label: 'Buying and selling guides' },
              { href: '/area-guides', label: 'Area guides' },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted hover:border-primary/30"
              >
                {label}
              </a>
            ))}
          </div>
        </ContentSection>

        {/* Sell CTA — feeds off region pulse figures (§0) */}
        <KbSell
          data={{
            medianListPrice: regionPulse?.medianListPrice ?? null,
            medianDaysToPending: regionPulse?.medianDaysToPending ?? null,
            soldCount30d: regionPulse?.closedLast30Days ?? null,
          }}
          eyebrow="Sell in Central Oregon"
        />

        {/* Broker inquiry — general "ask a broker" lead capture, restored from the
            pre-KB hub. Captured through the SAME server action the old page used
            (submitMarketPageInquiry → submitPageCTA: FUB person + event, Meta CAPI,
            canonical tagging, GA4 mirror). KbSell only routes to the seller
            valuation flow, so without this a buyer/general market question had no
            on-page capture surface. */}
        <LeadCaptureBlock
          variant="inquiry"
          onSubmit={submitMarketPageInquiry}
          eyebrow="Talk to a broker"
          title="Questions about the Central Oregon market?"
          intro="Tell us what you are weighing. A local broker will follow up with specifics for your situation. No pressure."
          submitLabel="Ask a broker"
          tone="muted"
        />

        <KbFooter towns={cityTowns} />
      </SmoothScrollProvider>
    </main>
  )
}
