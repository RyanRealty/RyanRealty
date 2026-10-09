import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GA4_BROWSER_EVENTS,
  GA4_BROWSER_EVENTS_NOT_SENT,
  GA4_EVENT_PARAMS,
  GA4_PARAMS_KEY,
  ga4BrowserEventTriggerRegex,
  ga4ListingKey,
  ga4ParamsFrom,
  pushDataLayerEvent,
} from './ga4-browser-events'
import { buildGtmImport, GTM_IMPORT_PATH } from '../../scripts/build-gtm-ga4-import'

const read = (p: string) => readFileSync(p, 'utf8')

/** The EventName union members, read from the source so a new name cannot dodge this test. */
function eventNameUnion(): string[] {
  const src = read('lib/tracking.ts')
  const block = src.match(/export type EventName =([\s\S]*?)\n\n/)
  if (!block) throw new Error('EventName union not found in lib/tracking.ts')
  return [...block[1].replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\|\s*'([A-Za-z_]+)'/g)].map((m) => m[1])
}

describe('GA4 browser events: the GTM trigger covers what the page sends', () => {
  const sent = new Set<string>(GA4_BROWSER_EVENTS)
  const regex = new RegExp(ga4BrowserEventTriggerRegex())

  it('every EventName is either sent by the GTM tag or deliberately not sent', () => {
    const missing = eventNameUnion().filter((n) => !sent.has(n) && !(n in GA4_BROWSER_EVENTS_NOT_SENT))
    expect(missing).toEqual([])
  })

  it('every literal trackEvent name in the repo is covered', () => {
    const out = execSync(`git grep -hoE "trackEvent\\(\\s*'[A-Za-z_]+'" -- '*.ts' '*.tsx'`, { encoding: 'utf8' })
    const names = new Set([...out.matchAll(/'([A-Za-z_]+)'/g)].map((m) => m[1]))
    const missing = [...names].filter((n) => !sent.has(n) && !(n in GA4_BROWSER_EVENTS_NOT_SENT))
    expect(missing).toEqual([])
  })

  it('the trigger regex matches every sent name and nothing it must not send', () => {
    for (const n of GA4_BROWSER_EVENTS) expect(regex.test(n), n).toBe(true)
    for (const n of ['generate_lead', 'page_view', 'form_start', 'valuation_requested', 'gtm.js', 'gtm.dom', 'gtm.load', 'gtm.historyChange', 'view_item', 'add_to_wishlist', 'section_view_x', 'xsection_view']) {
      expect(regex.test(n), n).toBe(false)
    }
  })

  it('sends no event name twice and no name it also lists as not sent', () => {
    expect(new Set(GA4_BROWSER_EVENTS).size).toBe(GA4_BROWSER_EVENTS.length)
    for (const n of Object.keys(GA4_BROWSER_EVENTS_NOT_SENT)) expect(sent.has(n), n).toBe(false)
  })
})

describe('ga4ParamsFrom', () => {
  it('keeps only allowlisted parameters, so PII-ish keys never reach GA4', () => {
    const p = ga4ParamsFrom({ phone_number: '5415550100', email_to: 'a@b.c', href: 'tel:5415550100', page_path: '/x', surface: 'sell' })
    expect(p).toEqual({ surface: 'sell' })
  })

  it('folds aliases to one name per fact, an explicit canonical key wins', () => {
    expect(ga4ParamsFrom({ section_id: 'hero' })).toEqual({ section: 'hero' })
    expect(ga4ParamsFrom({ percent: 50 })).toEqual({ depth: 50 })
    expect(ga4ParamsFrom({ depth_percent: 75, listing_id: 'L1' })).toEqual({ depth: 75, listing_key: 'L1' })
    expect(ga4ParamsFrom({ section_id: 'a', section: 'b' })).toEqual({ section: 'b' })
    expect(ga4ParamsFrom({ section: 'b', section_id: 'a' })).toEqual({ section: 'b' })
    expect(ga4ParamsFrom({ cta_label: 'Call', cta_context: 'hero' })).toEqual({ cta: 'Call', cta_location: 'hero' })
  })

  it('keeps a numeric listing key as text for GA4 with the lk_ prefix (no GTM change)', () => {
    const key = '20251020154621696143598238'
    expect(ga4ParamsFrom({ listing_key: key })).toEqual({ listing_key: `lk_${key}` })
    expect(ga4ParamsFrom({ listing_id: ` ${key} ` })).toEqual({ listing_key: `lk_${key}` })
    expect(ga4ParamsFrom({ listing_key: 220215761 })).toEqual({ listing_key: 'lk_220215761' })
    // Already text to GA4: left alone.
    expect(ga4ParamsFrom({ listing_key: 'L1' })).toEqual({ listing_key: 'L1' })
    expect(ga4ParamsFrom({ listing_key: '  ' })).toEqual({})
    expect(ga4ListingKey('1e5')).toBe('lk_1e5')
    expect(ga4ListingKey('mls-123')).toBe('mls-123')
  })

  it('prefixes only the GA4 copy: the flat dataLayer key keeps the bare listing key', () => {
    const g = globalThis as unknown as { window?: { dataLayer?: unknown[] } }
    const prev = g.window
    g.window = { dataLayer: [] }
    try {
      pushDataLayerEvent('view_listing', { listing_key: '20260331173119587000000000' })
      const pushed = g.window.dataLayer?.[1] as Record<string, unknown>
      expect(pushed.listing_key).toBe('20260331173119587000000000')
      expect((pushed.ga4_params as Record<string, unknown>).listing_key).toBe('lk_20260331173119587000000000')
    } finally {
      g.window = prev
    }
  })

  it('drops empty, non-finite and object values and caps strings at 100 characters', () => {
    const p = ga4ParamsFrom({ source: '  ', value: Number.NaN, context: { a: 1 }, surface: 'x'.repeat(150), method: false })
    expect(p).toEqual({ surface: 'x'.repeat(100), method: false })
  })

  it('does not put page context into ga4_params (the tag reads it flat)', () => {
    expect(ga4ParamsFrom({ page_type: 'sell', broker_slug: 'matt' })).toEqual({})
  })
})

describe('pushDataLayerEvent', () => {
  const g = globalThis as unknown as { window?: { dataLayer?: unknown[] } }
  afterEach(() => {
    delete g.window
  })

  it('clears ga4_params, then pushes the flat event plus ga4_params, with no undefined keys', () => {
    g.window = { dataLayer: [] }
    pushDataLayerEvent('section_view', { section: 'proof', page_type: 'sell', broker_slug: undefined, phone_number: '1' })
    expect(g.window.dataLayer).toEqual([
      { [GA4_PARAMS_KEY]: null },
      { event: 'section_view', section: 'proof', page_type: 'sell', phone_number: '1', [GA4_PARAMS_KEY]: { section: 'proof' } },
    ])
  })
})

describe('no GA4 gtag("event") in browser code', () => {
  it('only the Google Ads conversion call may use gtag("event")', () => {
    const out = execSync(`git grep -nE "gtag[^\\n]{0,12}['\\"]event['\\"]" -- '*.ts' '*.tsx' ':!*.test.ts' ':!*.test.tsx'`, {
      encoding: 'utf8',
    })
    const calls = out
      .split('\n')
      .filter(Boolean)
      .filter((line) => !/^\S+:\d+:\s*(\/\/|\*)/.test(line))
    expect(calls).toEqual([expect.stringMatching(/^lib\/tracking\.ts:\d+:\s+window\.gtag\('event', 'conversion', \{ send_to:/)])
  })
})

describe('GTM steps stay in step with the code', () => {
  const doc = read('docs/GTM_GA4_BROWSER_EVENTS.md')

  it('the doc carries the exact trigger regex and every parameter row', () => {
    expect(doc).toContain(ga4BrowserEventTriggerRegex())
    for (const p of GA4_EVENT_PARAMS) expect(doc).toContain(`| \`${p.name}\` | \`DLV - ga4 ${p.name}\` | \`${p.from}\` |`)
    expect(doc).toContain(`${GA4_EVENT_PARAMS.length} Data Layer Variables`)
    expect(doc).toContain(`(${GA4_EVENT_PARAMS.length} rows.`)
  })

  it('the committed GTM import file is the generated one (npx tsx scripts/build-gtm-ga4-import.ts)', () => {
    expect(JSON.parse(read(GTM_IMPORT_PATH))).toEqual(buildGtmImport())
  })
})
