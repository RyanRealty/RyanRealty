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
      first_send_approved_at: '2026-05-30T17:00:00.000Z',
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
      firstSendApprovedAt: '2026-05-30T17:00:00.000Z',
      personDeleted: false,
    })
  })

  it('marks a deleted contact, and one missing from the people read, so the sender never mails them', () => {
    const base = {
      id: 9,
      person_id: 9,
      areas: ['bend'],
      frequency: 'monthly',
      is_active: true,
      last_sent_at: null,
      last_attempt_at: null,
      first_send_approved_at: '2026-06-01T00:00:00Z',
    }
    const deleted = mapMarketReportSubscriberRow({
      ...base,
      crm_people: { name: 'Gone', first_name: null, last_name: null, assigned_broker: 'matt', fub_legacy_id: null, deleted: true },
    })
    expect(deleted.personDeleted).toBe(true)
    expect(mapMarketReportSubscriberRow({ ...base, crm_people: null }).personDeleted).toBe(true)
    const live = mapMarketReportSubscriberRow({
      ...base,
      crm_people: { name: 'Here', first_name: null, last_name: null, assigned_broker: 'matt', fub_legacy_id: null, deleted: false },
    })
    expect(live.personDeleted).toBe(false)
  })

  it('reads a missing first-send approval as null (the cadence holds it)', () => {
    const out = mapMarketReportSubscriberRow({
      id: 9016,
      person_id: 64138,
      areas: ['bend', 'bend-larkspur'],
      frequency: 'monthly',
      is_active: false,
      last_sent_at: null,
      last_attempt_at: null,
      crm_people: { name: 'Cheryl Younger', first_name: 'Cheryl', last_name: 'Younger', assigned_broker: 'matt', fub_legacy_id: null },
    })
    expect(out.firstSendApprovedAt).toBeNull()
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
