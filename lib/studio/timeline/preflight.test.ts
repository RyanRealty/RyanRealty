/**
 * The rules refuse before render (Matt 2026-10-14: "I expect you to know the
 * rules before you build a video").
 *
 * 1. The CHECK_PHASES table itself (every check preflight or file-only) is
 *    lib/studio/qa/phases.test.ts.
 * 2. Every preflight check is reported by every preflight step its row names,
 *    on a brief or timeline that breaks that rule (the CASES table below, one
 *    case or more per check and step; a check with no case fails the coverage
 *    test). Step c cases derive the planned manifest from the broken brief or
 *    timeline exactly as renderTimelineFilm does (F9); none edits a manifest.
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
import { CHECK_PHASES, PREFLIGHT_CHECK_IDS, type PreflightStep } from '../qa/phases'
import type { LedgerEntry } from '../qa/ledger'
import type { Measure } from '../qa/measure'
import { loadTechniqueRegistry, type TechniqueRegistry } from '../qa/techniques'
import { REPO_ROOT, loadVideoTypes, typeRulesFor } from '../qa/thresholds'
import { buildCaptions } from '../voice/captions'
import type { SpokenWord } from '../voice/types'
import { PlanError, endcardStartSeconds, planFilm, type FilmPlan } from './plan'
import {
  PreflightError,
  dryWords,
  scriptWords,
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
  return { types, rules: typeRulesFor(brief.video_type, types)!, registry, ledger, slug: 'bend-go-in-with-a-plan', oneSentence: brief.creative.one_sentence }
}

const fixtureWords: SpokenWord[] = read('lib/studio/timeline/fixtures/bend-mos.words.json').words

const FIXTURE_SCRIPT: string = read('lib/studio/timeline/fixtures/bend-mos.timeline.json').voice.script

/**
 * The voice the speak stub would hand back for this timeline, as render.ts gets
 * it: none when the timeline has none; the recorded synthesis for the sample's
 * own script; for a script a case changed word for word, the new words on the
 * recorded timing; otherwise the script read with even timing (dryWords).
 */
function voiceOf(timeline: Timeline): { words: SpokenWord[]; captions: ReturnType<typeof buildCaptions> } | null {
  if (!timeline.voice) return null
  const scripted = scriptWords(timeline.voice.script)
  const said =
    timeline.voice.script === FIXTURE_SCRIPT
      ? fixtureWords
      : scripted.length === fixtureWords.length
        ? fixtureWords.map((w, i) => ({ ...w, word: scripted[i] }))
        : dryWords(timeline.voice.script)
  const words = shiftWords(said, timeline.voice.start ?? 0.3)
  return { words, captions: buildCaptions(words, { display: timeline.voice.display, endLimitSeconds: endcardStartSeconds(timeline) }) }
}

/** planFilm as renderTimelineFilm calls it (scored only when the timeline names a score). */
function filmOf(brief: StudioBrief, timeline: Timeline): FilmPlan {
  const footage: Record<string, { path: string; width: number; height: number; duration: number }> = {}
  for (const f of [...timeline.beats.map((x) => x.footage), timeline.cta?.footage]) if (f) footage[f.src] = { path: '/c.mp4', width: 1080, height: 1920, duration: 24 }
  return planFilm({ brief, timeline, voice: voiceOf(timeline), footage, scored: Boolean(timeline.score), outlines: { bend: { subject: [SQUARE], context: [AROUND] } } })
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

/**
 * Step c, derived (F9, 2026-10-14): the case breaks the BRIEF or the TIMELINE,
 * and the planned manifest is built from them exactly as renderTimelineFilm
 * builds it (the voice, planFilm, plannedManifest, planPreflight); nothing edits
 * the manifest afterwards. Some rules the planner itself holds (holds, the
 * locked end card, a hook beat that opens on its figure, a technique no beat
 * sets up, a voice the captions need): planFilm refuses those at step c with a
 * PlanError, and the case names the rule it expects (`planner`). Any other
 * planner refusal fails the case, so a case cannot pass on the wrong reason.
 */
const planCase = (check: number, what: string, mutate: (b: Raw, t: Raw) => void, opts: { ledger?: LedgerEntry[]; planner?: RegExp } = {}): Case => ({
  check,
  step: 'plan',
  what,
  run: () => {
    const { brief, timeline } = parsed(mutate)
    let film: FilmPlan
    try {
      film = filmOf(brief, timeline)
    } catch (e) {
      if (!(e instanceof PlanError)) throw e
      const named = opts.planner ? e.problems.filter((p) => opts.planner!.test(p)) : []
      if (!named.length) throw new Error(`planFilm refused for another reason: ${e.problems.join('; ')}`)
      return named.map((problem) => ({ check, problem: `planFilm: ${problem}` }))
    }
    if (opts.planner) throw new Error(`expected planFilm to refuse (${opts.planner}), but it planned the film`)
    return planPreflight(plannedManifest(film, brief, voiceOf(timeline)), brief, ctxFor(brief, opts.ledger ?? []))
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
  // c: the planned manifest, derived from a broken brief or timeline (F9)
  planCase(3, 'a type whose hard maximum the film runs past (story_teaser, 15 s)', (b) => { b.video_type = 'story_teaser' }),
  planCase(4, 'a hook beat that does not open on its hook figure', (_b, t) => { t.beats[0].cards.unshift({ kind: 'text', text: 'Bend, right now', tone: 'payoff' }) }, { planner: /hook beat/ }),
  planCase(5, 'a meter beat held 0.7 s', (_b, t) => { t.beats[1].end = 4.0; t.beats[2].start = 4.0 }, { planner: /holds .*needs 2\.5s/ }),
  planCase(7, 'no voice on a voiced type', (_b, t) => { delete t.voice }, { planner: /voice/ }),
  planCase(8, 'a display rule that shows a word the voice does not say', (_b, t) => { t.voice.display['right now'] = 'today' }),
  planCase(9, 'a display rule that shows the wrong figure', (_b, t) => { t.voice.display['three and a half'] = '3.6' }),
  planCase(9, 'the same digits in another unit (F3)', (b, t) => {
    t.voice.script = t.voice.script.replace('three and a half months of homes', 'three and a half days of homes')
    b.spec_rules.voiceover.script = t.voice.script
  }),
  planCase(10, 'verdict words against 3.5 months on the payoff line', (_b, t) => { t.beats[2].scene.line = 'Buyers have leverage' }),
  planCase(10, 'a fair housing flag on the payoff line', (_b, t) => { t.beats[2].scene.line = 'Perfect for young professionals' }),
  planCase(12, 'an end card beat shorter than the locked card', (_b, t) => { t.beats[3].start = 13.2 }, { planner: /end card/ }),
  planCase(13, 'no loop on a looping type', (b, t) => {
    delete t.loop_seam
    b.techniques = b.techniques.filter((x: string) => x !== 'loop_seam_edit')
    b.spec_rules.loopable = false
  }),
  planCase(15, 'a brief technique no beat sets up', (b) => { b.techniques = [...b.techniques, 'question_secret_hook'] }, { planner: /no beat sets it up/ }),
  planCase(16, 'the same hook and scenes as an earlier film', () => undefined, { ledger: [repeatLine] }),
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

describe('the repeat rule at step b (F7)', () => {
  it('refuses a generic slug before anything is paid for', () => {
    const { brief, timeline } = parsed()
    const sixteen = textPreflight(brief, timeline, { ...ctxFor(brief), slug: 'test-film' }).filter((p) => p.check === 16)
    expect(sixteen.map((p) => p.problem).join('\n')).toContain('the slug "test-film" names no film')
  })

  it('exempts the previous version of this film, and only when the one sentence matches too', () => {
    const { brief, timeline } = parsed()
    const previous = { ...repeatLine, slug: 'bend-go-in-with-a-plan', oneSentence: brief.creative.one_sentence }
    expect(textPreflight(brief, timeline, ctxFor(brief, [previous])).filter((p) => p.check === 16)).toEqual([])
    const reused = { ...previous, oneSentence: 'Redmond is balanced, so take your time.' }
    expect(textPreflight(brief, timeline, ctxFor(brief, [reused])).filter((p) => p.check === 16)).toHaveLength(1)
  })
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
    const problems = textPreflight(b.value, t.value, { types, rules: typeRulesFor('buyer_ad', types)!, registry: loadTechniqueRegistry(), ledger: [], slug: 'bend-go-in-with-a-plan', oneSentence: b.value.creative.one_sentence })
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
