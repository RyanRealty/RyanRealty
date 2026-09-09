#!/usr/bin/env node
/**
 * check-offmarket-listing-cta.mjs — ci:offmarket-listing-cta (SITE-21).
 *
 * WHY THIS GATE EXISTS. Verified live on ryan-realty.com 2026-09-08: a Closed
 * listing headlined its CLOSE price under a "Closed Sep 2026" pill — SITE-20
 * had already made the headline status-aware — while the rest of the page went
 * on selling the house. `<div id="payment">` computed principal and interest on
 * the $1,250,000 ASK. The market instrument printed "This home's price sits
 * 32.0% over the Bend median list · $1,250,000 this price" directly under a
 * headline reading $1,100,000. Tour / Call / Text ran in the price strip, in
 * the broker card, and in the phone's sticky bar. Two prices for one home on a
 * public page (§0), and three asks a licensed broker cannot fulfil: there is no
 * showing to book on a home that closed.
 *
 * ci:mockup-parity checks IMPORTS, so every one of those sections could be made
 * conditional and that gate would stay green either way — including if someone
 * later deletes the condition and leaves the mount. This gate holds the
 * CONDITIONS.
 *
 * WHAT IT CHECKS.
 *
 *  1. THE PREDICATE, EXECUTED. lib/listing-status-public.ts must export
 *     isPublicOffMarketStatus, and this gate transpiles and RUNS it over the
 *     whole RESO status enum. Closed / Expired / Canceled / Withdrawn are off
 *     market; Active, Active Under Contract, For Sale, empty and null are not;
 *     and PENDING IS NOT, which is the load-bearing case. A pending home is
 *     under contract, takes backup offers, and is one of this site's better
 *     lead sources — rewire the predicate to the complement of
 *     PUBLIC_ACTIVE_STATUSES (which excludes Pending) and the strip, the mobile
 *     bar and the payment silently vanish from every under-contract home on the
 *     site. Running the function is the only check that catches that, because
 *     the wrong implementation reads perfectly.
 *
 *  2. ONE LIST OF STATUSES. The four status literals may not be retyped in
 *     lib/listing-status-public.ts: the set comes from SITE-20's
 *     publish-listing-published-price.ts, which is the same set that decides
 *     which PRICE the page publishes. Two lists is how Coming Soon reached the
 *     public site (see that file's header).
 *
 *  3. EVERY BRANCH IS STILL A BRANCH. For each named node in each named file,
 *     the node must be GUARDED by the off-market flag — either an enclosing
 *     conditional whose test mentions it, or an early return in the same
 *     function under an `if` that mentions it. Ancestry, not a literal
 *     spelling: `{offMarket ? null : <X/>}`, `{!offMarket && <X/>}`,
 *     `{isOff ? <A/> : <B/>}` and `if (offMarket) return …` all pass, and
 *     deleting the condition fails whichever way it was written. The 2026-09-08
 *     canonical-gate failure is the reason this is ancestry-based: that gate
 *     held the exact spelling it had been tested against and passed 10/10
 *     against the same defect written one character apart.
 *
 *     The guarded nodes:
 *       app/listing/[listingKey]/page.tsx  MortgageCalculator, ListingAskInstrument,
 *                                          V3ListingClose, every tel:/sms: URI
 *       PriceCtaStrip.tsx                  the Tour / Call / Text anchors
 *       ListingMobileContactBar.client.tsx every tel:/sms: URI
 *       TextMattCTA.tsx                    every tel:/sms: URI
 *
 *     The mobile bar is in that list for a reason a server-side check would
 *     miss entirely: it builds its `tel:` and `sms:` hrefs in the BROWSER from
 *     a broker prop, so the page's rendered HTML can be clean while a phone
 *     visitor still gets Call and Text about a sold home across the bottom of
 *     the screen, which is exactly where their thumb is.
 *
 *  4. THE REPLACEMENT IS MOUNTED. The page must mount ListingOffMarketFacts and
 *     ListingLikeThisAlerts and must call publishListingOffMarketFacts. A page
 *     that only withholds is a dead end; MASTER_SPEC §4.9 asks for the
 *     last-known facts, the active listings and a saved search.
 *
 * Run: npm run ci:offmarket-listing-cta (wired into ci:gates)
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')

const STATUS_MODULE = 'lib/listing-status-public.ts'
const PRICE_MODULE = 'lib/listing/publish-listing-published-price.ts'
const PAGE = 'app/listing/[listingKey]/page.tsx'
const STRIP = 'components/site/listing-detail/PriceCtaStrip.tsx'
const MOBILE_BAR = 'components/site/listing-detail/ListingMobileContactBar.client.tsx'
const BROKER_CARD = 'components/site/listing-detail/TextMattCTA.tsx'

/** The four. Named here so the executed matrix is readable, never imported as the source. */
const OFF_MARKET = ['Closed', 'Expired', 'Canceled', 'Withdrawn']
const ON_MARKET = ['Active', 'Active Under Contract', 'For Sale', 'Pending', '', null, undefined]

const failures = []

function read(rel) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) {
    failures.push(`${rel} is missing — re-point this gate, or the branch it holds is gone.`)
    return null
  }
  return readFileSync(p, 'utf8')
}

function parse(rel, src) {
  return ts.createSourceFile(rel, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
}

/* ── 1. the predicate, executed ────────────────────────────────────────────── */

async function loadPredicate() {
  // The status module imports the price module, which imports the import-free
  // figure contract. Rather than bundle, stitch a tiny module that re-declares
  // nothing: esbuild is not guaranteed present in every lane, so this gate
  // transpiles the two files it needs and resolves the one import by hand.
  const statusSrc = read(STATUS_MODULE)
  const priceSrc = read(PRICE_MODULE)
  if (!statusSrc || !priceSrc) return null

  const priceOnly = priceSrc
    // publish-listing-figure is a separate executed contract (ci:listing-figure-publish).
    // Nothing the predicate touches calls into it, so the import is dropped.
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*'@\/lib\/listing\/publish-listing-figure'/, '')
    .replace(/^\s*import\s+type[\s\S]*?$/gm, '')
  const statusOnly = statusSrc
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*'@\/lib\/listing\/publish-listing-published-price'/, '')
    .replace(/^\s*import\s+type[\s\S]*?$/gm, '')

  const stitched = `${priceOnly}\n${statusOnly}`
  const js = ts.transpileModule(stitched, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  } catch (error) {
    failures.push(
      `${STATUS_MODULE}: this gate could not execute the predicate (${error.message}). ` +
        `It must stay executable — a predicate nobody runs is a green gate over a broken page.`,
    )
    return null
  }
}

const mod = await loadPredicate()
if (mod) {
  const fn = mod.isPublicOffMarketStatus
  if (typeof fn !== 'function') {
    failures.push(
      `${STATUS_MODULE}: isPublicOffMarketStatus is not exported. It is the one public-surface ` +
        `answer to "can this home still be bought"; every branch below reads it.`,
    )
  } else {
    for (const s of OFF_MARKET) {
      if (fn(s) !== true) failures.push(`isPublicOffMarketStatus(${JSON.stringify(s)}) must be true.`)
    }
    for (const s of ON_MARKET) {
      if (fn(s) !== false) {
        failures.push(
          `isPublicOffMarketStatus(${JSON.stringify(s)}) must be FALSE.` +
            (s === 'Pending'
              ? ' Pending is under contract, not off market: it takes backup offers and is a live lead' +
                ' source. Deriving off-market from the complement of PUBLIC_ACTIVE_STATUSES (which excludes' +
                ' Pending) strips the ask off every under-contract home on the site.'
              : ''),
        )
      }
    }
  }
  const set = mod.OFF_MARKET_STATUSES
  if (!(set instanceof Set) || set.size !== 4 || !OFF_MARKET.every((s) => set.has(s))) {
    failures.push(
      `${STATUS_MODULE}: OFF_MARKET_STATUSES must re-export SITE-20's set of exactly ${OFF_MARKET.join(', ')}.`,
    )
  }
}

/* ── 2. one list of statuses ───────────────────────────────────────────────── */

{
  const src = read(STATUS_MODULE)
  if (src) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    if (!/from\s*'@\/lib\/listing\/publish-listing-published-price'/.test(body)) {
      failures.push(
        `${STATUS_MODULE}: the off-market set must come FROM ` +
          `lib/listing/publish-listing-published-price.ts, not be retyped here. One list of statuses ` +
          `decides both which price the page publishes and whether the ask survives.`,
      )
    }
    for (const status of ['Expired', 'Canceled', 'Withdrawn']) {
      if (new RegExp(`['"\`]${status}['"\`]`).test(body)) {
        failures.push(
          `${STATUS_MODULE}: the literal '${status}' appears here. The four off-market statuses live in ` +
            `publish-listing-published-price.ts; a second copy is the drift that put Coming Soon on the site.`,
        )
      }
    }
  }
}

/* ── 3. every branch is still a branch ─────────────────────────────────────── */

/**
 * Identifiers that name the off-market condition. Deliberately narrow: the flag
 * is one word across all four files, so a rename is a contract edit that comes
 * here too. Widening this to "any identifier containing 'market'" would let
 * `marketGeo` satisfy a guard.
 */
const FLAG = /\boffMarket\b|\bisPublicOffMarketStatus\b/

/** Does this expression's source mention the flag? */
function testsFlag(node, src) {
  return FLAG.test(src.slice(node.pos, node.end))
}

/**
 * True when `node` is only reached with the flag decided.
 *
 * Two shapes count, because both are honest code:
 *   (a) an ancestor conditional / logical / if whose TEST mentions the flag;
 *   (b) an earlier `if (<flag…>) { return … }` inside the same function, which
 *       is how ListingMobileContactBar leaves before it builds a tel: URI.
 */
function isGuarded(node, src) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isConditionalExpression(p) && testsFlag(p.condition, src)) return true
    if (ts.isBinaryExpression(p) && testsFlag(p.left, src)) {
      const op = p.operatorToken.kind
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) return true
    }
    if (ts.isIfStatement(p) && testsFlag(p.expression, src)) return true
    if (ts.isFunctionLike(p)) {
      // (b): an early return under the flag, before this node.
      let early = false
      const body = p.body
      if (body && ts.isBlock(body)) {
        for (const stmt of body.statements) {
          if (stmt.end > node.pos) break
          if (ts.isIfStatement(stmt) && testsFlag(stmt.expression, src)) {
            let returns = false
            const seek = (n) => {
              if (ts.isReturnStatement(n)) returns = true
              ts.forEachChild(n, seek)
            }
            seek(stmt.thenStatement)
            if (returns) early = true
          }
        }
      }
      if (early) return true
    }
  }
  return false
}

function eachNode(sourceFile, visit) {
  const walk = (n) => {
    visit(n)
    ts.forEachChild(n, walk)
  }
  walk(sourceFile)
}

/** Every `tel:`/`sms:` URI built in this file, as nodes. */
function contactUris(sourceFile) {
  const out = []
  eachNode(sourceFile, (n) => {
    if (ts.isTemplateExpression(n) && /^(tel|sms):/.test(n.head.text)) out.push(n)
    if (ts.isStringLiteral(n) && /^(tel|sms):/.test(n.text)) out.push(n)
    if (ts.isNoSubstitutionTemplateLiteral(n) && /^(tel|sms):/.test(n.text)) out.push(n)
  })
  return out
}

/** Every JSX mount of a component by name. */
function mounts(sourceFile, name) {
  const out = []
  eachNode(sourceFile, (n) => {
    if (
      (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) &&
      n.tagName.getText(sourceFile) === name
    ) {
      out.push(n)
    }
  })
  return out
}

/** Every JSX attribute `href={<ident>}` for one of the named identifiers. */
function hrefsNamed(sourceFile, names) {
  const out = []
  eachNode(sourceFile, (n) => {
    if (!ts.isJsxAttribute(n)) return
    if (n.name.getText(sourceFile) !== 'href') return
    const init = n.initializer
    if (!init || !ts.isJsxExpression(init) || !init.expression) return
    if (ts.isIdentifier(init.expression) && names.includes(init.expression.text)) out.push(n)
  })
  return out
}

function requireGuarded(rel, src, sourceFile, nodes, what) {
  if (nodes.length === 0) {
    failures.push(
      `${rel}: ${what} — nothing found to check. Either the ask moved and this gate is pointed at a ` +
        `dead file, or the control was deleted; both need a human, not a green build.`,
    )
    return
  }
  for (const node of nodes) {
    if (!isGuarded(node, src)) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      failures.push(
        `${rel}:${line}: ${what} is NOT guarded by the off-market flag. On a Closed, Expired, ` +
          `Canceled or Withdrawn listing this reaches a reader as an ask nobody can fulfil (SITE-21).`,
      )
    }
  }
}

function requireMounted(rel, sourceFile, name, why) {
  if (mounts(sourceFile, name).length === 0) {
    failures.push(`${rel}: ${name} is not mounted. ${why}`)
  }
}

{
  const src = read(PAGE)
  if (src) {
    const sf = parse(PAGE, src)
    if (!/isPublicOffMarketStatus/.test(src)) {
      failures.push(
        `${PAGE}: does not call isPublicOffMarketStatus. The page decides the whole off-market state; ` +
          `nothing downstream can.`,
      )
    }
    if (!/publishListingOffMarketFacts/.test(src)) {
      failures.push(
        `${PAGE}: does not call publishListingOffMarketFacts. The sold facts are the claim that replaces ` +
          `the market-ask instrument (MASTER_SPEC §4.9).`,
      )
    }
    requireGuarded(PAGE, src, sf, mounts(sf, 'MortgageCalculator'), 'the payment calculator')
    requireGuarded(PAGE, src, sf, mounts(sf, 'ListingAskInstrument'), 'the market-ask instrument')
    requireGuarded(PAGE, src, sf, mounts(sf, 'V3ListingClose'), 'the three-act close (watch / tour / payment)')
    requireGuarded(PAGE, src, sf, contactUris(sf), 'a tel:/sms: contact URI')
    requireMounted(
      PAGE,
      sf,
      'ListingOffMarketFacts',
      'A page that only withholds is a dead end; §4.9 asks for the last-known facts.',
    )
    requireMounted(
      PAGE,
      sf,
      'ListingLikeThisAlerts',
      'The saved search is what replaces the tour; §4.9 asks for it by name.',
    )
  }
}

{
  const src = read(STRIP)
  if (src) {
    const sf = parse(STRIP, src)
    requireGuarded(
      STRIP,
      src,
      sf,
      hrefsNamed(sf, ['tourHref', 'callHref', 'textHref', 'askHrefResolved']),
      'the Tour / Call / Text ask',
    )
  }
}

for (const rel of [MOBILE_BAR, BROKER_CARD]) {
  const src = read(rel)
  if (!src) continue
  const sf = parse(rel, src)
  requireGuarded(rel, src, sf, contactUris(sf), 'a tel:/sms: contact URI')
}

/* ── report ────────────────────────────────────────────────────────────────── */

console.log('off-market listing ask (ci:offmarket-listing-cta)')
console.log('=================================================')
console.log(`  predicate executed over : ${OFF_MARKET.length + ON_MARKET.length} statuses`)
console.log(`  files held              : 5`)

if (failures.length) {
  console.error(`\nFAIL - ${failures.length} problem(s):\n`)
  for (const f of failures) console.error('  • ' + f)
  console.error(
    '\nMASTER_SPEC §4.9 and CLAUDE.md §0: a home that is not for sale publishes what it sold for,\n' +
      'the homes that ARE for sale, and a saved search — never a mortgage on a price nobody can pay\n' +
      'and never a tour of a house that closed.',
  )
  process.exit(1)
}
console.log('\nOK - every off-market branch is present and guarded, and the predicate spares Pending.')