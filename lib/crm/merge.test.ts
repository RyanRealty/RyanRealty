import { describe, expect, it } from 'vitest'
import {
  MERGE_TOKENS,
  findUnresolvedMergeTokens,
  greetingFor,
  renderCrmMerge,
  splitName,
  type MergeContext,
  type MergePersonLike,
} from './merge'

/**
 * The regression this file locks: the picker advertised ~30 tokens while the
 * resolver replaced ~5 — the rest went out LITERALLY in delivered email
 * (CRM_BUILD_MISSION "FIX: merge fields", 2026-07-01). EVERY entry in
 * MERGE_TOKENS must resolve given a full person + context.
 */

const FULL_PERSON: MergePersonLike = {
  first_name: 'Alex',
  last_name: 'Sample',
  name: 'Alex Sample',
  stage: 'Lead',
  source: 'Ryan-Realty.com',
  lender_name: 'Pat Money',
  emails: [{ value: 'alex@example.com', isPrimary: 1 }],
  phones: [{ value: '541-555-0100', isPrimary: 1 }],
  addresses: [{ street: '123 Sample Ln', city: 'Bend', state: 'OR', code: '97701' }],
  custom: {
    customSellerPropertyAddress: '123 Sample Ln, Bend OR 97701',
    customPropertyAddress: '123 Sample Ln, Bend OR 97701',
    cmaLink: 'https://ryan-realty.com/cma/sample',
    customBuyerSearchAreas: 'NW Bend',
  },
}

const FULL_CTX: MergeContext = {
  agent: {
    firstName: 'Matt',
    lastName: 'Ryan',
    email: 'matt@ryan-realty.com',
    phone: '541.703.3095',
    title: 'Principal Broker',
    brokerage: 'Ryan Realty',
    website: 'https://ryan-realty.com',
  },
  sender: {
    firstName: 'Rebecca',
    lastName: 'Peterson',
    email: 'rebecca@ryan-realty.com',
    phone: '541.555.0142',
  },
  company: { name: 'Ryan Realty', address: '115 NW Oregon Ave. #2, Bend, Oregon 97703' },
  lender: { firstName: 'Pat', lastName: 'Money', email: 'pat@lender.com', phone: '541-555-0199' },
  property: {
    address: '456 Listing Ave, Bend OR 97702',
    price: '$895,000',
    mlsNumber: '220189422',
    lastViewedAddress: '789 Viewed St, Bend OR 97703',
  },
  leadSource: { name: 'Ryan-Realty.com', campaign: 'seller-lp' },
  timeZone: 'America/Los_Angeles',
  now: new Date('2026-07-01T17:00:00Z'), // 10am Pacific
}

describe('renderCrmMerge — every catalog token resolves', () => {
  for (const t of MERGE_TOKENS) {
    it(`resolves ${t.token}`, () => {
      const out = renderCrmMerge(`x ${t.token} y`, FULL_PERSON, FULL_CTX)
      expect(out).not.toContain(t.token)
      expect(findUnresolvedMergeTokens(out)).toEqual([])
    })
  }

  it('resolves a multi-token body end to end', () => {
    const out = renderCrmMerge(
      'Hey %contact_first_name%, it is %agent_first_name% with %company_name%. ' +
        'You are in stage %contact_stage%, reachable at %contact_email%. %greeting%.',
      FULL_PERSON,
      FULL_CTX,
    )
    expect(out).toBe(
      'Hey Alex, it is Matt with Ryan Realty. ' +
        'You are in stage Lead, reachable at alex@example.com. Good morning.',
    )
  })

  it('sender tokens resolve independently of agent tokens', () => {
    const out = renderCrmMerge('%agent_first_name% / %sender_first_name%', FULL_PERSON, FULL_CTX)
    expect(out).toBe('Matt / Rebecca')
  })

  it('legacy aliases still resolve', () => {
    const out = renderCrmMerge('%first% {{first_name}} {{address}} {{cma_link}}', FULL_PERSON, FULL_CTX)
    expect(out).toBe(
      'Alex Alex 123 Sample Ln, Bend OR 97701 https://ryan-realty.com/cma/sample',
    )
  })

  it('custom-field tokens resolve from person.custom', () => {
    expect(renderCrmMerge('%customBuyerSearchAreas%', FULL_PERSON, FULL_CTX)).toBe('NW Bend')
  })

  // FUB-imported template tokens (2026-07-02 mobile audit): 17 of 37 live SMS
  // templates carry these names; one reached a contact literally on Jun 30.
  it('FUB template aliases resolve (%greeting_time% / %agent_name% / %inquiry_address%)', () => {
    const out = renderCrmMerge(
      '%greeting_time%, from %agent_name% re: %inquiry_address%',
      FULL_PERSON,
      FULL_CTX,
    )
    expect(out).toBe('Good morning, from Matt Ryan re: 123 Sample Ln, Bend OR 97701')
  })

  it('%inquiry_address% falls back to the last viewed address', () => {
    const person = { ...FULL_PERSON, custom: {} }
    const ctx = { ...FULL_CTX, property: { ...FULL_CTX.property, address: null } }
    expect(renderCrmMerge('%inquiry_address%', person, ctx)).toBe('789 Viewed St, Bend OR 97703')
  })

  it('FUB aliases stay literal without data (fail-closed)', () => {
    const out = renderCrmMerge('%greeting_time% %agent_name% %inquiry_address%', { name: 'X Y' })
    expect(out).toBe('%greeting_time% %agent_name% %inquiry_address%')
  })
})

describe('renderCrmMerge — unknown/empty tokens stay literal (fail-closed)', () => {
  it('agent tokens stay literal without a context', () => {
    const out = renderCrmMerge('Hi %contact_first_name%, call %agent_phone%', FULL_PERSON)
    expect(out).toBe('Hi Alex, call %agent_phone%')
    expect(findUnresolvedMergeTokens(out)).toEqual(['%agent_phone%'])
  })

  it('empty custom fields stay literal', () => {
    const out = renderCrmMerge('%customNope%', { first_name: 'A', custom: {} })
    expect(out).toBe('%customNope%')
  })

  it('lender email/phone stay literal when only a lender name is known', () => {
    const person: MergePersonLike = { ...FULL_PERSON }
    const ctx: MergeContext = { ...FULL_CTX, lender: null }
    // Name splits from person.lender_name; email/phone unknown → literal.
    expect(renderCrmMerge('%lender_first_name% %lender_last_name%', person, ctx)).toBe('Pat Money')
    expect(renderCrmMerge('%lender_email%', person, ctx)).toBe('%lender_email%')
  })

  it('contact first name keeps the there fallback', () => {
    expect(renderCrmMerge('Hi %contact_first_name%', {})).toBe('Hi there')
  })

  it('missing last name stays literal (never invents a name)', () => {
    expect(renderCrmMerge('%contact_last_name%', { first_name: 'Cher', name: 'Cher' })).toBe(
      '%contact_last_name%',
    )
  })
})

describe('greeting + name helpers', () => {
  it('greetingFor respects the timezone', () => {
    const d = new Date('2026-07-01T17:00:00Z') // 10am PDT / 1pm EDT
    expect(greetingFor(d, 'America/Los_Angeles')).toBe('Good morning')
    expect(greetingFor(d, 'America/New_York')).toBe('Good afternoon')
    expect(greetingFor(new Date('2026-07-02T03:00:00Z'), 'America/Los_Angeles')).toBe('Good evening')
  })

  it('splitName splits multi-part last names', () => {
    expect(splitName('Matt Ryan')).toEqual({ first: 'Matt', last: 'Ryan' })
    expect(splitName('Ana de la Cruz')).toEqual({ first: 'Ana', last: 'de la Cruz' })
    expect(splitName('  ')).toEqual({ first: null, last: null })
  })

  it('address tokens read both code and zip keys', () => {
    const p: MergePersonLike = { addresses: [{ street: '1 A St', city: 'Bend', state: 'OR', zip: '97701' }] }
    expect(renderCrmMerge('%contact_address_zip%', p)).toBe('97701')
    expect(renderCrmMerge('%contact_address_full%', p)).toBe('1 A St, Bend OR, 97701')
  })
})

describe('renderCrmMerge purity — %greeting% needs a caller clock', () => {
  it('stays literal without ctx.now (hydration-safe: no ambient Date read)', () => {
    const ctx: MergeContext = { ...FULL_CTX, now: undefined }
    expect(renderCrmMerge('%greeting%', FULL_PERSON, ctx)).toBe('%greeting%')
  })
})
