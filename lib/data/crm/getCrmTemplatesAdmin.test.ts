import { describe, it, expect } from 'vitest'
import { tallyTemplateUsage, tallyTemplateUsedBy, mapTemplateRow, computeEmailMetrics, computeTextMetrics } from './getCrmTemplatesAdmin'

describe('tallyTemplateUsage', () => {
  it('counts references per key across all sequences', () => {
    const sequences = [
      { steps: [{ templateKey: 'email-a' }, { templateKey: 'sms-b' }] },
      { steps: [{ templateKey: 'email-a' }] },
      { steps: [{ templateKey: 'email-c' }] },
    ]
    expect(tallyTemplateUsage(['email-a', 'sms-b', 'email-c', 'unused'], sequences)).toEqual({
      'email-a': 2,
      'sms-b': 1,
      'email-c': 1,
      unused: 0,
    })
  })

  it('handles sequences with malformed steps', () => {
    const sequences = [{ steps: null }, { steps: 'oops' }, { steps: [{ templateKey: 'email-a' }] }]
    expect(tallyTemplateUsage(['email-a'], sequences)).toEqual({ 'email-a': 1 })
  })
})

describe('mapTemplateRow', () => {
  it('maps a raw email row to the admin shape', () => {
    const row = {
      id: 7,
      key: 'email-welcome',
      channel: 'email',
      name: 'Welcome',
      subject: 'Hi',
      body: 'Body',
      category: 'buyer',
      is_active: true,
      is_shared: false,
      owner_broker: 'matt',
    }
    expect(mapTemplateRow(row, 3, null)).toEqual({
      id: 7,
      key: 'email-welcome',
      channel: 'email',
      name: 'Welcome',
      subject: 'Hi',
      previewText: null,
      body: 'Body',
      category: 'buyer',
      isActive: true,
      isShared: false,
      ownerBroker: 'matt',
      featured: false,
      createdAt: null,
      usage: 3,
      usedBy: [],
      perf: null,
      emailMetrics: null,
      textMetrics: null,
    })
  })

  it('defaults an unknown channel to email and normalizes nulls', () => {
    const row = {
      id: 9,
      key: 'x',
      channel: 'push',
      name: 'X',
      subject: null,
      body: '',
      category: null,
      is_active: false,
      is_shared: false,
      owner_broker: null,
    }
    const m = mapTemplateRow(row, 0, null)
    expect(m.channel).toBe('email')
    expect(m.subject).toBeNull()
    expect(m.body).toBe('')
    expect(m.isActive).toBe(false)
    expect(m.isShared).toBe(false)
    expect(m.ownerBroker).toBeNull()
  })
})

describe('tallyTemplateUsedBy', () => {
  const sequences = [
    { name: 'Buyer drip', steps: [{ templateKey: 'email-a' }] },
    { name: 'Seller drip', steps: [{ templateKey: 'email-a' }, { templateKey: 'sms-b' }] },
    { name: 'Unrelated', steps: [{ templateKey: 'email-c' }] },
  ]
  it('lists every referencing sequence name', () => {
    expect(tallyTemplateUsedBy('email-a', sequences)).toEqual(['Buyer drip', 'Seller drip'])
    expect(tallyTemplateUsedBy('sms-b', sequences)).toEqual(['Seller drip'])
  })
  it('returns [] for an unreferenced key', () => {
    expect(tallyTemplateUsedBy('unused', sequences)).toEqual([])
  })
})

describe('computeEmailMetrics', () => {
  const rows = [
    { email_key: 'tpl:email-a:1:100', event: 'sent' },
    { email_key: 'tpl:email-a:1:100', event: 'open' },
    { email_key: 'tpl:email-a:2:200', event: 'sent' },
    { email_key: 'tpl:email-a:2:200', event: 'click' },
    { email_key: 'tpl:email-other:9:900', event: 'sent' },
    { email_key: 'manual:3:300', event: 'sent' },
  ]
  it('counts distinct sends/opens/clicks per template prefix only', () => {
    expect(computeEmailMetrics('email-a', 'email', rows)).toEqual({
      sent: 2,
      opens: 1,
      clicks: 1,
      replies: 0,
      unsubscribed: 0,
      bounces: 0,
    })
  })
  it('dedupes repeat events on the same send key', () => {
    const dup = [
      { email_key: 'tpl:email-a:1:100', event: 'open' },
      { email_key: 'tpl:email-a:1:100', event: 'open' },
      { email_key: 'tpl:email-a:1:100', event: 'sent' },
    ]
    expect(computeEmailMetrics('email-a', 'email', dup)?.opens).toBe(1)
  })
  it('returns null for sms templates', () => {
    expect(computeEmailMetrics('sms-b', 'sms', rows)).toBeNull()
  })
})

describe('computeTextMetrics', () => {
  const now = new Date('2026-07-01T00:00:00Z')
  const rows = [
    { ts: '2026-06-25T00:00:00Z', templateKey: 'sms-b' }, // in 30d window
    { ts: '2026-03-01T00:00:00Z', templateKey: 'sms-b' }, // older
    { ts: '2026-06-25T00:00:00Z', templateKey: 'sms-other' },
    { ts: '2026-06-25T00:00:00Z', templateKey: null },
  ]
  it('splits 30-day vs all-time send counts per key', () => {
    expect(computeTextMetrics('sms-b', 'sms', rows, now)).toEqual({ sent30d: 1, sentTotal: 2 })
  })
  it('returns null for email templates', () => {
    expect(computeTextMetrics('email-a', 'email', rows, now)).toBeNull()
  })
})
