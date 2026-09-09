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
 *  2. NO STATUS INPUT AT THE CHOKEPOINT. In app/listing/[listingKey]/page.tsx
 *     generateMetadata, the `noindex` passed to pageMetadata is a function of
 *     GEOGRAPHY ONLY. Its expression — resolved through a local const if it was
 *     written as a shorthand — may reference only the out-of-area policy, may
 *     not touch a `status` property, may not name any off-market predicate, and
 *     may not contain an off-market status literal. Three filters, because one
 *     is not enough: an identifier allowlist alone passes
 *     `outOfArea !== null || listing.status === 'Closed'` (every identifier in
 *     it is allowlisted), and a name blocklist alone passes a status compared
 *     through a helper. `nofollow` may not be set at all.
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

/**
 * The ONLY thing `noindex` at the listing chokepoint may depend on: SITE-33's
 * out-of-area geography. Widening this set is a policy change — it needs Matt,
 * and it needs docs/MASTER_SPEC.md §4.9 edited in the same commit.
 */
const GEOGRAPHY_ALLOWLIST = new Set([
  'outOfArea',
  'outOfAreaListingPolicy',
  'listing',
  'undefined',
  'null',
  // Coercions, so `Boolean(outOfArea)` and `!!outOfArea` are not read as a
  // second input. A gate that fails on an honest rewrite gets deleted.
  'Boolean',
])

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

/** Every identifier named anywhere inside an expression. */
function identifiersIn(node, acc = new Set()) {
  walk(node, (n) => {
    if (ts.isIdentifier(n)) {
      // `a.b` — `b` is a property name, not a free identifier.
      if (ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) return
      acc.add(n.text)
    }
    if (n.kind === ts.SyntaxKind.NullKeyword) acc.add('null')
  })
  return acc
}

/** Property names read off an expression (`listing.status` → `status`). */
function propertiesIn(node, acc = new Set()) {
  walk(node, (n) => {
    if (ts.isPropertyAccessExpression(n)) acc.add(n.name.text)
    if (ts.isElementAccessExpression(n) && ts.isStringLiteral(n.argumentExpression)) {
      acc.add(n.argumentExpression.text)
    }
  })
  return acc
}

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
      // Local `const x = <expr>` inside generateMetadata, so a shorthand
      // `noindex` in the pageMetadata argument resolves back to its expression.
      const locals = new Map()
      walk(genMeta, (n) => {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
          locals.set(n.name.text, n.initializer)
        }
      })

      /** The expression actually handed to `noindex`, shorthand resolved. */
      const directives = []
      walk(genMeta, (n) => {
        if (ts.isPropertyAssignment(n) && propertyName(n) === 'noindex') {
          directives.push({ node: n, expr: n.initializer, spelling: 'noindex: <expr>' })
        }
        if (ts.isShorthandPropertyAssignment(n) && n.name.text === 'noindex') {
          const local = locals.get('noindex')
          if (local) {
            directives.push({ node: n, expr: local, spelling: 'noindex, (shorthand for a local)' })
          } else {
            failures.push(
              `${PAGE}:${lineOf(sf, n)}: \`noindex\` is passed as a shorthand this gate cannot ` +
                `resolve to an expression. Pass it inline, or declare the local in generateMetadata.`,
            )
          }
        }
      })

      if (directives.length === 0) {
        failures.push(
          `${PAGE}: generateMetadata passes no \`noindex\` at all. SITE-33's out-of-area branch is ` +
            `expected here (\`noindex: outOfArea !== null\`) — if it was removed, out-of-area ` +
            `listings re-entered the index. Restore it, or amend this gate and the ruling together.`,
        )
      }

      /**
       * The directive's expression AND every local const it reaches through,
       * transitively. `noindex: hidden` where `const hidden = outOfArea !== null`
       * is honest and must pass; the same shape hiding
       * `isPublicOffMarketStatus(listing.status)` one hop away must not. The
       * 2026-09-08 canonical-gate failure is why: that gate held the exact
       * spelling it was tested against and passed against the same defect
       * written one character apart.
       */
      const RESOLUTION_TERMINALS = new Set(['listing'])
      function reach(expr) {
        const exprs = [expr]
        const seen = new Set()
        for (let i = 0; i < exprs.length; i++) {
          for (const id of identifiersIn(exprs[i])) {
            if (seen.has(id) || RESOLUTION_TERMINALS.has(id)) continue
            seen.add(id)
            const local = locals.get(id)
            if (local) exprs.push(local)
          }
        }
        return exprs
      }

      const union = (expr, fn) => {
        const acc = new Set()
        for (const e of reach(expr)) for (const v of fn(e)) acc.add(v)
        return acc
      }

      for (const { node, expr, spelling } of directives) {
        const line = lineOf(sf, node)
        const stray = [...union(expr, identifiersIn)].filter(
          (id) => !GEOGRAPHY_ALLOWLIST.has(id) && !locals.has(id),
        )
        if (stray.length) {
          failures.push(
            `${PAGE}:${line}: \`${spelling}\` reaches for ${stray.map((s) => `\`${s}\``).join(', ')}. ` +
              `The robots directive on a listing page is a function of GEOGRAPHY ONLY ` +
              `(${[...GEOGRAPHY_ALLOWLIST].join(', ')}). Matt ruled 2026-09-08 that off-market URLs ` +
              `stay index,follow — see docs/MASTER_SPEC.md §4.9.`,
          )
        }
        const statusProps = [...union(expr, propertiesIn)].filter((p) => STATUS_NAMES.includes(p))
        if (statusProps.length) {
          failures.push(
            `${PAGE}:${line}: \`${spelling}\` reads ${statusProps.map((s) => `\`.${s}\``).join(', ')}. ` +
              `Status is not an input to indexing on this page. Closed, Expired, Canceled and ` +
              `Withdrawn URLs carry 46% of listing-detail impressions and a CTR at or above Active; ` +
              `an address query has no Active substitute, so a noindex deletes those clicks.`,
          )
        }
        const statusStrings = [...union(expr, stringsIn)].filter((s) =>
          STATUS_LITERALS.some((lit) => s.toLowerCase().includes(lit.toLowerCase())),
        )
        if (statusStrings.length) {
          failures.push(
            `${PAGE}:${line}: \`${spelling}\` compares against the status literal(s) ` +
              `${statusStrings.map((s) => JSON.stringify(s)).join(', ')}. Same ruling: off-market is ` +
              `not a reason to leave the index.`,
          )
        }
      }

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

console.log('OK — indexing on a listing page depends on geography and the refusal path, not status.')
console.log('     pageMetadata default executed: index, follow. Refusal: index: false, follow: true.')
process.exit(0)
