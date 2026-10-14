import { describe, expect, it } from 'vitest'
import { marketVerdict } from '@/lib/market/classify'
import {
  CLOSER_SECONDS,
  CUE_PARTS,
  ENDCARD_SECONDS,
  ENTER_SECONDS,
  MIN_CARD_SECONDS,
  cueTexts,
  figureLeaks,
  frameState,
  planMotion,
  stillTimes,
  type MotionCue,
  type MotionPlan,
  type MotionSubject,
} from './cues'

const market = (mos: string | null, extra: Record<string, string> = {}): MotionSubject => {
  const figures: Record<string, string> = { ...extra }
  if (mos) figures['months of supply'] = mos
  return {
    label: 'Bend, Oregon',
    figures,
    citations: Object.values(figures).map((figure) => ({
      figure,
      source: 'Supabase',
      table: 'market_metric (via getMarketPulse overlay)',
      computed_at: '2026-10-06T14:00:00.000Z',
    })),
  }
}

const listing = (agent: MotionSubject['agent']): MotionSubject => ({
  label: '61234 Elm St, Bend',
  heading: { eyebrow: 'Bend', line: '61234 Elm St' },
  figures: { 'list price': '$1,250,000', bedrooms: '4', bathrooms: '3.5' },
  citations: [
    { figure: '$1,250,000', fetched_at: '2026-10-07T15:00:00.000Z' },
    { figure: '4', fetched_at: '2026-10-07T15:00:00.000Z' },
    { figure: '3.5', fetched_at: '2026-10-07T15:00:00.000Z' },
  ],
  agent,
})

const MATT = { name: 'Matt Ryan', headshotPath: '/images/brokers/ryan-matt.png' }

const byKind = <K extends MotionCue['kind']>(plan: MotionPlan, kind: K) =>
  plan.cues.filter((c): c is Extract<MotionCue, { kind: K }> => c.kind === kind)

describe('planMotion: market', () => {
  it('a six-second pulse gets the meter up front and the locked end card after the clip', () => {
    const plan = planMotion({ spec: { lead: 'market', closer: 'brand' }, subject: market('4.1'), duration: 6 })
    expect(plan.cues.map((c) => c.kind)).toEqual(['meter', 'endcard'])
    const [meter, endcard] = plan.cues
    // Content is fully up by 1.0s.
    expect(meter.start + ENTER_SECONDS).toBeLessThanOrEqual(1)
    expect(meter.end - meter.start).toBeGreaterThanOrEqual(MIN_CARD_SECONDS)
    // The end card is opaque, so it follows the footage rather than eating it.
    expect(endcard.start).toBe(6)
    expect(endcard.end).toBe(6 + ENDCARD_SECONDS)
    expect(plan.duration).toBe(endcard.end)
    expect(plan.footageSeconds).toBe(6)
    expect(meter.end).toBeLessThanOrEqual(6 - 0.2)
  })

  it('the end card starts on a whole frame after footage of any length', () => {
    const plan = planMotion({ spec: { lead: 'market', closer: 'brand' }, subject: market('4.1'), duration: 6.041667 })
    const endcard = plan.cues.find((c) => c.kind === 'endcard')
    if (endcard?.kind !== 'endcard') throw new Error('no end card')
    // Frame 182 at 30 fps is the first whole frame after the clip ends, and
    // the card is up on it: the start is never a hair after the frame.
    expect(endcard.start).toBe(6.066)
    expect(182 / 30).toBeGreaterThanOrEqual(endcard.start)
    expect(181 / 30).toBeLessThan(endcard.start)
    expect(frameState(plan, 182 / 30).find((s) => s.id === 'endcard-card')?.opacity).toBe(1)
    expect(frameState(plan, 181 / 30).find((s) => s.id === 'endcard-card')?.opacity).toBe(0)
    expect(endcard.times).toMatchObject({ quality: 6.066, local: 6.466, service: 6.866, call: 7.316, out: 9.116 })
  })

  it('the verdict is the canonical one for the number it sits beside', () => {
    for (const mos of ['3.9', '4.0', '4.1', '5.9', '6.0', '7.2']) {
      const [meter] = byKind(planMotion({ spec: { lead: 'market', closer: 'brand' }, subject: market(mos), duration: 6 }), 'meter')
      const expected = marketVerdict(Number(mos)).label
      expect(meter.verdict.toLowerCase()).toBe(expected.toLowerCase())
      expect(meter.thresholds).toEqual([4, 6])
    }
  })

  it('without months of supply it falls back to a verified figure, then to the name alone', () => {
    const median = planMotion({
      spec: { lead: 'market', closer: 'brand' },
      subject: market(null, { 'median list price': '$749,000' }),
      duration: 6,
    })
    expect(byKind(median, 'figure')[0]).toMatchObject({ value: '$749,000', detail: 'median list price' })
    const bare = planMotion({ spec: { lead: 'market', closer: 'brand' }, subject: market(null), duration: 6 })
    expect(byKind(bare, 'title')[0]).toMatchObject({ line: 'Bend, Oregon', value: null })
  })

  it('carries the as-of date from the trace', () => {
    const [meter] = byKind(planMotion({ spec: { lead: 'market', closer: 'brand' }, subject: market('4.1'), duration: 6 }), 'meter')
    expect(meter.asOf).toBe('As of Oct 6, 2026')
  })
})

describe('planMotion: listings', () => {
  it('a four-beat film puts the address on beat one, the price on beat two, and lets the house breathe', () => {
    const plan = planMotion({
      spec: { lead: 'listing', closer: 'listing-agent' },
      subject: listing(MATT),
      duration: 24,
      beats: [0, 6, 12, 18],
    })
    expect(plan.cues.map((c) => c.kind)).toEqual(['title', 'figure', 'closer', 'endcard'])
    const [title, price, closer, endcard] = plan.cues
    expect(title).toMatchObject({ eyebrow: 'Bend', line: '61234 Elm St' })
    expect(title.end).toBeLessThan(6)
    expect(price.start).toBeGreaterThanOrEqual(6)
    expect(price.end).toBeLessThan(12)
    expect(price).toMatchObject({ value: '$1,250,000', detail: '4 bedrooms · 3.5 bathrooms' })
    // Our own listing keeps the agent's card, then closes on the locked card.
    expect(closer).toMatchObject({ start: 24 - CLOSER_SECONDS, end: 24, agent: MATT })
    expect(endcard).toMatchObject({ start: 24, end: 24 + ENDCARD_SECONDS })
  })

  it('a single clip carries one card with address and price together', () => {
    const plan = planMotion({ spec: { lead: 'listing', closer: 'listing-agent' }, subject: listing(MATT), duration: 6 })
    expect(plan.cues.map((c) => c.kind)).toEqual(['title', 'closer', 'endcard'])
    expect(plan.cues[0]).toMatchObject({ line: '61234 Elm St', value: '$1,250,000' })
  })

  it("another office's listing gets no brand card, and says so", () => {
    const plan = planMotion({ spec: { lead: 'listing', closer: 'listing-agent' }, subject: listing(null), duration: 6 })
    expect(plan.cues.some((c) => c.kind === 'closer' || c.kind === 'endcard')).toBe(false)
    expect(plan.duration).toBe(6)
    expect(plan.notes.join(' ')).toMatch(/not a Ryan Realty broker/)
  })

  it("closer 'none' keeps the brand out of frame entirely", () => {
    const plan = planMotion({ spec: { lead: 'listing', closer: 'none' }, subject: listing(MATT), duration: 6 })
    expect(plan.cues.map((c) => c.kind)).toEqual(['title'])
    expect(plan.duration).toBe(6)
    expect(plan.notes).toEqual([])
  })

  it('a short clip still gets its lead card, and the end card after it', () => {
    const plan = planMotion({ spec: { lead: 'market', closer: 'brand' }, subject: market('4.1'), duration: 4 })
    expect(plan.cues.map((c) => c.kind)).toEqual(['meter', 'endcard'])
    expect(plan.duration).toBe(4 + ENDCARD_SECONDS)
  })

  it('a clip too short for the agent card drops it and keeps the end card', () => {
    const plan = planMotion({ spec: { lead: 'listing', closer: 'listing-agent' }, subject: listing(MATT), duration: 4 })
    expect(plan.cues.map((c) => c.kind)).toEqual(['title', 'endcard'])
    expect(plan.notes.join(' ')).toMatch(/no room/)
  })
})

describe('review fixes', () => {
  it('never prints a read time as the data date', () => {
    const plan = planMotion({
      spec: { lead: 'listing', closer: 'listing-agent' },
      subject: listing(MATT),
      duration: 24,
      beats: [0, 6, 12, 18],
    })
    // Listing traces carry only fetched_at: no basis, no date on screen.
    expect(byKind(plan, 'figure')[0].asOf).toBeNull()
  })

  it('a card leaves at least half a second before the next cut', () => {
    const plan = planMotion({
      spec: { lead: 'listing', closer: 'listing-agent' },
      subject: listing(MATT),
      duration: 24,
      beats: [0, 6, 12, 18],
    })
    expect(plan.cues[0].end).toBeLessThanOrEqual(6 - 0.5)
    expect(plan.cues[1].end).toBeLessThanOrEqual(12 - 0.5)
  })

  it('the lit zone is the verdict kind, at the boundaries too', () => {
    for (const [mos, kind] of [['4.0', 'sellers'], ['4.1', 'balanced'], ['5.9', 'balanced'], ['6.0', 'buyers']] as const) {
      const [meter] = byKind(planMotion({ spec: { lead: 'market', closer: 'brand' }, subject: market(mos), duration: 6 }), 'meter')
      expect(meter.verdictKind).toBe(kind)
    }
  })
})

describe('figureLeaks (§0 backstop)', () => {
  it('a plan built from the figures has no leaks, dates and thresholds included', () => {
    const subject = market('4.1')
    const plan = planMotion({ spec: { lead: 'market', closer: 'brand' }, subject, duration: 6 })
    expect(figureLeaks(plan, subject)).toEqual([])
    expect(figureLeaks(plan, subject, ['4.1 months of supply', '4 mo', '6 mo', '10 mo', '4', '6'])).toEqual([])
    const film = planMotion({
      spec: { lead: 'listing', closer: 'listing-agent' },
      subject: listing(MATT),
      duration: 24,
      beats: [0, 6, 12, 18],
    })
    expect(figureLeaks(film, listing(MATT))).toEqual([])
  })

  it('catches a number that is not a verified figure, in the plan or in what was drawn', () => {
    const subject = listing(MATT)
    const plan = planMotion({ spec: { lead: 'listing', closer: 'listing-agent' }, subject, duration: 6 })
    const tampered: MotionPlan = {
      ...plan,
      cues: plan.cues.map((c) => (c.kind === 'title' ? { ...c, value: '$1.25M' } : c)),
    }
    expect(figureLeaks(tampered, subject)).toContain('$1.25')
    expect(figureLeaks(plan, subject, ['Priced to sell at $1,199,000'])).toEqual(['$1,199,000'])
  })

  it('no card text carries an em dash', () => {
    const plan = planMotion({
      spec: { lead: 'listing', closer: 'listing-agent' },
      subject: listing(MATT),
      duration: 24,
      beats: [0, 6, 12, 18],
    })
    for (const cue of plan.cues) for (const text of cueTexts(cue)) expect(text).not.toMatch(/—/)
  })
})

describe('frameState', () => {
  const plan = planMotion({ spec: { lead: 'market', closer: 'brand' }, subject: market('4.1'), duration: 6 })

  it('drives every part of every card', () => {
    const ids = frameState(plan, 0).map((s) => s.id)
    expect(ids).toEqual(plan.cues.flatMap((c) => CUE_PARTS[c.kind].map(({ part }) => `${c.id}-${part}`)))
  })

  it('nothing shows before the first card, and a held card does not change frame to frame', () => {
    expect(frameState(plan, 0).every((s) => s.opacity === 0)).toBe(true)
    expect(JSON.stringify(frameState(plan, 2.2))).toBe(JSON.stringify(frameState(plan, 2.6)))
  })

  it('lead travel never exceeds 16px at 1080 wide, and the end card holds to the last frame', () => {
    for (let t = 0; t <= plan.duration; t += 1 / 30) {
      for (const s of frameState(plan, t)) if (!s.id.startsWith('endcard')) expect(s.y).toBeLessThanOrEqual(16)
    }
    const last = frameState(plan, plan.duration - 1 / 30).filter((s) => s.id.startsWith('endcard'))
    expect(last.map((s) => s.id)).toEqual(CUE_PARTS.endcard.map(({ part }) => `endcard-${part}`))
    expect(last.every((s) => s.opacity === 1)).toBe(true)
    // The call block has landed and holds.
    expect(last.filter((s) => s.id === 'endcard-pill' || s.id === 'endcard-phone').every((s) => s.y === 0)).toBe(true)
  })

  it('the meter marker draws on once the card is in, then stays', () => {
    const marker = (t: number) => frameState(plan, t).find((s) => s.id === 'lead1-card')?.marker ?? -1
    expect(marker(0.5)).toBe(0)
    expect(marker(1.0)).toBeGreaterThan(0)
    expect(marker(2.0)).toBe(1)
  })

  it('stills land inside each card after it has settled', () => {
    for (const { cueId, t } of stillTimes(plan)) {
      const cue = plan.cues.find((c) => c.id === cueId)!
      expect(t).toBeGreaterThan(cue.start + ENTER_SECONDS)
      expect(t).toBeLessThan(cue.end)
    }
  })
})
