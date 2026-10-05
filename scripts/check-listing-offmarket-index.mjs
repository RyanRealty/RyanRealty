#!/usr/bin/env node
/**
 * check-listing-offmarket-index.mjs — ci:listing-offmarket-index (SITE-32).
 *
 * OFF-MARKET LISTING URLS STAY INDEXED. Matt ruled it on 2026-09-08, and this
 * gate is the ruling's only mechanical form.
 *
 * WHY A GATE FOR AN ABSENCE. Two written policies had stood for months and
 * neither was implemented. docs/MASTER_SPEC.md §4.9 said an off-market detail
 * URL returns 200 and Google keeps indexing it; docs/plans/data-architecture-
 * plan.md Part J §1 said keep the page but noindex it, set Offer.availability
 * to SoldOut, and optionally 410 after twelve months. The live site happened to
 * match the first, by accident rather than by decision: nothing in the route
 * mentions status at all. The losing text is now deleted and §4.9 is the one
 * statement — but a policy whose entire implementation is the ABSENCE of four
 * lines is exactly the kind that a well-meaning SEO cleanup restores. This gate
 * makes the absence load-bearing.
 *
 * THE MEASUREMENT BEHIND THE RULING (GSC page report crossed against the DAL,
 * 2026-06-08..2026-09-05): 14,508 listing-detail URLs, 56,650 impressions, 807
 * clicks. Off market is 6,611 URLs and 26,123 impressions — 46% — split Closed
 * 3,207/12,125, Pending 1,431/6,105, Expired 790/3,226, Canceled 748/2,860,
 * Withdrawn 435/1,807, at a CTR that straddles or beats Active and worth
 * roughly 324-577 clicks per 90 days. An address query has no Active
 * substitute, so a noindex on this class deletes those clicks rather than
 * redistributing them. They are residual index, not submissions:
 * lib/data/sitemap/getListingSitemapRows.ts ships Active/AUC only.
 *
 * ODS. G54 (scripts/check-ods-compliance.mjs) pins §5-4 A.4 — sold data is
 * VOW-only, no indexable public sold surface — and checks the search presets
 * and statusFilter variants. Matt ruled in the same breath that a single
 * listing's DETAIL page showing its own ClosePrice is not one of those
 * compilation surfaces for indexing purposes, so G54 is deliberately not
 * extended to app/listing/**. That scope note is recorded in G54's header.
 *
 * WHAT THIS GATE CHECKS.
 *
 *  1. THE DEFAULT, EXECUTED. lib/site/page-metadata.ts is transpiled and RUN.
 *     pageMetadata() with no noindex must return { index: true, follow: true },
 *     and with noindex must return { index: false, follow: TRUE }. Every
 *     off-market listing page rides that default, so flipping it would noindex
 *     the whole class while the AST below stayed spotless. Reading the source
 *     cannot catch that; running it can.
 *
 *  2. NO NOINDEX AT THE CHOKEPOINT. In app/listing/[listingKey]/page.tsx
 *     generateMetadata, NOTHING is passed as `noindex` to pageMetadata — not
 *     a status test, and since Matt's 2026-10-05 revert of SITE-33 ("Undo
 *     it"), not geography either. Out-of-area listings (Medford, Klamath
 *     Falls, Grants Pass, ...) are index, follow: the 2026-09-09 out-of-area
 *     noindex cost about 36% of the Search Console impression drop since
 *     Sep 12 (~2,500 impressions and ~30 clicks a week). Any `noindex`
 *     property or shorthand in generateMetadata fails, whatever it computes.
 *     `nofollow` may not be set at all.
 *
 *  7. OUT-OF-AREA ROWS SHIP IN listings.xml (Matt 2026-10-05).
 *     lib/data/sitemap/getListingSitemapRows.ts may not import or call a
 *     service-area predicate (isServiceAreaCity, outOfAreaListingPolicy,
 *     SERVICE_AREA_CITIES_*, serviceAreaSitemapTiles): the listings sitemap is
 *     every Active/AUC listing, whatever its city.
 *
 *  3. NO SECOND ROBOTS DIRECTIVE IN EITHER FILE. Neither chokepoint may
 *     hand-build a robots object. The by-address route in particular must keep
 *     DELEGATING to the [listingKey] generateMetadata and add nothing: it is
 *     the path most of these URLs are indexed under, and it already shipped one
 *     defect (SITE-22) from overriding a field the delegate had computed.
 *
 *  4. THE ONE SANCTIONED NOINDEX IS STILL THE REFUSAL, AND ONLY THE REFUSAL.
 *     LISTING_UNAVAILABLE_METADATA must carry { index: false, follow: true },
 *     and it may be returned only under a guard that says nothing about status.
 *     getListingDetail refuses exactly two things — IDX opt-outs and Coming
 *     Soon — so a sold key never reaches it.
 *
 *  5. THE REFUSAL COPY DOES NOT CLAIM A SOLD KEY IS REFUSED. Every string the
 *     refusal renders is scanned: it may not say "sold", "no longer ... on the
 *     market", or "off the market". That copy shipped for months under a page
 *     that refuses none of those things, and it is what let the off-market
 *     state be believed handled while the live page sold a closed house.
 *
 *  6. A DATABASE FAILURE IS NEVER A 200 NOINDEX (GSC slide fix, 2026-10-05).
 *     Until 7e392cc4 a failed listing lookup rendered the noindexed refusal as
 *     HTTP 200; URL Inspection found 12 of a random 150 sitemap listing URLs
 *     still "Excluded by 'noindex' tag" weeks later, 8 of them with a Google
 *     canonical pointing at a different listing. So:
 *       a. getListingLookup's catch returns { kind: 'error' }, never 'missing'.
 *       b. In the page, an `.kind === 'error'` guard never reaches the refusal
 *          (LISTING_UNAVAILABLE_METADATA / <ListingUnavailable />), and
 *          generateMetadata does return LISTING_TEMPORARILY_UNAVAILABLE_METADATA
 *          under one.
 *       c. LISTING_TEMPORARILY_UNAVAILABLE_METADATA declares no robots.
 *       d. middleware.ts answers a transient edge lookup failure through
 *          readListingForRequest / isListingLookupUnavailable /
 *          listingTemporarilyUnavailableResponse, and that response is a 503
 *          with Retry-After and no-store whose strings never say noindex.
 *
 * Usage:
 *   node scripts/check-listing-offmarket-index.mjs            # CI
 *   node scripts/check-listing-offmarket-index.mjs --json
 *
 * Run: npm run ci:listing-offmarket-index (wired into ci:gates)
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const JSON_OUT = process.argv.includes('--json')

const PAGE = 'app/listing/[listingKey]/page.tsx'
const BY_ADDRESS = 'app/listing/by-address/[...slug]/page.tsx'
const UNAVAILABLE = 'components/site/listing-detail/ListingUnavailable.tsx'
const METADATA_MODULE = 'lib/site/page-metadata.ts'
const SHARE_MODULE = 'lib/share-metadata.ts'

/** Names that mean "this home is off the market". None may reach the directive. */
const STATUS_NAMES = [
  'status',
  'standardStatus',
  'standard_status',
  'StandardStatus',
  'isPublicOffMarketStatus',
  'listingIsOffMarket',
  'OFF_MARKET_STATUSES',
  'PUBLIC_ACTIVE_STATUSES',
  'PUBLIC_ON_MARKET_STATUSES',
  'isPubliclyDisplayableStatus',
  'closePrice',
  'closeDate',
]

/** The four, plus the spellings a feed sends. A literal here is a status test. */
const STATUS_LITERALS = [
  'Closed',
  'Expired',
  'Canceled',
  'Cancelled',
  'Withdrawn',
  'Pending',
  'Sold',
]

const failures = []

function read(rel) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) {
    failures.push(
      `${rel} is missing. Re-point this gate at the file that replaced it — the ruling it holds ` +
        `(off-market listing URLs stay index,follow) did not move just because the route did.`,
    )
    return null
  }
  return readFileSync(p, 'utf8')
}

function parse(rel, src) {
  return ts.createSourceFile(rel, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
}

function propertyName(node) {
  const name = node.name
  if (!name) return null
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return null
}

function lineOf(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

function walk(node, fn) {
  fn(node)
  ts.forEachChild(node, (child) => walk(child, fn))
}

/* ── 1. the default, executed ──────────────────────────────────────────────── */

async function loadPageMetadata() {
  const shareSrc = read(SHARE_MODULE)
  const metaSrc = read(METADATA_MODULE)
  if (!shareSrc || !metaSrc) return null

  // share-metadata.ts imports nothing; page-metadata.ts imports only from it
  // and a `type` from next (which transpileModule erases). Transpile the two
  // SEPARATELY and rewrite the one specifier to the first module's data URL —
  // esbuild is not guaranteed present in every lane, and concatenating them
  // collides on the private const both files happen to name MAX_DESC.
  const asModule = (src) =>
    `data:text/javascript;base64,${Buffer.from(
      ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    ).toString('base64')}`

  const metaOnly = metaSrc.replace(/'@\/lib\/share-metadata'/, JSON.stringify(asModule(shareSrc)))
  try {
    return await import(asModule(metaOnly))
  } catch (error) {
    failures.push(
      `${METADATA_MODULE}: this gate could not execute pageMetadata (${error.message}). It must stay ` +
        `executable — the robots default every listing page rides on is not readable from the AST.`,
    )
    return null
  }
}

{
  const mod = await loadPageMetadata()
  if (mod) {
    const fn = mod.pageMetadata
    if (typeof fn !== 'function') {
      failures.push(`${METADATA_MODULE}: pageMetadata is not exported.`)
    } else {
      const base = { title: 'A home', description: 'A home', path: '/listing/x' }
      const plain = fn(base).robots
      if (!plain || plain.index !== true || plain.follow !== true) {
        failures.push(
          `${METADATA_MODULE}: pageMetadata() with no noindex returned ` +
            `${JSON.stringify(plain)} — it must be { index: true, follow: true }. Every off-market ` +
            `listing page is indexed by riding this default (Matt 2026-09-08); changing it noindexes ` +
            `6,611 URLs and ~26,123 impressions per 90 days without touching the listing route.`,
        )
      }
      const hidden = fn({ ...base, noindex: true }).robots
      if (!hidden || hidden.index !== false || hidden.follow !== true) {
        failures.push(
          `${METADATA_MODULE}: pageMetadata({ noindex: true }) returned ${JSON.stringify(hidden)} — ` +
            `it must be { index: false, follow: true }. noindex must never re-fuse to nofollow: a ` +
            `noindexed listing page still carries ~200 internal links that have to keep passing.`,
        )
      }
    }
  }
}

/* ── 2 + 4. the [listingKey] chokepoint ────────────────────────────────────── */

/** String literals inside an expression, template spans included. */
function stringsIn(node, acc = new Set()) {
  walk(node, (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) acc.add(n.text)
    if (ts.isTemplateExpression(n)) {
      acc.add(n.head.text)
      for (const span of n.templateSpans) acc.add(span.literal.text)
    }
  })
  return acc
}

/** The enclosing function-ish node, so "inside generateMetadata" is answerable. */
function enclosingFunction(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (
      ts.isFunctionDeclaration(p) ||
      ts.isFunctionExpression(p) ||
      ts.isArrowFunction(p) ||
      ts.isMethodDeclaration(p)
    ) {
      return p
    }
  }
  return null
}

function functionNamed(sf, name) {
  let found = null
  walk(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) found = n
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === name &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
    ) {
      found = n.initializer
    }
  })
  return found
}

{
  const src = read(PAGE)
  if (src) {
    const sf = parse(PAGE, src)
    const genMeta = functionNamed(sf, 'generateMetadata')
    if (!genMeta) {
      failures.push(
        `${PAGE}: no generateMetadata found. This is the chokepoint the ruling lives at; if it was ` +
          `renamed or moved, re-point this gate in the same commit.`,
      )
    } else {
      // Any `noindex` in generateMetadata is a failure (Matt 2026-10-05): not
      // status (SITE-32) and no longer geography (SITE-33 reverted). The one
      // sanctioned noindex is the refusal constant, checked in section 4.
      walk(genMeta, (n) => {
        const isNoindex =
          (ts.isPropertyAssignment(n) && propertyName(n) === 'noindex') ||
          (ts.isShorthandPropertyAssignment(n) && n.name.text === 'noindex')
        if (!isNoindex) return
        const text = n.getText(sf)
        const statusy =
          STATUS_NAMES.some((name) => new RegExp(`\\b${name}\\b`).test(text)) ||
          STATUS_LITERALS.some((lit) => text.toLowerCase().includes(lit.toLowerCase()))
        failures.push(
          `${PAGE}:${lineOf(sf, n)}: generateMetadata passes \`${text.replace(/\s+/g, ' ').slice(0, 120)}\`. ` +
            (statusy
              ? `Status is not an input to indexing on this page (Matt 2026-09-08, SITE-32): off-market ` +
                `URLs carry 46% of listing-detail impressions and an address query has no Active ` +
                `substitute, so a noindex deletes those clicks. `
              : '') +
            `No listing page passes noindex: out-of-area listings are index, follow too (Matt ` +
            `2026-10-05 reverted SITE-33; the out-of-area noindex cost ~36% of the Search Console ` +
            `impression drop since Sep 12). The only noindex on a listing URL is the refusal ` +
            `(LISTING_UNAVAILABLE_METADATA). See docs/MASTER_SPEC.md §4.9.`,
        )
      })

      // `nofollow` is a separate field on purpose (SITE-25). Never set here.
      walk(genMeta, (n) => {
        if (
          (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) &&
          (propertyName(n) === 'nofollow' || n.name?.text === 'nofollow')
        ) {
          failures.push(
            `${PAGE}:${lineOf(sf, n)}: \`nofollow\` is set. A listing page carries ~200 internal ` +
              `links; dropping follow discards every one of them. It must never be set here.`,
          )
        }
      })

      // A hand-built robots object bypasses pageMetadata entirely.
      walk(genMeta, (n) => {
        if (ts.isPropertyAssignment(n) && propertyName(n) === 'robots') {
          failures.push(
            `${PAGE}:${lineOf(sf, n)}: a \`robots\` object is built by hand inside generateMetadata. ` +
              `The directive comes from pageMetadata's noindex/nofollow fields and nowhere else — ` +
              `two sources for one page is how a policy ends up unstated.`,
          )
        }
      })

      // 4. The refusal metadata is returned only under a status-free guard.
      walk(genMeta, (n) => {
        if (
          ts.isReturnStatement(n) &&
          n.expression &&
          ts.isIdentifier(n.expression) &&
          n.expression.text === 'LISTING_UNAVAILABLE_METADATA'
        ) {
          let guard = null
          for (let p = n.parent; p && p !== genMeta; p = p.parent) {
            if (ts.isIfStatement(p)) {
              guard = p.expression
              break
            }
            if (ts.isIfStatement(p.parent) && p.parent.thenStatement === p) {
              guard = p.parent.expression
              break
            }
          }
          if (!guard) {
            failures.push(
              `${PAGE}:${lineOf(sf, n)}: LISTING_UNAVAILABLE_METADATA is returned unconditionally.`,
            )
            return
          }
          const guardText = guard.getText(sf)
          const named = STATUS_NAMES.filter((name) => new RegExp(`\\b${name}\\b`).test(guardText))
          if (named.length) {
            failures.push(
              `${PAGE}:${lineOf(sf, n)}: the noindexed refusal is reached on a STATUS test ` +
                `(\`${guardText}\`). It is reachable only when getListingDetail returns null — an IDX ` +
                `opt-out, a non-participant broker, Coming Soon, or no such listing. A sold key ` +
                `resolves and renders the full off-market page (SITE-21).`,
            )
          }
        }
      })
    }
  }
}

/* ── 3. the by-address route adds nothing ──────────────────────────────────── */

{
  const src = read(BY_ADDRESS)
  if (src) {
    const sf = parse(BY_ADDRESS, src)
    let delegates = false
    walk(sf, (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        if (n.expression.text === 'generateListingMetadata') delegates = true
      }
      if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) {
        const name = propertyName(n) ?? n.name?.text
        if (name === 'robots' || name === 'noindex' || name === 'nofollow') {
          const fn = enclosingFunction(n)
          const inMetadata = fn === functionNamed(sf, 'generateMetadata') || fn === null
          failures.push(
            `${BY_ADDRESS}:${lineOf(sf, n)}: this route sets \`${name}\`${inMetadata ? '' : ' '}. It ` +
              `must add NOTHING to the directive computed by app/listing/[listingKey] ` +
              `generateMetadata — this is the path most off-market URLs are indexed under, and ` +
              `overriding a field the delegate already computed is precisely the defect SITE-22 ` +
              `fixed here (a self-canonical to whatever path was requested).`,
          )
        }
      }
    })
    if (!delegates) {
      failures.push(
        `${BY_ADDRESS}: generateMetadata no longer delegates to the [listingKey] route's ` +
          `generateMetadata. One page, one directive, one canonical — do not fork it.`,
      )
    }
  }
}

/* ── 4b + 5. the refusal constant and its copy ─────────────────────────────── */

{
  const src = read(UNAVAILABLE)
  if (src) {
    const sf = parse(UNAVAILABLE, src)
    let robotsSeen = false
    walk(sf, (n) => {
      if (ts.isPropertyAssignment(n) && propertyName(n) === 'robots') {
        robotsSeen = true
        const obj = n.initializer
        if (!ts.isObjectLiteralExpression(obj)) {
          failures.push(`${UNAVAILABLE}:${lineOf(sf, n)}: robots must be an object literal.`)
          return
        }
        const fields = new Map()
        for (const prop of obj.properties) {
          if (ts.isPropertyAssignment(prop)) {
            fields.set(propertyName(prop), prop.initializer.kind)
          }
        }
        if (fields.get('index') !== ts.SyntaxKind.FalseKeyword) {
          failures.push(
            `${UNAVAILABLE}:${lineOf(sf, n)}: the refusal must carry \`index: false\`. It is a 200 ` +
              `Next cannot downgrade to a 404, so noindex is the only thing keeping a page with no ` +
              `home on it out of the index.`,
          )
        }
        if (fields.get('follow') !== ts.SyntaxKind.TrueKeyword) {
          failures.push(
            `${UNAVAILABLE}:${lineOf(sf, n)}: the refusal must carry \`follow: true\`. Its body is ` +
              `four internal links to the places a visitor should go next.`,
          )
        }
      }
    })
    if (!robotsSeen) {
      failures.push(
        `${UNAVAILABLE}: LISTING_UNAVAILABLE_METADATA no longer declares robots. This is the ONE ` +
          `sanctioned noindex on a listing URL; without it the soft-200 refusal enters the index.`,
      )
    }

    // 5. The rendered copy may not claim a sold key is refused.
    const CLAIMS = [
      /\bsold\b/i,
      /no longer\b[^.]{0,30}\bmarket\b/i,
      /\boff the market\b/i,
      /\bno longer available\b/i,
    ]
    walk(sf, (n) => {
      if (
        ts.isStringLiteral(n) ||
        ts.isNoSubstitutionTemplateLiteral(n) ||
        ts.isJsxText(n)
      ) {
        const text = n.text
        for (const claim of CLAIMS) {
          if (claim.test(text)) {
            failures.push(
              `${UNAVAILABLE}:${lineOf(sf, n)}: the refusal copy says ${JSON.stringify(text.trim())}. ` +
                `A sold key never reaches this page — getListingDetail refuses only IDX opt-outs and ` +
                `Coming Soon, and off-market listings render the full honest state (SITE-21, ruled ` +
                `2026-09-08). Telling a visitor their home "probably sold" is a false statement of ` +
                `fact about a specific address. Say only what is true of every refusal: the address ` +
                `matches nothing we hold, or we are not permitted to display it publicly.`,
            )
          }
        }
      }
    })
  }
}

/* ── 6. a database failure is never a 200 noindex ─────────────────────────── */

const LOOKUP_DAL = 'lib/data/listings/getListingDetail.ts'
const MIDDLEWARE = 'middleware.ts'
const UNAVAILABLE_503 = 'lib/routing/listing-unavailable.ts'

/** The nearest enclosing if-guard's text, or null. */
function guardTextOf(sf, node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isIfStatement(p)) return p.expression.getText(sf)
  }
  return null
}

const ERROR_GUARD = /\.kind\s*===\s*['"]error['"]/

{
  const src = read(LOOKUP_DAL)
  if (src) {
    const sf = parse(LOOKUP_DAL, src)
    const fn = functionNamed(sf, 'getListingLookupUncoalesced')
    if (!fn) {
      failures.push(
        `${LOOKUP_DAL}: getListingLookupUncoalesced not found. It is the lookup that keeps a database ` +
          `failure apart from a missing home; if it moved, re-point this gate in the same commit.`,
      )
    } else {
      let catches = 0
      walk(fn, (n) => {
        if (!ts.isCatchClause(n)) return
        catches++
        const literals = stringsIn(n.block)
        if (!literals.has('error') || literals.has('missing')) {
          failures.push(
            `${LOOKUP_DAL}:${lineOf(sf, n)}: getListingLookup's catch must return { kind: 'error' } and ` +
              `nothing else. A failed read reported as 'missing' renders the noindexed refusal on a ` +
              `live listing, which is how 12 of 150 sampled sitemap listings sat "Excluded by noindex" ` +
              `(URL Inspection, 2026-10-05).`,
          )
        }
      })
      if (catches === 0) {
        failures.push(
          `${LOOKUP_DAL}: getListingLookupUncoalesced has no catch; a failed read must become { kind: 'error' }.`,
        )
      }
    }
  }
}

{
  const src = read(PAGE)
  if (src) {
    const sf = parse(PAGE, src)
    let tempMetaOnError = false
    walk(sf, (n) => {
      const isRefusalMeta =
        ts.isIdentifier(n) && n.text === 'LISTING_UNAVAILABLE_METADATA' && n.parent && ts.isReturnStatement(n.parent)
      const isRefusalJsx =
        (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText(sf) === 'ListingUnavailable'
      if (isRefusalMeta || isRefusalJsx) {
        const guard = guardTextOf(sf, n)
        if (guard && ERROR_GUARD.test(guard)) {
          failures.push(
            `${PAGE}:${lineOf(sf, n)}: the refusal is reached on a lookup ERROR (\`${guard}\`). A ` +
              `database failure is not a missing home: it must never render the noindexed refusal.`,
          )
        }
      }
      if (
        ts.isIdentifier(n) &&
        n.text === 'LISTING_TEMPORARILY_UNAVAILABLE_METADATA' &&
        n.parent &&
        ts.isReturnStatement(n.parent)
      ) {
        const guard = guardTextOf(sf, n)
        if (guard && ERROR_GUARD.test(guard)) tempMetaOnError = true
      }
    })
    if (!tempMetaOnError) {
      failures.push(
        `${PAGE}: generateMetadata no longer returns LISTING_TEMPORARILY_UNAVAILABLE_METADATA under a ` +
          `\`.kind === 'error'\` guard. A failed lookup must get the robots-free temporary metadata.`,
      )
    }
  }
}

{
  const src = read(UNAVAILABLE)
  if (src) {
    const sf = parse(UNAVAILABLE, src)
    let declared = false
    walk(sf, (n) => {
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.name.text === 'LISTING_TEMPORARILY_UNAVAILABLE_METADATA'
      ) {
        declared = true
        if (!n.initializer) return
        walk(n.initializer, (m) => {
          if (
            (ts.isPropertyAssignment(m) || ts.isShorthandPropertyAssignment(m)) &&
            (propertyName(m) ?? m.name?.text) === 'robots'
          ) {
            failures.push(
              `${UNAVAILABLE}:${lineOf(sf, m)}: LISTING_TEMPORARILY_UNAVAILABLE_METADATA declares robots. ` +
                `A temporary failure must never carry a robots directive.`,
            )
          }
        })
      }
    })
    if (!declared) failures.push(`${UNAVAILABLE}: LISTING_TEMPORARILY_UNAVAILABLE_METADATA is missing.`)
  }
}

{
  const mw = read(MIDDLEWARE)
  if (mw) {
    const sf = parse(MIDDLEWARE, mw)
    const called = new Set()
    walk(sf, (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) called.add(n.expression.text)
    })
    for (const name of ['readListingForRequest', 'isListingLookupUnavailable', 'listingTemporarilyUnavailableResponse']) {
      if (!called.has(name)) {
        failures.push(
          `${MIDDLEWARE}: no call to ${name}(). A listing path whose database read fails must answer 503 ` +
            `with Retry-After before the page streams a 200 (lib/routing/listing-unavailable.ts).`,
        )
      }
    }
  }
  const resp = read(UNAVAILABLE_503)
  if (resp) {
    const sf = parse(UNAVAILABLE_503, resp)
    const fn = functionNamed(sf, 'listingTemporarilyUnavailableResponse')
    if (!fn) {
      failures.push(`${UNAVAILABLE_503}: listingTemporarilyUnavailableResponse is missing.`)
    } else {
      const text = fn.getText(sf)
      if (!/status:\s*503\b/.test(text)) failures.push(`${UNAVAILABLE_503}: the response must be status 503.`)
      if (!/['"]retry-after['"]/i.test(text)) failures.push(`${UNAVAILABLE_503}: the response must carry Retry-After.`)
      if (!/no-store/.test(text)) failures.push(`${UNAVAILABLE_503}: the response must be cache-control no-store.`)
    }
    for (const lit of stringsIn(sf)) {
      if (/noindex/i.test(lit)) {
        failures.push(
          `${UNAVAILABLE_503}: a string says ${JSON.stringify(lit.slice(0, 60))}. The 503 must never carry ` +
            `noindex, in a header or the body.`,
        )
      }
    }
  }
}

/* ── 7. out-of-area rows ship in listings.xml (Matt 2026-10-05) ───────────── */

const SITEMAP_ROWS = 'lib/data/sitemap/getListingSitemapRows.ts'
const SERVICE_AREA_NAMES = [
  'isServiceAreaCity',
  'outOfAreaListingPolicy',
  'serviceAreaSitemapTiles',
  'SERVICE_AREA_CITIES_LOWER',
  'SERVICE_AREA_CITIES_PROPER',
  'CENTRAL_OREGON_CITY_SLUGS',
]

{
  const src = read(SITEMAP_ROWS)
  if (src) {
    const sf = parse(SITEMAP_ROWS, src)
    walk(sf, (n) => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        const spec = n.moduleSpecifier.text
        if (/service-area|central-oregon|out-of-area/.test(spec)) {
          failures.push(
            `${SITEMAP_ROWS}:${lineOf(sf, n)}: imports ${spec}. The listings sitemap carries every ` +
              `Active/AUC listing whatever its city; Matt reverted SITE-33's out-of-area sitemap drop ` +
              `on 2026-10-05 (it cost ~36% of the Search Console impression drop since Sep 12).`,
          )
        }
      }
      if (ts.isIdentifier(n) && SERVICE_AREA_NAMES.includes(n.text)) {
        failures.push(
          `${SITEMAP_ROWS}:${lineOf(sf, n)}: names \`${n.text}\`. No geography filter on listings.xml ` +
            `(Matt 2026-10-05, SITE-33 reverted).`,
        )
      }
    })
  }
}

/* ── report ────────────────────────────────────────────────────────────────── */

if (JSON_OUT) {
  console.log(
    JSON.stringify({ gate: 'ci:listing-offmarket-index', failures }, null, 2),
  )
  process.exit(failures.length ? 1 : 0)
}

console.log('listing off-market index gate (ci:listing-offmarket-index)')
console.log('==========================================================')

if (failures.length) {
  console.error('')
  console.error('Off-market listing URLs must stay index,follow (Matt 2026-09-08, SITE-32):')
  for (const f of failures) console.error(`  ✗ ${f}`)
  console.error('')
  console.error('The one policy statement is docs/MASTER_SPEC.md §4.9 "Listing not found / sold /')
  console.error('withdrawn". If the policy is genuinely changing, it changes there first, with Matt.')
  process.exit(1)
}

console.log('OK — no listing page passes noindex (status or geography); only the refusal is noindexed.')
console.log('     listings.xml carries no service-area filter (out-of-area listings indexed, Matt 2026-10-05).')
console.log('     pageMetadata default executed: index, follow. Refusal: index: false, follow: true.')
process.exit(0)
