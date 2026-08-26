import { describe, expect, it } from 'vitest'
import { igMediaRows } from './route'
import type { IGMedia } from '@/lib/meta-graph'

const media = (over: Partial<IGMedia> = {}): IGMedia => ({
  id: 'm1',
  timestamp: '2026-08-24T00:00:00Z',
  media_type: 'IMAGE',
  media_url: 'https://example.com/a.jpg',
  permalink: 'https://instagram.com/p/a',
  caption: 'a caption',
  views: 27,
  reach: 16,
  total_interactions: 3,
  saved: 1,
  ...over,
})

describe('igMediaRows — an unmeasured metric is absent, never zero', () => {
  // The defect: Meta retired `impressions` for IG media at v22, every call 400d,
  // the error was caught and a 0 written. 869 straight days of false zeros in
  // marketing_channel_daily, with the pipeline reporting healthy the whole time.
  it('writes a row for every metric it actually read', () => {
    const rows = igMediaRows('2026-08-24', [media()])
    expect(rows.map((r) => r.metric).sort()).toEqual(['reach', 'saved', 'total_interactions', 'views'])
    expect(rows.find((r) => r.metric === 'views')?.value).toBe(27)
  })

  it('DROPS a metric it could not read rather than writing 0', () => {
    const rows = igMediaRows('2026-08-24', [media({ views: null, reach: null })])
    expect(rows.map((r) => r.metric).sort()).toEqual(['saved', 'total_interactions'])
    expect(rows.some((r) => r.metric === 'views')).toBe(false)
    expect(rows.some((r) => r.value === 0 && r.metric === 'views')).toBe(false)
  })

  it('keeps a genuine zero — 0 read from the API is real and must be written', () => {
    const rows = igMediaRows('2026-08-24', [media({ saved: 0 })])
    const saved = rows.find((r) => r.metric === 'saved')
    expect(saved).toBeDefined()
    expect(saved?.value).toBe(0)
  })

  it('never emits the retired impressions or engagement metrics', () => {
    const rows = igMediaRows('2026-08-24', [media()])
    expect(rows.some((r) => r.metric === 'impressions')).toBe(false)
    expect(rows.some((r) => r.metric === 'engagement')).toBe(false)
  })
})
