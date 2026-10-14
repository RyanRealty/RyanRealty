/**
 * The rules refuse before render (Matt 2026-10-14: "I expect you to know the
 * rules before you build a video").
 *
 * 1. Every video:check check is classified preflight or file-only
 *    (lib/studio/qa/phases.ts), and the table matches the checks video:check runs.
 * 2. Every preflight check is reported by every preflight step its row names,
 *    on a film that breaks that rule (the CASES table below, one case per
 *    check and step; a check with no case fails the coverage test).
 * 3. renderTimelineFilm runs the steps in order and refuses before the paid
 *    voice (step b), before the layout probe and any frame (step c), and before
 *    the full render (step d).
 *
 * The sample fixture is the Bend months-of-supply film. Its only signature
 * technique here is outline_draw_zoom, marked approved in a TEST-ONLY copy of
 * the registry (written to a temp file per run, never the committed file):
 * nothing is approved in the real registry, so the real sample is refused at
 * the signature floor, on purpose.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_ONLY_APPROVAL } from '../qa/fixtures/test-approval'
import { cueTexts, stillTimes } from '../motion/cues'
import type { DrawnText } from '../motion/render'
import { CHECK_IDS } from '../qa/check'
import { CHECK_PHASES, PREFLIGHT_CHECK_IDS, type PreflightStep } from '../qa/phases'
import type { LedgerEntry } from '../qa/ledger'
import type { Manifest } from '../qa/manifest'
import type { Measure } from '../qa/measure'
import { loadTechniqueRegistry, type TechniqueRegistry } from '../qa/techniques'
import { REPO_ROOT, loadVideoTypes, typeRulesFor } from '../qa/thresholds'
import { buildCaptions } from '../voice/captions'
import type { SpokenWord } from '../voice/types'
import { endcardStartSeconds, planFilm, type FilmPlan } from './plan'
import {
  PreflightError,
  dryWords,
  layoutPreflight,
  planPreflight,
  plannedManifest,
  textPreflight,
  type PreflightContext,
  type PreflightProblem,
} from './preflight'
import { renderTimelineFilm, textsFromProbes, type RenderDeps } from './render'
import type { StudioBrief, Timeline } from './types'
import { parseBrief, parseTimeline } from './validate'
import { shiftWords, type FilmVoice } from './voice'

const read = (p: string) => JSON.parse(readFileSync(join(REPO_ROOT, p), 'utf8'))
const SQUARE: Array<[number, number]> = [[-121.32, 44.05], [-121.3, 44.05], [-121.3, 44.07], [-121.32, 44.07], [-121.32, 44.05]]
const AROUND: Array<[number, number]> = [[-121.4, 44.0], [-121.22, 44.0], [-121.22, 44.12], [-121.4, 44.12], [-121.4, 44.0]]

let dir = ''
let registryPath = ''
let registry: TechniqueRegistry

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rr-preflight-'))
  const raw = read('.claude/skills/ryan-studio/techniques/registry.json')
  // A stub approval in a temp copy, for the tests only. Never the committed registry.
  raw.techniques.outline_draw_zoom = { ...raw.techniques.outline_draw_zoom, status: 'approved', ...TEST_ONLY_APPROVAL }
  registryPath = join(dir, 'registry.test-only.json')
  writeFileSync(registryPath, JSON.stringify(raw))
  registry = loadTechniqueRegistry(registryPath, { testOnly: true })
})
afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

type Raw = Record<string, any>

/** The sample, with its payoff beat drawing Bend's outline (the approved stub signature). */
function rawFilm(mutate?: (b: Raw, t: Raw) => void): { b: Raw; t: Raw } {
  const b = read('lib/studio/timeline/fixtures/bend-mos.brief.json')
  const t = read('lib/studio/timeline/fixtures/bend-mos.timeline.json')
  b.techniques = [...b.techniques, 'outline_draw_zoom']
  b.outlines = [{ key: 'bend', geo_type: 'neighborhood', geo_slug: 'test-square', context: { geo_type: 'city', geo_slug: 'bend' }, source: 'boundaries table (test ring)' }]
  delete t.beats[2].footage
  delete t.beats[2].cards
  // The camera comes in from the city: the beat holds the move and the draw.
  t.beats[2].end = 9.5
  t.cta.start = 9.5
  t.beats[2].scene = { kind: 'outline_draw_zoom', outline: 'bend', line: 'Go in with a plan', eyebrow: 'Bend' }
  mutate?.(b, t)
  return { b, t }
}

function parsed(mutate?: (b: Raw, t: Raw) => void): { brief: StudioBrief; timeline: Timeline } {
  const { b, t } = rawFilm(mutate)
  const pb = parseBrief(b)
  const pt = parseTimeline(t)
  if (!pb.ok || !pt.ok) throw new Error(`fixture invalid: ${JSON.stringify(pb.ok ? '' : pb.issues)} ${JSON.stringify(pt.ok ? '' : pt.issues)}`)
  return { brief: pb.value, timeline: pt.value }
}

function ctxFor(brief: StudioBrief, ledger: LedgerEntry[] = []): PreflightContext {
  const types = loadVideoTypes()
  return { types, rules: typeRulesFor(brief.video_type, types)!, registry, ledger, slug: 'bend-go-in-with-a-plan' }
}

const fixtureWords: SpokenWord[] = read('lib/studio/timeline/fixtures/bend-mos.words.json').words

function voiceOf(timeline: Timeline) {
  const words = shiftWords(fixtureWords, timeline.voice?.start ?? 0.3)
  return { words, captions: buildCaptions(words, { display: timeline.voice?.display, endLimitSeconds: endcardStartSeconds(timeline) }) }
}

function filmOf(brief: StudioBrief, timeline: Timeline): FilmPlan {
  const footage: Record<string, { path: string; width: number; height: number; duration: number }> = {}
  for (const f of [...timeline.beats.map((x) => x.footage), timeline.cta?.footage]) if (f) footage[f.src] = { path: '/c.mp4', width: 1080, height: 1920, duration: 24 }
  return planFilm({ brief, timeline, voice: voiceOf(timeline), footage, scored: true, outlines: { bend: { subject: [SQUARE], context: [AROUND] } } })
}

/** What a page that drew the plan would read back: every cue's texts (the meter's scale marks too), each in its own box. */
function drawnBy(plan: FilmPlan['plan'], edit?: (texts: DrawnText[]) => DrawnText[]): Array<{ t: number; texts: DrawnText[] }> {
  const all = plan.cues.flatMap((cue) =>
    [...cueTexts(cue), ...(cue.kind === 'meter' ? [...cue.thresholds.map(String), '4 mo', '6 mo', `${Math.round(cue.domainMax)} mo`] : [])]
      .filter(Boolean)
      .map((text, i): DrawnText => ({ cue: cue.id, text, x: 120, y: 300 + i * 40, w: 600, h: 36, opacity: 1 })),
  )
  // One probe per still time; textsFromProbes picks each cue's own texts from it.
  return [...new Set(stillTimes(plan).map((s) => s.t))].map((t) => ({ t, texts: edit ? edit(all) : all }))
}

const probesOf = (film: FilmPlan, edit?: (texts: DrawnText[]) => DrawnText[]) => drawnBy(film.plan, edit)

const checksIn = (problems: PreflightProblem[]) => [...new Set(problems.map((p) => p.check))].sort((a, b) => a - b)

// ---------------------------------------------------------------------------
// 1. The table

describe('CHECK_PHASES: every check is preflight or file-only', () => {
  it('classifies exactly the checks video:check runs', () => {
    expect(CHECK_PHASES.map((c) => c.id)).toEqual([...CHECK_IDS])
    for (const c of CHECK_PHASES) {
      expect(['preflight', 'file-only'], `check ${c.id}`).toContain(c.phase)
      if (c.phase === 'preflight') expect(c.steps.length, `check ${c.id}`).toBeGreaterThan(0)
    }
  })

  it('keeps the file-only checks to what only the MP4 can show', () => {
    expect(CHECK_PHASES.filter((c) => c.phase === 'file-only').map((c) => c.id)).toEqual([1, 2, 6, 14, 17])
  })
})

// ---------------------------------------------------------------------------
// 2. Each preflight check, refused by each of its steps

type Case = { check: number; step: PreflightStep; what: string; run: () => PreflightProblem[] }

const textCase = (check: number, what: string, mutate: (b: Raw, t: Raw) => void, ledger: LedgerEntry[] = []): Case => ({
  check,
  step: 'text',
  what,
  run: () => {
    const { brief, timeline } = parsed(mutate)
    return textPreflight(brief, timeline, ctxFor(brief, ledger))
  },
})

const planCase = (check: number, what: string, edit: (m: Manifest) => void, ledger: LedgerEntry[] = []): Case => ({
  check,
  step: 'plan',
  what,
  run: () => {
    const { brief, timeline } = parsed()
    const film = filmOf(brief, timeline)
    const m = plannedManifest(film, brief, voiceOf(timeline))
    edit(m)
    return planPreflight(m, brief, ctxFor(brief, ledger))
  },
})

const layoutCase = (check: number, what: string, edit: (texts: DrawnText[]) => DrawnText[]): Case => ({
  check,
  step: 'layout',
  what,
  run: () => {
    const { brief, timeline } = parsed()
    const film = filmOf(brief, timeline)
    return layoutPreflight(plannedManifest(film, brief, voiceOf(timeline)), film, probesOf(film, edit), textsFromProbes)
  },
})

const repeatLine: LedgerEntry = {
  sha256: 'f'.repeat(64), slug: 'another-film', videoType: 'buyer_ad', hookDevice: 'dollar_first_hook',
  sceneSet: ['meter_fill_verdict', 'outline_draw_zoom'], techniques: [], checkedAt: '2026-10-13T00:00:00.000Z',
}

/** The review's sentence (F4): no number word in it, four figures all the same. */
const QUANTITY_SCRIPT =
  "[warm] So... prices doubled in a dozen neighborhoods and half the listings cut their price by a quarter. Sellers still have the edge... so go in with a plan. [long pause] Send this to whoever you're house hunting with."

const CASES: Case[] = [
  // b: the script and the authored strings
  textCase(7, 'no voice on a voiced type', (_b, t) => { delete t.voice }),
  textCase(8, 'a display rule that shows words the voice does not say', (_b, t) => { t.voice.display['right now'] = 'today' }),
  textCase(9, 'a figure said in words with no display rule', (b, t) => {
    t.voice.script = '[warm] So... prices fell twelve percent in Bend. Sellers still have the edge... so go in with a plan. [long pause] Send this to whoever you\'re house hunting with.'
    b.spec_rules.voiceover.script = t.voice.script
  }),
  textCase(9, "the review's quantity words (doubled, a dozen, half, a quarter)", (b, t) => {
    t.voice.script = QUANTITY_SCRIPT
    b.spec_rules.voiceover.script = t.voice.script
  }),
  textCase(10, 'a fair housing flag on a card', (_b, t) => { t.beats[0].cards[0].footer = 'Perfect for young professionals' }),
  textCase(15, 'a planned technique and no approved signature', (b) => { b.techniques = b.techniques.filter((x: string) => x !== 'outline_draw_zoom').concat('subframe_motion_blur') }),
  textCase(16, 'the same hook and scenes as a recent film', () => undefined, [repeatLine]),
  // c: the planned manifest
  planCase(3, 'a film over the hard maximum', (m) => { m.video.duration = 45 }),
  planCase(4, 'hook text after the limit', (m) => { for (const t of m.texts) if (t.kind !== 'caption') t.start = Math.max(t.start, 5) }),
  planCase(5, 'a beat under 2.5 s', (m) => { m.beats[1].end = 4.0; m.beats[2].start = 4.0 }),
  planCase(7, 'the voice dropped', (m) => { m.voice = null; m.captions = [] }),
  planCase(8, 'a caption that is not the words', (m) => { m.captions[0].text = 'WRONG WORDS HERE' }),
  planCase(9, 'a figure with no row', (m) => { m.texts.push({ text: '12 days', start: 4, end: 6, box: { x: 0, y: 0, w: 0, h: 0 }, kind: 'card' }) }),
  planCase(10, 'verdict words against 3.5 months', (m) => { m.texts.push({ text: 'Buyers have leverage', start: 4, end: 6, box: { x: 0, y: 0, w: 0, h: 0 }, kind: 'card' }) }),
  planCase(12, 'an end card that is not its beat', (m) => { m.endcard!.start = 2 }),
  planCase(13, 'no loop on a looping type', (m) => { m.loop = null }),
  planCase(15, 'a brief technique the plan never set up', (m) => { m.techniques = m.techniques.filter((x) => x !== 'outline_draw_zoom') }),
  planCase(16, 'a repeat of a recent film', () => undefined, [repeatLine]),
  // d: the layout probe
  layoutCase(9, 'a meter scale mark the page never drew', (texts) => texts.filter((x) => x.text !== '4 mo')),
  layoutCase(11, 'a box past x 960', (texts) => texts.map((x, i) => (i === 0 ? { ...x, w: 900 } : x))),
]

describe('every preflight check is refused by every step its row names', () => {
  it('has a case for each preflight check and step', () => {
    for (const c of CHECK_PHASES) {
      if (c.phase !== 'preflight') continue
      for (const step of c.steps) expect(CASES.some((k) => k.check === c.id && k.step === step), `check ${c.id} at step ${step}`).toBe(true)
    }
    expect([...new Set(CASES.map((k) => k.check))].sort((a, b) => a - b)).toEqual([...PREFLIGHT_CHECK_IDS])
  })

  it('passes the film that breaks nothing, at every step', () => {
    const { brief, timeline } = parsed()
    const ctx = ctxFor(brief)
    expect(textPreflight(brief, timeline, ctx)).toEqual([])
    const film = filmOf(brief, timeline)
    const m = plannedManifest(film, brief, voiceOf(timeline))
    expect(planPreflight(m, brief, ctx)).toEqual([])
    expect(layoutPreflight(m, film, probesOf(film), textsFromProbes)).toEqual([])
  })

  for (const k of CASES) {
    it(`step ${k.step} refuses check ${k.check}: ${k.what}`, () => {
      expect(checksIn(k.run())).toContain(k.check)
    })
  }
})

describe('quantity words refuse at step b (F4)', () => {
  it("names each figure in the review's sentence that no sourced caption shows", () => {
    const { brief, timeline } = parsed((b, t) => {
      t.voice.script = QUANTITY_SCRIPT
      b.spec_rules.voiceover.script = t.voice.script
    })
    const nine = textPreflight(brief, timeline, ctxFor(brief)).filter((p) => p.check === 9).map((p) => p.problem)
    for (const said of ["doubled", "a dozen", "half", "a quarter"]) expect(nine.some((p) => p.includes(`spoken "${said}`)), said).toBe(true)
  })

  it('refuses a vague quantity outright', () => {
    const { brief, timeline } = parsed((b, t) => {
      t.voice.script = "[warm] So... most buyers in Bend go in with a plan. [long pause] Send this to whoever you're house hunting with."
      b.spec_rules.voiceover.script = t.voice.script
    })
    const nine = textPreflight(brief, timeline, ctxFor(brief)).filter((p) => p.check === 9).map((p) => p.problem)
    expect(nine.join('\n')).toContain('spoken "most" (words 1 to 1) is a quantity with no single figure')
  })
})

describe('the real sample, against the committed registry', () => {
  it('is refused at the signature floor and nothing else: no technique is approved yet', () => {
    const b = parseBrief(read('lib/studio/timeline/fixtures/bend-mos.brief.json'))
    const t = parseTimeline(read('lib/studio/timeline/fixtures/bend-mos.timeline.json'))
    if (!b.ok || !t.ok) throw new Error('fixture invalid')
    const types = loadVideoTypes()
    const problems = textPreflight(b.value, t.value, { types, rules: typeRulesFor('buyer_ad', types)!, registry: loadTechniqueRegistry(), ledger: [], slug: 'x' })
    expect(problems).toEqual([{ check: 15, problem: expect.stringContaining('at least one approved signature technique') }])
  })

  it('reads the script with even timing, a pause after punctuation', () => {
    const w = dryWords('[warm] So... Bend has')
    expect(w.map((x) => x.word)).toEqual(['So...', 'Bend', 'has'])
    expect(w[1].start - w[0].start).toBeCloseTo(0.8, 6)
    expect(w[2].start - w[1].start).toBeCloseTo(0.45, 6)
  })
})

// ---------------------------------------------------------------------------
// 3. The order inside renderTimelineFilm

describe('renderTimelineFilm refuses before it spends or draws', () => {
  type Calls = { download: number; speak: number; layout: number; browser: number; logs: string[] }

  function deps(calls: Calls, layout?: (texts: DrawnText[]) => DrawnText[]): RenderDeps {
    const measure = {
      async probe() {
        return { width: 1920, height: 1080, fps: 30, codec: 'h264', pixFmt: 'yuv420p', duration: 24, videoDuration: 24, hasAudio: false }
      },
    } as unknown as Measure
    return {
      ffmpeg: join(dir, 'no-ffmpeg-here'),
      voiceProvider: async () => {
        throw new Error('the paid voice was called')
      },
      launchBrowser: async () => {
        calls.browser++
        throw new Error('FULL RENDER STARTED')
      },
      measure,
      // Stand-in assets: the page is built (the layout probe is faked), never drawn.
      loadAssets: async () => {
        const f = 'data:font/ttf;base64,AA=='
        return { fonts: { amboqia: f, amboqiaI: f, azo: f, geist400: f, geist500: f, geist600: f, geist700: f }, wordmark: f, endcardLogo: f, headshots: {} }
      },
      download: async (_url, dest) => {
        calls.download++
        writeFileSync(dest, 'clip')
      },
      log: (line) => calls.logs.push(line),
      speak: async (voice) => {
        calls.speak++
        const words = shiftWords(fixtureWords, voice.start ?? 0.3)
        const silent = { left: new Float32Array(48000), right: new Float32Array(48000) }
        return {
          engine: 'elevenlabs', model: 'eleven_v3', voiceId: 'v', offset: voice.start ?? 0.3, script: voice.script, words,
          captions: buildCaptions(words, { display: voice.display, endLimitSeconds: 12.2 }), audio: silent, voiceWords: words,
          outputFormat: 'pcm_48000', cached: true,
        } satisfies FilmVoice
      },
      // The layout probe reads back what the plan draws, optionally edited.
      layoutProbe: async (input) => {
        calls.layout++
        return drawnBy(input.plan, layout)
      },
      resolveOutline: async ({ geoSlug }) => (geoSlug === 'bend' ? [AROUND] : [SQUARE]),
      registryPath,
    }
  }

  async function render(mutate: ((b: Raw, t: Raw) => void) | undefined, calls: Calls, layout?: (texts: DrawnText[]) => DrawnText[]): Promise<Error> {
    const { b, t } = rawFilm(mutate)
    return renderTimelineFilm(
      { brief: b, timeline: t, baseDir: dir, outDir: join(dir, `film-${Math.random().toString(36).slice(2)}`), cacheDir: join(dir, 'cache'), ledgerPath: join(dir, 'ledger.jsonl') },
      deps(calls, layout),
    ).then(
      () => new Error('rendered'),
      (e: Error) => e,
    )
  }

  const fresh = (): Calls => ({ download: 0, speak: 0, layout: 0, browser: 0, logs: [] })

  beforeAll(() => {
    writeFileSync(join(dir, 'ledger.jsonl'), '')
  })

  it('a film that breaks nothing clears steps b, c and d and only then starts the work', async () => {
    const calls = fresh()
    const err = await render(undefined, calls)
    expect(err).not.toBeInstanceOf(PreflightError)
    expect(calls.logs).toEqual(expect.arrayContaining([expect.stringMatching(/preflight b/), expect.stringMatching(/preflight c/), expect.stringMatching(/preflight d/)]))
    expect(calls.speak).toBe(1)
    expect(calls.layout).toBe(1)
  })

  it('step b refuses before any download, voice or browser', async () => {
    const calls = fresh()
    const err = await render((_b, t) => { t.beats[0].cards[0].footer = 'Perfect for young professionals' }, calls)
    expect(err).toBeInstanceOf(PreflightError)
    expect((err as PreflightError).step).toBe('text')
    expect(calls).toMatchObject({ download: 0, speak: 0, layout: 0, browser: 0 })
  })

  it('step c refuses after the voice, before the layout probe and any frame', async () => {
    const calls = fresh()
    const err = await render((b) => { b.video_type = 'story_teaser' }, calls)
    expect(err).toBeInstanceOf(PreflightError)
    expect((err as PreflightError).step).toBe('plan')
    expect((err as PreflightError).problems.map((p) => p.check)).toContain(3)
    expect(calls).toMatchObject({ speak: 1, layout: 0, browser: 0 })
  })

  it('step d refuses after the layout probe, before the full render', async () => {
    const calls = fresh()
    const err = await render(undefined, calls, (texts) => texts.map((x, i) => (i === 0 ? { ...x, x: 500, w: 600 } : x)))
    expect(err).toBeInstanceOf(PreflightError)
    expect((err as PreflightError).step).toBe('layout')
    expect((err as PreflightError).problems.map((p) => p.check)).toContain(11)
    expect(calls).toMatchObject({ speak: 1, layout: 1, browser: 0 })
  })

  it('lists every problem at once', async () => {
    const calls = fresh()
    const err = (await render((b, t) => {
      t.beats[0].cards[0].footer = 'Perfect for young professionals'
      t.cta.text = 'Send this to Mrs Jones'
      b.techniques = b.techniques.filter((x: string) => x !== 'outline_draw_zoom')
    }, calls)) as PreflightError
    expect(err.problems.map((p) => p.check)).toEqual(expect.arrayContaining([10, 15]))
    expect(err.problems.filter((p) => p.check === 10)).toHaveLength(2)
    expect(err.message).toMatch(/nothing was rendered/)
  })
})
