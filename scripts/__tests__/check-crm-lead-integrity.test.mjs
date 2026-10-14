import { describe, it, expect } from 'vitest'
import { isSiteHostSource } from '../../lib/crm/lead-source'
import { isHostLiteral, scannedFiles, sourceWrites, sourceWriteFailures, SOURCE_ALLOWED } from '../check-crm-lead-integrity.mjs'

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

// A review on 2026-10-14 found the first version of this reader missing each of
// these (it kept one name table per file and matched host text): the host got
// through, or a clean label failed.
describe('reads a name the way TypeScript scopes it', () => {
  /** The leaf kinds of each write. */
  const kinds = (src, files) => read(src, files).map((leaves) => leaves.map((l) => l.split(':')[0]))

  it('a destructured, loop, catch or block-scoped name is its own binding, not a same-named const elsewhere', () => {
    expect(
      kinds(`
        export async function door() { const source = 'contact-form'; await sendEvent({ type: 'x', source }) }
        export async function click() { const { source } = { source: siteHost() }; await sendEvent({ type: 'y', source }) }`),
    ).toEqual([['label'], ['host']])
    expect(kinds(`const door = 'contact-form'\nfor (const door of [siteHost()]) sendEvent({ source: door })`)).toEqual([['opaque']])
    expect(kinds(`for (let door of doors) { if (!door) door = 'contact-form'; sendEvent({ source: door }) }`)).toEqual([['opaque', 'label']])
    expect(kinds(`const src = 'contact-form'\ntry { risky() } catch (src) { sendEvent({ source: src }) }`)).toEqual([['opaque']])
    expect(kinds(`function f(door: string) { { const door = siteHost(); return sendEvent({ source: door }) } }`)).toEqual([['host']])
  })

  it('follows every assignment to a name, compound ones included', () => {
    expect(kinds(`let source = ''\nsource ||= siteHost()\nsendEvent({ source })`)).toEqual([['empty', 'host']])
    expect(kinds(`let source = 'contact-form'\nif (x) source += siteOrigin()\nsendEvent({ source })`)).toEqual([['label', 'host']])
    expect(kinds(`let source = 'contact'\nif (x) source += '-form'\nsendEvent({ source })`)).toEqual([['label', 'opaque']])
  })

  it('keeps every arm when one name sits in two of them', () => {
    const src = `
      export async function POST(req: Request) {
        const host = req.headers.get('host')
        await sendEvent({ source: tagged ? \`web-\${host}\` : host })
      }`
    expect(kinds(src)).toEqual([['label', 'opaque']])
  })

  it('spells out a joined string, so a host built from pieces is the host', () => {
    expect(read("const tld = 'com'\nsendEvent({ source: `ryan-realty.${tld}` })")).toEqual([['host:ryan-realty.com']])
    expect(read("const h = siteHost()\nsendEvent({ source: 'door-' + h })")).toEqual([["host:'door-' + h"]])
    expect(read("const kind = 'seller'\nsendEvent({ source: kind + '-lp' })")).toEqual([['label:seller-lp']])
    // A lead-in that starts the host or a URL, before a piece this gate cannot read.
    expect(kinds("sendEvent({ source: `https://${req.host}/` })\nsendEvent({ source: 'ryan-realty.' + input.tld })")).toEqual([['host'], ['host']])
  })

  it('a spread after the key may override it', () => {
    expect(kinds(`const extra = { source: siteHost() }\nsendEvent({ type: 'x', source: 'contact-form', ...extra })`)).toEqual([['label', 'host']])
    expect(kinds(`const extra = { tags: [] }\nsendEvent({ type: 'x', source: 'contact-form', ...extra })`)).toEqual([['label']])
  })

  it('finds a writer under any local name, and a computed key', () => {
    expect(kinds(`import { sendEvent as capture } from '@/lib/crm/send-event'\ncapture({ type: 'x', source: siteHost() })`)).toEqual([['host']])
    expect(kinds(`const fire = sendEvent\nfire({ type: 'x', source: siteHost() })`)).toEqual([['host']])
    expect(kinds(`const { ensureNativeLead: save } = await import('@/lib/data/crm/ensureNativeLead')\nsave({ source: siteHost() })`)).toEqual([['host']])
    expect(kinds(`sendEvent({ type: 'x', ['source']: siteHost() })`)).toEqual([['host']])
  })

  it('reads an empty source as naming no door', () => {
    expect(kinds(`sendEvent({ source: '' })\nsendEvent({ source: undefined })`)).toEqual([['empty'], ['empty']])
  })

  it('follows export aliases, re-export barrels and export *', () => {
    const lib = {
      'lib/doors.ts': "const DOOR = 'contact-form'\nconst HOST = siteHost()\nexport { HOST as DOOR }",
      'lib/barrel/index.ts': "export { DOOR } from './labels'\nexport * from './more'",
      'lib/barrel/labels.ts': "export const DOOR = 'contact-form'",
      'lib/barrel/more.ts': "export const OTHER = 'place-page'",
    }
    expect(kinds(`import { DOOR } from '@/lib/doors'\nsendEvent({ source: DOOR })`, lib)).toEqual([['host']])
    expect(read(`import { DOOR, OTHER } from '@/lib/barrel'\nsendEvent({ source: DOOR })\nsendEvent({ source: OTHER })`, lib)).toEqual([
      ['label:contact-form'],
      ['label:place-page'],
    ])
  })

  it("reads an object literal's own property, not the whole literal", () => {
    expect(read(`const cfg = { url: siteOrigin(), door: 'contact-form' }\nsendEvent({ source: cfg.door })`)).toEqual([['label:contact-form']])
  })

  it('names the host only from a host call or value, not from a name that looks like one', () => {
    expect(read(`sendEvent({ source: 'https-something' })`)).toEqual([['label:https-something']])
    expect(kinds(`const siteUrl = 'x'\nsendEvent({ source: pickDoor(siteUrl) })`)).toEqual([['opaque']])
    expect(kinds(`const h = siteHost()\nsendEvent({ source: await Promise.resolve(h) })`)).toEqual([['host']])
  })

  it('reads every host spelling isSiteHostSource reads, and no door label', () => {
    const hosts = ['ryan-realty.com', 'www.ryan-realty.com', 'Ryan-Realty.com', 'ryanrealty.com', 'ryanrealty.vercel.app', 'pr-12.ryan-realty.vercel.app', 'localhost', 'localhost:3000', ' ryan-realty.com ']
    for (const h of hosts) expect([h, isSiteHostSource(h), isHostLiteral(h)]).toEqual([h, true, true])
    for (const d of ['contact-form', 'seller-lp', 'Website booking', 'https-something', 'tetherow-buyer-lp', 'agent-referral']) {
      expect([d, isSiteHostSource(d), isHostLiteral(d)]).toEqual([d, false, false])
    }
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
    expect(fails[0]).toMatch(/^app\/a\.ts:2: sendEvent source `source` can be the site host\. /)
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
    expect(fails.some((f) => f.startsWith('app/a.ts:2: sendEvent source `source` can be the site host'))).toBe(true)
    expect(fails.some((f) => f.startsWith('app/a.ts: SOURCE_ALLOWED allows `source` (opaque), but no write there needs'))).toBe(true)
    expect(fails.some((f) => f.startsWith("app/c.ts: SOURCE_ALLOWED allows `'contact-form'` (opaque)"))).toBe(true)
    expect(fails.some((f) => f.startsWith('app/gone.ts: SOURCE_ALLOWED allows `source` (host), but the file is not scanned'))).toBe(true)
    expect(fails.some((f) => f.startsWith('app/b.ts'))).toBe(false)
  })

  it('a host allowance does not cover an unreadable arm, and an empty source is never allowed', () => {
    const mixed = { 'app/m.ts': `const source = flag ? siteHost() : input.door\nsendEvent({ type: 'Visited Website', source })` }
    const runMixed = (allowed) => sourceWriteFailures(['app/m.ts'], { read: repo(mixed), allowed })
    expect(runMixed({ 'app/m.ts': { source: { kind: 'host', reason: 'not a door' } } }).some((f) => f.includes('can be the site host, or values this gate cannot read (input.door)'))).toBe(true)
    expect(runMixed({ 'app/m.ts': { source: { kind: 'host+opaque', reason: 'not a door, and the caller names it' } } })).toEqual([])
    const empty = { 'app/e.ts': `sendEvent({ source: '' })` }
    expect(sourceWriteFailures(['app/e.ts'], { read: repo(empty), allowed: {} })).toEqual([
      "app/e.ts:1: sendEvent source `''` can be empty, which names no door. Write the door label (FUNNEL-4).",
    ])
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
