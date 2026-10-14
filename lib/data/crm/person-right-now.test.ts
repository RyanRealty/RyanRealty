import { describe, expect, it } from 'vitest'
import { derivePersonRightNow } from './person-right-now'
import type { PersonTimelineItem } from './person-timeline'

const now = Date.parse('2026-10-13T17:09:00Z')

function item(partial: Partial<PersonTimelineItem> & Pick<PersonTimelineItem, 'id' | 'ts'>): PersonTimelineItem {
  return {
    channel: 'sms',
    direction: 'out',
    actor: 'matt',
    title: 'Text sent',
    body: 'Hi Chance, thanks for letting us know.',
    href: null,
    system: false,
    ...partial,
  }
}

describe('derivePersonRightNow', () => {
  it('reads last activity and last message from the merged timeline', () => {
    const strip = derivePersonRightNow({
      nowMs: now,
      nowLine: 'Not on the site.',
      timeline: [
        item({ id: 'out', ts: '2026-10-13T16:53:00Z' }),
        item({
          id: 'in',
          ts: '2026-10-13T14:51:00Z',
          direction: 'in',
          title: 'Text received',
          body: 'Hi Ryan, This is Chance',
          actor: null,
        }),
      ],
      tasks: [],
    })
    expect(strip.lastActivity.title).toContain('Text sent')
    expect(strip.lastActivity.title).toContain('16 minutes ago')
    expect(strip.lastMessage?.channel).toBe('sms')
    expect(strip.lastMessage?.direction).toBe('out')
    expect(strip.lastMessage?.preview).toContain('Hi Chance')
  })

  it('marks next step as Replied and lists reply tasks that can close', () => {
    const strip = derivePersonRightNow({
      nowMs: now,
      timeline: [item({ id: 'out', ts: '2026-10-13T16:53:00Z' })],
      tasks: [
        { id: 1, name: 'Reply back — they answered your sms', type: 'call', due_at: '2026-10-13T15:06:00Z', completed_at: null },
        { id: 2, name: 'Reply to text from Chance Jackson', type: 'Text', due_at: '2026-10-13T15:06:00Z', completed_at: null },
      ],
    })
    expect(strip.nextStep.title).toBe('Replied')
    expect(strip.nextStep.detail).toBe('2 reply tasks can close')
    expect(strip.nextStep.closeTaskIds).toEqual([1, 2])
  })

  it('ignores system rows when picking last activity', () => {
    const strip = derivePersonRightNow({
      nowMs: now,
      timeline: [
        item({
          id: 'sys',
          ts: '2026-10-13T16:54:00Z',
          channel: 'system',
          direction: null,
          title: 'System update',
          body: 'Broker alert queued',
          system: true,
        }),
        item({ id: 'out', ts: '2026-10-13T16:53:00Z' }),
      ],
      tasks: [],
    })
    expect(strip.lastActivity.title).toContain('Text sent')
  })
})
