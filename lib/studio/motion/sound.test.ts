import { describe, expect, it } from 'vitest'
import { ENTER_SECONDS, planMotion, type MotionSubject } from './cues'
import { scoreFor } from './sound'

const market: MotionSubject = {
  label: 'Bend, Oregon',
  figures: { 'months of supply': '4.1' },
  citations: [{ figure: '4.1', computed_at: '2026-10-06T14:00:00.000Z' }],
}

describe('scoreFor', () => {
  it('a format with no sound is silent', () => {
    const plan = planMotion({ spec: { lead: 'market', closer: 'brand' }, subject: market, duration: 6 })
    expect(scoreFor(plan, { lead: 'market', closer: 'brand' }, market, 'x')).toBeNull()
  })

  it('reads every sound off the plan: card in, marker lands, each end card word, the call resolves', () => {
    const spec = { lead: 'market' as const, closer: 'brand' as const, sound: 'measured' as const }
    const plan = planMotion({ spec, subject: market, duration: 6 })
    const score = scoreFor(plan, spec, market, 'draft-9')!
    const [meter, endcard] = plan.cues
    if (endcard.kind !== 'endcard') throw new Error('no end card')
    expect(score).toMatchObject({ duration: 9.05, seed: 'draft-9', mood: 'measured' })
    expect(score.sections).toEqual([
      { start: 0, end: endcard.start },
      { start: endcard.start, end: 9.05 },
    ])
    expect(score.events).toEqual([
      { kind: 'enter', t: meter.start, weight: 1 },
      { kind: 'land', t: Math.round((meter.start + ENTER_SECONDS + 0.6) * 1000) / 1000, weight: 0.7 },
      { kind: 'enter', t: endcard.times.quality, weight: 0.8 },
      { kind: 'enter', t: endcard.times.local, weight: 0.7 },
      { kind: 'enter', t: endcard.times.service, weight: 0.7 },
      { kind: 'lockup', t: endcard.times.call },
    ])
  })

  it("an agent's card before the end card is an entrance; the end card keeps the lockup", () => {
    const listing: MotionSubject = {
      label: '61234 Elm St, Bend',
      heading: { eyebrow: 'Bend', line: '61234 Elm St' },
      figures: { 'list price': '$1,250,000' },
      citations: [{ figure: '$1,250,000' }],
      agent: { name: 'Matt Ryan', headshotPath: null },
    }
    const spec = { lead: 'listing' as const, closer: 'listing-agent' as const, sound: 'calm' as const }
    const plan = planMotion({ spec, subject: listing, duration: 6 })
    const score = scoreFor(plan, spec, listing, 'x')!
    const closer = plan.cues.find((c) => c.kind === 'closer')!
    const endcard = plan.cues.find((c) => c.kind === 'endcard')
    if (endcard?.kind !== 'endcard') throw new Error('no end card')
    expect(score.events.filter((e) => e.kind === 'lockup')).toEqual([{ kind: 'lockup', t: endcard.times.call }])
    expect(score.events).toContainEqual({ kind: 'enter', t: closer.start, weight: 1 })
  })

  it('a trend film plays one note per plotted month, in time order, carrying its value', () => {
    const points = Array.from({ length: 24 }, (_, i) => ({ tick: `T${i}`, value: i === 4 ? null : 600000 + i * 5000 }))
    const subject: MotionSubject = {
      ...market,
      figures: { ...market.figures, first: '$600,000', last: '$715,000' },
      citations: [...market.citations, { figure: '$600,000' }, { figure: '$715,000' }],
      series: { title: 'Median sale price', scope: 's', points, firstKey: 'first', lastKey: 'last' },
    }
    const spec = { lead: 'trend' as const, closer: 'brand' as const, sound: 'measured' as const }
    const plan = planMotion({ spec, subject, duration: 0 })
    const score = scoreFor(plan, spec, subject, 's')!
    const datums = score.events.filter((e): e is Extract<typeof e, { kind: 'datum' }> => e.kind === 'datum')
    expect(datums).toHaveLength(23)
    for (let i = 1; i < datums.length; i++) expect(datums[i].t).toBeGreaterThan(datums[i - 1].t)
    expect(datums[0]).toMatchObject({ value: 600000, min: 600000, max: 715000 })
    expect(datums[datums.length - 1].value).toBe(715000)
    expect(score.duration).toBe(plan.duration)
  })
})

describe('the score, measured', () => {
  /** Momentary loudness (400 ms blocks every 100 ms) of a 16-bit stereo WAV, as [t, LUFS]. */
  async function momentary(wav: Buffer): Promise<Array<[number, number]>> {
    const { integratedLoudness, SAMPLE_RATE } = await import('../score')
    const n = (wav.length - 44) / 4
    const left = new Float32Array(n)
    const right = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      left[i] = wav.readInt16LE(44 + i * 4) / 32768
      right[i] = wav.readInt16LE(46 + i * 4) / 32768
    }
    const block = Math.round(0.4 * SAMPLE_RATE)
    const hop = Math.round(0.1 * SAMPLE_RATE)
    const out: Array<[number, number]> = []
    for (let i = 0; i + block <= n; i += hop) {
      out.push([(i + block) / SAMPLE_RATE, integratedLoudness(left.subarray(i, i + block), right.subarray(i, i + block))])
    }
    return out
  }

  it('the end card is the most resolved moment, not the loudest: at least 3 dB under the film', async () => {
    const { composeScore } = await import('../score')
    const points = Array.from({ length: 24 }, (_, i) => ({ tick: `T${i}`, value: 700000 + ((i * 37) % 11) * 12000 }))
    const subject: MotionSubject = {
      ...market,
      figures: { ...market.figures, first: '$700,000', last: '$736,000' },
      citations: [...market.citations, { figure: '$700,000' }, { figure: '$736,000' }],
      series: { title: 'Median sale price', scope: 's', points, firstKey: 'first', lastKey: 'last' },
    }
    for (const spec of [
      { lead: 'trend' as const, closer: 'brand' as const, sound: 'measured' as const },
      { lead: 'market' as const, closer: 'brand' as const, sound: 'measured' as const },
      { lead: 'market' as const, closer: 'brand' as const, sound: 'calm' as const },
    ]) {
      const plan = planMotion({ spec, subject, duration: 12 })
      const input = scoreFor(plan, spec, subject, 'measured-arc')!
      const curve = await momentary(composeScore(input).wav)
      const lockup = input.events.find((e) => e.kind === 'lockup') as { t: number }
      const film = Math.max(...curve.filter(([t]) => t < lockup.t).map(([, m]) => m))
      const closing = Math.max(...curve.filter(([t]) => t >= lockup.t + 0.4).map(([, m]) => m))
      expect(film - closing, `${spec.lead}/${spec.sound}`).toBeGreaterThanOrEqual(3)
    }
  }, 30_000)
})
