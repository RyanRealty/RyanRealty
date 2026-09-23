import { describe, expect, it } from 'vitest'
import {
  ANSWER_ENGINE_SOURCE,
  batteryQueries,
  batteryRows,
  citationHost,
  runAnswerEngineBattery,
  scoreCitations,
  type BatterySearch,
} from './answer-engine-battery'
import { foldAnswerEngineRows, ranThisMonth } from '@/lib/data/loop/answer-engine-citations'

describe('scoreCitations (AEO-9)', () => {
  it('finds ryan-realty.com among the cited domains and reports its position', () => {
    const score = scoreCitations(
      [
        'https://www.bendpremierrealestate.com/blog/market-update',
        'https://bendpremierrealestate.com/other',
        'https://ryan-realty.com/communities/tetherow',
        'https://www.zillow.com/bend-or/',
      ],
      'Tetherow homes list from $1.2M, per Ryan Realty and others.',
    )
    expect(score.cited).toBe(true)
    expect(score.position).toBe(2)
    expect(score.ourUrls).toEqual(['https://ryan-realty.com/communities/tetherow'])
    expect(score.competitorDomains).toEqual(['bendpremierrealestate.com', 'zillow.com'])
    expect(score.brandMentioned).toBe(true)
    expect(score.citationCount).toBe(4)
  })

  it('reports not cited, and no position, when only competitors are cited', () => {
    const score = scoreCitations(['https://www.redfin.com/city/1/OR/Bend'], 'Homes in Bend are selling.')
    expect(score).toMatchObject({ cited: false, position: null, brandMentioned: false })
  })

  it('ignores unparseable citations', () => {
    expect(citationHost('not a url')).toBeNull()
    expect(scoreCitations(['not a url'], '').competitorDomains).toEqual([])
  })
})

describe('batteryQueries', () => {
  it('runs the F1 queries plus the non-brand set, once each', () => {
    const qs = batteryQueries()
    const texts = qs.map((q) => q.query.toLowerCase())
    expect(new Set(texts).size).toBe(texts.length)
    expect(texts).toContain('show me the best broker in bend')
    expect(texts).toContain('tetherow homes for sale')
    expect(qs.filter((q) => q.origin === 'f1').length).toBeGreaterThanOrEqual(3)
  })
})

describe('runAnswerEngineBattery + batteryRows', () => {
  const search: BatterySearch = async ({ prompt }) => {
    if (prompt === 'boom') throw new Error('xAI 500')
    return {
      text: 'answer',
      citations:
        prompt === 'cited'
          ? ['https://example.com/a', 'https://ryan-realty.com/about']
          : ['https://example.com/a', 'https://other.org/b'],
      model: 'grok-test',
      costUsd: 0.05,
    }
  }
  const queries = [
    { id: 'a', query: 'cited', intent: 'brand', origin: 'f1' },
    { id: 'b', query: 'not cited', intent: 'brand', origin: 'non-brand' },
    { id: 'c', query: 'boom', intent: 'brand', origin: 'non-brand' },
  ]

  it('never throws; a failed engine call is a recorded error, not a zero', async () => {
    const results = await runAnswerEngineBattery(search, queries, 2)
    expect(results.map((r) => r.query.id)).toEqual(['a', 'b', 'c'])
    expect(results[2]).toMatchObject({ score: null, error: 'xAI 500' })

    const rows = batteryRows('2026-10-02', results)
    expect(rows.every((r) => r.source === ANSWER_ENGINE_SOURCE && r.channel === 'answer_engine')).toBe(true)
    const q = (id: string, metric: string) => rows.find((r) => r.scope_id === `query:${id}` && r.metric === metric)
    expect(q('cited', 'cited')?.value).toBe(1)
    expect(q('cited', 'cited_position')?.value).toBe(2)
    expect(q('not cited', 'cited')?.value).toBe(0)
    expect(q('not cited', 'cited_position')).toBeUndefined()
    expect(rows.some((r) => r.scope_id === 'query:boom')).toBe(false)
    const account = (metric: string) => rows.find((r) => r.scope === 'account' && r.metric === metric)?.value
    expect(account('queries_run')).toBe(3)
    expect(account('queries_answered')).toBe(2)
    expect(account('queries_cited')).toBe(1)
    const example = rows.find((r) => r.scope === 'source' && r.scope_id === 'example.com')
    expect(example?.value).toBe(2)
  })

  it('folds back to the loop summary the way signals.ts reads it', async () => {
    const results = await runAnswerEngineBattery(search, queries, 2)
    const rows = batteryRows('2026-10-02', results).map((r) => ({
      date: r.date,
      // The site_signal view: surface is scope_id, or site:<scope> when empty.
      surface: r.scope_id || `site:${r.scope}`,
      metric: r.metric,
      value: r.value,
      scope: r.scope,
    }))
    const older = { date: '2026-09-02', surface: 'site:account', metric: 'queries_cited', value: 9, scope: 'account' }
    const folded = foldAnswerEngineRows([...rows, older])
    expect(folded).toMatchObject({
      runDate: '2026-10-02',
      queriesRun: 3,
      queriesAnswered: 2,
      queriesCited: 1,
      citedQueries: ['cited'],
    })
    expect(folded.topCompetitors[0]).toEqual({ domain: 'example.com', queries: 2 })
  })

  it('knows when this month already ran', () => {
    const now = new Date('2026-10-20T00:00:00Z')
    expect(ranThisMonth('2026-10-02', now)).toBe(true)
    expect(ranThisMonth('2026-09-30', now)).toBe(false)
    expect(ranThisMonth(null, now)).toBe(false)
  })
})
