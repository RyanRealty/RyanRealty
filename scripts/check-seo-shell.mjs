#!/usr/bin/env node
/**
 * ci:seo-shell — Layer A forever-gate.
 *
 * Money-route discovery shells (title + H1 + lead + KbHero defaults) must stay
 * query language: place + type + head terms. Buffett personality lives under
 * the H1 (Layer B) only.
 *
 * Law (TOP_SITE_GOAL_SYSTEM / VOICE Layer A):
 *   if someone would type it into Google, it stays Layer A — never poetry-ized.
 *
 * Checks:
 *   1. Required exact-match head terms per money family (cannot drift)
 *   2. The homepage hero lock (KbHero defaults if it ever returns; else the v3
 *      Stage literal in app/page.tsx)
 *
 * The banned-poetry phrase list (11 patterns: "we show the work", "where the
 * desert meets", ...) was removed 2026-09-23 (visibility audit PROCESS-7,
 * Matt 2026-09-23 directive): VOICE.md is the one voice document and names no
 * word list. The head-term contract stays, because it is SEO, not voice: it
 * pins the query a searcher types to the H1 and title of each money route.
 *
 * Usage:
 *   node scripts/check-seo-shell.mjs
 *   npm run ci:seo-shell
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

// Exact-match contracts: head terms that must remain on specific money shells.
// Patterns match source as authored (literals + template literal static parts).
const REQUIRED = [
  {
    file: 'app/page.tsx',
    // Home lock 2026-09-06: visible Stage H1 is the buyer job line. Brand stays
    // in metadata title/OG only (absolute, brand first). KB spelled the
    // H1 as titleTop/titleBottom; v3 takes `headline`. BOTH ARMS ARE EXACT
    // LITERALS. D11 lead sentence must appear as a literal in this file
    // (the gate does not scan app/_v3/).
    checks: [
      {
        re: /titleTop\s*=\s*["']Central Oregon["'][\s\S]{0,800}titleBottom\s*=\s*["']Homes for Sale["']|headline=\{v3Text\('Homes for sale in Central Oregon'\)\}|heading\s*=\s*["']Homes for sale in Central Oregon["']/,
        msg: 'H1 must be buyer job line: Homes for sale in Central Oregon (brand stays in metadata title/OG)',
      },
      {
        re: /Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne\. Live list prices and days on market\./,
        msg: 'D11 homepage town list must appear as an exact literal in app/page.tsx',
      },
      {
        re: /<HomeHeroSearch/,
        msg: 'Homepage Stage action is search (HomeHeroSearch), not a leftover count sentence',
      },
      {
        // gsc-trend-11 (visibility audit 2026-09-22, Matt 2026-09-23 "nothing is
        // permanent"): the brand now LEADS the title. The 2026-09-07 keyword
        // title carried it as the tail and / ranked p45 for "ryan realty" in
        // both July and September (GSC API) while /?utm_source=gbp ranked p3.
        // The head term stays exactly "Homes for Sale in Central Oregon"; "Bend"
        // rides with the brand so /homes-for-sale/bend keeps "Bend homes for sale".
        re: /title:\s*\{\s*absolute:\s*['"]Ryan Realty, Bend \| Homes for Sale in Central Oregon['"]/,
        msg: 'metadata title must be "Ryan Realty, Bend | Homes for Sale in Central Oregon" (gsc-trend-11, 2026-09-23; absolute, so the layout suffix does not double the brand)',
      },
    ],
  },
  {
    file: 'app/cities/[slug]/page.tsx',
    // The FACT this locks is the money-route head term in the H1, not the prop
    // that carries it. KB spelled the city H1 as titleTop/titleBottom; the v3
    // register has no such prop, its patterns take `headline`
    // (V3InstrumentProps.headline). Writing a prop literally named titleBottom on
    // a v3 page to satisfy a regex would be gate-gaming, so the check accepts
    // either register's spelling.
    //
    // City grain bids "{city} real estate". Inventory "{city} homes for sale"
    // stays on /homes-for-sale/{city}. Matt 2026-09-22: stop the twin.
    checks: [
      {
        re: /placeCityRealEstateHeading\(\s*cityName\s*\)|[`'"]\$\{cityName\} real estate\b/,
        msg: 'city H1 must be "{city} real estate" (placeCityRealEstateHeading(cityName))',
      },
      {
        re: /publishCityRealEstateTitle\(\s*cityName|placeCityRealEstateHeading\(\s*cityName\s*\)|title:\s*[`'"]\$\{cityName\} real estate/i,
        msg: 'city metadata title must be "{city} real estate" (publishCityRealEstateTitle)',
      },
    ],
  },
  {
    file: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    // Same translation the market hub took (see the note on that entry below):
    // the FACT locked here is the head term and its capitalization, not the prop
    // that carries it. KB spells the H1 as titleTop/titleBottom; the v3 register
    // has no such prop — its patterns take `headline`. Writing a prop literally
    // named titleBottom onto a v3 component to satisfy a regex would be
    // gate-gaming, so the check accepts either register's spelling.
    //
    // BOTH ARMS ARE EXACT, DELIBERATELY. The v3 arm requires a template-literal
    // headline that opens with an interpolation (the place name) followed
    // immediately by the exact sentence-case head term v3 headlines are written
    // in (design_system/public/PUBLIC_UI.md). It does NOT accept "homes for
    // sale" anywhere in any headline: a looser pattern on a money route would be
    // a weaker lock than the KB rule it replaces.
    // docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 3.2.
    checks: [
      {
        re: /titleBottom\s*=\s*["']Homes for Sale["']|headline\s*=\s*\{?\s*(?:v3Text\(\s*)?`\$\{[^`{}]*\}\s+homes for sale\b|neighborhoodHeadline\(\s*neighborhood\.name\s*\)/,
        msg: 'neighborhood H1 must carry the head term: KB titleBottom="Homes for Sale", a v3 headline template `${place} homes for sale`, or neighborhoodHeadline(neighborhood.name)',
      },
    ],
  },
  {
    file: 'app/housing-market/page.tsx',
    // The FACT this locks is the head term and its capitalization, not the prop that
    // carries it. KB spells the H1 as titleTop/titleBottom; the v3 register has no
    // such prop — its patterns take `headline` (V3InstrumentProps.headline). Writing
    // a prop literally named titleBottom on a v3 page to satisfy a regex would be
    // gate-gaming, so the check accepts either register's spelling.
    //
    // BOTH ARMS ARE EXACT LITERALS, DELIBERATELY. The first pass at this translation
    // matched `[Hh]ousing [Mm]arket` anywhere inside any headline literal, which is a
    // LOOSER lock than the KB rule it replaced: it accepts any casing and any
    // surrounding copy on a money route whose head term is the thing being locked.
    // v3 headlines are sentence case (design_system/public/PUBLIC_UI.md), so the KB
    // arm keeps title case and the v3 arm pins the sentence-case string the page
    // actually opens with. Change the page's H1 and this must be changed with it —
    // that is the point of a required contract.
    // docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 3.2, blocker B3.
    checks: [
      {
        re: /titleBottom\s*=\s*["']Housing Market["']|headline\s*=\s*\{?\s*(?:v3Text\(\s*)?[`'"]Central Oregon housing market\b/,
        msg: 'market hub H1 must carry the head term: KB titleBottom="Housing Market", or a v3 headline literal opening "Central Oregon housing market"',
      },
      { re: /title:\s*['"]Central Oregon Housing Market['"]/i, msg: 'market hub title must be "Central Oregon Housing Market"' },
    ],
  },
  {
    file: 'app/sell/page.tsx',
    // The FACT this locks is the head term, not the prop that carries it. KB
    // spelled the H1 as titleTop/titleBottom; the v3 register has no such prop,
    // its patterns take `headline` (V3StageProps.headline). Writing a prop
    // literally named titleTop on a v3 page to satisfy a regex would be
    // gate-gaming. BOTH ARMS ARE EXACT LITERALS. v3 headlines are sentence
    // case (design_system/public/PUBLIC_UI.md), so the KB arm keeps the old
    // titleTop and the v3 arm pins the sentence-case string the page opens
    // with. Change the page's H1 and this must change with it.
    // docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 3.2.
    checks: [
      {
        re: /titleTop\s*=\s*["']Sell your home in["']|headline\s*=\s*\{?\s*(?:v3Text\(\s*)?[`'"]Sell your home in Central Oregon\b/,
        msg: 'sell H1 must carry the head term: KB titleTop="Sell your home in", or a v3 headline literal opening "Sell your home in Central Oregon"',
      },
      { re: /title:\s*['"]Sell Your Home/i, msg: 'sell metadata title must lead with "Sell Your Home"' },
    ],
  },
  {
    file: 'app/open-houses/page.tsx',
    // The FACT this locks is the head term, not the prop that carries it. KB
    // spelled the H1 as titleTop; the v3 register takes `headline` (and the
    // empty branch uses Quiet `heading=`). Both arms are exact literals.
    checks: [
      {
        re: /titleTop\s*=\s*["']Open houses in["']|headline\s*=\s*\{?\s*(?:v3Text\(\s*)?['"]Open houses in Central Oregon\b|heading\s*=\s*["']Open houses in Central Oregon\b/i,
        msg: 'open-houses H1 must carry the head term: KB titleTop="Open houses in", or a v3 headline/heading literal opening "Open houses in Central Oregon"',
      },
      { re: /title:\s*['"]Open Houses/i, msg: 'open-houses metadata title must lead with "Open Houses"' },
    ],
  },
  {
    file: 'app/open-houses/[city]/page.tsx',
    checks: [
      {
        re: /titleTop\s*=\s*["']Open houses in["']|headline\s*=\s*\{?\s*(?:v3Text\(\s*)?`Open houses in \$\{cityName\}|heading\s*=\s*`Open houses in \$\{cityName\}/i,
        msg: 'city open-houses H1 must carry the head term: KB titleTop="Open houses in", or a v3 headline/heading template literal reading `Open houses in ${cityName}`',
      },
      { re: /title:\s*[`'"]Open Houses in/i, msg: 'city open-houses title must lead with "Open Houses in"' },
    ],
  },
  {
    file: 'app/price-drops/page.tsx',
    // Same translation as the market hub: lock the head term, not the prop.
    // KB titleTop was exact "Price Drops". v3 headlines are sentence case, so
    // the v3 arm pins "Price drops in Central Oregon". Empty Quiet uses heading=.
    checks: [
      {
        re: /titleTop\s*=\s*["']Price Drops["']|headline\s*=\s*\{?\s*(?:v3Text\(\s*)?['"]Price drops in Central Oregon\b|heading\s*=\s*["']Price drops in Central Oregon\b/,
        msg: 'price-drops H1 must carry the head term: KB titleTop="Price Drops", or a v3 headline/heading literal opening "Price drops in Central Oregon"',
      },
      { re: /title:\s*['"]Price Drops/i, msg: 'price-drops metadata title must lead with "Price Drops"' },
    ],
  },
  {
    file: 'app/price-drops/[city]/page.tsx',
    checks: [
      {
        re: /titleTop\s*=\s*["']Price Drops["']|headline\s*=\s*\{?\s*(?:v3Text\(\s*)?`Price drops in \$\{cityName\}|heading\s*=\s*`Price drops in \$\{cityName\}/,
        msg: 'city price-drops H1 must carry the head term: KB titleTop="Price Drops", or a v3 headline/heading template literal reading `Price drops in ${cityName}`',
      },
      { re: /title:\s*[`'"]Price Drops in/i, msg: 'city price-drops title must lead with "Price Drops in"' },
    ],
  },
  {
    file: 'app/search/page.tsx',
    checks: [
      { re: /homes for sale/i, msg: 'search index title/H1 builders must use "homes for sale"' },
      {
        re: /return ['"]Central Oregon homes for sale['"]/,
        msg: 'empty-filter title must be "Central Oregon homes for sale"',
      },
      {
        re: /appendIndexableSearchParams\(/,
        msg: 'search index canonical must strip view/bbox via appendIndexableSearchParams',
      },
      {
        re: /shouldNoIndexSearchVariant\(/,
        // gsc-trend-5 (2026-09-23): camera keys view/bbox consolidate through
        // the canonical, not noindex (lib/seo-routing.ts); filters still noindex.
        msg: 'search index must apply the variant noindex policy (filter/sort/page variants)',
      },
    ],
  },
  {
    file: 'app/search/[...slug]/page.tsx',
    checks: [
      {
        re: /placeHomesForSaleHeading\(\s*placeName\s*\)/,
        msg: 'default search H1 must be "{place} homes for sale" (placeHomesForSaleHeading(placeName))',
      },
    ],
  },
]

// ── Run ─────────────────────────────────────────────────────────────────────
const violations = []

// (1) Required exact-match contracts
for (const req of REQUIRED) {
  const abs = join(ROOT, req.file)
  if (!existsSync(abs)) {
    violations.push({
      file: req.file,
      kind: 'missing',
      id: 'file-missing',
      msg: `required money route missing — cannot enforce Layer A contract`,
    })
    continue
  }
  const src = readFileSync(abs, 'utf8')
  for (const check of req.checks) {
    if (!check.re.test(src)) {
      violations.push({
        file: req.file,
        kind: 'required',
        id: check.re.source.slice(0, 40),
        msg: check.msg,
      })
    }
  }
}

// (2) The hero's Layer A lock, wherever the hero lives.
//
// KB era: KbHero carried default titleTop/titleBottom props, so the defaults
// themselves were the poetry footgun and this section pinned them. The 2026-08-27
// v3 rebuild deleted KbHero with its last consumer (app/page.tsx); the hero is
// now the V3Stage mounted IN app/page.tsx, whose headline is a literal this
// gate's REQUIRED block pins (the D11 arm). V3Stage has no default headline,
// so there is no defaults footgun to pin. This branch
// keeps the lock from evaporating: if KbHero ever returns it is re-pinned, and
// while it is gone the v3 hero literal MUST be present in app/page.tsx —
// a homepage with neither spelling fails here as well as in REQUIRED.
const HERO = join(ROOT, 'components/site/kb/KbHero.client.tsx')
if (existsSync(HERO)) {
  const heroSrc = readFileSync(HERO, 'utf8')
  // Defaults are parameter defaults: titleTop = '…', titleBottom = '…'
  const topM = heroSrc.match(/\btitleTop\s*=\s*(['"])([^'"]*)\1/)
  const botM = heroSrc.match(/\btitleBottom\s*=\s*(['"])([^'"]*)\1/)
  const top = topM?.[2] ?? ''
  const bot = botM?.[2] ?? ''
  // Positive lock: defaults must be the homepage Layer A pattern
  if (top !== 'Central Oregon' || bot !== 'Homes for Sale') {
    violations.push({
      file: 'components/site/kb/KbHero.client.tsx',
      kind: 'hero-default',
      id: 'safe-defaults',
      msg: `KbHero defaults must be titleTop="Central Oregon" titleBottom="Homes for Sale" (got ${JSON.stringify(top)} / ${JSON.stringify(bot)})`,
    })
  }
} else {
  const homeSrc = readFileSync(join(ROOT, 'app/page.tsx'), 'utf8')
  if (/HERO_COUNT_LEAD/.test(homeSrc) || /homes for sale across Central Oregon\. Live list prices and days on market/.test(homeSrc)) {
    violations.push({
      file: 'app/page.tsx',
      kind: 'required',
      id: 'no-leftover-count',
      msg: 'Homepage Field must not print the leftover inventory caption (1,746 homes for sale across Central Oregon. Live list prices and days on market.)',
    })
  }
  if (/action=\{\{\s*label:\s*['"]See homes['"]/.test(homeSrc)) {
    violations.push({
      file: 'app/page.tsx',
      kind: 'required',
      id: 'no-see-homes',
      msg: 'Homepage Stage has one action (search). Do not also ship See homes.',
    })
  }
  if (!/headline=\{v3Text\('Homes for sale in Central Oregon'\)\}/.test(homeSrc)) {
    violations.push({
      file: 'app/page.tsx',
      kind: 'hero-default',
      id: 'v3-hero-lock',
      msg: 'KbHero is deleted, so the v3 hero must carry buyer H1 headline={v3Text(\'Homes for sale in Central Oregon\')} in app/page.tsx (brand stays in metadata)',
    })
  }
  if (/headline=\{v3Text\('Ryan Realty, Bend'\)\}/.test(homeSrc)) {
    violations.push({
      file: 'app/page.tsx',
      kind: 'hero-default',
      id: 'brand-h1-on-home',
      msg: 'Homepage Stage H1 must not be brand "Ryan Realty, Bend" — brand stays in metadata title/OG only',
    })
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log('seo-shell gate (ci:seo-shell) — Layer A forever')
console.log('==============================================')
console.log('Required contracts:', REQUIRED.length)

if (violations.length === 0) {
  console.log('\n✓ OK — money shells carry their head terms in H1 and title.')
  process.exit(0)
}

console.error(`\n✗ ${violations.length} Layer A violation(s):\n`)
for (const v of violations) {
  console.error(`  ${v.file}`)
  console.error(`    [${v.kind}${v.id ? `:${v.id}` : ''}] ${v.msg}`)
}
console.error('\nLayer A = place + type + head terms (Homes for Sale / Housing Market / Price Drops / Open Houses / Sell Your Home).')
console.error('Buffett voice belongs under the H1 (Layer B). See docs/plans/seo-voice/TOP_SITE_GOAL_SYSTEM.md §2.1.')
process.exit(1)
