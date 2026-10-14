import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { figureLeaks, type MotionCue } from '../motion/cues'
import { buildCaptions } from '../voice/captions'
import type { SpokenWord } from '../voice/types'
import { PlanError, endcardStartSeconds, planFilm, subjectFromBrief, type ResolvedFootage } from './plan'
import { parseBrief, parseTimeline } from './validate'
import { shiftWords } from './voice'
import type { StudioBrief, Timeline } from './types'

const repo = join(__dirname, '..', '..', '..')
const read = (p: string) => JSON.parse(readFileSync(join(repo, p), 'utf8'))

function sample(mutate?: (b: Record<string, any>, t: Record<string, any>) => void): { brief: StudioBrief; timeline: Timeline } {
  const rawBrief = read('lib/studio/timeline/fixtures/bend-mos.brief.json')
  const rawTimeline = read('lib/studio/timeline/fixtures/bend-mos.timeline.json')
  mutate?.(rawBrief, rawTimeline)
  const b = parseBrief(rawBrief)
  const t = parseTimeline(rawTimeline)
  if (!b.ok || !t.ok) throw new Error(`fixture invalid: ${JSON.stringify(b.ok ? '' : b.issues)} ${JSON.stringify(t.ok ? '' : t.issues)}`)
  return { brief: b.value, timeline: t.value }
}

const voiceWords: SpokenWord[] = read('lib/studio/timeline/fixtures/bend-mos.words.json').words

function voiceFor(timeline: Timeline) {
  const words = shiftWords(voiceWords, timeline.voice?.start ?? 0.3)
  const captions = buildCaptions(words, { display: timeline.voice?.display, endLimitSeconds: endcardStartSeconds(timeline) })
  return { words, captions }
}

function footageFor(timeline: Timeline): Record<string, ResolvedFootage> {
  const out: Record<string, ResolvedFootage> = {}
  for (const f of [...timeline.beats.map((b) => b.footage), timeline.cta?.footage]) {
    if (f) out[f.src] = { path: `/tmp/${out[f.src] ? 'x' : 'clip'}.mp4`, width: 1080, height: 1920, duration: 24 }
  }
  return out
}

function plan(mutate?: (b: Record<string, any>, t: Record<string, any>) => void) {
  const { brief, timeline } = sample(mutate)
  return planFilm({ brief, timeline, voice: voiceFor(timeline), footage: footageFor(timeline), scored: Boolean(timeline.score) })
}

const byKind = <K extends MotionCue['kind']>(cues: MotionCue[], kind: K) =>
  cues.filter((c): c is Extract<MotionCue, { kind: K }> => c.kind === kind)

describe('planFilm on the sample (Bend months of supply)', () => {
  const film = plan()

  it('runs 489 frames: the end card at 13.2 s, out at 16.25 s, one frame past it for the loop', () => {
    expect(film.endcard).toMatchObject({ start: 13.2, quality: 13.2, local: 13.6, service: 14, call: 14.45, out: 16.25 })
    expect(film.frames).toBe(489)
    expect(film.duration).toBeCloseTo(16.3, 9)
    expect(film.loop).toEqual({ seconds: 0.3 })
    expect(film.plan.loopEcho).toEqual({ from: 15.95 })
  })

  it('draws the hook figure first, the meter, the payoff line, the share card, the captions, then the locked card on top', () => {
    const kinds = film.plan.cues.map((c) => c.kind)
    expect(kinds.slice(0, 4)).toEqual(['number', 'meter', 'text', 'cta'])
    expect(kinds.at(-1)).toBe('endcard')
    expect(byKind(film.plan.cues, 'caption').length).toBeGreaterThan(10)
    const [number] = byKind(film.plan.cues, 'number')
    expect(number).toMatchObject({ start: 0.1, value: '3.5', unit: 'months of homes for sale', asOf: 'As of Oct 13, 2026' })
    expect(number.eyebrow).toBe('City of Bend · single-family homes')
    const [meter] = byKind(film.plan.cues, 'meter')
    expect(meter).toMatchObject({ value: '3.5', mos: 3.5, verdictKind: 'sellers', thresholds: [4, 6], domainMax: 10 })
    expect(film.plan.layout).toBe('captioned')
    expect(film.plan.holdDriftPx).toBe(8)
  })

  it('every card holds at least 2.5 s and sits above the caption band', () => {
    for (const cue of film.plan.cues) {
      if (cue.kind === 'caption' || cue.kind === 'endcard') continue
      expect(cue.end - cue.start, cue.id).toBeGreaterThanOrEqual(2.5)
      expect(cue.place?.top ?? 0, cue.id).toBeLessThan(700)
    }
  })

  it('no caption runs into the end card, and captions show the brief figure for "three and a half"', () => {
    const caps = byKind(film.plan.cues, 'caption')
    for (const c of caps) expect(c.end).toBeLessThanOrEqual(13.2)
    expect(caps.some((c) => c.text.includes('3.5 months'))).toBe(true)
  })

  it('cuts the plate per beat, frame exact, and holds frame 0 under the end card', () => {
    expect(film.segments.map((s) => s.kind)).toEqual(['footage', 'footage', 'footage', 'footage', 'opening'])
    const frames = film.segments.map((s) => Math.round(s.seconds * 30))
    expect(frames.reduce((a, b) => a + b, 0)).toBe(489)
    expect(film.segments[0]).toMatchObject({ kind: 'footage', in: 0.5 })
  })

  it('writes the manifest beats in role order, the share line as the cta beat', () => {
    expect(film.beats.map((b) => b.role)).toEqual(['hook', 'body', 'payoff', 'cta', 'endcard'])
    expect(film.beats.at(-1)).toMatchObject({ start: 13.2, end: 16.25 })
  })

  it('plans every brief technique with its proof', () => {
    expect(film.techniques.map((t) => t.name).sort()).toEqual(
      ['composed_score', 'dollar_first_hook', 'eased_number_reveal', 'loop_seam_edit', 'meter_fill_verdict', 'send_invite_hook', 'tiktok_caption_burn'].sort(),
    )
    const dollar = film.techniques.find((t) => t.name === 'dollar_first_hook')!
    expect(dollar.proofs).toEqual([{ t: 1, cue: 'hook-number', text: '3.5' }])
  })

  it('carries the brief row and a row for every authored digit beside it (scale marks, as-of date)', () => {
    expect(film.numbers.map((n) => n.onScreen)).toEqual(['3.5', 'As of Oct 13, 2026', '4 mo', '6 mo', '10 mo'])
    for (const n of film.numbers) for (const k of ['source', 'window', 'geography', 'definition'] as const) expect(n[k]?.trim()).toBeTruthy()
  })

  it('passes the §0 backstop, and an unsourced number on a card is caught', () => {
    expect(figureLeaks(film.plan, film.subject)).toEqual([])
    // A digit never reaches a text card (validate.ts refuses it); on a caption the backstop still holds.
    const leaky = { ...film, plan: { ...film.plan, cues: [...film.plan.cues, { kind: 'caption', id: 'capx', start: 1, end: 2, text: 'down 45%', words: [0] } as MotionCue] } }
    expect(figureLeaks(leaky.plan, leaky.subject)).toEqual(['45%'])
  })
})

describe('planFilm refuses what it cannot draw honestly', () => {
  const problems = (mutate: (b: Record<string, any>, t: Record<string, any>) => void) => {
    try {
      plan(mutate)
    } catch (e) {
      if (e instanceof PlanError) return e.problems
      throw e
    }
    return []
  }

  it('a brief technique the renderer does not run', () => {
    expect(problems((b) => b.techniques.push('line_draw_riding_dot'))).toContainEqual(expect.stringMatching(/"line_draw_riding_dot" is not one the timeline renderer runs/))
  })

  it('a number key with no brief row', () => {
    expect(problems((_b, t) => (t.beats[0].cards[0].number = 'bend_median_price'))).toContainEqual(expect.stringMatching(/"bend_median_price" has no brief.numbers row/))
  })

  it('a gap between beats', () => {
    expect(problems((_b, t) => (t.beats[1].start = 3.9))).toContainEqual(expect.stringMatching(/beats run edge to edge/))
  })

  it('a hook device the brief names and the timeline never sets up', () => {
    expect(problems((b) => b.techniques.push('question_secret_hook'))).toContainEqual(expect.stringMatching(/question_secret_hook but no beat sets it up/))
  })

  it('an end card beat that does not run the locked 3.05 s', () => {
    expect(problems((_b, t) => (t.beats[3].end = 18.2))).toContainEqual(expect.stringMatching(/set the end card beat's end to 16.25s/))
  })

  it('a meter on a figure that is not months of supply', () => {
    expect(
      problems((b) => {
        b.numbers[0].definition = 'median list price'
        b.techniques = b.techniques.filter((x: string) => x !== 'meter_fill_verdict')
      }).join(' '),
    ).toMatch(/needs a months-of-supply figure/)
  })
})

describe('planFilm keeps today\'s timelines working', () => {
  it('plans the ryan-studio pass timeline once its end card runs the locked 3.05 s', () => {
    const rawBrief = { ...read('.claude/skills/ryan-studio/tools/tests/fixtures/pass.brief.json'), techniques: ['eased_number_reveal'] }
    const rawTimeline = read('.claude/skills/ryan-studio/tools/tests/fixtures/pass.timeline.json')
    rawTimeline.beats[4].end = 22.05
    const b = parseBrief(rawBrief)
    const t = parseTimeline(rawTimeline)
    if (!b.ok || !t.ok) throw new Error('pass fixtures invalid')
    const film = planFilm({ brief: b.value, timeline: t.value, voice: null, footage: {} })
    // Each legacy beat draws its figure and its line; no footage means cream paper beats.
    expect(film.plan.cues.filter((c) => c.kind === 'number').map((c) => (c as { value: string }).value)).toEqual(['69%', '1 IN 2'])
    // The brief is loopable, so frame 0 (cream paper here) is held under the end card.
    expect(film.segments.map((s) => s.kind)).toEqual(['paper', 'paper', 'paper', 'paper', 'opening'])
    expect(film.plan.cues.filter((c) => c.kind === 'text' && c.place?.paper).map((c) => (c as { line: string }).line)).toEqual(['BEND THIS SUMMER', 'ROOM TO NEGOTIATE'])
    expect(film.plan.cues.find((c) => c.kind === 'number')).toMatchObject({ value: '69%', unit: 'UNDER ASKING' })
    expect(figureLeaks(film.plan, subjectFromBrief(b.value))).toEqual([])
  })
})
