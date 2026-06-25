import { describe, it, expect } from 'vitest'
import { mapMarketReportSubscriberRow } from './getMarketReportSubscribers'

describe('mapMarketReportSubscriberRow', () => {
  it('maps a fully-populated joined row', () => {
    const out = mapMarketReportSubscriberRow({
      id: 12,
      person_id: 4500,
      areas: ['bend', 'tetherow'],
      frequency: 'weekly',
      is_active: true,
      last_sent_at: '2026-06-01T09:00:00.000Z',
      last_attempt_at: '2026-06-01T09:00:00.000Z',
      crm_people: {
        name: 'Jane Buyer',
        first_name: 'Jane',
        last_name: 'Buyer',
        assigned_broker: 'rebecca',
        fub_legacy_id: 88231,
      },
    })
    expect(out).toEqual({
      subscriptionId: 12,
      personId: 4500,
      personName: 'Jane Buyer',
      assignedBroker: 'rebecca',
      fubPersonId: 88231,
      areas: ['bend', 'tetherow'],
      frequency: 'weekly',
      isActive: true,
      lastSentAt: '2026-06-01T09:00:00.000Z',
      lastAttemptAt: '2026-06-01T09:00:00.000Z',
    })
  })

  it('derives name from first/last when name is blank', () => {
    const out = mapMarketReportSubscriberRow({
      id: 1,
      person_id: 2,
      areas: [],
      frequency: 'monthly',
      is_active: true,
      last_sent_at: null,
      last_attempt_at: null,
      crm_people: { name: '  ', first_name: 'Sam', last_name: 'Seller', assigned_broker: null, fub_legacy_id: null },
    })
    expect(out.personName).toBe('Sam Seller')
    expect(out.assignedBroker).toBeNull()
    expect(out.fubPersonId).toBeNull()
    expect(out.lastSentAt).toBeNull()
  })

  it('defaults an unknown frequency to monthly and filters non-string areas', () => {
    const out = mapMarketReportSubscriberRow({
      id: '3',
      person_id: '7',
      areas: ['bend', 5, null, 'sisters'] as unknown[],
      frequency: 'fortnightly',
      is_active: false,
      last_sent_at: null,
      last_attempt_at: null,
      crm_people: null,
    })
    expect(out.subscriptionId).toBe(3)
    expect(out.personId).toBe(7)
    expect(out.frequency).toBe('monthly')
    expect(out.areas).toEqual(['bend', 'sisters'])
    expect(out.isActive).toBe(false)
    expect(out.personName).toBeNull()
  })
})
