import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * THE BREAK TEST FOR ci:offmarket-listing-cta.
 *
 * A gate that only catches the exact code its author deleted is decoration.
 * On 2026-09-08 ci:listing-canonical-single passed ten runs against the very
 * defect it was written for, because the defect had been re-typed one character
 * apart (`base.alternates = { canonical }` instead of `alternates: { canonical }`)
 * and the gate held the SPELLING it had been tested against, not the defect.
 *
 * So every branch this gate holds is restored here in MORE THAN ONE plausible
 * spelling — the ternary, the negated `&&`, the early return, the guard moved
 * into a helper variable — and each one must FAIL. And each branch's correct
 * form, in more than one spelling, must PASS: a gate that fails on honest code
 * gets deleted by the next person in a hurry.
 *
 * The gate runs against a SANDBOX copy of the five files it reads, so a
 * deliberately broken tree never touches the repo.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(
  tmpdir(),
  `rr-offmarket-gate-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`,
)
const GATE = join(SANDBOX, 'scripts/check-offmarket-listing-cta.mjs')

const PAGE = 'app/listing/[listingKey]/page.tsx'
const STRIP = 'components/site/listing-detail/PriceCtaStrip.tsx'
const BAR = 'components/site/listing-detail/ListingMobileContactBar.client.tsx'
const CARD = 'components/site/listing-detail/TextMattCTA.tsx'
const STATUS = 'lib/listing-status-public.ts'

const FILES = [
  'scripts/check-offmarket-listing-cta.mjs',
  STATUS,
  'lib/listing/publish-listing-published-price.ts',
  PAGE,
  STRIP,
  BAR,
  CARD,
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
  const before = readFileSync(p, 'utf8')
  const hits = before.split(from).length - 1
  if (hits !== 1) {
    throw new Error(`anchor appears ${hits}× in ${rel} (expected 1): ${from.slice(0, 80)}`)
  }
  writeFileSync(p, before.replace(from, to))
}

beforeAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
  reset()
})
afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

describe('ci:offmarket-listing-cta', () => {
  it('passes on an untouched copy of the tree', () => {
    reset()
    const r = run()
    expect(r.out).toContain('OK - every off-market branch is present and guarded')
    expect(r.code).toBe(0)
  })

  /* ── the payment ─────────────────────────────────────────────────────────── */

  it('FAILS when the payment loses its guard — condition deleted', () => {
    reset()
    edit(PAGE, '{!offMarket && wholePropertyPrice != null ? (', '{wholePropertyPrice != null ? (')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('the payment calculator is NOT guarded')
  })

  it('FAILS when the payment guard is faked with a lookalike identifier', () => {
    reset()
    edit(
      PAGE,
      '{!offMarket && wholePropertyPrice != null ? (',
      '{marketGeo == null && wholePropertyPrice != null ? (',
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('the payment calculator is NOT guarded')
  })

  it('PASSES when the payment guard is re-spelled as a ternary the other way round', () => {
    reset()
    edit(
      PAGE,
      '{!offMarket && wholePropertyPrice != null ? (',
      '{offMarket || wholePropertyPrice == null ? null : (',
    )
    // the JSX arms swap with the condition; rebuild the tail to match.
    edit(
      PAGE,
      `            listingKey={listing.listingKey}
          />
        </div>
      ) : null}`,
      `            listingKey={listing.listingKey}
          />
        </div>
      )}`,
    )
    const r = run()
    expect(r.out).toContain('OK - every off-market branch')
    expect(r.code).toBe(0)
  })

  /* ── the market-ask instrument ───────────────────────────────────────────── */

  it('FAILS when the ask instrument loses its guard — condition deleted', () => {
    reset()
    edit(
      PAGE,
      '{!offMarket && askClaim ? <ListingAskInstrument claim={askClaim} /> : null}',
      '{askClaim ? <ListingAskInstrument claim={askClaim} /> : null}',
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('the market-ask instrument is NOT guarded')
  })

  it('FAILS when the ask instrument is mounted unconditionally', () => {
    reset()
    edit(
      PAGE,
      '{!offMarket && askClaim ? <ListingAskInstrument claim={askClaim} /> : null}',
      '<ListingAskInstrument claim={askClaim!} />',
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('the market-ask instrument is NOT guarded')
  })

  /* ── the three-act close ─────────────────────────────────────────────────── */

  it('FAILS when the close loses its guard', () => {
    reset()
    edit(PAGE, '{!offMarket ? (\n        <V3ListingClose', '{true ? (\n        <V3ListingClose')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('the three-act close')
  })

  /* ── the page's own tel:/sms: ────────────────────────────────────────────── */

  it('FAILS when the page hands the strip an unguarded tel:', () => {
    reset()
    edit(PAGE, 'callHref={ctaTel && !offMarket ? `tel:${ctaTel}` : null}', 'callHref={ctaTel ? `tel:${ctaTel}` : null}')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('a tel:/sms: contact URI is NOT guarded')
  })

  it('FAILS when the page hands the strip an unguarded sms:', () => {
    reset()
    edit(PAGE, 'textHref={ctaTel && !offMarket ? `sms:${ctaTel}` : null}', 'textHref={ctaTel ? `sms:${ctaTel}` : null}')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('a tel:/sms: contact URI is NOT guarded')
  })

  /* ── the price strip's ask ───────────────────────────────────────────────── */

  it('FAILS when the strip serves Tour / Call / Text to everyone — branch removed', () => {
    reset()
    const p = join(SANDBOX, STRIP)
    const src = readFileSync(p, 'utf8')
    const start = src.indexOf('        {offMarket ? (')
    const end = src.indexOf('        <V3Button\n          type="button"', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const onMarketArm = `        <V3Button href={tourHref}>Tour</V3Button>
        <V3Button href={callHref!} variant="ghost">Call</V3Button>
        <V3Button href={textHref!} variant="ghost">Text</V3Button>
`
    writeFileSync(p, src.slice(0, start) + onMarketArm + src.slice(end))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('the Tour / Call / Text ask is NOT guarded')
  })

  /* ── the mobile bar, whose hrefs are built client-side ───────────────────── */

  it('FAILS when the mobile bar loses its early return — the whole branch deleted', () => {
    reset()
    const p = join(SANDBOX, BAR)
    const src = readFileSync(p, 'utf8')
    const start = src.indexOf('  if (offMarket) {')
    const end = src.indexOf('  const phone =', start)
    expect(start).toBeGreaterThan(-1)
    writeFileSync(p, src.slice(0, start) + src.slice(end))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('a tel:/sms: contact URI is NOT guarded')
  })

  it('FAILS when the early return survives but stops testing the flag', () => {
    reset()
    edit(BAR, '  if (offMarket) {', '  if (listingKey === "never") {')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('a tel:/sms: contact URI is NOT guarded')
  })

  it('PASSES when the mobile bar guard is re-spelled as a ternary instead of an early return', () => {
    reset()
    const p = join(SANDBOX, BAR)
    const src = readFileSync(p, 'utf8')
    const rewritten = src
      .replace('  if (offMarket) {\n    return (', '  if (offMarket) {\n    return (')
      .replace(
        'const tel = phone ? phone.replace(/[^\\d]/g, \'\') : null',
        "const tel = offMarket ? null : phone ? phone.replace(/[^\\d]/g, '') : null",
      )
      .replace(/\{`tel:\$\{tel\}`\}/g, '{offMarket ? undefined : `tel:${tel}`}')
      .replace(/\{`sms:\$\{tel\}`\}/g, '{offMarket ? undefined : `sms:${tel}`}')
    writeFileSync(p, rewritten)
    const r = run()
    expect(r.out).toContain('OK - every off-market branch')
    expect(r.code).toBe(0)
  })

  /* ── the broker card ─────────────────────────────────────────────────────── */

  it('FAILS when the broker card publishes Call / Text on a sold home', () => {
    reset()
    edit(CARD, '{phone && !offMarket ? (', '{phone ? (')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('a tel:/sms: contact URI is NOT guarded')
  })

  it('FAILS when only the button pair loses its guard, the phone line keeping one', () => {
    reset()
    edit(CARD, '          {offMarket ? (\n            <a href={valuationHref', '          {false ? (\n            <a href={valuationHref')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('a tel:/sms: contact URI is NOT guarded')
  })

  /* ── the replacement content ─────────────────────────────────────────────── */

  it('FAILS when the sold facts are removed, leaving a page that only withholds', () => {
    reset()
    edit(PAGE, '<ListingOffMarketFacts', '<ListingOffMarketFactsRemoved')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('ListingOffMarketFacts is not mounted')
  })

  it('FAILS when the saved search is removed', () => {
    reset()
    edit(PAGE, '<ListingLikeThisAlerts', '<ListingLikeThisAlertsRemoved')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('ListingLikeThisAlerts is not mounted')
  })

  /* ── the predicate itself ────────────────────────────────────────────────── */

  it('FAILS when the predicate is rewired to the complement of the active set — Pending dies', () => {
    reset()
    edit(
      STATUS,
      'export function isPublicOffMarketStatus(s: string | null | undefined): boolean {\n  return listingIsOffMarket(s)\n}',
      'export function isPublicOffMarketStatus(s: string | null | undefined): boolean {\n' +
        '  const v = (s ?? "").trim()\n' +
        '  return v.length > 0 && !PUBLIC_ACTIVE_STATUSES.includes(v as never)\n}',
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('isPublicOffMarketStatus("Pending") must be FALSE')
  })

  it('FAILS when the predicate is inverted', () => {
    reset()
    edit(
      STATUS,
      'export function isPublicOffMarketStatus(s: string | null | undefined): boolean {\n  return listingIsOffMarket(s)\n}',
      'export function isPublicOffMarketStatus(s: string | null | undefined): boolean {\n  return !listingIsOffMarket(s)\n}',
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('must be true')
  })

  it('FAILS when a second list of statuses is typed into the public module', () => {
    reset()
    edit(
      STATUS,
      'export function isPublicOffMarketStatus(s: string | null | undefined): boolean {\n  return listingIsOffMarket(s)\n}',
      'const OFF = new Set(["Closed", "Expired", "Canceled", "Withdrawn"])\n' +
        'export function isPublicOffMarketStatus(s: string | null | undefined): boolean {\n' +
        '  return OFF.has((s ?? "").trim())\n}',
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/the literal 'Expired' appears here/)
  })

  it('FAILS when the page stops asking the predicate at all', () => {
    reset()
    edit(PAGE, "import { isPublicOffMarketStatus } from '@/lib/listing-status-public'\n", '')
    edit(PAGE, '  const offMarket = isPublicOffMarketStatus(listing.status)', '  const offMarket = false')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('does not call isPublicOffMarketStatus')
  })
})
