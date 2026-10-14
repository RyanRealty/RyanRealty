/**
 * One lead event, sent once (Matt 2026-10-08, analytics optimization plan fix 3).
 *
 * generate_lead is sent only from the server, only through fireLeadGenerated,
 * only with a lead_type from the fixed list and a known form_id. A recruit
 * inquiry or a newsletter signup is its own event, never a lead. This file
 * fails the build when a browser path sends generate_lead again, when another
 * server path calls fireGa4Event('generate_lead') directly, or when an unknown
 * lead_type would be sent.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve({ get: () => null }),
}))

import {
  contactLeadType,
  ga4InquiryType,
  ga4LeadExtra,
  isLeadFormId,
  isLeadType,
  LEAD_FORM_IDS,
  LEAD_TYPES,
  NON_LEAD_EVENTS,
} from './lead-event'
import {
  attributionParamsFromSearch,
  leadEventParams,
  mergeLeadAttribution,
  type FireLeadParams,
} from '@/lib/lead-tracking'

const ROOT = process.cwd()

/** The argument object of each `fireLeadGenerated({ ... })` call, brace-matched. */
function fireLeadGeneratedArgs(src: string): string[] {
  const out: string[] = []
  const re = /fireLeadGenerated\(\s*\{/g
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 1
    let i = m.index + m[0].length
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
    }
    out.push(src.slice(m.index + m[0].length, i - 1))
  }
  return out
}

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const FILES = ['app', 'components', 'lib', 'hooks']
  .flatMap((d) => {
    try {
      return sourceFiles(join(ROOT, d))
    } catch {
      return []
    }
  })
  // Comments are not code: a doc that names the old call must not trip the scan.
  .map((f) => ({ rel: relative(ROOT, f), src: stripComments(readFileSync(f, 'utf8')) }))

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('the fixed lead_type list', () => {
  it('is the list Matt approved, nothing vague', () => {
    expect([...LEAD_TYPES]).toEqual([
      'seller_valuation',
      'seller_listing',
      'buyer_showing',
      'buyer_question',
      'buyer_alerts',
      'listing_inquiry',
      'contact_general',
    ])
    for (const vague of ['general', 'seller', 'buyer', 'page_cta', 'recruit']) {
      expect(isLeadType(vague)).toBe(false)
    }
  })

  it('keeps non-leads off the list', () => {
    for (const n of NON_LEAD_EVENTS) expect(isLeadType(n)).toBe(false)
    expect([...NON_LEAD_EVENTS]).toEqual(['recruit_inquiry', 'newsletter_signup'])
  })
})

/**
 * No personal information in GA4 (Matt 2026-10-14). Found 2026-10-14: a
 * housing-market inquiry sent `context` = "... from <name> - <their message>"
 * on generate_lead, /contact sent free text the /about box carried as
 * `inquiry_type`, and a referral sent its typed `area`. GA4's copy of `extra`
 * is labels and ids only; the CRM keeps the full text.
 */
describe('ga4LeadExtra: labels and ids only', () => {
  it('drops free text, person-named keys and contact values; keeps labels, ids and numbers', () => {
    expect(
      ga4LeadExtra({
        context: 'Housing-market page inquiry — from Pat Smith — We want to sell 12 Elm St',
        area: 'Near 12 Elm St',
        address: '12 Elm St',
        cma_slug: 'cma-12-elm',
        email: 'pat@example.com',
        referral: 'inbound',
        intent: 'buyer-consult',
        resort: 'tetherow',
        person_id: 123,
        possible_realtor: false,
        listing_key: '20260714190234066850000000',
        source: 'pat@example.com',
      }),
    ).toEqual({ referral: 'inbound', intent: 'buyer-consult', resort: 'tetherow', person_id: 123, possible_realtor: false, listing_key: '20260714190234066850000000' })
  })

  it('maps inquiry_type to the fixed list, Other for anything typed', () => {
    expect(ga4InquiryType('Selling')).toBe('Selling')
    expect(ga4InquiryType('join the team')).toBe('Join the team')
    expect(ga4InquiryType('I want to sell 12 Elm St, call Pat')).toBe('Other')
    expect(ga4LeadExtra({ inquiry_type: 'We are moving from 12 Elm St' })).toEqual({ inquiry_type: 'Other' })
  })

  it('keeps page_path, without a person document slug or query', () => {
    expect(ga4LeadExtra({ page_path: '/buy/leverage?address=12%20Elm' })).toEqual({ page_path: '/buy/leverage' })
    expect(ga4LeadExtra({ page_path: '/cma/cma-12-elm' })).toEqual({ page_path: '/cma/[document]' })
  })

  it('generate_lead carries none of a caller\'s free text', () => {
    const p = leadEventParams({
      lp_variant: 'page-cta-general',
      lead_type: 'contact_general',
      form_id: 'page_cta',
      extra: { context: 'Housing-market page inquiry — from Pat Smith — call me' },
    })
    expect(JSON.stringify(p)).not.toMatch(/Pat|call me/)
  })
})

describe('leadEventParams', () => {
  const ok: FireLeadParams = { lp_variant: 'home-valuation', lead_type: 'seller_valuation', form_id: 'home_valuation' }

  it('sends lead_type and form_id, never value or currency', () => {
    const p = leadEventParams(ok)
    expect(p).toMatchObject({
      lead_type: 'seller_valuation',
      form_id: 'home_valuation',
    })
    expect(p).not.toHaveProperty('value')
    expect(p).not.toHaveProperty('currency')
  })

  it('sends nothing for an unknown lead_type or form_id', () => {
    expect(leadEventParams({ ...ok, lead_type: 'general' as never })).toBeNull()
    expect(leadEventParams({ ...ok, form_id: 'mystery_form' as never })).toBeNull()
  })

  it('attaches first-party gclid, fbclid and utm_* from the arrival query, allowlisted', () => {
    const fromAd = attributionParamsFromSearch('?gclid=G1&fbclid=F1&utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_content=ad&utm_term=bend&email=no@no.com')
    expect(fromAd).toEqual({
      lp_source: 'google',
      lp_medium: 'cpc',
      lp_campaign: 'spring',
      lp_content: 'ad',
      lp_term: 'bend',
      gclid: 'G1',
      fbclid: 'F1',
    })
    const p = leadEventParams(ok, fromAd)
    expect(p).toMatchObject({ gclid: 'G1', fbclid: 'F1', lp_source: 'google' })
    expect(p).not.toHaveProperty('email')
  })

  it('lets client attribution win over referer UTMs so click-around still converts', () => {
    const referer = attributionParamsFromSearch('?utm_source=google&utm_medium=cpc&gclid=G1')
    const p = leadEventParams(
      {
        ...ok,
        attribution: { lp_source: 'facebook', lp_medium: 'paid_social', fbclid: 'F1' },
      },
      referer,
    )
    expect(p).toMatchObject({
      lp_source: 'facebook',
      lp_medium: 'paid_social',
      gclid: 'G1',
      fbclid: 'F1',
    })
  })

  it('lets client lpContext win over a bare referer so click-around still attributes', () => {
    const merged = mergeLeadAttribution(
      { lp_source: 'direct' },
      { lp_source: 'facebook', lp_medium: 'paid_social', gclid: 'g-1', fbclid: 'f-1' },
    )
    expect(merged).toEqual({
      lp_source: 'facebook',
      lp_medium: 'paid_social',
      gclid: 'g-1',
      fbclid: 'f-1',
    })
  })

  it('never lets extra change what the lead is or inject dollar values', () => {
    const p = leadEventParams({
      ...ok,
      extra: { lead_type: 'recruit', value: 9999, currency: 'USD', form_id: 'x' },
    })
    expect(p).toMatchObject({ lead_type: 'seller_valuation', form_id: 'home_valuation' })
    expect(p).not.toHaveProperty('value')
    expect(p).not.toHaveProperty('currency')
  })

  it('every form_id is snake_case and unique', () => {
    expect(new Set(LEAD_FORM_IDS).size).toBe(LEAD_FORM_IDS.length)
    for (const f of LEAD_FORM_IDS) {
      expect(f).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(isLeadFormId(f)).toBe(true)
    }
    expect(LEAD_FORM_IDS).toContain('buyer_alerts_lp')
    expect(LEAD_FORM_IDS).toContain('buyer_leverage_lp')
  })
})

describe('contactLeadType', () => {
  it('replaces "general" with what the visitor asked for', () => {
    expect(contactLeadType({ isTour: true, listingKey: 'X1', inquiryType: 'Buying' })).toBe('buyer_showing')
    expect(contactLeadType({ isTour: false, listingKey: 'X1', inquiryType: 'General Inquiry' })).toBe('listing_inquiry')
    expect(contactLeadType({ isTour: false, inquiryType: 'Home valuation' })).toBe('seller_valuation')
    expect(contactLeadType({ isTour: false, inquiryType: 'Selling' })).toBe('seller_listing')
    expect(contactLeadType({ isTour: false, inquiryType: 'Both' })).toBe('seller_listing')
    expect(contactLeadType({ isTour: false, inquiryType: 'Buying' })).toBe('buyer_question')
    expect(contactLeadType({ isTour: false, inquiryType: 'Relocation' })).toBe('buyer_question')
    expect(contactLeadType({ isTour: false, inquiryType: 'General Inquiry' })).toBe('contact_general')
  })
})

describe('generate_lead is server-only and sent in one place', () => {
  it('no browser path sends generate_lead (trackEvent, dataLayer, gtag)', () => {
    const CLIENT_SEND = [
      /trackEvent\(\s*['"`]generate_lead['"`]/,
      /pushDataLayerEvent\(\s*['"`]generate_lead['"`]/,
      /gtag\(\s*['"`]event['"`]\s*,\s*['"`]generate_lead['"`]/,
      /\bevent:\s*['"`]generate_lead['"`]/,
    ]
    const hits = FILES.filter((f) => CLIENT_SEND.some((re) => re.test(f.src))).map((f) => f.rel)
    expect(hits).toEqual([])
  })

  it('no server path calls fireGa4Event with generate_lead except lib/lead-tracking.ts', () => {
    const DIRECT = /eventName:\s*['"`]generate_lead['"`]/
    const hits = FILES.filter((f) => f.rel !== 'lib/lead-tracking.ts' && DIRECT.test(f.src)).map((f) => f.rel)
    expect(hits).toEqual([])
  })

  it('every fireLeadGenerated call names lead_types from the fixed list', () => {
    const bad: string[] = []
    let calls = 0
    for (const f of FILES) {
      if (f.rel === 'lib/lead-tracking.ts') continue
      for (const call of fireLeadGeneratedArgs(f.src)) {
        calls++
        const lt = /lead_type:([\s\S]*?)(?:,\s*\n\s*[a-z_]+:|$)/.exec(call)
        if (!lt) {
          bad.push(`${f.rel}: no lead_type`)
          continue
        }
        // The values a lead_type expression can produce: its literals, minus the
        // ones it only compares against (`x === 'seller' ? ... : ...`).
        const lits = [...lt[1].matchAll(/(?<![=!]==?\s*)'([a-z_]+)'/g)].map((m) => m[1])
        // contactLeadType() returns LeadType and has its own test above.
        if (
          lits.length === 0 &&
          !/^\s*contactLeadType\(/.test(lt[1]) &&
          !/^\s*(?:input\.)?leadType/.test(lt[1])
        ) {
          bad.push(`${f.rel}: lead_type is not a literal`)
        }
        for (const l of lits) if (!isLeadType(l)) bad.push(`${f.rel}: ${l}`)
        if (
          !/form_id:\s*'[a-z_]+'/.test(call) &&
          !/form_id:\s*(?:input\.)?formId(?:\s*\?\?\s*'[a-z_]+')?/.test(call)
        ) {
          bad.push(`${f.rel}: no literal form_id`)
        }
      }
    }
    expect(bad).toEqual([])
    expect(calls).toBeGreaterThan(15)
  })

  it('persists the _ga client_id so offline qualify_lead / close_convert_lead can stitch', () => {
    const src = readFileSync(join(ROOT, 'lib/lead-tracking.ts'), 'utf8')
    expect(src).toContain('rememberGaClientId')
    expect(src).toContain('persistGaClientIdFromCookies')
    // fireLeadGenerated persists through the shared helper (which reads the
    // _ga cookie and calls rememberGaClientId), on the lead's CRM person.
    expect(src).toMatch(/await persistGaClientIdFromCookies\(params\.crm_person_id \?\? params\.fub_person_id\)/)
    // Persist is first-party CRM state and runs before the consent / suppression return.
    const persistAt = src.indexOf('await persistGaClientIdFromCookies(params.crm_person_id')
    const declineAt = src.indexOf('const req = await requestContext({ serverToServer')
    expect(persistAt).toBeGreaterThan(0)
    expect(declineAt).toBeGreaterThan(persistAt)
  })

  it('every fireLeadGenerated call names the CRM person so persist can write', () => {
    const bad: string[] = []
    for (const f of FILES) {
      if (f.rel === 'lib/lead-tracking.ts') continue
      for (const call of fireLeadGeneratedArgs(f.src)) {
        if (!/\b(?:crm_person_id|fub_person_id)\s*:/.test(call)) {
          bad.push(`${f.rel}: fireLeadGenerated missing crm_person_id`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('each named lead form action persists the _ga cookie on the person', () => {
    const required = [
      'app/actions/lead-landing.ts',
      'app/actions/lead-capture.ts',
      'app/actions/search-alert-capture.ts',
      'app/contact/actions.ts',
      'app/lp/seller-home-value/actions.ts',
      'app/buy/concessions/actions.ts',
      'app/communities/[slug]/_v3/place-value-actions.ts',
    ]
    const missing = required.filter((rel) => {
      const f = FILES.find((row) => row.rel === rel)
      return !f || !f.src.includes('persistGaClientIdFromCookies')
    })
    expect(missing).toEqual([])
  })

  it('puts no dollar value on generate_lead (Matt 2026-10-08)', () => {
    const bannedToken = ['LEAD', 'VALUE', 'USD'].join('_')
    for (const rel of ['lib/analytics/lead-event.ts', 'lib/lead-tracking.ts']) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      expect(src, rel).not.toContain(bannedToken)
    }
    const bad: string[] = []
    for (const f of FILES) {
      for (const call of fireLeadGeneratedArgs(f.src)) {
        if (/\bvalue\s*:/.test(call) || /\bcurrency\s*:/.test(call)) {
          bad.push(`${f.rel}: value/currency in fireLeadGenerated`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})

describe('Meta Lead events carry no dollar value (Matt 2026-10-14)', () => {
  it('no CAPI Lead or fbq Lead payload sends value or currency', () => {
    const skip = new Set(['lib/meta-offline-conversions.ts'])
    const bad: string[] = []
    for (const f of FILES) {
      if (skip.has(f.rel)) continue
      if (/fbq\([\s\S]{0,160}['"`]Lead['"`][\s\S]{0,400}?\b(?:value|currency)\s*:/.test(f.src)) {
        bad.push(`${f.rel}: fbq Lead value/currency`)
      }
      if (/eventName:\s*['"`]Lead['"`][\s\S]{0,800}?\b(?:value|currency)\s*:/.test(f.src)) {
        bad.push(`${f.rel}: CAPI Lead value/currency`)
      }
    }
    expect(bad).toEqual([])
  })
})
