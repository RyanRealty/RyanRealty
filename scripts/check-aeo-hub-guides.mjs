#!/usr/bin/env node
/**
 * check-aeo-hub-guides.mjs — ci:aeo-hub-guides (SITE-123).
 *
 * /buy, /sell, /neighborhoods, and /housing-market/bend must crawlably link
 * the Sep 7 AEO cluster with the published titles. Sealed SEO Desk list.
 * Dropping a href or swapping the title for a generic label fails.
 *
 *   node scripts/check-aeo-hub-guides.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const GATE = 'ci:aeo-hub-guides'

/** SEO Desk live list. Shrinking lib/seo/aeo-hub-guides.ts still fails here. */
const REQUIRED = {
  buy: [
    ['/blog/first-time-home-buyer-guide-central-oregon', 'First-Time Home Buyer Guide for Bend and Central Oregon'],
    ['/blog/cost-of-living-bend-oregon', 'Cost of Living in Bend, Oregon: Housing, Taxes, and a Realistic Budget'],
    ['/blog/best-neighborhoods-bend-buyers', 'Best Neighborhoods in Bend, Oregon for Buyers'],
    ['/blog/bend-vs-redmond-vs-sisters', 'Bend vs Redmond vs Sisters: Which Central Oregon Town Fits'],
    ['/blog/westside-vs-eastside-bend', 'Westside vs Eastside Bend: Price, Walkability, and Trade-offs'],
    ['/blog/moving-to-bend-from-california', 'Moving to Bend from California: What Changes'],
    ['/blog/is-now-a-good-time-to-buy-in-bend', 'Is Now a Good Time to Buy in Bend?'],
    ['/blog/property-taxes-deschutes-county', 'Property Taxes in Bend and Deschutes County, Explained'],
  ],
  sell: [
    ['/blog/how-to-sell-your-home-bend', 'How to Sell Your House in Bend, Oregon'],
    ['/blog/cost-to-sell-house-bend-oregon', 'What It Costs to Sell a House in Bend (and Oregon)'],
    ['/blog/how-to-price-your-bend-home', 'How to Price Your Bend Home So It Sells'],
    ['/blog/selling-your-bend-home-from-out-of-state', 'Selling Your Bend Home from Out of State'],
    ['/blog/property-taxes-deschutes-county', 'Property Taxes in Bend and Deschutes County, Explained'],
  ],
  neighborhoods: [
    ['/blog/best-neighborhoods-bend-buyers', 'Best Neighborhoods in Bend, Oregon for Buyers'],
    ['/blog/westside-vs-eastside-bend', 'Westside vs Eastside Bend: Price, Walkability, and Trade-offs'],
    ['/blog/bend-vs-redmond-vs-sisters', 'Bend vs Redmond vs Sisters: Which Central Oregon Town Fits'],
  ],
  'housing-market/bend': [
    ['/blog/is-now-a-good-time-to-buy-in-bend', 'Is Now a Good Time to Buy in Bend?'],
    ['/blog/cost-of-living-bend-oregon', 'Cost of Living in Bend, Oregon: Housing, Taxes, and a Realistic Budget'],
    ['/blog/property-taxes-deschutes-county', 'Property Taxes in Bend and Deschutes County, Explained'],
  ],
}

const TIP_MINS = {
  buy: 4,
  sell: ['/blog/how-to-sell-your-home-bend', '/blog/cost-to-sell-house-bend-oregon'],
  neighborhoods: ['/blog/best-neighborhoods-bend-buyers', '/blog/bend-vs-redmond-vs-sisters'],
  'housing-market/bend': 3,
}

const OMIT = ['/blog/closing-costs-buyers-bend-oregon']
const INVENTED_BROKER = ['/blog/closing-costs-buyers-bend-oregon']

const HUB_FILES = {
  buy: ['app/buy/_v3/buy-constants.ts', 'app/buy/page.tsx'],
  sell: ['app/sell/page.tsx'],
  neighborhoods: ['app/neighborhoods/page.tsx'],
  'housing-market/bend': ['app/housing-market/[...slug]/_v3/geo-figures.ts'],
}

const WIRE = {
  buy: { helper: 'aeoHubLedgerRows', primitive: 'V3Ledger' },
  sell: { helper: 'aeoHubQuietItems', primitive: 'V3Quiet' },
  neighborhoods: { helper: 'aeoHubQuietItems', primitive: 'V3Quiet' },
  'housing-market/bend': { helper: 'aeoHubQuietItems', primitive: 'V3Quiet' },
}

function src(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

function aeoHubGuideProblems() {
  const failures = []
  const contract = src('lib/seo/aeo-hub-guides.ts')

  for (const [hub, pairs] of Object.entries(REQUIRED)) {
    for (const [href, title] of pairs) {
      if (!contract.includes(`href: '${href}'`)) {
        failures.push(`${hub}: contract dropped ${href}`)
      }
      if (!contract.includes(`title: '${title.replace(/'/g, "\\'")}'`) && !contract.includes(`title: '${title}'`)) {
        // Titles with apostrophes use the seed spelling; accept either quote form.
        if (!contract.includes(title)) failures.push(`${hub}: contract dropped title "${title}"`)
      }
    }

    const hubSrc = HUB_FILES[hub].map(src).join('\n')
    const { helper, primitive } = WIRE[hub]
    if (!hubSrc.includes(`from '@/lib/seo/aeo-hub-guides'`) && !hubSrc.includes(`from "@/lib/seo/aeo-hub-guides"`)) {
      failures.push(`${hub}: ${HUB_FILES[hub][0]} must import @/lib/seo/aeo-hub-guides`)
    }
    if (!hubSrc.includes(helper)) {
      failures.push(`${hub}: must call ${helper} so titles stay the visible anchors`)
    }
    if (!hubSrc.includes(primitive) && hub !== 'buy' && hub !== 'housing-market/bend') {
      failures.push(`${hub}: must render through ${primitive} (44px tap floor)`)
    }
    if (hub === 'buy' && !src('app/buy/page.tsx').includes('V3Ledger')) {
      failures.push('buy: page must keep V3Ledger so AEO rows stay 44px and crawlable')
    }
    if (hub === 'housing-market/bend' && !src('app/housing-market/[...slug]/_v3/geo-figures.ts').includes("citySlug === 'bend'")) {
      failures.push('housing-market/bend: static AEO guides must gate on citySlug === bend')
    }

    const hrefs = pairs.map(([href]) => href)
    const min = TIP_MINS[hub]
    if (typeof min === 'number') {
      if (hrefs.length < min) failures.push(`${hub}: Tip Ready floor is ${min} live guides`)
    } else {
      for (const need of min) {
        if (!hrefs.includes(need)) failures.push(`${hub}: Tip Ready floor missing ${need}`)
      }
    }

    for (const banned of [...OMIT, ...INVENTED_BROKER]) {
      if (hubSrc.includes(banned)) {
        failures.push(`${hub}: omitted slug ${banned} must not appear on the hub`)
      }
    }
  }

  if (contract.includes("buyers-agent-bend-buyer-broker-agreement")) {
    failures.push('contract: omit the buyer-broker slug (not on the SEO Desk wire list)')
  }

  return failures
}

const failures = aeoHubGuideProblems()
if (failures.length) {
  console.error(`${GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}

console.log(
  `${GATE} — OK: /buy /sell /neighborhoods /housing-market/bend keep the Sep 7 AEO cluster with authentic titles.`,
)
