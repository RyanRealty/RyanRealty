/**
 * Housing market hub — Central Oregon entry / navigation page.
 *
 * Converted to the KB (kinetic-brutalist) design system (Phase 9).
 * Reuses components/site/kb/* AS-IS; no fork.
 *
 * This is the navigation / overview page. The deep, AI-citable region REPORT
 * (Dataset + FAQ + price chart + city comparison + narrative) lives at
 * /housing-market/central-oregon. The hub deliberately does NOT duplicate the
 * region Dataset/FAQ, so the two URLs do not compete on the same query.
 *
 * THE PAGE CONTRACT: KB design + SEO (pageMetadata + MetadataBlock JSON-LD:
 * BreadcrumbList/WebPage) + KbSectionTracker pageType="market-report".
 * Every figure live and traced to a @/lib/data source (§0).
 *
 * Section order:
 *   1. MetadataBlock    — breadcrumb + webPage JSON-LD (no Dataset; that lives
 *      on /housing-market/central-oregon so the hub and report never compete)
 *   2. KbNav            — KB chrome
 *   3. KbSectionTracker — page-level analytics (pageType="market-report")
 *   4. KbBreadcrumb     — Home > Housing market
 *   5. SmoothScrollProvider wrapper
 *   6. KbHero           — region eyebrow + glance lede (data-driven)
 *   7. KbExploreTowns   — per-city tiles with live active counts
 *   8. KbArticles       — cross-links to region report + blog posts
 *   9. KbSell           — seller conversion CTA
 *  10. KbFooter         — full sitemap close
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
  const [regionPulse, citySnapshots, blogPosts] = await Promise.all([
    getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => null),
    getMarketPulseCitySnapshots(CITY_LABELS).catch(() => []),
    getRecentBlogPosts({ limit: 3 }).catch(() => []),
  ])

  // -------------------------------------------------------------------------
  // KbHero lede — data-driven from the region pulse (§0).
  // No Dataset JSON-LD here; the /central-oregon report owns the citable data.
  // -------------------------------------------------------------------------
  const ledeParts: string[] = []
  if (regionPulse && regionPulse.activeCount > 0) {
    ledeParts.push(
      `${regionPulse.activeCount.toLocaleString()} single-family homes active across Central Oregon.`,
    )
  }
  if (regionPulse?.medianListPrice != null) {
    const r = Math.round(regionPulse.medianListPrice / 1000) * 1000
    ledeParts.push(`Region median list price $${r.toLocaleString()}.`)
  }
  if (regionPulse?.monthsOfSupply != null) {
    const mos = Math.round(regionPulse.monthsOfSupply * 10) / 10
    let verdict = 'balanced market'
    if (mos <= 4) verdict = "seller's market"
    else if (mos >= 6) verdict = "buyer's market"
    ledeParts.push(`${mos} months of supply: ${verdict}.`)
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
  // JSON-LD — BreadcrumbList + WebPage only.
  // Dataset + FAQPage live on /housing-market/central-oregon (the region report)
  // so the hub and the report never emit the same structured market data.
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

  return (
    <main className="kb-root">
      {/* AI-citability: breadcrumb + webPage only. KbBreadcrumb has no JSON-LD
          of its own; MetadataBlock emits the single BreadcrumbList. */}
      <MetadataBlock schemas={schemas} />

      <KbNav />
      <KbSectionTracker pageType="market-report" />

      {/* Breadcrumb visual — Home > Housing market */}
      <KbBreadcrumb
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

        {/* Sell CTA — feeds off region pulse figures (§0) */}
        <KbSell
          data={{
            medianListPrice: regionPulse?.medianListPrice ?? null,
            medianDaysToPending: regionPulse?.medianDaysToPending ?? null,
            soldCount30d: regionPulse?.closedLast30Days ?? null,
          }}
          eyebrow="Sell in Central Oregon"
        />

        <KbFooter towns={cityTowns} />
      </SmoothScrollProvider>
    </main>
  )
}
