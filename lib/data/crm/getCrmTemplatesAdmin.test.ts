import { describe, it, expect } from 'vitest'
import { tallyTemplateUsage, mapTemplateRow } from './getCrmTemplatesAdmin'

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
      body: 'Body',
      category: 'buyer',
      isActive: true,
      isShared: false,
      ownerBroker: 'matt',
      usage: 3,
      perf: null,
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
