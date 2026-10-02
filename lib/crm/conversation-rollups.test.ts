import { describe, expect, it } from 'vitest'
import { conversationRollups, type RollupMessage } from './conversation-rollups'

const m = (p: Partial<RollupMessage> & Pick<RollupMessage, 'id' | 'created_at'>): RollupMessage => ({
  direction: 'out',
  channel: 'email',
  body: null,
  subject: null,
  meta: null,
  sent_by: null,
  ...p,
})

describe('conversationRollups', () => {
  it('is null for a conversation with no messages', () => {
    expect(conversationRollups([])).toBeNull()
  })

  it('takes the clocks per direction and the newest message for the display fields', () => {
    const r = conversationRollups([
      m({ id: 'a', created_at: '2026-09-01T10:00:00Z', direction: 'out', sent_by: 'matt', body: 'first', subject: 'Hi' }),
      m({ id: 'b', created_at: '2026-09-02T10:00:00Z', direction: 'in', channel: 'sms', body: 'reply' }),
      m({ id: 'c', created_at: '2026-09-01T12:00:00Z', direction: 'out', sent_by: 'paul', channel: 'sms' }),
    ])!
    expect(r.last_message_at).toBe('2026-09-02T10:00:00Z')
    expect(r.last_inbound_at).toBe('2026-09-02T10:00:00Z')
    expect(r.last_outbound_at).toBe('2026-09-01T12:00:00Z')
    expect(r.needs_reply).toBe(true)
    expect(r.message_count).toBe(3)
    expect(r.channel_set.sort()).toEqual(['email', 'sms'])
    expect(r.outbound_brokers.sort()).toEqual(['matt', 'paul'])
    expect([r.last_snippet, r.last_direction, r.last_channel, r.last_subject]).toEqual(['reply', 'in', 'sms', null])
    expect(r.last_inbound_at).not.toBeNull()
  })

  it('breaks a created_at tie by the larger id, as ORDER BY created_at DESC, id DESC does', () => {
    const r = conversationRollups([
      m({ id: '1111', created_at: '2026-09-01T10:00:00Z', body: 'low' }),
      m({ id: '9999', created_at: '2026-09-01T10:00:00Z', body: 'high' }),
    ])!
    expect(r.last_snippet).toBe('high')
  })

  it('carries a call duration only when the newest message is a call or voicemail', () => {
    expect(conversationRollups([m({ id: 'a', created_at: '2026-09-01T10:00:00Z', channel: 'call', meta: { durationSec: '42' } })])!.last_call_duration_sec).toBe(42)
    expect(conversationRollups([m({ id: 'a', created_at: '2026-09-01T10:00:00Z', channel: 'email', meta: { durationSec: '42' } })])!.last_call_duration_sec).toBeNull()
  })

  it('has no inbound clock and needs no reply when every message is ours', () => {
    const r = conversationRollups([m({ id: 'a', created_at: '2026-09-01T10:00:00Z', direction: 'out' })])!
    expect(r.last_inbound_at).toBeNull()
    expect(r.needs_reply).toBe(false)
  })
})
