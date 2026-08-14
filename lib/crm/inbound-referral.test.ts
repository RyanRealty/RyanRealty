import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INBOUND_FEE_PCT,
  inboundAgentTags,
  inboundClientTags,
  inboundReferralFromPerson,
  phoneForSecondPerson,
  validateInboundReferral,
} from './inbound-referral'
import {
  REFERRAL_INBOUND_TAG,
  REFERRING_AGENT_TAG,
  geoReferralEnrollBlock,
} from '@/lib/referral-geo'

describe('validateInboundReferral', () => {
  const good = {
    intent: 'buy',
    area: 'Bend',
    clientName: 'Alex Rivera',
    clientEmail: 'alex@example.com',
    agentName: 'Jordan Lee',
    agentEmail: 'jordan@otherbroker.com',
    brokerage: 'Other Brokerage',
  }

  it('accepts a complete referral', () => {
    const r = validateInboundReferral(good)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.honeypot).toBe(false)
    expect(r.parsed.intent).toBe('buy')
    expect(r.parsed.clientEmail).toBe('alex@example.com')
  })

  it('treats a filled honeypot as success and creates nothing', () => {
    const r = validateInboundReferral({ ...good, company: 'Acme Bot' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.honeypot).toBe(true)
  })

  it('rejects the agent email reused as the client email', () => {
    const r = validateInboundReferral({ ...good, clientEmail: 'jordan@otherbroker.com' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/client's email/i)
  })

  it('rejects a missing area', () => {
    const r = validateInboundReferral({ ...good, area: ' ' })
    expect(r.ok).toBe(false)
  })

  it('rejects a bad client email', () => {
    const r = validateInboundReferral({ ...good, clientEmail: 'not-an-email' })
    expect(r.ok).toBe(false)
  })
})

describe('inbound tags', () => {
  it('marks the client inbound and the agent as referring-agent', () => {
    expect(inboundClientTags('buy')).toContain(REFERRAL_INBOUND_TAG)
    expect(inboundClientTags('sell')).toContain('audience:seller')
    expect(inboundClientTags('both')).toEqual(
      expect.arrayContaining(['audience:buyer', 'audience:seller', REFERRAL_INBOUND_TAG]),
    )
    expect(inboundAgentTags()).toContain(REFERRING_AGENT_TAG)
  })

  it('blocks both from consumer drip', () => {
    expect(geoReferralEnrollBlock(inboundClientTags('buy'))).toMatch(/inbound/)
    expect(geoReferralEnrollBlock(inboundAgentTags())).toMatch(/referring agent/)
  })
})

describe('phoneForSecondPerson', () => {
  it('drops a shared last-10 so ensureNativeLead cannot phone-merge', () => {
    expect(phoneForSecondPerson('541-555-0100', '(541) 555-0100')).toBe('')
    expect(phoneForSecondPerson('541-555-0100', '541-555-0199')).toBe('541-555-0199')
    expect(phoneForSecondPerson('', '541-555-0199')).toBe('541-555-0199')
  })
})

describe('inboundReferralFromPerson', () => {
  it('reads the custom fields the action writes', () => {
    const row = inboundReferralFromPerson({
      id: 9,
      name: 'Alex Rivera',
      source: 'agent-referral',
      created_at: '2026-08-14T00:00:00Z',
      custom: {
        inboundIntent: 'buy',
        inboundArea: 'Tetherow',
        referringAgentName: 'Jordan Lee',
        referringBrokerage: 'Other Brokerage',
        referringAgentEmail: 'jordan@otherbroker.com',
      },
    })
    expect(row.area).toBe('Tetherow')
    expect(row.referringAgentName).toBe('Jordan Lee')
    expect(row.intent).toBe('buy')
  })
})

describe('fee default', () => {
  it('matches the receivables blank-means-25 rule', () => {
    expect(DEFAULT_INBOUND_FEE_PCT).toBe(25)
  })
})
