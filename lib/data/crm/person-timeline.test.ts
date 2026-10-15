import { describe, expect, it } from 'vitest'
import { filterPersonTimeline, mergePersonTimeline, pageViewsFromVisits } from './person-timeline'
import type { ConversationMessage } from './getContactConversation'
import type { ActivityFeedItem } from './getContactActivityFeed'
import type { PersonNoteRow } from './getPersonNotes'

const conv = (partial: Partial<ConversationMessage> & Pick<ConversationMessage, 'id' | 'ts' | 'kind'>): ConversationMessage => ({
  title: null,
  body: null,
  broker: null,
  payload: null,
  ...partial,
})

const feed = (partial: Partial<ActivityFeedItem> & Pick<ActivityFeedItem, 'id' | 'ts' | 'kind'>): ActivityFeedItem => ({
  category: 'message',
  direction: null,
  label: 'Text sent',
  snippet: null,
  broker: null,
  source: 'app',
  recordingSid: null,
  recordingDurationSec: null,
  contentHidden: false,
  group: null,
  ...partial,
})

describe('mergePersonTimeline', () => {
  it('orders newest first', () => {
    const items = mergePersonTimeline({
      conversation: [
        conv({ id: 1, ts: '2026-10-13T14:51:00Z', kind: 'sms_in', body: 'Hello' }),
        conv({ id: 2, ts: '2026-10-13T16:53:00Z', kind: 'sms_out', body: 'Thanks', broker: 'matt' }),
      ],
      notes: [{ id: 9, ts: '2025-11-07T17:38:00Z', body: 'Imported', broker: 'import' }],
    })
    expect(items.map((i) => i.id)).toEqual(['conv:2', 'conv:1', 'note:9'])
    expect(items[0]?.channel).toBe('sms')
    expect(items[0]?.direction).toBe('out')
  })

  it('dedupes a sent text that is in both the thread and the activity feed', () => {
    const items = mergePersonTimeline({
      conversation: [
        conv({
          id: 22,
          ts: '2026-10-13T16:53:00Z',
          kind: 'sms_out',
          body: 'Hi Chance, thanks for letting us know.',
          broker: 'matt',
        }),
      ],
      feed: [
        feed({
          id: 22,
          ts: '2026-10-13T16:53:00Z',
          kind: 'sms_out',
          direction: 'out',
          label: 'Text sent',
          snippet: 'Hi Chance, thanks for letting us know.',
          broker: 'matt',
        }),
      ],
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('conv:22')
  })

  it('keeps a system row but marks it so the UI can hide it', () => {
    const items = mergePersonTimeline({
      feed: [
        feed({
          id: 3,
          ts: '2026-10-13T14:51:00Z',
          kind: 'system',
          category: 'system',
          label: 'System update',
          snippet: 'Broker alert queued (reply:sms)',
        }),
      ],
    })
    expect(items[0]?.system).toBe(true)
    expect(filterPersonTimeline(items, 'all')).toEqual([])
    expect(filterPersonTimeline(items, 'all', { showSystem: true })).toHaveLength(1)
  })

  it('shows a delivery row on the timeline, flagged as an email lifecycle row', () => {
    const items = mergePersonTimeline({
      feed: [
        feed({
          id: 4,
          ts: '2026-10-15T14:00:00Z',
          kind: 'email_delivered',
          category: 'email',
          label: 'Email delivered',
          snippet: 'River West homes: 3 new listings',
        }),
      ],
    })
    expect(items[0]).toMatchObject({ channel: 'email', direction: null, system: false, lifecycle: true, title: 'Email delivered' })
    expect(filterPersonTimeline(items, 'all')).toHaveLength(1)
    expect(filterPersonTimeline(items, 'email')).toHaveLength(1)
  })

  it('merges page views as visit rows without dropping notes', () => {
    const note: PersonNoteRow = { id: 4, ts: '2025-11-07T17:38:00Z', body: 'Location note', broker: null }
    const items = mergePersonTimeline({
      notes: [note],
      pageViews: [{ ts: '2026-10-12T18:00:00Z', title: 'Tetherow homes', href: '/communities/tetherow' }],
    })
    expect(items.map((i) => i.channel)).toEqual(['visit', 'note'])
    expect(items[0]?.href).toBe('/communities/tetherow')
  })

  it('flattens identity-loop visits into page-view rows', () => {
    const views = pageViewsFromVisits([
      {
        pages: [
          { at: '2026-10-12T18:00:00Z', title: 'Tetherow', path: '/communities/tetherow' },
          { at: '2026-10-12T18:02:00Z', title: 'A listing', path: '/homes-for-sale/x' },
        ],
      },
    ])
    expect(views).toHaveLength(2)
    expect(views[1]?.href).toBe('/homes-for-sale/x')
  })
})
