import { describe, it, expect } from 'vitest'
import { replyLatencySeconds } from '@/lib/crm/first-broker-action'

describe('replyLatencySeconds', () => {
  it('returns null without stamp', () => {
    expect(replyLatencySeconds({ created_at: '2026-08-01T00:00:00Z', custom: {} })).toBeNull()
  })

  it('computes whole seconds from create to first action', () => {
    expect(
      replyLatencySeconds({
        created_at: '2026-08-01T00:00:00Z',
        custom: { first_broker_action_at: '2026-08-01T00:05:30Z' },
      }),
    ).toBe(330)
  })

  it('prefers fub_created_at when present', () => {
    expect(
      replyLatencySeconds({
        created_at: '2026-08-01T12:00:00Z',
        fub_created_at: '2026-08-01T00:00:00Z',
        custom: { first_broker_action_at: '2026-08-01T00:01:00Z' },
      }),
    ).toBe(60)
  })
})
