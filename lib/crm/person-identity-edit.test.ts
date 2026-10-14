import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUDIENCE_BUYER_TAG,
  AUDIENCE_SELLER_TAG,
  composeDisplayName,
  leadTypeFromPerson,
  planPersonIdentityEdit,
  tagsForLeadType,
  type PersonIdentitySnapshot,
} from './person-identity-edit'

const elize: PersonIdentitySnapshot = {
  name: 'Call lead 9453937490',
  first_name: null,
  last_name: null,
  tags: ['source:inbound-call'],
  custom: {},
}

const jane: PersonIdentitySnapshot = {
  name: 'Jane Doe',
  first_name: 'Jane',
  last_name: 'Doe',
  tags: [AUDIENCE_BUYER_TAG, 'segment:buyer'],
  custom: { lead_type: 'buyer' },
}

describe('planPersonIdentityEdit', () => {
  it('sets Elize Marais and buyer on a placeholder Call lead', () => {
    const plan = planPersonIdentityEdit({
      person: elize,
      firstName: 'Elize',
      lastName: 'Marais',
      leadType: 'buyer',
      actorEmail: 'matt@ryan-realty.com',
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.setName).toEqual({ first: 'Elize', last: 'Marais', name: 'Elize Marais' })
    expect(plan.leadType).toBe('buyer')
    expect(plan.customPatch).toEqual({ lead_type: 'buyer' })
    expect(plan.tags).toEqual(expect.arrayContaining([AUDIENCE_BUYER_TAG, 'segment:buyer', 'source:inbound-call']))
    expect(plan.auditTitles[0]).toContain('Call lead 9453937490')
    expect(plan.auditTitles[0]).toContain('Elize Marais')
    expect(plan.auditTitles.some((t) => t.includes('Lead type changed'))).toBe(true)
    expect(plan.skipReason).toBeNull()
  })

  it('lets a broker overwrite a real name (Jane Doe → Jane Smith)', () => {
    const plan = planPersonIdentityEdit({
      person: jane,
      firstName: 'Jane',
      lastName: 'Smith',
      leadType: 'buyer',
      actorEmail: 'matt@ryan-realty.com',
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.setName).toEqual({ first: 'Jane', last: 'Smith', name: 'Jane Smith' })
    expect(plan.leadType).toBeNull()
    expect(plan.customPatch).toEqual({})
    expect(plan.auditTitles).toEqual([
      'Name changed from "Jane Doe" to "Jane Smith" by matt@ryan-realty.com',
    ])
  })

  it('switches buyer to seller and swaps audience tags', () => {
    const plan = planPersonIdentityEdit({
      person: jane,
      firstName: 'Jane',
      lastName: 'Doe',
      leadType: 'seller',
      actorEmail: 'matt@ryan-realty.com',
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.setName).toBeNull()
    expect(plan.leadType).toBe('seller')
    expect(plan.tags).toEqual(expect.arrayContaining([AUDIENCE_SELLER_TAG, 'segment:seller']))
    expect(plan.tags).not.toEqual(expect.arrayContaining([AUDIENCE_BUYER_TAG]))
    expect(plan.auditTitles).toEqual([
      'Lead type changed from "buyer" to "seller" by matt@ryan-realty.com',
    ])
  })

  it('sets lead type other and drops audience tags', () => {
    const plan = planPersonIdentityEdit({
      person: jane,
      firstName: 'Jane',
      lastName: 'Doe',
      leadType: 'other',
      actorEmail: 'matt@ryan-realty.com',
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.leadType).toBe('other')
    expect(plan.tags ?? []).not.toContain(AUDIENCE_BUYER_TAG)
    expect(plan.tags ?? []).not.toContain(AUDIENCE_SELLER_TAG)
  })

  it('refuses a blank name', () => {
    const plan = planPersonIdentityEdit({
      person: elize,
      firstName: '  ',
      lastName: '',
      leadType: 'buyer',
      actorEmail: 'matt@ryan-realty.com',
    })
    expect(plan).toEqual({ ok: false, error: 'A first or last name is required.' })
  })

  it('refuses an invalid lead type', () => {
    const plan = planPersonIdentityEdit({
      person: elize,
      firstName: 'Elize',
      lastName: 'Marais',
      leadType: 'investor',
      actorEmail: 'matt@ryan-realty.com',
    })
    expect(plan).toEqual({ ok: false, error: 'Lead type must be buyer, seller, or other.' })
  })

  it('no-ops when name and lead type are unchanged', () => {
    const plan = planPersonIdentityEdit({
      person: jane,
      firstName: 'Jane',
      lastName: 'Doe',
      leadType: 'buyer',
      actorEmail: 'matt@ryan-realty.com',
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.skipReason).toBe('unchanged')
    expect(plan.setName).toBeNull()
    expect(plan.leadType).toBeNull()
    expect(plan.auditTitles).toEqual([])
  })
})

describe('leadTypeFromPerson / tagsForLeadType', () => {
  it('reads custom.lead_type, then audience tags', () => {
    expect(leadTypeFromPerson(jane)).toBe('buyer')
    expect(leadTypeFromPerson({ ...elize, tags: [AUDIENCE_SELLER_TAG] })).toBe('seller')
    expect(leadTypeFromPerson(elize)).toBe('other')
  })

  it('composes a display name', () => {
    expect(composeDisplayName('Elize', 'Marais')).toBe('Elize Marais')
    expect(composeDisplayName('Elize', '')).toBe('Elize')
  })

  it('does not invent a seller tag for other', () => {
    expect(tagsForLeadType(['source:inbound-sms'], 'other')).toEqual(['source:inbound-sms'])
  })
})

describe('profile wiring', () => {
  it('puts the editor on both person-profile layouts', () => {
    const v2 = readFileSync(resolve('app/admin/(protected)/people/[id]/PersonIdentityHeader.tsx'), 'utf8')
    const v3 = readFileSync(resolve('components/admin/crm/lead-page-v3/LeadHeader.tsx'), 'utf8')
    const action = readFileSync(resolve('app/actions/crm-person-identity.ts'), 'utf8')
    expect(v2).toMatch(/PersonIdentityEditor/)
    expect(v3).toMatch(/PersonIdentityEditor/)
    expect(action).toMatch(/crm_timeline/)
    expect(action).not.toMatch(/sendCrmEmail|sendSms\s*\(/)
  })
})
