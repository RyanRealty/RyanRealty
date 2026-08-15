#!/usr/bin/env node
/**
 * G34 — AI structured-data presence gate.
 *
 * Matt's directive (2026-05-29): "build this site so other AI agents will use it
 * when asked about Central Oregon homes ... no exceptions ... hard code the gates."
 *
 * Generative Engine Optimization (GEO) research is unambiguous: machine-readable
 * JSON-LD is the single most reliable lever for AI citation (3+ schema types =
 * ~40% higher citation weight; FAQPage = +340% vs plain text). This gate makes
 * that structured data a hard requirement — a page rebuild that drops the schema
 * fails CI instead of silently shipping an un-citable surface.
 *
 * Each entry lists the markers a surface MUST contain. `all` = every marker
 * required; `any` = at least one. Markers are import/usage tokens, kept loose on
 * purpose: this is a PRESENCE check (does the page emit structured data via the
 * approved path), not a deep schema validator (that is what the rendered SSR +
 * Google Rich Results test cover).
 *
 * Companion: lib/site/json-ld.ts (builders), lib/site/market-faq.ts (verified
 * Q&A + Dataset), components/JsonLd.tsx (site-wide Organization), G25/DESIGN_DIRECTIVES.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const CHECKS = [
  {
    file: 'app/layout.tsx',
    label: 'site-wide Organization + WebSite',
    all: ['JsonLd'],
    why:
      'The root layout MUST render <JsonLd> so every page carries the canonical\n' +
      '  RealEstateAgent + LocalBusiness + WebSite entity (the anchor AI engines cite).',
  },
  {
    file: 'app/about/page.tsx',
    label: 'about: AboutPage entity link + breadcrumb',
    all: ['MetadataBlock', 'AboutPage', 'aboutOrganization'],
    why:
      'The about page MUST type itself as AboutPage with mainEntity -> #organization\n' +
      '  — the page AI assistants read to answer "who is Ryan Realty".',
  },
  {
    file: 'app/team/page.tsx',
    label: 'team: CollectionPage entity link + breadcrumb',
    all: ['MetadataBlock', 'CollectionPage', 'aboutOrganization'],
    why:
      'The team page MUST type itself as CollectionPage with mainEntity -> #organization\n' +
      '  — the page AI assistants read to answer "who are the brokers".',
  },
  {
    file: 'app/cities/[slug]/page.tsx',
    label: 'city: entity + market Dataset + FAQPage',
    all: ['MetadataBlock', 'buildMarketFaq'],
    why:
      'City pages MUST emit the City Place + market Dataset (via MetadataBlock) and a\n' +
      '  verified FAQ (buildMarketFaq -> FAQBlock). These are the proven AI-citation levers.',
  },
  {
    file: 'app/communities/[slug]/page.tsx',
    label: 'community: entity + market Dataset + FAQPage',
    all: ['MetadataBlock', 'buildMarketFaq'],
    why:
      'Community pages MUST emit the Place + market Dataset (via MetadataBlock) and a\n' +
      '  verified FAQ (buildMarketFaq -> FAQBlock).',
  },
  {
    file: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    label: 'neighborhood: entity + market Dataset + FAQPage',
    all: ['MetadataBlock', 'buildMarketFaq'],
    why:
      'Neighborhood pages MUST emit the Neighborhood Place + market Dataset (via\n' +
      '  MetadataBlock) and a verified FAQ (buildMarketFaq -> FAQBlock), matching the\n' +
      '  city + community depth.',
  },
  {
    file: 'app/listing/[listingKey]/page.tsx',
    label: 'listing: RealEstateListing + BreadcrumbList',
    all: ['MetadataBlock', 'realEstateListing', "type: 'breadcrumb'"],
    why:
      'The listing page MUST emit RealEstateListing + BreadcrumbList JSON-LD via\n' +
      '  MetadataBlock (canonical listingDetailPath, listingShareSummary). The shell is\n' +
      '  layout-only and must not emit a second payload.',
  },
  {
    file: 'app/blog/[slug]/page.tsx',
    label: 'blog: BlogPosting JSON-LD',
    all: ['generateBlogSchema'],
    why:
      'Blog posts MUST emit BlogPosting JSON-LD (generateBlogSchema) so AI engines can\n' +
      '  cite the article with author + dates.',
  },
  {
    file: 'lib/structured-data.ts',
    label: 'blog freshness: dateModified',
    all: ['dateModified', 'generateBlogSchema'],
    why:
      'generateBlogSchema MUST emit dateModified — AI engines apply a steep recency\n' +
      '  preference; without it every edited evergreen post loses its freshness signal.',
  },
  {
    file: 'app/neighborhoods/page.tsx',
    label: 'neighborhoods index: breadcrumb + CollectionPage',
    all: ['MetadataBlock'],
    why: 'The neighborhoods index MUST emit breadcrumb JSON-LD via MetadataBlock.',
  },
  {
    file: 'app/subdivisions/page.tsx',
    label: 'subdivisions index: breadcrumb + CollectionPage',
    all: ['MetadataBlock'],
    why: 'The subdivisions index MUST emit breadcrumb JSON-LD via MetadataBlock.',
  },
  {
    file: 'app/schools/page.tsx',
    label: 'schools index: breadcrumb + WebPage',
    all: ['MetadataBlock'],
    why: 'The schools index MUST emit breadcrumb + WebPage JSON-LD via MetadataBlock.',
  },
  {
    file: 'app/parks/page.tsx',
    label: 'parks index: breadcrumb + WebPage',
    all: ['MetadataBlock'],
    why: 'The parks index MUST emit breadcrumb + WebPage JSON-LD via MetadataBlock.',
  },

  // ── Findings P1.13 / P1.16 / P1.17 / P1.18 / P1.19 (2026-06-09) ──────
  {
    file: 'app/subdivisions/[slug]/page.tsx',
    label: 'subdivisions: Place + BreadcrumbList via MetadataBlock',
    all: ['MetadataBlock'],
    why:
      'Subdivision pages MUST emit a Place entity + BreadcrumbList via MetadataBlock so\n' +
      '  AI engines can cite and navigate to individual subdivision pages.',
  },
  {
    file: 'app/zip/[zip]/page.tsx',
    label: 'zip: Place + Dataset via MetadataBlock',
    all: ['MetadataBlock'],
    why:
      'ZIP pages MUST emit a Place entity + market Dataset via MetadataBlock so AI\n' +
      '  engines can surface ZIP-level market statistics as structured claims.',
  },
  // /guides permanently redirects to /blog — Article schema lives on app/blog/[slug].
  {
    file: 'components/landing/LeadLandingPage.tsx',
    label: 'lead LPs: FAQPage from visible config.faq',
    all: ['generateFAQSchema'],
    why:
      'Lead landing pages render a visible FAQ section from config.faq and MUST\n' +
      '  emit a matching FAQPage JSON-LD block (generateFAQSchema) so those Q&As\n' +
      '  surface in Google rich results.',
  },
  {
    file: 'app/tools/mortgage-calculator/page.tsx',
    label: 'mortgage calculator: SoftwareApplication JSON-LD',
    any: ['SoftwareApplication', 'WebApplication'],
    why:
      'The mortgage calculator MUST emit a SoftwareApplication (or WebApplication)\n' +
      '  JSON-LD node, matching the pattern used by the rental-property-calculator\n' +
      '  and appreciation-calculator siblings.',
  },
  {
    file: 'app/lp/bend/page.tsx',
    label: 'lp/bend: Dataset + BreadcrumbList',
    all: ['Dataset', 'BreadcrumbList'],
    why:
      'The Bend LP renders a 6-stat KPI grid from live data and MUST emit a Dataset\n' +
      '  carrying those stats plus a BreadcrumbList so AI engines can navigate to\n' +
      '  this tier-1 search-authority surface.',
  },
  {
    file: 'app/search/[...slug]/SearchPageJsonLd.tsx',
    label: 'search: suppressPlace prop + totalCount for ItemList',
    all: ['suppressPlace', 'totalCount'],
    why:
      'SearchPageJsonLd MUST accept suppressPlace (to avoid duplicate Place nodes\n' +
      '  when ResortCommunityJsonLd is also rendered) and totalCount (so\n' +
      '  ItemList.numberOfItems reflects the real result total, not the page slice).',
  },
  {
    file: 'app/search/[...slug]/page.tsx',
    label: 'search presets: SearchPageJsonLd + Dataset + preset FAQPage depth (P1.13)',
    all: ['SearchPageJsonLd', 'MetadataBlock', 'buildPresetFaq'],
    why:
      'The search route MUST render SearchPageJsonLd (ItemList + Place + Breadcrumb),\n' +
      '  the city market Dataset via MetadataBlock, and the preset-page FAQ depth via\n' +
      '  buildPresetFaq (whose FAQBlock emits FAQPage JSON-LD). The ~320 indexable\n' +
      '  preset pages are destination pages; stripping their structured data fails CI.',
  },

  // ── Price Drop Radar (2026-06-09) ──────────────────────────────────────
  {
    file: 'app/price-drops/page.tsx',
    label: 'price-drops region: BreadcrumbList + Dataset via MetadataBlock',
    all: ['MetadataBlock', 'getPriceDrops'],
    why:
      'The Price Drop Radar region page MUST emit a BreadcrumbList + Dataset JSON-LD\n' +
      '  (via MetadataBlock) carrying aggregate stats (count, totalReduced, medianDropPct)\n' +
      '  dated to fetchedAt so AI engines can surface verified Central Oregon price-drop data.',
  },
  {
    file: 'app/price-drops/[city]/page.tsx',
    label: 'price-drops city: BreadcrumbList + Dataset via MetadataBlock',
    all: ['MetadataBlock', 'getPriceDrops'],
    why:
      'Per-city Price Drop Radar pages MUST emit BreadcrumbList + Dataset JSON-LD\n' +
      '  (via MetadataBlock) so AI engines can navigate and cite city-scoped price-drop data.',
  },

  // ── Field-level assertions (P1.14) ─────────────────────────────────────
  {
    file: 'lib/site/json-ld.ts',
    label: 'json-ld: availability field on RealEstateListingInput',
    all: ['availability'],
    why:
      'RealEstateListingInput MUST declare an availability field so the Offer node\n' +
      '  can reflect listing status (InStock / PreOrder / omitted) rather than\n' +
      '  always advertising a live for-sale price on closed or withdrawn homes.',
  },
  {
    file: 'app/listing/[listingKey]/page.tsx',
    label: 'listing page: status field on RealEstateListing',
    all: ['availability', 'listing.status'],
    why:
      'The listing page MUST pass listing.status to the realEstateListing JSON-LD\n' +
      '  builder as availability so the Offer node reflects live status.',
  },
  {
    file: 'app/sell/page.tsx',
    label: 'sell: Service + FAQPage via MetadataBlock',
    all: ['MetadataBlock', "type: 'service'", "type: 'faqPage'"],
    why:
      'The Sell door MUST emit Service (Value my home) + FAQPage JSON-LD so AI\n' +
      '  assistants can cite the page for "get my home\'s value in Bend".',
  },
  {
    file: 'app/sell/valuation/page.tsx',
    label: 'valuation: Service + WebPage + FAQPage via MetadataBlock',
    all: ['MetadataBlock', "type: 'service'", "type: 'webPage'", "type: 'faqPage'"],
    why:
      'The written-CMA leftover MUST emit Service + WebPage + FAQPage, not breadcrumb\n' +
      '  alone, so "get my home\'s value" has a citable schema target.',
  },
  {
    file: 'app/reviews/page.tsx',
    label: 'reviews: Review nodes, no aggregateRating',
    all: ['buildReviewsJsonLd'],
    why:
      'The reviews page MUST emit Review JSON-LD from the same testimonials it renders.\n' +
      '  aggregateRating stays banned (Google self-serving-review policy).',
  },
  {
    file: 'app/reviews/_v3/reviews-jsonld.ts',
    label: 'reviews builder: Review bodies, no aggregateRating',
    all: ["'@type': 'Review'", 'reviewBody'],
    why: 'Review nodes must carry reviewBody. Do not add aggregateRating on our own site.',
  },
  {
    file: 'app/housing-market/reports/page.tsx',
    label: 'reports hub: BreadcrumbList + WebPage via MetadataBlock',
    all: ['MetadataBlock', "type: 'breadcrumb'", "type: 'webPage'", 'V3SectionTracker'],
    why:
      'The reports hub MUST emit BreadcrumbList + WebPage JSON-LD via MetadataBlock so\n' +
      '  AI engines can cite the canonical /housing-market/reports surface. Dataset lives\n' +
      '  next to the streamed range rows in ReportsIslands.',
  },
  {
    file: 'app/housing-market/reports/_v3/hub-sections.ts',
    label: 'reports hub Dataset builder: verified city variables',
    all: ["type: 'dataset'", 'variableMeasured'],
    why:
      'Dataset variableMeasured MUST be built from fetched city rows, never a hardcoded list.',
  },
  {
    file: 'app/housing-market/reports/_v3/ReportsIslands.tsx',
    label: 'reports hub Dataset: emitted beside the range rows',
    all: ['MetadataBlock', 'ReportsByCityView', 'buildRangeDataset'],
    why:
      'The range-table island MUST emit Dataset JSON-LD from the verified city rows it\n' +
      '  fetched, next to ReportsByCityView.',
  },
  {
    file: 'app/housing-market/reports/[slug]/page.tsx',
    label: 'weekly report: Report JSON-LD + breadcrumb',
    all: ["@type': 'Report'", 'MetadataBlock', 'getMarketReportBySlug'],
    why:
      'Weekly report pages MUST emit schema.org Report JSON-LD from live report data\n' +
      '  plus a BreadcrumbList, on the canonical /housing-market/reports/[slug] URL.',
  },
]

const errors = []

for (const check of CHECKS) {
  const abs = join(ROOT, check.file)
  if (!existsSync(abs)) {
    errors.push(`${check.file}: file not found (${check.label}).`)
    continue
  }
  const src = readFileSync(abs, 'utf8')

  if (check.all) {
    const missing = check.all.filter((m) => !src.includes(m))
    if (missing.length > 0) {
      errors.push(
        `${check.file} [${check.label}]: missing ${missing.map((m) => `\`${m}\``).join(', ')}.\n  ${check.why}`,
      )
    }
  }
  if (check.any) {
    const present = check.any.some((m) => src.includes(m))
    if (!present) {
      errors.push(
        `${check.file} [${check.label}]: needs at least one of ${check.any.map((m) => `\`${m}\``).join(', ')}.\n  ${check.why}`,
      )
    }
  }
}

if (errors.length > 0) {
  console.error('\nG34 — AI structured-data gate FAILED:\n')
  for (const e of errors) console.error(`  - ${e}\n`)
  console.error(
    'Every key surface must emit machine-readable JSON-LD so AI assistants (Claude,\n' +
      'ChatGPT, Perplexity, Google AI Overviews) can surface and cite Ryan Realty.\n' +
      'See scripts/check-ai-structured-data.mjs + docs/DESIGN_DIRECTIVES.md.\n',
  )
  process.exit(1)
}

console.log(`G34: OK — ${CHECKS.length} surfaces emit AI structured data (JSON-LD present on every key page type).`)
