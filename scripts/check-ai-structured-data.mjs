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
    file: 'components/site/listing-detail/ListingDetailShell.tsx',
    label: 'listing: RealEstateListing + BreadcrumbList',
    all: ['MetadataBlock'],
    why:
      'The listing detail shell MUST emit the RealEstateListing + BreadcrumbList JSON-LD\n' +
      '  via MetadataBlock (the listing page renders this shell).',
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
    file: 'app/area-guides/page.tsx',
    label: 'area-guides: breadcrumb + WebPage',
    all: ['MetadataBlock'],
    why: 'The area-guides index MUST emit breadcrumb + WebPage JSON-LD via MetadataBlock.',
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
