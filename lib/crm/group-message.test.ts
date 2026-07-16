import { describe, it, expect } from 'vitest'
import { groupInfoFromPayload } from '@/lib/crm/group-message'

describe('groupInfoFromPayload', () => {
  it('detects an outbound group text from payload.groupTo', () => {
    const g = groupInfoFromPayload({ groupTo: ['(503) 970-9123', '(360) 798-8385', '+15416681633'] })
    expect(g).toEqual({ count: 3, participants: ['(503) 970-9123', '(360) 798-8385', '+15416681633'] })
  })

  it('detects an inbound group text from payload.groupMembers', () => {
    const g = groupInfoFromPayload({ group: true, groupMembers: ['+15416681633', '+13607988385', '+15039709123', '+15417033095'] })
    expect(g?.count).toBe(4)
  })

  it('returns null for a 1:1 (no group fields)', () => {
    expect(groupInfoFromPayload({ twilioSid: 'SM1', to: '+15551234567' })).toBeNull()
  })

  it('treats a single participant as a 1:1, not a group', () => {
    expect(groupInfoFromPayload({ groupTo: ['+15551234567'] })).toBeNull()
    expect(groupInfoFromPayload({ groupTo: [] })).toBeNull()
  })

  it('is null-safe for missing / non-object payloads', () => {
    expect(groupInfoFromPayload(null)).toBeNull()
    expect(groupInfoFromPayload(undefined)).toBeNull()
    expect(groupInfoFromPayload('nope')).toBeNull()
  })
})
