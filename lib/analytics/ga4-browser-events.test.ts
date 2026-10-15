import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GA4_BROWSER_EVENTS,
  GA4_BROWSER_EVENTS_NOT_SENT,
  GA4_EVENT_PARAMS,
  GA4_PAGE_VIEW_PARAMS,
  GA4_PAGE_VIEW_TAG_NAME,
  GA4_PAGE_VIEW_TRIGGER_NAME,
  GA4_PARAMS_KEY,
  GA4_USER_PROPERTIES,
  ga4BrowserEventTriggerRegex,
  ga4ListingKey,
  GA4_PARAM_ALIASES,
  ga4ParamsFrom,
  pushDataLayerEvent,
  setGa4PageLocation,
} from './ga4-browser-events'
import { isPersonParamName } from '@/app/api/visitors/track/strip-identity'
import { buildGtmImport, gtmVariableFor, GTM_IMPORT_PATH, GTM_TAG_NAME } from '../../scripts/build-gtm-ga4-import'

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
    for (const p of GA4_EVENT_PARAMS) expect(doc).toContain(`| \`${p.name}\` | \`${gtmVariableFor(p)}\` | \`${p.from}\` |`)
    expect(doc).toContain(`${buildGtmImport().containerVersion.variable.length} variables`)
    expect(doc).toContain(`(${GA4_EVENT_PARAMS.length} rows.`)
  })

  it('the doc carries the page_view tag and every one of its parameter rows', () => {
    expect(doc).toContain(`\`${GA4_PAGE_VIEW_TAG_NAME}\``)
    expect(doc).toContain(`\`${GA4_PAGE_VIEW_TRIGGER_NAME}\``)
    for (const p of GA4_PAGE_VIEW_PARAMS) expect(doc).toContain(`| \`${p.name}\` | \`${gtmVariableFor(p)}\` | \`${p.from}\``)
    expect(doc).toContain('`send_page_view` = `false`')
  })

  it('the doc carries every user property row (GTM version 10)', () => {
    for (const p of GA4_USER_PROPERTIES) expect(doc).toContain(`| \`${p.name}\` | \`${gtmVariableFor(p)}\` | \`${p.from}\` |`)
  })

  it('the committed GTM import file is the generated one (npx tsx scripts/build-gtm-ga4-import.ts)', () => {
    expect(JSON.parse(read(GTM_IMPORT_PATH))).toEqual(buildGtmImport())
  })
})

/**
 * GTM version 10 (2026-10-14, live): both GA4 Event tags send content_group from
 * page_type and set the user properties visitor_intent / primary_market from
 * their flat dataLayer keys (lib/analytics/visitor-intent.ts).
 */
describe('GTM version 10: content group and visitor-intent user properties', () => {
  type Param = { key: string; value?: string; list?: Array<{ map: Array<{ key: string; value: string }> }> }
  type Tag = { name: string; parameter: Param[] }
  const container = buildGtmImport().containerVersion
  const tags = container.tag as unknown as Tag[]
  const rows = (tag: Tag, key: string, k: string, v: string) =>
    Object.fromEntries(
      (tag.parameter.find((p) => p.key === key)?.list ?? []).map((row) => {
        const m = Object.fromEntries(row.map.map((x) => [x.key, x.value]))
        return [m[k], m[v]]
      }),
    )

  it('the user properties are the two flat keys', () => {
    expect(GA4_USER_PROPERTIES.map((p) => [p.name, p.from])).toEqual([
      ['visitor_intent', 'visitor_intent'],
      ['primary_market', 'primary_market'],
    ])
  })

  it.each([GTM_TAG_NAME, GA4_PAGE_VIEW_TAG_NAME])('%s sets both user properties and sends content_group from page_type', (name) => {
    const tag = tags.find((t) => t.name === name)!
    expect(rows(tag, 'userProperties', 'name', 'value')).toEqual({
      visitor_intent: '{{DLV - ga4 visitor_intent}}',
      primary_market: '{{DLV - ga4 primary_market}}',
    })
    expect(rows(tag, 'eventSettingsTable', 'parameter', 'parameterValue').content_group).toBe('{{DLV - ga4 page_type}}')
  })

  it('content_group reuses the page_type variable; the user properties get one variable each', () => {
    const vars = container.variable.map((v) => [v.name, v.parameter.find((p) => p.key === 'name')?.value])
    expect(vars).toContainEqual(['DLV - ga4 visitor_intent', 'visitor_intent'])
    expect(vars).toContainEqual(['DLV - ga4 primary_market', 'primary_market'])
    expect(vars.filter(([, key]) => key === 'page_type')).toEqual([['DLV - ga4 page_type', 'page_type']])
    expect(new Set(vars.map(([name]) => name)).size).toBe(vars.length)
  })

  it('content_group never enters ga4_params (it is page context, read flat)', () => {
    expect(ga4ParamsFrom({ content_group: 'sell', page_type: 'sell' })).toEqual({})
  })
})

/**
 * No personal information reaches GA4 (Matt 2026-10-14; GA4's terms forbid it).
 * Found live 2026-10-14: on /sell?address=<typed address>, view_landing_page and
 * every other dataLayer event went to GA4 with that address as dl=, because the
 * GTM event tag reads the browser's location. A `gtag('set')` with the safe
 * address now precedes the event, and no registry names a person parameter.
 */
describe('browser GA4 events carry no personal information', () => {
  it('no GA4 parameter, page_view parameter, user property or alias is named like a person or a person document', () => {
    const names = [
      ...GA4_EVENT_PARAMS.map((p) => p.name),
      ...GA4_EVENT_PARAMS.map((p) => p.from.replace(`${GA4_PARAMS_KEY}.`, '')),
      ...GA4_PAGE_VIEW_PARAMS.map((p) => p.name),
      ...GA4_USER_PROPERTIES.map((p) => p.name),
      ...Object.keys(GA4_PARAM_ALIASES),
      ...Object.values(GA4_PARAM_ALIASES),
    ]
    expect(names.filter(isPersonParamName)).toEqual([])
  })

  it('drops an email address or phone number from any parameter, and a CMA slug from lp_campaign', () => {
    expect(
      ga4ParamsFrom({ cta: 'pat@example.com', context: '(541) 555-1212', lp_campaign: 'cma-1975-harriman', lp_content: 'cma-letter', source: 'hero' }),
    ).toEqual({ lp_campaign: 'cma-letter', lp_content: 'cma-letter', source: 'hero' })
  })

  const g = globalThis as unknown as { window?: { dataLayer?: unknown[]; location?: { href: string } } }
  const isArgs = (row: unknown): row is ArrayLike<unknown> => Object.prototype.toString.call(row) === '[object Arguments]'
  afterEach(() => {
    delete g.window
  })

  it('setGa4PageLocation pushes a gtag set command (an arguments object) with the safe address and referrer', () => {
    g.window = { dataLayer: [] }
    setGa4PageLocation('https://ryan-realty.com/contact?inquiry=Sell%20my%20place&utm_source=gbp', 'https://ryan-realty.com/cma/cma-828-florida')
    const [cmd] = g.window.dataLayer ?? []
    expect(isArgs(cmd)).toBe(true)
    expect(Array.from(cmd as ArrayLike<unknown>)).toEqual([
      'set',
      { page_location: 'https://ryan-realty.com/contact?utm_source=gbp', page_referrer: 'https://ryan-realty.com/cma/[document]' },
    ])
  })

  it('an event on a page whose address holds a typed home address is preceded by the safe page_location', () => {
    g.window = { dataLayer: [], location: { href: 'https://ryan-realty.com/sell?address=123%20Test%20Ln&from=%2F' } }
    pushDataLayerEvent('view_landing_page', { lp_variant: 'seller-home-value' })
    const rows = g.window.dataLayer ?? []
    expect(isArgs(rows[0])).toBe(true)
    expect(Array.from(rows[0] as ArrayLike<unknown>)).toEqual(['set', { page_location: 'https://ryan-realty.com/sell?from=%2F' }])
    expect(rows.slice(1)).toEqual([
      { [GA4_PARAMS_KEY]: null },
      { event: 'view_landing_page', lp_variant: 'seller-home-value', [GA4_PARAMS_KEY]: { lp_variant: 'seller-home-value' } },
    ])
    // the next event on the same address does not set it again
    pushDataLayerEvent('click_cta', { cta: 'get value' })
    expect(rows.filter(isArgs)).toHaveLength(1)
    expect(JSON.stringify(rows.map((r) => (isArgs(r) ? Array.from(r) : r)))).not.toContain('Test')
  })
})
