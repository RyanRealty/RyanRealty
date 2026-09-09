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
 * status literal (which defeats an identifier allowlist on its own), through a
 * local const one hop away, and as a hand-built robots object — and the honest
 * rewrites (`Boolean(outOfArea)`, `!!outOfArea`, an intermediate const) must
 * still PASS, because a gate that fires on honest code gets deleted by the next
 * person in a hurry.
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

const FILES = [
  'scripts/check-listing-offmarket-index.mjs',
  PAGE,
  BY_ADDRESS,
  UNAVAILABLE,
  META,
  SHARE,
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

/** The shipped out-of-area directive, the one line every break rewrites. */
const SHIPPED_DIRECTIVE = 'noindex: outOfArea !== null,'

/**
 * The generateMetadata copy of the out-of-area lookup. The page body computes
 * the same policy for the visible honesty block, so the bare declaration
 * appears twice — anchor on the comment line above it, which does not.
 */
const OUT_OF_AREA_DECL =
  '  // disagree about which market this home is in.\n' +
  '  const outOfArea = outOfAreaListingPolicy(listing.city)'

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
    it('a predicate call added to the directive', () => {
      reset()
      edit(PAGE, SHIPPED_DIRECTIVE, 'noindex: outOfArea !== null || isPublicOffMarketStatus(listing.status),')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toMatch(/isPublicOffMarketStatus|\.status/)
    })

    it('a bare comparison against a status literal — no new identifier to catch', () => {
      reset()
      edit(PAGE, SHIPPED_DIRECTIVE, "noindex: outOfArea !== null || listing.status === 'Closed',")
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('.status')
      expect(out).toContain('"Closed"')
    })

    it('the status test hidden one hop away in a local const', () => {
      reset()
      edit(
        PAGE,
        OUT_OF_AREA_DECL,
        OUT_OF_AREA_DECL + '\n' +
          '  const hidden = outOfArea !== null || isPublicOffMarketStatus(listing.status)',
      )
      edit(PAGE, SHIPPED_DIRECTIVE, 'noindex: hidden,')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toMatch(/isPublicOffMarketStatus/)
    })

    it('the status test hidden behind a shorthand property', () => {
      reset()
      edit(
        PAGE,
        OUT_OF_AREA_DECL,
        OUT_OF_AREA_DECL + '\n' +
          "  const noindex = outOfArea !== null || listing.standardStatus === 'Expired'",
      )
      edit(PAGE, SHIPPED_DIRECTIVE, 'noindex,')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toMatch(/standardStatus|"Expired"/)
    })

    it('a robots object hand-built around pageMetadata', () => {
      reset()
      edit(
        PAGE,
        SHIPPED_DIRECTIVE,
        'noindex: outOfArea !== null,\n    robots: { index: false, follow: true },',
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('`robots` object is built by hand')
    })

    it('nofollow set alongside it', () => {
      reset()
      edit(PAGE, SHIPPED_DIRECTIVE, 'noindex: outOfArea !== null,\n    nofollow: true,')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('nofollow')
    })

    it('the refusal metadata re-pointed at a status test', () => {
      reset()
      edit(
        PAGE,
        '  if (!listing) return LISTING_UNAVAILABLE_METADATA',
        '  if (!listing || listing.status === \'Closed\') return LISTING_UNAVAILABLE_METADATA',
      )
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('reached on a STATUS test')
    })

    it('the out-of-area branch deleted outright', () => {
      reset()
      edit(PAGE, `\n    ${SHIPPED_DIRECTIVE}`, '')
      const { code, out } = run()
      expect(code).toBe(1)
      expect(out).toContain('passes no `noindex` at all')
    })
  })

  describe('honest rewrites of the same geography branch still pass', () => {
    it('Boolean(outOfArea)', () => {
      reset()
      edit(PAGE, SHIPPED_DIRECTIVE, 'noindex: Boolean(outOfArea),')
      expect(run().code).toBe(0)
    })

    it('!!outOfArea', () => {
      reset()
      edit(PAGE, SHIPPED_DIRECTIVE, 'noindex: !!outOfArea,')
      expect(run().code).toBe(0)
    })

    it('an intermediate const, geography only', () => {
      reset()
      edit(
        PAGE,
        OUT_OF_AREA_DECL,
        OUT_OF_AREA_DECL + '\n' +
          '  const referralOnly = outOfArea !== null',
      )
      edit(PAGE, SHIPPED_DIRECTIVE, 'noindex: referralOnly,')
      expect(run().code).toBe(0)
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
})
