/**
 * Housing market hub — Central Oregon entry / navigation page.
 *
 * Data ONLY through @/lib/data (G8). Composes site v2 blocks per parity.json.
 * Mockup: design_system/ryan-realty/ui_kits/market-report/index.html
 * Parity: design_system/ryan-realty/ui_kits/market-report/parity.json
 *
 * This is the navigation / overview page. The deep, AI-citable region REPORT
 * (Dataset + FAQ + price chart + city comparison + narrative) lives at
 * /housing-market/central-oregon. The hub deliberately does NOT duplicate the
 * region Dataset/FAQ, so the two URLs do not compete on the same query.
 *
 * Section order:
 *   1. MetadataBlock — breadcrumb + webPage JSON-LD (no Dataset; that is the
 *      region report's signal)
 *   2. BreadcrumbNav — Home > Housing market
 *   3. HeroBlock — DisplayHeading H1 + region glance lede
 *   4. MarketSnapshot — region-level 4-stat band (no citySlug = region)
 *   5. RelatedAreas — per-city tiles with live active counts (the nav core)
 *   6. ContentSection — cross-links (region report, explore, cities, etc.)
 *   7. LeadCaptureBlock — broker inquiry
 *   8. CTABar — navy broker contact band
 *
 * Data accuracy (CLAUDE.md §0):
 *   - Region glance via getMarketPulse({geoType:'region', geoSlug:'central-oregon'})
 *     from market_pulse_live, property_type='A'. Same source MarketSnapshot uses.
 *   - City active counts via getMarketPulseCitySnapshots; displayed counts are
 *     the exact values returned, no rounding.
 */

import type { Metadata } from 'next'
import { getMarketPulse, getMarketPulseCitySnapshots } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { RelatedAreaItem } from '@/components/site/RelatedAreas'

import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import { RelatedAreas } from '@/components/site/RelatedAreas'
import { ContentSection } from '@/components/site/ContentSection'
import { LeadCaptureBlock } from '@/components/site/LeadCaptureBlock'
import { CTABar } from '@/components/site/CTABar'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { Container } from '@/components/site/primitives'
import { submitMarketPageInquiry } from '@/app/housing-market/actions'

export const revalidate = 300

// ---------------------------------------------------------------------------
// Central Oregon cities — drive the per-city navigation tiles.
// ---------------------------------------------------------------------------

const CENTRAL_OREGON_CITY_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Terrebonne',
]

const CITY_SLUG_MAP: Record<string, string> = {
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
  // §0 trace:
  //   regionPulse   — market_pulse_live, geo_type='region', geo_slug='central-oregon',
  //                   property_type='A'. Source: getMarketPulse.
  //   citySnapshots — market_pulse_live, geo_type='city', geo_label IN labels,
  //                   property_type='A'. Source: getMarketPulseCitySnapshots.
  const [regionPulse, citySnapshots] = await Promise.all([
    getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => null),
    getMarketPulseCitySnapshots(CENTRAL_OREGON_CITY_LABELS).catch(() => []),
  ])

  // Hero lede — a region glance from regionPulse (same source MarketSnapshot
  // uses, so the hero and the stat band can never disagree). No structured
  // Dataset here; the /central-oregon report owns the citable region data.
  const ledeParts: string[] = []
  if (regionPulse && regionPulse.activeCount > 0) {
    ledeParts.push(`${regionPulse.activeCount.toLocaleString()} single-family homes active across Central Oregon.`)
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
  const lede = ledeParts.join(' ')

  // JSON-LD — breadcrumb + webPage only. The region Dataset + FAQPage live on
  // the /housing-market/central-oregon report so the two pages do not emit the
  // same structured market data.
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

  // City tiles — live active counts from the snapshot fan-out.
  const relatedItems: RelatedAreaItem[] = citySnapshots
    .filter((s) => CITY_SLUG_MAP[s.geo_label] !== undefined)
    .map((s) => ({
      name: s.geo_label,
      href: `/housing-market/${CITY_SLUG_MAP[s.geo_label] ?? s.geo_slug}`,
      activeCount: s.active_count > 0 ? s.active_count : null,
    }))

  // Fill in any city that returned no snapshot row (zero active = no row).
  const coveredLabels = new Set(relatedItems.map((r) => r.name))
  for (const label of CENTRAL_OREGON_CITY_LABELS) {
    if (!coveredLabels.has(label) && CITY_SLUG_MAP[label]) {
      relatedItems.push({
        name: label,
        href: `/housing-market/${CITY_SLUG_MAP[label]}`,
        activeCount: null,
      })
    }
  }

  return (
    <main className="min-h-screen bg-background">

      {/* AI-citability: breadcrumb + webPage only. BreadcrumbNav below has
          includeJsonLd=false to avoid a duplicate BreadcrumbList. */}
      <MetadataBlock schemas={schemas} />

      {/* Breadcrumb */}
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          includeJsonLd={false}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Housing market' },
          ]}
        />
      </Container>

      {/* Hero — DisplayHeading H1 in Amboqia via HeroBlock; lede is a region glance. */}
      <HeroBlock
        headline="Central Oregon housing market"
        lede={lede || 'Live single-family market data across Central Oregon cities, updated every 15 minutes.'}
        minHeight={460}
      />

      {/* Region glance — no citySlug = region aggregate. */}
      <MarketSnapshot />

      {/* City navigation — live active counts; each tile opens that city's
          full market report. This is the hub's primary job. */}
      {relatedItems.length > 0 ? (
        <RelatedAreas
          eyebrow="By city"
          title="Choose a city market"
          items={relatedItems}
          tone="muted"
          cols={4}
        />
      ) : null}

      {/* Cross-links — design-system tiles. The region report is the deep,
          AI-citable Central Oregon page. */}
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

      {/* Lead capture — broker inquiry, captured via the shared server action. */}
      <LeadCaptureBlock
        variant="inquiry"
        onSubmit={submitMarketPageInquiry}
        eyebrow="Talk to a broker"
        title="Questions about the Central Oregon market?"
        intro="Tell us what you are weighing. A local broker will follow up with specifics for your situation. No pressure."
        submitLabel="Ask a broker"
        tone="muted"
      />

      {/* CTA bar — navy broker contact band. */}
      <CTABar
        eyebrow="Questions about Central Oregon?"
        title="Local brokers. Specific numbers. No pressure."
        body="We close deals across Central Oregon. We can tell you what the data means for your situation."
        primary={{ href: '/contact', label: 'Schedule a call' }}
        secondary={{ href: 'tel:5412136706', label: '541.213.6706' }}
        tone="navy"
      />

    </main>
  )
}
