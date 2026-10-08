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
  isLeadFormId,
  isLeadType,
  LEAD_FORM_IDS,
  LEAD_TYPES,
  LEAD_VALUE_USD,
  NON_LEAD_EVENTS,
} from './lead-event'
import { leadEventParams, type FireLeadParams } from '@/lib/lead-tracking'

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

  it('gives every lead_type a value and keeps non-leads off the list', () => {
    for (const t of LEAD_TYPES) expect(LEAD_VALUE_USD[t]).toBeGreaterThan(0)
    for (const n of NON_LEAD_EVENTS) expect(isLeadType(n)).toBe(false)
    expect([...NON_LEAD_EVENTS]).toEqual(['recruit_inquiry', 'newsletter_signup'])
  })
})

describe('leadEventParams', () => {
  const ok: FireLeadParams = { lp_variant: 'home-valuation', lead_type: 'seller_valuation', form_id: 'home_valuation' }

  it('sends lead_type, form_id, value and currency', () => {
    expect(leadEventParams(ok)).toMatchObject({
      lead_type: 'seller_valuation',
      form_id: 'home_valuation',
      value: LEAD_VALUE_USD.seller_valuation,
      currency: 'USD',
    })
  })

  it('sends nothing for an unknown lead_type or form_id', () => {
    expect(leadEventParams({ ...ok, lead_type: 'general' as never })).toBeNull()
    expect(leadEventParams({ ...ok, form_id: 'mystery_form' as never })).toBeNull()
  })

  it('never lets extra change what the lead is', () => {
    const p = leadEventParams({ ...ok, extra: { lead_type: 'recruit', value: 9999, form_id: 'x' } })
    expect(p).toMatchObject({ lead_type: 'seller_valuation', form_id: 'home_valuation', value: LEAD_VALUE_USD.seller_valuation })
  })

  it('every form_id is snake_case and unique', () => {
    expect(new Set(LEAD_FORM_IDS).size).toBe(LEAD_FORM_IDS.length)
    for (const f of LEAD_FORM_IDS) {
      expect(f).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(isLeadFormId(f)).toBe(true)
    }
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
        if (lits.length === 0 && !/^\s*contactLeadType\(/.test(lt[1])) bad.push(`${f.rel}: lead_type is not a literal`)
        for (const l of lits) if (!isLeadType(l)) bad.push(`${f.rel}: ${l}`)
        if (!/form_id:\s*'[a-z_]+'/.test(call)) bad.push(`${f.rel}: no literal form_id`)
      }
    }
    expect(bad).toEqual([])
    expect(calls).toBeGreaterThan(15)
  })
})
