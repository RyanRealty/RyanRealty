#!/usr/bin/env node
/**
 * check-listing-offmarket-index.mjs — ci:listing-offmarket-index.
 *
 * OFF-MARKET LISTING URLS ARE NOINDEX, FOLLOW (Matt 2026-10-13).
 * When a registry community page exists, the HTML canonical is that
 * community URL. Pending stays index, follow. Geography is not an input
 * (SITE-33 reverted 2026-10-05). listings.xml stays Active/AUC only.
 *
 * The 2026-09-08 SITE-32 keep-indexed ruling is superseded: Search Console
 * showed community pages (Brasada Ranch first) losing impressions to listing
 * URLs, including homes already off the market. The page still returns 200
 * with SITE-21's honest state. One policy: docs/MASTER_SPEC.md §4.9.
 *
 * WHAT THIS GATE CHECKS.
 *
 *  1. THE DEFAULT, EXECUTED. pageMetadata() with no noindex is
 *     { index: true, follow: true }; with noindex it is
 *     { index: false, follow: true }. noindex must never re-fuse to nofollow.
 *
 *  2. THE POLICY HELPER IS THE ONLY NOINDEX AT THE CHOKEPOINT.
 *     generateMetadata must call listingIndexPolicy and pass
 *     `noindex: <result>.noindex` and `path: <result>.canonicalPath`.
 *     Geography (outOfArea) may not reach noindex. `nofollow` may not be set.
 *     A hand-built robots object is forbidden. The helper itself is executed:
 *     Closed/Expired/Canceled/Withdrawn → noindex; a community href becomes
 *     the canonical; Active/AUC/Pending stay indexed on the listing path.
 *
 *  7. OUT-OF-AREA ROWS SHIP IN listings.xml (Matt 2026-10-05).
 *     getListingSitemapRows.ts may not import a service-area predicate.
 *
 *  3. The by-address route delegates and adds nothing.
 *
 *  4. LISTING_UNAVAILABLE_METADATA (IDX / Coming Soon refusal) stays
 *     { index: false, follow: true } and is not reached on a status test.
 *
 *  5. Refusal copy does not claim a sold key is refused.
 *
 *  6. A database failure is never a 200 noindex.
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
const ORIGIN_MODULE = 'lib/site-origin.ts'
const POLICY_MODULE = 'lib/listing/listing-index-policy.ts'

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
          `(off-market listing URLs are noindex,follow) did not move just because the route did.`,
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
  const originSrc = read(ORIGIN_MODULE)
  const shareSrc = read(SHARE_MODULE)
  const metaSrc = read(METADATA_MODULE)
  if (!originSrc || !shareSrc || !metaSrc) return null

  // site-origin.ts imports nothing; share-metadata.ts imports only from it;
  // page-metadata.ts imports only from share-metadata and a `type` from next
  // (which transpileModule erases). Transpile the three SEPARATELY and rewrite
  // each one specifier to the module below's data URL — esbuild is not
  // guaranteed present in every lane, and concatenating them collides on the
  // private const both metadata files happen to name MAX_DESC.
  const asModule = (src) =>
    `data:text/javascript;base64,${Buffer.from(
      ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    ).toString('base64')}`

  const shareOnly = shareSrc.replace(/'@\/lib\/site-origin'/, JSON.stringify(asModule(originSrc)))
  const metaOnly = metaSrc.replace(/'@\/lib\/share-metadata'/, JSON.stringify(asModule(shareOnly)))
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
            `${JSON.stringify(plain)} — it must be { index: true, follow: true }. Active, ` +
            `Pending, and Active Under Contract listing pages ride this default.`,
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

{
  const policySrc = read(POLICY_MODULE)
  if (policySrc) {
    if (!/isPublicOffMarketStatus/.test(policySrc)) {
      failures.push(
        `${POLICY_MODULE}: listingIndexPolicy must read isPublicOffMarketStatus. Do not keep a second status list.`,
      )
    }
    const stub = `export function isPublicOffMarketStatus(s) {
      return ['Closed', 'Expired', 'Canceled', 'Withdrawn'].includes(String(s ?? ''))
    }`
    const asModule = (src) =>
      `data:text/javascript;base64,${Buffer.from(
        ts.transpileModule(src, {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText,
      ).toString('base64')}`
    try {
      const rewritten = policySrc.replace(
        /'@\/lib\/listing-status-public'/,
        JSON.stringify(asModule(stub)),
      )
      const mod = await import(asModule(rewritten))
      const fn = mod.listingIndexPolicy
      if (typeof fn !== 'function') {
        failures.push(`${POLICY_MODULE}: listingIndexPolicy is not exported.`)
      } else {
        const listingPath = '/homes-for-sale/powell-butte/brasada-ranch/1-main-220000000'
        const communityHref = '/communities/brasada-ranch'
        for (const status of ['Closed', 'Expired', 'Canceled', 'Withdrawn']) {
          const withCommunity = fn({ status, listingPath, communityHref })
          if (!withCommunity?.noindex || withCommunity.canonicalPath !== communityHref) {
            failures.push(
              `${POLICY_MODULE}: ${status} with a community href returned ` +
                `${JSON.stringify(withCommunity)} — must be { noindex: true, canonicalPath: communityHref }.`,
            )
          }
          const alone = fn({ status, listingPath, communityHref: null })
          if (!alone?.noindex || alone.canonicalPath !== listingPath) {
            failures.push(
              `${POLICY_MODULE}: ${status} without a community href returned ` +
                `${JSON.stringify(alone)} — must be { noindex: true, canonicalPath: listingPath }.`,
            )
          }
        }
        for (const status of ['Active', 'Active Under Contract', 'Pending']) {
          const onMarket = fn({ status, listingPath, communityHref })
          if (onMarket?.noindex || onMarket?.canonicalPath !== listingPath) {
            failures.push(
              `${POLICY_MODULE}: ${status} returned ${JSON.stringify(onMarket)} — ` +
                `must stay { noindex: false, canonicalPath: listingPath }.`,
            )
          }
        }
      }
    } catch (error) {
      failures.push(
        `${POLICY_MODULE}: this gate could not execute listingIndexPolicy (${error.message}).`,
      )
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
      // Off-market noindex must come from listingIndexPolicy, not an inline
      // status or geography test. Geography is still not an input (SITE-33).
      let callsPolicy = false
      walk(genMeta, (n) => {
        if (
          ts.isCallExpression(n) &&
          ts.isIdentifier(n.expression) &&
          n.expression.text === 'listingIndexPolicy'
        ) {
          callsPolicy = true
        }
      })
      if (!callsPolicy) {
        failures.push(
          `${PAGE}: generateMetadata must call listingIndexPolicy. Off-market pages are ` +
            `noindex, follow through that helper (Matt 2026-10-13); do not inline a status test.`,
        )
      }

      let policyNoindex = 0
      let policyCanonicalPath = 0
      walk(genMeta, (n) => {
        const isNoindex =
          (ts.isPropertyAssignment(n) && propertyName(n) === 'noindex') ||
          (ts.isShorthandPropertyAssignment(n) && n.name.text === 'noindex')
        if (!isNoindex) return
        const text = n.getText(sf)
        const init = ts.isPropertyAssignment(n) ? n.initializer : n.name
        const fromPolicy =
          ts.isPropertyAccessExpression(init) && init.name.text === 'noindex'
        if (fromPolicy) {
          policyNoindex++
          if (/outOfArea/.test(init.getText(sf))) {
            failures.push(
              `${PAGE}:${lineOf(sf, n)}: generateMetadata passes \`${text.replace(/\s+/g, ' ').slice(0, 120)}\`. ` +
                `Out-of-area listings are index, follow (Matt 2026-10-05 reverted SITE-33; the ` +
                `out-of-area noindex cost ~36% of the Search Console impression drop since Sep 12).`,
            )
          }
          return
        }
        failures.push(
          `${PAGE}:${lineOf(sf, n)}: generateMetadata passes \`${text.replace(/\s+/g, ' ').slice(0, 120)}\`. ` +
            `The only sanctioned noindex here is \`indexPolicy.noindex\` from listingIndexPolicy. ` +
            `Geography is not an input (out-of-area listings are index, follow too).`,
        )
      })
      if (policyNoindex === 0) {
        failures.push(
          `${PAGE}: generateMetadata must pass \`noindex: indexPolicy.noindex\` to pageMetadata.`,
        )
      }

      walk(genMeta, (n) => {
        if (!(ts.isPropertyAssignment(n) && propertyName(n) === 'path')) return
        const init = n.initializer
        if (ts.isPropertyAccessExpression(init) && init.name.text === 'canonicalPath') {
          policyCanonicalPath++
          return
        }
        failures.push(
          `${PAGE}:${lineOf(sf, n)}: pageMetadata \`path\` must be \`indexPolicy.canonicalPath\` ` +
            `so an off-market home with a community page consolidates to that community URL.`,
        )
      })
      if (policyCanonicalPath === 0) {
        failures.push(
          `${PAGE}: generateMetadata must pass \`path: indexPolicy.canonicalPath\` to pageMetadata.`,
        )
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
  console.error('Off-market listing URLs must be noindex,follow (Matt 2026-10-13):')
  for (const f of failures) console.error(`  ✗ ${f}`)
  console.error('')
  console.error('The one policy statement is docs/MASTER_SPEC.md §4.9 "Listing not found / sold /')
  console.error('withdrawn". Community canonical when a registry community page exists.')
  process.exit(1)
}

console.log('OK — off-market listing pages pass noindex, follow through listingIndexPolicy;')
console.log('     community canonical when one exists. Active/AUC/Pending stay index, follow.')
console.log('     Geography is not an input. listings.xml is Active/AUC only, no service-area filter.')
console.log('     pageMetadata default executed: index, follow. Refusal: index: false, follow: true.')
process.exit(0)
