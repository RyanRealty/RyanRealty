import { describe, expect, it } from 'vitest'
import { classifyFeed, formatSilentZeroReport, RETIRED_METRICS, type FeedWindow } from './silent-zero'

// The generic fixture uses `reach`, a metric that is still LIVE. It used to use
// `impressions` — the original real case — but that name is now classified
// `retired`, because Meta removed it and its stored rows were never measured.
// Reusing it here would test the retired path while claiming to test the
// silent-zero path.
const w = (over: Partial<FeedWindow> = {}): FeedWindow => ({
  channel: 'instagram',
  metric: 'reach',
  rows: 90,
  total: 0,
  nonZeroRows: 0,
  latest: '2026-08-24',
  ...over,
})

describe('classifyFeed', () => {
  // The real case: Instagram impressions, 869 consecutive days of 0, landing on
  // time the whole way. Every freshness check passed.
  it('flags a feed that lands on schedule and reports only zeros', () => {
    const v = classifyFeed(w())
    expect(v.verdict).toBe('silent-zero')
    expect(v.note).toContain('every value 0')
  })

  it('does NOT flag a feed with real values mixed in', () => {
    expect(classifyFeed(w({ nonZeroRows: 12, total: 4745 })).verdict).toBe('healthy')
  })

  // A genuine zero day is ordinary. Only a long unbroken run is a defect.
  it('does not call a short window broken', () => {
    expect(classifyFeed(w({ rows: 3 })).verdict).toBe('sparse')
  })

  it('reports a feed that stopped landing entirely', () => {
    const v = classifyFeed(w({ rows: 0, latest: null }))
    expect(v.verdict).toBe('absent')
    expect(v.note).toContain('not landing')
  })

  it('a single real value in a long window is enough to clear it', () => {
    expect(classifyFeed(w({ nonZeroRows: 1 })).verdict).toBe('healthy')
  })
})

describe('formatSilentZeroReport', () => {
  it('says so plainly when everything is fine', () => {
    const out = formatSilentZeroReport([classifyFeed(w({ nonZeroRows: 5 }))])
    expect(out[0]).toContain('none reporting only zeros')
  })

  it('names each broken feed', () => {
    const out = formatSilentZeroReport([
      classifyFeed(w()),
      classifyFeed(w({ channel: 'meta_page', metric: 'post_impressions' })),
      classifyFeed(w({ channel: 'youtube', metric: 'impressions', rows: 0, latest: null })),
    ]).join('\n')
    expect(out).toContain('instagram.reach')
    expect(out).toContain('meta_page.post_impressions')
    expect(out).toContain('youtube.impressions')
    expect(out).toContain('ONLY ZEROS')
  })
})

describe('KNOWN_DORMANT — the guard\'s first false positive', () => {
  // It flagged every YouTube account metric as a silent zero. Probing the API
  // returned rows [[0,0]] and 2 views across 30 days: the channel is dormant and
  // the zeros are real. Reading stored data cannot tell a measured 0 from an
  // error written as 0 — they are the same byte — so a verified-real zero has to
  // be recorded, or the guard fires forever and gets ignored like the lead alarm.
  it('does not flag a feed whose zeros were verified real', () => {
    const v = classifyFeed(w({ channel: 'youtube', metric: 'views' }))
    expect(v.verdict).toBe('dormant')
    expect(v.note).toContain('zeros are real')
  })

  it('a wildcard covers every metric on that channel', () => {
    expect(classifyFeed(w({ channel: 'youtube', metric: 'likes' })).verdict).toBe('dormant')
    expect(classifyFeed(w({ channel: 'youtube', metric: 'anything' })).verdict).toBe('dormant')
  })

  it('still flags channels that are NOT on the list', () => {
    // `reach` is live on Instagram, so a run of zeros there is a real defect.
    // (`impressions` is no longer the example: it is now classified `retired`.)
    expect(classifyFeed(w({ channel: 'instagram', metric: 'reach' })).verdict).toBe('silent-zero')
  })

  it('dormant feeds do not appear in the report', () => {
    const out = formatSilentZeroReport([classifyFeed(w({ channel: 'youtube', metric: 'views' }))]).join('\n')
    expect(out).toContain('none reporting only zeros')
  })

  it('the silent-zero note asks the reader to verify, not to conclude', () => {
    const v = classifyFeed(w())
    expect(v.note).toContain('PROMPT, not a verdict')
    expect(v.note).toContain('Probe the API')
  })
})


describe('retired metrics are named, not chased', () => {
  // The distinction that matters: a DORMANT feed's zeros are real measurements
  // of a quiet account. A RETIRED metric's zeros were never measured — the API
  // 400d on the name and a 0 was written. Calling the second one "dormant"
  // would assert the opposite of the truth.
  const win = (channel: string, metric: string): FeedWindow => ({
    channel, metric, rows: 30, total: 0, nonZeroRows: 0, latest: '2026-08-25',
  })

  it('classifies a retired metric as retired, never as a silent zero', () => {
    const v = classifyFeed(win('instagram', 'impressions'))
    expect(v.verdict).toBe('retired')
    expect(v.note).toContain('retired')
  })

  it('says the stored rows were never measured', () => {
    const v = classifyFeed(win('meta_page', 'post_impressions'))
    expect(v.note).toContain('never measured')
  })

  it('retired outranks dormant so a channel-wide dormant rule cannot mislabel it', () => {
    // If a retired metric ever sat on a KNOWN_DORMANT channel, "zeros are real"
    // would be exactly backwards. Retired is checked first, on purpose.
    const retiredKeys = Object.keys(RETIRED_METRICS)
    expect(retiredKeys.length).toBeGreaterThan(0)
    for (const key of retiredKeys) {
      const [channel, metric] = key.split(':')
      expect(classifyFeed(win(channel, metric)).verdict).toBe('retired')
    }
  })

  it('a live metric on the same channel is still judged on its own merits', () => {
    expect(classifyFeed(win('instagram', 'views')).verdict).toBe('silent-zero')
    expect(classifyFeed({ ...win('instagram', 'views'), nonZeroRows: 12 }).verdict).toBe('healthy')
  })

  it('the report separates retired from a defect to chase', () => {
    const lines = formatSilentZeroReport([
      classifyFeed(win('instagram', 'impressions')),
      classifyFeed(win('instagram', 'views')),
    ])
    const joined = lines.join('\n')
    expect(joined).toContain('RETIRED')
    expect(joined).toContain('ONLY ZEROS')
    // The retired one must NOT be counted among the feeds to chase.
    expect(joined).toContain('1 feed(s) landing on schedule and reporting ONLY ZEROS')
  })
})
