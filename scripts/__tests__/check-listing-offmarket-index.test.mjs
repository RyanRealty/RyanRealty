import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * THE BREAK TEST FOR ci:listing-offmarket-index (SITE-32).
 *
 * The policy this gate holds is an ABSENCE — no status branch at either listing
 * metadata chokepoint — so the only proof the gate works is a tree where the
 * branch has been put back, in every plausible spelling, failing every time.
 *
 * The spellings matter more here than usual. On 2026-09-08
 * ci:listing-canonical-single passed ten runs against the very defect it was
 * written for, because that defect had been re-typed one character apart and
 * the gate held the SPELLING it had been tested against. So the noindex is
 * restored here as a direct call, as a bare property comparison against a
 * status literal, through a local const one hop away, behind a shorthand, and
 * as a hand-built robots object.
 *
 * SITE-33 REVERTED (Matt 2026-10-05, "Undo it"): the out-of-area noindex cost
 * ~36% of the Search Console impression drop since Sep 12, so geography is no
 * longer a sanctioned input either. Restoring `noindex: outOfArea !== null` in
 * any spelling fails, and so does putting a service-area filter back into the
 * listings sitemap read.
 *
 * The gate runs against a SANDBOX copy of the files it reads, so a deliberately
 * broken tree never touches the repo.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(
  tmpdir(),
  `rr-offmarket-index-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`,
)
const GATE = join(SANDBOX, 'scripts/check-listing-offmarket-index.mjs')

const PAGE = 'app/listing/[listingKey]/page.tsx'
const BY_ADDRESS = 'app/listing/by-address/[...slug]/page.tsx'
const UNAVAILABLE = 'components/site/listing-detail/ListingUnavailable.tsx'
const META = 'lib/site/page-metadata.ts'
const SHARE = 'lib/share-metadata.ts'
const ORIGIN = 'lib/site-origin.ts'

const LOOKUP_DAL = 'lib/data/listings/getListingDetail.ts'
const MIDDLEWARE = 'middleware.ts'
const UNAVAILABLE_503 = 'lib/routing/listing-unavailable.ts'
const SITEMAP_ROWS = 'lib/data/sitemap/getListingSitemapRows.ts'

const FILES = [
  'scripts/check-listing-offmarket-index.mjs',
  PAGE,
  BY_ADDRESS,
  UNAVAILABLE,
  META,
  SHARE,
  ORIGIN,
  LOOKUP_DAL,
  MIDDLEWARE,
  UNAVAILABLE_503,
  SITEMAP_ROWS,
]

function reset() {
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
  if (!existsSync(join(SANDBOX, 'node_modules'))) {
    symlinkSync(join(REPO, 'node_modules'), join(SANDBOX, 'node_modules'), 'dir')
  }
}

function run() {
  try {
    const out = execFileSync('node', [GATE], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

/** Replace exactly once, and fail loudly if the anchor moved. */
function edit(rel, from, to) {
  const p = join(SANDBOX, rel)
  const src = readFileSync(p, 'utf8')
  const parts = src.split(from)
  if (parts.length !== 2) {
    throw new Error(
      `anchor not found exactly once in ${rel} (${parts.length - 1} matches): ${String(from).slice(0, 90)}`,
    )
  }
  writeFileSync(p, parts.join(to))
}

/** The last field generateMetadata hands pageMetadata; every break adds after it. */
const OG_LINE = 'ogImage: `/api/og?type=listing&id=${encodeURIComponent(listing.listingKey)}`,'

/** A line inside generateMetadata to hang a local const off. */
const CANONICAL_DECL = '  const canonicalPath = listingCanonicalHref(listing)'

beforeAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  reset()
})
afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

describe('ci:listing-offmarket-index', () => {
  it('passes on the tree as shipped', () => {
    reset()
    const { code, out } = run()
    expect(out).toContain('index, follow')
    expect(code).toBe(0)
  })

  describe('a status branch at the [listingKey] chokepoint fails, however it is written', () => {
    it('a predicate call as the directive', () => {
      reset()
      edit(PAGE, OG_LINE, OG_LINE + '\n    noindex: isPublicOffMarketStatus(listing.status),')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toMatch(/isPublicOffMarketStatus|Status is not an input/)
    })

    it('a bare comparison against a status literal', () => {
      reset()
      edit(PAGE, OG_LINE, OG_LINE + "\n    noindex: listing.status === 'Closed',")
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('Status is not an input')
    })

    it('the status test hidden one hop away in a local const', () => {
      reset()
      edit(PAGE, CANONICAL_DECL, CANONICAL_DECL + '\n  const hidden = isPublicOffMarketStatus(listing.status)')
      edit(PAGE, OG_LINE, OG_LINE + '\n    noindex: hidden,')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('generateMetadata passes `noindex: hidden`')
    })

    it('the status test hidden behind a shorthand property', () => {
      reset()
      edit(PAGE, CANONICAL_DECL, CANONICAL_DECL + "\n  const noindex = listing.standardStatus === 'Expired'")
      edit(PAGE, OG_LINE, OG_LINE + '\n    noindex,')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('generateMetadata passes `noindex`')
    })

    it('a robots object hand-built around pageMetadata', () => {
      reset()
      edit(PAGE, OG_LINE, OG_LINE + '\n    robots: { index: false, follow: true },')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('`robots` object is built by hand')
    })

    it('nofollow set', () => {
      reset()
      edit(PAGE, OG_LINE, OG_LINE + '\n    nofollow: true,')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('nofollow')
    })

    it('the refusal metadata re-pointed at a status test', () => {
      reset()
      edit(
        PAGE,
        "  if (lookup.kind === 'missing') return LISTING_UNAVAILABLE_METADATA",
        "  if (lookup.kind === 'missing' || (lookup.kind === 'ok' && lookup.listing.status === 'Closed')) return LISTING_UNAVAILABLE_METADATA",
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('reached on a STATUS test')
    })
  })

  describe('the reverted SITE-33 out-of-area noindex fails in every spelling (Matt 2026-10-05)', () => {
    const OOA = '\n  const outOfArea = outOfAreaListingPolicy(listing.city)'
    for (const directive of ['noindex: outOfArea !== null,', 'noindex: Boolean(outOfArea),', 'noindex: !!outOfArea,']) {
      it(directive, () => {
        reset()
        edit(PAGE, CANONICAL_DECL, CANONICAL_DECL + OOA)
        edit(PAGE, OG_LINE, OG_LINE + '\n    ' + directive)
        const { code, out } = run()
        expect(code).toBe(1)
        expect(out).toContain('out-of-area listings are index, follow')
      })
    }

    it('an intermediate const', () => {
      reset()
      edit(PAGE, CANONICAL_DECL, CANONICAL_DECL + OOA + '\n  const referralOnly = outOfArea !== null')
      edit(PAGE, OG_LINE, OG_LINE + '\n    noindex: referralOnly,')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('generateMetadata passes `noindex: referralOnly`')
    })

    it('the service-area filter put back into the listings sitemap read', () => {
      reset()
      edit(
        SITEMAP_ROWS,
        "import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'",
        "import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'\nimport { isServiceAreaCity } from '@/lib/data/listings/service-area'",
      )
      edit(SITEMAP_ROWS, 'assembleListingSitemapRows(tiles, now,', 'assembleListingSitemapRows(tiles.filter((t) => isServiceAreaCity(t.city)), now,')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('imports @/lib/data/listings/service-area')
      expect(out).toContain('names `isServiceAreaCity`')
    })
  })

  describe('the by-address route may add nothing to the directive', () => {
    it('a robots override', () => {
      reset()
      edit(
        BY_ADDRESS,
        '  return generateListingMetadata({ params: Promise.resolve({ listingKey }) })',
        '  const base = await generateListingMetadata({ params: Promise.resolve({ listingKey }) })\n' +
          '  return { ...base, robots: { index: false, follow: true } }',
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('sets `robots`')
    })

    it('a noindex override', () => {
      reset()
      edit(
        BY_ADDRESS,
        '  return generateListingMetadata({ params: Promise.resolve({ listingKey }) })',
        '  const base = await generateListingMetadata({ params: Promise.resolve({ listingKey }) })\n' +
          '  return { ...base, noindex: true }',
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('sets `noindex`')
    })

    it('the delegation dropped for a hand-built object', () => {
      reset()
      edit(
        BY_ADDRESS,
        '  return generateListingMetadata({ params: Promise.resolve({ listingKey }) })',
        "  return { title: 'A home' }",
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('no longer delegates')
    })
  })

  describe('the executed default is held, not just read', () => {
    it('the robots default flipped to noindex', () => {
      reset()
      edit(
        META,
        'robots: { index: !input.noindex, follow: !input.nofollow },',
        'robots: { index: false, follow: !input.nofollow },',
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('{ index: true, follow: true }')
    })

    it('noindex re-fused to nofollow', () => {
      reset()
      edit(
        META,
        'robots: { index: !input.noindex, follow: !input.nofollow },',
        'robots: { index: !input.noindex, follow: !input.noindex },',
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('must never re-fuse to nofollow')
    })
  })

  describe('the refusal stays the one sanctioned noindex, and stops claiming a sale', () => {
    it('follow dropped from the refusal', () => {
      reset()
      edit(UNAVAILABLE, 'robots: { index: false, follow: true },', 'robots: { index: false, follow: false },')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('`follow: true`')
    })

    it('index: false removed from the refusal', () => {
      reset()
      edit(UNAVAILABLE, 'robots: { index: false, follow: true },', 'robots: { index: true, follow: true },')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('`index: false`')
    })

    it('the old "it may have sold" copy restored', () => {
      reset()
      edit(
        UNAVAILABLE,
        "body: 'This address does not match a listing we hold, or it is one we are not permitted to display publicly. A broker can look it up for you. Here is where to go next.',",
        "body: 'It may have sold or been taken off the market. Here is where to look next.',",
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('false statement of fact')
    })

    it('a heading that says the home is no longer on the market', () => {
      reset()
      edit(
        UNAVAILABLE,
        'heading="We can\'t show this home"',
        'heading="This home may no longer be on the market"',
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('refusal copy says')
    })
  })

  // GSC slide fix 2026-10-05: a database failure must never be a 200 noindex.
  describe('a database failure reaching the noindexed refusal fails', () => {
    it('getListingLookup reporting a failed read as missing', () => {
      reset()
      edit(LOOKUP_DAL, "  } catch {\n    return { kind: 'error' }", "  } catch {\n    return { kind: 'missing' }")
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain("must return { kind: 'error' }")
    })

    it('the page rendering the refusal on an error', () => {
      reset()
      edit(PAGE, "if (lookup.kind === 'error') return <ListingTemporarilyUnavailable />", "if (lookup.kind === 'error') return <ListingUnavailable />")
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('lookup ERROR')
    })

    it('generateMetadata returning the refusal metadata on an error', () => {
      reset()
      edit(
        PAGE,
        "if (lookup.kind === 'error') return LISTING_TEMPORARILY_UNAVAILABLE_METADATA",
        "if (lookup.kind === 'error') return LISTING_UNAVAILABLE_METADATA",
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('lookup ERROR')
    })

    it('a robots directive added to the temporary metadata', () => {
      reset()
      edit(UNAVAILABLE, "  title: 'Listing loading',", "  title: 'Listing loading',\n  robots: { index: false, follow: true },")
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('declares robots')
    })

    it('middleware no longer answering a failed read with the 503', () => {
      reset()
      edit(MIDDLEWARE, 'return listingTemporarilyUnavailableResponse(', 'return void (')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('listingTemporarilyUnavailableResponse()')
    })

    it('the 503 downgraded to a 200, or given a noindex', () => {
      reset()
      edit(UNAVAILABLE_503, 'status: 503,', 'status: 200,')
      let r = run()
      expect(r.code).toBe(1)
      expect(r.out).toContain('status 503')
      reset()
      edit(UNAVAILABLE_503, "'cache-control': 'no-store',", "'cache-control': 'no-store',\n    'x-robots-tag': 'noindex',")
      r = run()
      expect(r.code).toBe(1)
      expect(r.out).toContain('never carry')
    })
  })
})
