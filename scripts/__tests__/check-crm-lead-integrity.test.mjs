import { describe, it, expect } from 'vitest'
import { scannedFiles, sourceWrites, sourceWriteFailures, SOURCE_ALLOWED } from '../check-crm-lead-integrity.mjs'

/** An in-memory repo: repo-relative path → file text. */
const repo = (files) => (rel) => files[rel] ?? null
/** kind:text of what each write's source can hold, one array per write. */
const read = (src, files = {}) =>
  sourceWrites('app/x.ts', repo({ ...files, 'app/x.ts': src })).map((w) => w.leaves.map((l) => `${l.kind}:${l.text}`))

// FUNNEL-4 (2026-09-23): crm_people.source names the door, never the site host.
describe('check-crm-lead-integrity reads each source write on the syntax tree', () => {
  it("reads the object's own source, not a nested campaign.source, a message value or a comment", () => {
    const src = `
      // crm_people.source: was the host
      const source = siteHost()
      await sendEvent({
        type: 'General Inquiry',
        message: source,
        campaign: { source: 'fb', medium: 'x' },
        /* source: siteHost() */
        source: isJoinInquiry(t) ? 'join' : 'contact-form',
      })`
    expect(read(src)).toEqual([['label:join', 'label:contact-form']])
  })

  it('reads ensureNativeLead writes as well as sendEvent', () => {
    expect(read(`await ensureNativeLead({ email, source: 'place-page' })`)).toEqual([['label:place-page']])
  })

  it('follows a name to what the file assigns it, across lines and through satisfies', () => {
    const src = `
      const NEWSLETTER = 'blog-email' satisfies LeadSource
      const door =
        input.kind === 'newsletter'
          ? NEWSLETTER
          : 'homepage-cta'
      sendEvent({ source: door })`
    expect(read(src)).toEqual([['label:blog-email', 'label:homepage-cta']])
  })

  it('reads a shorthand source', () => {
    expect(read(`const source = siteHost()\nsendEvent({ type: 'Visited Website', source })`)).toEqual([['host:siteHost()']])
  })

  it('follows an imported const to its module, by alias or relative path', () => {
    const lib = { 'lib/doors.ts': "export const DOOR = 'agent-referral'" }
    expect(read(`import { DOOR as D } from '@/lib/doors'\nensureNativeLead({ source: D })`, lib)).toEqual([['label:agent-referral']])
    expect(read(`import { DOOR } from '../lib/doors'\nensureNativeLead({ source: DOOR })`, lib)).toEqual([['label:agent-referral']])
  })

  it('reads the host through a variable, a replace, a URL, a call argument and a template', () => {
    const src = `
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? ''
      sendEvent({ source: base.replace(/^https?:\\/\\//, '') })
      sendEvent({ source: new URL(siteOrigin()).host })
      sendEvent({ source: pick(utm, siteHost()) })
      sendEvent({ source: \`\${base}\` })
      sendEvent({ source: 'https://ryan-realty.com' })`
    expect(read(src).map((leaves) => leaves.some((l) => l.startsWith('host:')))).toEqual([true, true, true, true, true])
  })

  it('reads what it cannot see as opaque: a parameter, a property, a spread, a passed object', () => {
    const src = `
      const door = 'contact-form'
      function f(door: string) { return sendEvent({ source: door }) }
      function g({ source }: Input) { return sendEvent({ source }) }
      sendEvent({ source: params.source })
      sendEvent({ type: 'x', ...rest })
      sendEvent(input)`
    expect(read(src).map((leaves) => leaves.every((l) => l.startsWith('opaque:')))).toEqual([true, true, true, true, true])
  })

  it('reads a template with a fixed lead-in as the door it names', () => {
    expect(read('sendEvent({ source: `Facebook Lead Ad — ${lead.campaignName}` })')).toEqual([
      ['label:`Facebook Lead Ad — ${lead.campaignName}`'],
    ])
  })
})

describe('sourceWriteFailures', () => {
  const files = {
    'app/a.ts': `const source = siteHost()\nsendEvent({ type: 'x', source })`,
    'app/b.ts': `export function f(p: P) {\n  return ensureNativeLead({ source: p.source })\n}`,
    'app/c.ts': `sendEvent({ source: 'contact-form' })`,
  }
  const run = (allowed) => sourceWriteFailures(Object.keys(files), { read: repo(files), allowed })

  it('fails a host source and an unreadable one, naming the file and line', () => {
    const fails = run({})
    expect(fails).toHaveLength(2)
    expect(fails[0]).toMatch(/^app\/a\.ts:2: sendEvent source `source` is the site host/)
    expect(fails[1]).toMatch(/^app\/b\.ts:2: ensureNativeLead source `p\.source` does not read down to a door label \(p\.source\)/)
  })

  it('passes an allowance scoped to the file and expression, of the matching kind', () => {
    expect(
      run({
        'app/a.ts': { source: { kind: 'host', reason: 'not a door' } },
        'app/b.ts': { 'p.source': { kind: 'opaque', reason: 'the caller names the door' } },
      }),
    ).toEqual([])
  })

  it('fails an allowance of the wrong kind, one no write needs, and one for a file not scanned', () => {
    const fails = run({
      'app/a.ts': { source: { kind: 'opaque', reason: 'wrong kind' } },
      'app/b.ts': { 'p.source': { kind: 'opaque', reason: 'ok' } },
      'app/c.ts': { "'contact-form'": { kind: 'opaque', reason: 'a label needs nothing' } },
      'app/gone.ts': { source: { kind: 'host', reason: 'deleted' } },
    })
    expect(fails.some((f) => f.startsWith('app/a.ts:2: sendEvent source `source` is the site host'))).toBe(true)
    expect(fails.some((f) => f.startsWith('app/a.ts: SOURCE_ALLOWED allows `source` (opaque), but no write there needs'))).toBe(true)
    expect(fails.some((f) => f.startsWith("app/c.ts: SOURCE_ALLOWED allows `'contact-form'` (opaque)"))).toBe(true)
    expect(fails.some((f) => f.startsWith('app/gone.ts: SOURCE_ALLOWED allows `source` (host), but the file is not scanned'))).toBe(true)
    expect(fails.some((f) => f.startsWith('app/b.ts'))).toBe(false)
  })
})

// FUNNEL-4 leftovers (2026-10-14): the check named four door files and matched
// text, and nine more doors still wrote the host. It now reads every sendEvent and
// ensureNativeLead in app/ and lib/.
describe('every crm_people.source write in the tree names a door', () => {
  const labels = (rel) => sourceWrites(rel).map((w) => w.leaves.map((l) => `${l.kind}:${l.text}`))

  it('no write outside SOURCE_ALLOWED is the host or unreadable, and every allowance is still needed', () => {
    expect(sourceWriteFailures(scannedFiles())).toEqual([])
  })

  it('the doors that wrote the host until 2026-10-14 write their own label', () => {
    expect(labels('app/actions/cma-download.ts')).toEqual([
      ['label:published-cma'],
      ['label:published-cma'],
      ['label:listing-pricing-read'],
      ['label:listing-pricing-read'],
    ])
    expect(labels('app/actions/saved-searches.ts')).toEqual([['label:idx-registration']])
    expect(labels('app/actions/listing-payment-email.ts')).toEqual([['label:listing-payment-email']])
    expect(labels('app/api/pdf/cma/route.ts')).toEqual([['label:cma-request']])
    expect(labels('app/actions/lead-landing.ts')).toEqual([
      ['label:seller-lp', 'label:buyer-lp'],
      ['label:seller-lp', 'label:buyer-lp'],
    ])
    expect(labels('app/actions/lead-capture.ts')).toEqual([
      ['label:blog-email', 'label:homepage-cta'],
      ['label:rental-calculator'],
      ['label:tetherow-seller-lp', 'label:tetherow-buyer-lp'],
    ])
  })

  it('every allowance says why', () => {
    for (const entries of Object.values(SOURCE_ALLOWED)) {
      for (const { kind, reason } of Object.values(entries)) {
        expect(['host', 'opaque']).toContain(kind)
        expect(reason.length).toBeGreaterThan(20)
      }
    }
  })
})
