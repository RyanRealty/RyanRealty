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
    label: 'neighborhood: structured data present',
    any: ['MetadataBlock', 'application/ld+json'],
    why:
      'Neighborhood pages MUST emit structured data (Place + BreadcrumbList).\n' +
      '  FOLLOW-UP: migrate to MetadataBlock + buildMarketFaq (market Dataset + FAQ) in\n' +
      '  the Wave 3 neighborhood rebuild so it matches city/community depth.',
  },
  {
    file: 'components/site/listing-detail/ListingDetailShell.tsx',
    label: 'listing: RealEstateListing + BreadcrumbList',
    all: ['MetadataBlock'],
    why:
      'The listing detail shell MUST emit the RealEstateListing + BreadcrumbList JSON-LD\n' +
      '  via MetadataBlock (the listing page renders this shell).',
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
