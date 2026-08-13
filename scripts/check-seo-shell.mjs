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
 *   1. Banned poetry / personality patterns in Layer A shells on money routes
 *   2. Required exact-match head terms per money family (cannot drift)
 *   3. KbHero component defaults are Layer A safe (no poetry footgun)
 *
 * Usage:
 *   node scripts/check-seo-shell.mjs
 *   npm run ci:seo-shell
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

// ── Banned poetry / personality in Layer A ──────────────────────────────────
// Closed list of patterns that previously (or could) land in title/H1 shells.
// Expand only with known regressions — do not invent fuzzy "sounds poetic" rules.
const BANNED = [
  { id: 'mls-list', re: /\bthe\s+mls\s+list\b/i, hint: 'Use place + "Homes for Sale"' },
  { id: 'what-sold-for', re: /\bwhat\s+it\s+sold\s+for\b/i, hint: 'Sold facts belong in Layer B body, not H1' },
  { id: 'on-the-market-now', re: /\bon\s+the\s+market\s+now\b/i, hint: 'Use "Homes for Sale" / inventory count' },
  { id: 'payment-be', re: /\bwhat\s+will\s+the\s+payment\s+be\b/i, hint: 'Payment questions are body/FAQ, not H1' },
  { id: 'the-list-comma', re: /\bthe\s+list\s*,/i, hint: 'Drop "the list," metaphor H1s' },
  { id: 'we-show-the-work', re: /\bwe\s+show\s+the\s+work\b/i, hint: 'Personality → Layer B' },
  { id: 'plain-facts-only', re: /\bplain\s+facts\s+only\b/i, hint: 'Personality → Layer B' },
  { id: 'market-does-not-care', re: /\bthe\s+market\s+does\s+not\s+care\b/i, hint: 'Personality → Layer B' },
  { id: 'still-have-a-story', re: /\bhomes\s+that\s+still\s+have\s+a\s+story\b/i, hint: 'Personality → Layer B' },
  { id: 'desert-meets', re: /\bwhere\s+the\s+desert\s+meets\b/i, hint: 'Metaphor → Layer B' },
  { id: 'broker-you-get', re: /\bthe\s+broker\s+you\s+call\b.*\bthe\s+broker\s+you\s+get\b/i, hint: 'Team personality H1 not money-shell' },
]

// ── Money routes (page.tsx trees) ───────────────────────────────────────────
// Task C2 families: home, cities, search/homes-for-sale, housing-market, sell,
// open-houses, price-drops. Buy hub included as money-path shell.
const MONEY_PATHS = [
  'app/page.tsx',
  'app/buy/page.tsx',
  'app/sell/page.tsx',
  'app/cities',
  'app/search',
  'app/housing-market',
  'app/open-houses',
  'app/price-drops',
]

// Exact-match contracts: head terms that must remain on specific money shells.
// Patterns match source as authored (literals + template literal static parts).
const REQUIRED = [
  {
    file: 'app/page.tsx',
    // The FACT this locks is the D11 homepage H1 and lead, not the prop that
    // carries them. KB spelled the H1 as titleTop/titleBottom; the v3 register
    // has no such prop, its patterns take `headline` (V3InstrumentProps.headline)
    // and the empty branch uses Quiet `heading=`. Writing a prop literally named
    // titleTop on a v3 page to satisfy a regex would be gate-gaming, so the check
    // accepts either register's spelling.
    // BOTH ARMS ARE EXACT LITERALS. The v3 arm pins
    // headline={v3Text('Homes for Sale in Central Oregon')} (VOICE.md D11) and
    // the D11 lead sentence must appear as a literal in this file (the gate does
    // not scan app/_v3/).
    checks: [
      {
        re: /titleTop\s*=\s*["']Central Oregon["'][\s\S]{0,800}titleBottom\s*=\s*["']Homes for Sale["']|headline=\{v3Text\('Homes for Sale in Central Oregon'\)\}|heading\s*=\s*["']Homes for Sale in Central Oregon["']/,
        msg: 'H1 must be the D11 lock: KB titleTop="Central Oregon" + titleBottom="Homes for Sale", or v3 headline={v3Text(\'Homes for Sale in Central Oregon\')} / heading="Homes for Sale in Central Oregon"',
      },
      {
        re: /Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne\. Live list prices and days on market\./,
        msg: 'D11 homepage lead must appear as an exact literal in app/page.tsx',
      },
      { re: /title:\s*['"]Homes for Sale/i, msg: 'metadata title must lead with "Homes for Sale"' },
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
    // BOTH ARMS ARE EXACT LITERALS, DELIBERATELY, the same discipline as the
    // market hub's arm below. The v3 arm pins the interpolated head term the page
    // actually opens with, `${cityName} homes for sale`, in the sentence case
    // design_system/public/PUBLIC_UI.md requires, so the H1 still carries the
    // term the city money route ranks on while being the place verdict the
    // locked Places opening asks for. Change the page's H1 and this must change
    // with it, which is the point of a required contract.
    // docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 3.2.
    checks: [
      {
        re: /titleBottom\s*=\s*["']Homes for Sale["']|[`'"]\$\{cityName\} homes for sale\b/,
        msg: 'city H1 must carry the head term: KB titleBottom="Homes for Sale", or a v3 headline literal opening "${cityName} homes for sale"',
      },
      { re: /title:\s*[`'"]Homes for Sale in \$\{/i, msg: 'city metadata title must be "Homes for Sale in ${city}…"' },
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
        re: /titleBottom\s*=\s*["']Homes for Sale["']|headline\s*=\s*\{?\s*(?:v3Text\(\s*)?`\$\{[^`{}]*\}\s+homes for sale\b/,
        msg: 'neighborhood H1 must carry the head term: KB titleBottom="Homes for Sale", or a v3 headline template literal reading `${place} homes for sale`',
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
      { re: /Homes for Sale/, msg: 'search index title/H1 builders must use "Homes for Sale"' },
      { re: /return ['"]Homes for Sale['"]/, msg: 'empty-filter title must be exact "Homes for Sale"' },
    ],
  },
  {
    file: 'app/search/[...slug]/page.tsx',
    checks: [
      {
        re: /Homes for sale in \$\{placeName\}/i,
        msg: 'default search H1 must be "Homes for sale in ${placeName}" (query language)',
      },
    ],
  },
]

// ── File collection ─────────────────────────────────────────────────────────
function walkPageTsx(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e === '__tests__') continue
    const p = join(dir, e)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walkPageTsx(p, out)
    else if (e === 'page.tsx') out.push(p)
  }
  return out
}

function collectMoneyPages() {
  const files = []
  for (const g of MONEY_PATHS) {
    const abs = join(ROOT, g)
    if (!existsSync(abs)) continue
    const st = statSync(abs)
    if (st.isFile()) files.push(abs)
    else if (st.isDirectory()) walkPageTsx(abs, files)
  }
  return [...new Set(files)].sort()
}

function rel(p) {
  return relative(ROOT, p).replace(/\\/g, '/')
}

/**
 * Extract Layer A shell snippets from a page source.
 * We intentionally do NOT scan the whole file (body copy may be Layer B).
 */
function extractLayerAShell(src) {
  const chunks = []

  /** Push last capture group (or full match) from every hit. */
  const pushAll = (re, groupIndex = 1) => {
    re.lastIndex = 0
    let m
    while ((m = re.exec(src)) !== null) {
      chunks.push(m[groupIndex] ?? m[0])
    }
  }

  // titleTop / titleBottom / lead — string or template literal (optionally wrapped in {})
  // group 2 = content between matching quotes
  pushAll(/\btitleTop\s*=\s*\{?\s*(["'`])([\s\S]*?)\1\s*\}?/g, 2)
  pushAll(/\btitleBottom\s*=\s*\{?\s*(["'`])([\s\S]*?)\1\s*\}?/g, 2)
  pushAll(/\blead\s*=\s*\{?\s*(["'`])([\s\S]*?)\1\s*\}?/g, 2)
  // metadata title: '…' / title: `…`
  pushAll(/\btitle\s*:\s*(["'`])([\s\S]*?)\1/g, 2)
  // <h1>…</h1> and <H1>…</H1> (may span lines / nested spans)
  pushAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, 1)
  pushAll(/<H1\b[^>]*>([\s\S]*?)<\/H1>/g, 1)
  // v3 register (components/site/v3): headings render through <V3Heading> and the
  // six patterns take their H1 copy as `headline`, so without these two the
  // banned-poetry scan goes completely blind the moment a money route migrates.
  // docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 3.2.
  pushAll(/<V3Heading\b[^>]*>([\s\S]*?)<\/V3Heading>/g, 1)
  pushAll(/\bheadline\s*=\s*\{?\s*(?:v3Text\(\s*)?(["'`])([\s\S]*?)\1/g, 2)
  // Quiet empty-state H1s use `heading=` (V3QuietProps.heading). Without this
  // the banned-poetry scan misses the branch that replaces Instrument.
  pushAll(/\bheading\s*=\s*(["'`])([\s\S]*?)\1/g, 2)
  // aria-label="…"
  pushAll(/\baria-label\s*=\s*(["'`])([\s\S]*?)\1/g, 2)
  // headerTitle assignment blob (search routes)
  pushAll(/\bheaderTitle\s*=[\s\S]{0,500}?(?=\n\s*(?:const|return|\/\/|\/\*|<))/g, 0)
  // buildSearchTitle / similar return literals
  pushAll(/return\s+(["'`])([^"'`]*Homes for [Ss]ale[^"'`]*)\1/g, 2)
  pushAll(/return\s+`([^`]*Homes for [Ss]ale[^`]*)`/g, 1)

  // Normalize JSX text: strip tags, collapse whitespace
  return chunks
    .map((c) =>
      String(c)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\$\{[^}]+\}/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n')
}

// ── Run ─────────────────────────────────────────────────────────────────────
const violations = []
const files = collectMoneyPages()

// (1) Banned poetry on money-route shells
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const shell = extractLayerAShell(src)
  if (!shell) continue
  for (const ban of BANNED) {
    if (ban.re.test(shell)) {
      violations.push({
        file: rel(file),
        kind: 'banned',
        id: ban.id,
        msg: `Layer A shell matches banned poetry /${ban.re.source}/i — ${ban.hint}`,
      })
    }
  }
}

// (2) Required exact-match contracts
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

// (3) KbHero defaults must not reintroduce poetry when a caller omits props
const HERO = join(ROOT, 'components/site/kb/KbHero.client.tsx')
if (existsSync(HERO)) {
  const heroSrc = readFileSync(HERO, 'utf8')
  // Defaults are parameter defaults: titleTop = '…', titleBottom = '…'
  const topM = heroSrc.match(/\btitleTop\s*=\s*(['"])([^'"]*)\1/)
  const botM = heroSrc.match(/\btitleBottom\s*=\s*(['"])([^'"]*)\1/)
  const top = topM?.[2] ?? ''
  const bot = botM?.[2] ?? ''
  const defaultShell = `${top}\n${bot}`
  for (const ban of BANNED) {
    if (ban.re.test(defaultShell)) {
      violations.push({
        file: 'components/site/kb/KbHero.client.tsx',
        kind: 'hero-default',
        id: ban.id,
        msg: `KbHero default H1 is poetry (${JSON.stringify(top)} / ${JSON.stringify(bot)}) — ${ban.hint}`,
      })
    }
  }
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
  violations.push({
    file: 'components/site/kb/KbHero.client.tsx',
    kind: 'missing',
    id: 'hero-missing',
    msg: 'KbHero component missing — cannot lock Layer A defaults',
  })
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log('seo-shell gate (ci:seo-shell) — Layer A forever')
console.log('==============================================')
console.log(`Scanned ${files.length} money-route page.tsx files + KbHero defaults`)
console.log('Banned patterns:', BANNED.length)
console.log('Required contracts:', REQUIRED.length)

if (violations.length === 0) {
  console.log('\n✓ OK — money shells are query language; poetry cannot return via H1/title/defaults.')
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
