/**
 * checkVideo with a fake Measure: every check's pass path and its fail paths,
 * with no ffmpeg. The real-binary version is check.int.test.ts.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ONLY_APPROVAL } from './fixtures/test-approval'

// The unit project never runs the real OCR tooling (F10): every checkVideo call
// here injects a fake PixelProbe, and one that forgets fails loudly.
vi.mock('./pixels', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./pixels')>()),
  createPixelProbe: () => {
    throw new Error('check.test.ts: inject a fake pixel probe (deps.pixels); the unit project never runs the real OCR tooling')
  },
}))
import { checkVideo, type CheckDeps, type CheckReport } from './check'
import type { Interval, Loudness, Measure, ProbeResult } from './measure'
import type { GateRun, PixelProbe } from './pixels'
import { VIDEO_TYPES_PATH, loadVideoTypes, typeRulesFor } from './thresholds'

const SHA = 'c'.repeat(64)
const GOLDEN_BYTES = Buffer.from('GOLDEN')

interface Fake {
  probe: ProbeResult
  sha: string
  loudness: Loudness | Error
  freezes: Interval[]
  cuts: number[]
  hookVariance: number
  endcardSsim: number
  loopSsim: number
  failFrame: boolean
  /** Where the cream end card starts in the pixels; null when no frame is the card. */
  endcardFrom: number | null
}

const defaultFake = (): Fake => ({
  probe: { width: 1080, height: 1920, fps: 30, codec: 'h264', pixFmt: 'yuv420p', duration: 27.5, videoDuration: 27.5, hasAudio: true },
  sha: SHA,
  loudness: { integratedLufs: -14, truePeakDb: -1.7 },
  freezes: [],
  cuts: [],
  hookVariance: 900,
  endcardSsim: 0.97,
  loopSsim: 0.9,
  failFrame: false,
  endcardFrom: 24.45,
})

function fakeMeasure(f: Fake, frameCalls: number[] = []): Measure {
  return {
    async probe() { return f.probe },
    async loudness() {
      if (f.loudness instanceof Error) throw f.loudness
      return f.loudness
    },
    async freezes() { return f.freezes },
    async sceneCuts() { return f.cuts },
    async frameAt(_p, t) {
      if (f.failFrame) throw new Error('no frame')
      frameCalls.push(Math.round(t * 1000) / 1000)
      return Buffer.from(`frame@${t.toFixed(3)}`)
    },
    async ssim(a, b) { return a.equals(GOLDEN_BYTES) || b.equals(GOLDEN_BYTES) ? f.endcardSsim : f.loopSsim },
    async lumaStats() { return { mean: 120, variance: f.hookVariance } },
    async creamFractions(_p, from, to) {
      const out: Array<{ t: number; fraction: number }> = []
      for (let t = from; t <= to + 1e-9; t += 1 / 30) {
        const at = Math.round(t * 1000) / 1000
        out.push({ t: at, fraction: f.endcardFrom !== null && at >= f.endcardFrom - 1e-6 ? 0.9 : 0.001 })
      }
      return out
    },
    async sha256() { return f.sha },
  }
}

interface FakePixels {
  missing: string | null
  gate: GateRun | Error
  /** Override what a box reads; default: the manifest text drawn in that box at that time. */
  read?: (t: number, text: string | undefined) => string
}

const defaultPixels = (): FakePixels => ({ missing: null, gate: { fails: [], info: {}, samples: [] } })

/** A pixel probe that reads back exactly what the manifest says was drawn (the honest case). */
function fakePixels(manifest: Json, p: FakePixels, calls: string[] = []): PixelProbe {
  return {
    async missingTooling() { return p.missing },
    async gate() {
      if (p.gate instanceof Error) throw p.gate
      return p.gate
    },
    async readBox(_mp4, t, box) {
      const hit = (manifest.texts as Json[]).find((x) => x.box.x === box.x && x.box.y === box.y && x.box.w === box.w && t >= x.start && t <= x.end)
      calls.push(`${t}:${hit?.text ?? ''}`)
      return p.read ? p.read(t, hit?.text) : hit?.text ?? ''
    },
  }
}

type Json = Record<string, any>

function goodManifest(): Json {
  return {
    factory: 'lib/studio',
    manifestVersion: 2,
    video: { file: 'final.mp4', sha256: SHA, width: 1080, height: 1920, fps: 30, duration: 27.5 },
    videoType: 'listing',
    techniques: ['dollar_first_hook', 'subframe_motion_blur', 'eased_number_reveal'],
    beats: [
      { id: 'hook', role: 'hook', start: 0, end: 3.1 },
      { id: 'intro', role: 'intro', start: 3.1, end: 8 },
      { id: 'body', role: 'body', start: 8, end: 14 },
      { id: 'payoff', role: 'payoff', start: 14, end: 24.45 },
      { id: 'end', role: 'endcard', start: 24.45, end: 27.5 },
    ],
    texts: [
      { text: '63% cut their price', start: 0.2, end: 3.1, box: { x: 90, y: 400, w: 860, h: 220 }, kind: 'card' },
      { text: 'OKAY SO', start: 0.12, end: 0.6, box: { x: 90, y: 1300, w: 860, h: 120 }, kind: 'caption' },
      { text: '63% CUT', start: 0.65, end: 1.8, box: { x: 90, y: 1300, w: 860, h: 120 }, kind: 'caption' },
      { text: 'THEIR PRICE', start: 1.85, end: 2.5, box: { x: 90, y: 1300, w: 860, h: 120 }, kind: 'caption' },
      { text: 'Quality', start: 24.45, end: 27.5, box: { x: 120, y: 800, w: 830, h: 120 }, kind: 'endcard' },
      { text: 'Call now 541.703.3095', start: 25.7, end: 27.5, box: { x: 205, y: 1130, w: 660, h: 260 }, kind: 'endcard' },
    ],
    numbers: [{ onScreen: '63%', source: 'Supabase market_pulse_live', window: '2026-07-01..2026-09-30', geography: 'Bend', definition: 'share of active listings with a price cut' }],
    voice: {
      engine: 'elevenlabs', model: 'eleven_v3', voiceId: 'v1',
      words: [
        { word: 'Okay,', start: 0.12, end: 0.41 }, { word: 'so', start: 0.45, end: 0.6 },
        { word: 'sixty', start: 0.65, end: 0.9 }, { word: 'three', start: 0.9, end: 1.1 },
        { word: 'percent', start: 1.1, end: 1.5 }, { word: 'cut', start: 1.55, end: 1.8 },
        { word: 'their', start: 1.85, end: 2.0 }, { word: 'price.', start: 2.05, end: 2.5 },
      ],
    },
    captions: [
      { text: 'OKAY SO', start: 0.12, end: 0.6, words: [0, 1] },
      { text: '63% CUT', start: 0.65, end: 1.8, words: [2, 3, 4, 5] },
      { text: 'THEIR PRICE', start: 1.85, end: 2.5, words: [6, 7] },
    ],
    audio: { lufs: -14.0, truePeakDb: -1.7, silent: false },
    endcard: { start: 24.45, quality: 24.45, local: 24.85, service: 25.25, call: 25.7, out: 27.5 },
    loop: { seconds: 0.3 },
    builtBy: 'claude',
    briefSha256: 'e'.repeat(64),
    slug: 'bend-supply-check',
    creative: { feel: 'satisfying', constraint: 'one figure per beat', lineage: 'Swiss typographic posters', one_sentence: 'One number, read on a ruler.' },
  }
}

const goodBrief = (): Json => ({
  video_type: 'listing',
  title: 'Bend supply check',
  techniques: ['dollar_first_hook', 'subframe_motion_blur', 'eased_number_reveal'],
})

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

/** video_types.json with one type's rules changed. */
function typesWith(type: string, over: Json): Json {
  const raw = JSON.parse(readFileSync(VIDEO_TYPES_PATH, 'utf8'))
  raw.types[type] = { ...raw.types[type], ...over }
  return raw
}

/** A test-only registry: subframe_motion_blur stands in as an approved signature scene. Never the committed file. */
const REGISTRY = {
  techniques: {
    dollar_first_hook: { category: 'hook', status: 'ready', tier: 'base' },
    question_secret_hook: { category: 'hook', status: 'ready', tier: 'base' },
    subframe_motion_blur: { category: 'scene', status: 'approved', tier: 'signature', ...TEST_ONLY_APPROVAL },
    loop_seam_edit: { category: 'scene', status: 'ready', tier: 'base' },
    eased_number_reveal: { category: 'type', status: 'ready', tier: 'base' },
    measured_drop_sync: { category: 'sound', status: 'ready', tier: 'base' },
  },
}

interface Setup {
  manifest?: (m: Json) => void
  brief?: ((b: Json) => void) | null
  fake?: (f: Fake) => void
  registry?: Json | null
  ledger?: string
  final?: boolean
  review?: Json | null
  golden?: boolean
  rawManifest?: string | null
  explicitBrief?: boolean
  pixels?: (p: FakePixels) => void
  types?: Json
  /** Extra options passed straight to checkVideo (overrides). */
  options?: Json
}

let dir = ''
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rr-check-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

async function run(s: Setup = {}): Promise<{ report: CheckReport; frames: number[]; ledgerPath: string; reads: string[] }> {
  const mp4 = join(dir, 'final.mp4')
  writeFileSync(mp4, 'not really a video')
  const m = goodManifest()
  if (s.brief !== null) {
    const b = goodBrief()
    s.brief?.(b)
    const text = JSON.stringify(b)
    writeFileSync(join(dir, 'final.brief.json'), text)
    m.briefSha256 = sha256(text)
  }
  s.manifest?.(m)
  if (s.rawManifest !== null) writeFileSync(join(dir, 'final.manifest.json'), s.rawManifest ?? JSON.stringify(m))
  const registryPath = join(dir, 'registry.json')
  if (s.registry !== null) writeFileSync(registryPath, JSON.stringify(s.registry ?? REGISTRY))
  const ledgerPath = join(dir, 'film-ledger.jsonl')
  writeFileSync(ledgerPath, s.ledger ?? '')
  const goldenPath = join(dir, 'golden.png')
  if (s.golden !== false) writeFileSync(goldenPath, GOLDEN_BYTES)
  let typesPath: string | undefined
  if (s.types) {
    typesPath = join(dir, 'video_types.json')
    writeFileSync(typesPath, JSON.stringify(s.types))
  }
  if (s.review) writeFileSync(join(dir, 'final.review.json'), JSON.stringify(s.review))
  const fake = defaultFake()
  s.fake?.(fake)
  const pix = defaultPixels()
  s.pixels?.(pix)
  const frames: number[] = []
  const reads: string[] = []
  const deps: CheckDeps = {
    measure: fakeMeasure(fake, frames),
    pixels: fakePixels(m, pix, reads),
    now: () => new Date('2026-10-13T12:00:00.000Z'),
    testPaths: { golden: goldenPath, registryPath, ledgerPath, ...(typesPath ? { typesPath } : {}) },
  }
  const report = await checkVideo({ mp4Path: mp4, final: s.final, ...(s.options ?? {}) }, deps)
  return { report, frames, ledgerPath, reads }
}

const get = (r: CheckReport, id: number) => r.checks.find((c) => c.id === id)!
const failIds = (r: CheckReport) => r.checks.filter((c) => !c.pass).map((c) => c.id)

describe('a good film', () => {
  it('passes checks 1 to 13 and 15 to 17 and lists them in order, without the review', async () => {
    const { report } = await run()
    expect(failIds(report)).toEqual([])
    expect(report.pass).toBe(true)
    expect(report.final).toBe(false)
    expect(report.overrides).toEqual({})
    expect(report.checks.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17])
    for (const c of report.checks) {
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.detail.length).toBeGreaterThan(0)
      expect(c.detail).not.toMatch(/[\u2013\u2014]/)
    }
  })

  it('reads the frames the contract names: 0, hook_max_s, call + 0.5, and the last frame', async () => {
    const { frames } = await run()
    const hookMax = typeRulesFor('listing', loadVideoTypes())!.hook_max_s
    expect(frames).toContain(0)
    expect(frames).toContain(hookMax)
    expect(frames).toContain(26.2)
    expect(frames.some((t) => t > 27.4)).toBe(true)
  })
})

describe('1 Provenance', () => {
  it('fails with no manifest, naming the path', async () => {
    const { report } = await run({ rawManifest: null })
    expect(get(report, 1).pass).toBe(false)
    expect(get(report, 1).detail).toContain('does not exist')
    expect(report.pass).toBe(false)
  })

  it('fails with an invalid manifest and lists why', async () => {
    const { report } = await run({ manifest: (m) => { delete m.beats; m.video.width = 'wide' } })
    expect(get(report, 1).detail).toContain('beats is required')
    expect(get(report, 1).detail).toContain('video.width')
  })

  it('fails with manifest JSON that does not parse', async () => {
    const { report } = await run({ rawManifest: '{ nope' })
    expect(get(report, 1).detail).toContain('not valid JSON')
  })

  it('fails when the file hash differs from the manifest', async () => {
    const { report } = await run({ fake: (f) => { f.sha = 'd'.repeat(64) } })
    expect(get(report, 1).pass).toBe(false)
    expect(get(report, 1).detail).toContain('differs from the manifest')
  })

  it('fails another factory', async () => {
    const { report } = await run({ manifest: (m) => { m.factory = 'remotion' } })
    expect(get(report, 1).detail).toContain('not "lib/studio"')
  })

  it('fails when the brief names a different video type than the manifest', async () => {
    const { report } = await run({ brief: (b) => { b.video_type = 'brand_film' } })
    expect(get(report, 1).detail).toContain('brand_film')
  })

  it('fails when the brief changed after the render (its sha256 is not the manifest\'s)', async () => {
    // review finding: the manifest was unsigned paperwork; nothing tied it to the brief
    const { report } = await run({ manifest: (m) => { m.briefSha256 = 'b'.repeat(64) } })
    expect(get(report, 1).pass).toBe(false)
    expect(get(report, 1).detail).toContain('the brief changed after the render')
  })

  it('fails with no brief beside the film', async () => {
    const { report } = await run({ brief: null })
    expect(get(report, 1).detail).toContain('no brief to hold the film to')
  })

  it('fails a slug that is not the brief\'s', async () => {
    const { report } = await run({ manifest: (m) => { m.slug = 'another-film' } })
    expect(get(report, 1).detail).toContain('slug "another-film" is not the brief\'s ("bend-supply-check")')
  })

  it('makes every manifest-dependent check fail rather than pass when the manifest is missing', async () => {
    const { report } = await run({ rawManifest: null })
    for (const id of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17]) {
      expect(get(report, id).pass, `check ${id}`).toBe(false)
      expect(get(report, id).detail, `check ${id}`).toContain('cannot be measured')
    }
  })
})

describe('2 Format', () => {
  const fails = async (f: (p: ProbeResult) => void) => get((await run({ fake: (x) => f(x.probe) })).report, 2)

  it('fails the wrong size', async () => {
    expect((await fails((p) => { p.width = 720; p.height = 1280 })).detail).toContain('720x1280')
  })

  it('fails the wrong frame rate and accepts 30000/1000', async () => {
    expect((await fails((p) => { p.fps = 29.97 })).detail).toContain('frame rate')
    expect((await fails((p) => { p.fps = 30.0 })).pass).toBe(true)
  })

  it('fails a codec or pixel format that is not h264 yuv420p', async () => {
    expect((await fails((p) => { p.codec = 'hevc' })).detail).toContain('codec')
    expect((await fails((p) => { p.pixFmt = 'yuv444p' })).detail).toContain('pixel format')
  })

  it('fails a duration more than 0.05 s from the manifest, passes 0.05', async () => {
    expect((await fails((p) => { p.duration = 27.56 })).detail).toContain('differs from the manifest')
    expect((await fails((p) => { p.duration = 27.55 })).pass).toBe(true)
  })
})

describe('3 Length', () => {
  const rules = typeRulesFor('listing', loadVideoTypes())!
  // A film of d seconds: the same story, with the end card as the last 3.05 s.
  const at = (d: number, over: Setup = {}) =>
    run({
      ...over,
      manifest: (m) => {
        const s = d - 3.05
        m.video.duration = d
        m.beats = [
          { id: 'hook', role: 'hook', start: 0, end: 3.1 },
          { id: 'intro', role: 'intro', start: 3.1, end: 6 },
          { id: 'body', role: 'body', start: 6, end: 9 },
          { id: 'payoff', role: 'payoff', start: 9, end: s },
          { id: 'end', role: 'endcard', start: s, end: d },
        ]
        m.endcard = { start: s, quality: s, local: s + 0.4, service: s + 0.8, call: s + 1.25, out: d }
      },
      fake: (f) => { f.probe.duration = d; f.probe.videoDuration = d },
    })

  it('passes inside the window and exactly at min and max', async () => {
    expect(get((await at(20)).report, 3).pass).toBe(true)
    expect(get((await at(rules.min_s)).report, 3).pass).toBe(true)
    expect(get((await at(rules.max_s)).report, 3).pass).toBe(true)
  })

  it('fails under the minimum', async () => {
    expect(get((await at(rules.min_s - 0.5)).report, 3).detail).toContain('minimum')
  })

  it('fails over the hard maximum even with a reason', async () => {
    const r = await at(rules.hard_max_s + 1, { brief: (b) => { b.length_reason = 'long story' } })
    expect(get(r.report, 3).detail).toContain('hard maximum')
  })

  it('fails over max with no length_reason, and passes with one', async () => {
    const d = rules.max_s + 2
    expect(get((await at(d)).report, 3).detail).toContain('no length_reason')
    expect(get((await at(d, { brief: (b) => { b.length_reason = '  ' } })).report, 3).pass).toBe(false)
    expect(get((await at(d, { brief: (b) => { b.length_reason = 'two-part market story' } })).report, 3).pass).toBe(true)
  })

  it('fails over max when there is no brief at all', async () => {
    const r = await at(rules.max_s + 2, { brief: null })
    expect(get(r.report, 3).detail).toContain('no brief beside the film')
  })

  it('fails a video type video_types.json does not list', async () => {
    const { report } = await run({ manifest: (m) => { m.videoType = 'vlog' } })
    expect(get(report, 3).detail).toContain('not in video_types.json')
    expect(get(report, 4).pass).toBe(false)
  })

  it('reads the limits from video_types.json: a story_teaser is judged by its own window', async () => {
    const teaser = typeRulesFor('story_teaser', loadVideoTypes())!
    const r = await run({ manifest: (m) => { m.videoType = 'story_teaser' }, brief: (b) => { b.video_type = 'story_teaser' } })
    expect(get(r.report, 3).pass).toBe(27.5 <= teaser.hard_max_s && 27.5 >= teaser.min_s)
    expect(get(r.report, 3).expected).toMatchObject({ min_s: teaser.min_s, max_s: teaser.max_s })
  })
})

describe('4 Hook', () => {
  it('fails when the first beat is not the hook', async () => {
    const { report } = await run({ manifest: (m) => { m.beats[0].role = 'intro' } })
    expect(get(report, 4).detail).toContain('must be the hook')
  })

  it('fails a first text that appears after hook_max_s, and a caption-only opening', async () => {
    expect(get((await run({ manifest: (m) => { m.texts[0].start = 5 } })).report, 4).detail).toContain('after')
    expect(get((await run({ manifest: (m) => { m.texts[0].kind = 'caption' } })).report, 4).detail).toContain('captions do not count')
  })

  it('fails a blank frame at hook_max_s', async () => {
    const { report } = await run({ fake: (f) => { f.hookVariance = 0.5 } })
    expect(get(report, 4).detail).toContain('is blank')
  })

  it('fails when the frame cannot be read', async () => {
    const { report } = await run({ fake: (f) => { f.failFrame = true } })
    expect(get(report, 4).pass).toBe(false)
    expect(get(report, 4).detail).toContain('cannot be measured')
  })

  it('uses the buyer_ad limit of 1.5 s', async () => {
    const limit = typeRulesFor('buyer_ad', loadVideoTypes())!.hook_max_s
    const { report } = await run({ manifest: (m) => { m.videoType = 'buyer_ad'; m.texts[0].start = limit + 0.2 }, brief: (b) => { b.video_type = 'buyer_ad' } })
    expect(get(report, 4).detail).toContain(`after ${limit}s`)
  })
})

describe('5 Holds', () => {
  it('fails a beat under min_hold_s', async () => {
    const { report } = await run({ manifest: (m) => { m.beats[1].end = 4; m.beats[2].start = 4 } })
    expect(get(report, 5).detail).toContain('beat "intro" holds 0.9s')
  })

  it('fails a shot between two scene cuts that is too short', async () => {
    const { report } = await run({ fake: (f) => { f.cuts = [5, 6.2] } })
    expect(get(report, 5).detail).toContain('shot 5s to 6.2s holds 1.2s')
  })

  it('fails a short opening shot', async () => {
    const { report } = await run({ fake: (f) => { f.cuts = [1.5] } })
    expect(get(report, 5).pass).toBe(false)
  })

  it('does not count cuts inside the end card as shots', async () => {
    const { report } = await run({ fake: (f) => { f.cuts = [6, 24.45, 24.85, 25.25, 25.7] } })
    expect(get(report, 5).pass).toBe(true)
    expect(get(report, 5).measured).toMatchObject({ endcardWordPops: [24.45, 24.85, 25.25, 25.7] })
  })
})

describe('6 Motion', () => {
  it('fails a frozen stretch of 1.2 s or more', async () => {
    const { report } = await run({ fake: (f) => { f.freezes = [{ start: 6, end: 7.5, duration: 1.5 }] } })
    expect(get(report, 6).detail).toContain('frozen from 6s to 7.5s')
  })

  it('fails exactly 1.2 s and passes a stretch below it', async () => {
    expect(get((await run({ fake: (f) => { f.freezes = [{ start: 6, end: 7.2, duration: 1.2 }] } })).report, 6).pass).toBe(false)
    expect(get((await run({ fake: (f) => { f.freezes = [{ start: 6, end: 7.1, duration: 1.1 }] } })).report, 6).pass).toBe(true)
  })

  it('fails a freeze that runs to the end of the film', async () => {
    const { report } = await run({ fake: (f) => { f.freezes = [{ start: 24, end: 27.5, duration: 3.5 }] } })
    expect(get(report, 6).pass).toBe(false)
  })
})

describe('7 Sound', () => {
  it('fails too quiet and too loud', async () => {
    expect(get((await run({ fake: (f) => { f.loudness = { integratedLufs: -18, truePeakDb: -3 } } })).report, 7).detail).toContain('outside')
    expect(get((await run({ fake: (f) => { f.loudness = { integratedLufs: -9.5, truePeakDb: -3 } } })).report, 7).pass).toBe(false)
  })

  it('fails a true peak above -1.0 dBTP', async () => {
    expect(get((await run({ fake: (f) => { f.loudness = { integratedLufs: -14, truePeakDb: -0.4 } } })).report, 7).detail).toContain('true peak')
  })

  it('fails silence and a file with no audio on a voiced film', async () => {
    expect(get((await run({ fake: (f) => { f.loudness = { integratedLufs: null, truePeakDb: null } } })).report, 7).pass).toBe(false)
    const r = await run({ fake: (f) => { f.probe.hasAudio = false } })
    expect(get(r.report, 7).detail).toContain('no audio stream')
  })

  it('fails when loudness cannot be measured', async () => {
    const r = await run({ fake: (f) => { f.loudness = new Error('ebur128 printed no summary') } })
    expect(get(r.report, 7).detail).toContain('cannot be measured: ebur128 printed no summary')
  })

  it('passes a film declared silent with no voice and no audio stream, for a type and brief with no voiceover', async () => {
    const r = await run({
      types: typesWith('listing', { requires_voiceover: false }),
      manifest: (m) => { m.voice = null; m.captions = []; m.audio = { lufs: null, truePeakDb: null, silent: true } },
      fake: (f) => { f.probe.hasAudio = false },
    })
    expect(get(r.report, 7).pass).toBe(true)
  })

  it('fails a silent film when the type or the brief asks for a voiceover', async () => {
    // review finding: a silent film passed checks 7 and 8 by declaring itself silent
    const silent = (m: Json) => { m.voice = null; m.captions = []; m.audio = { lufs: null, truePeakDb: null, silent: true } }
    const byType = await run({ manifest: silent, fake: (f) => { f.probe.hasAudio = false } })
    expect(get(byType.report, 7).detail).toContain('asks for a voiceover')
    expect(get(byType.report, 8).detail).toContain('asks for a voiceover')
    const byBrief = await run({
      types: typesWith('listing', { requires_voiceover: false }),
      brief: (b) => { b.spec_rules = { voiceover: { engine: 'elevenlabs_v3' } } },
      manifest: silent,
      fake: (f) => { f.probe.hasAudio = false },
    })
    expect(get(byBrief.report, 7).pass).toBe(false)
    expect(get(byBrief.report, 8).pass).toBe(false)
  })

  it('fails a voiced type whose manifest drops the voice but keeps the audio', async () => {
    const r = await run({ manifest: (m) => { m.voice = null; m.captions = [] } })
    expect(get(r.report, 7).detail).toContain('the manifest carries none')
    expect(get(r.report, 8).detail).toContain('no voice words')
  })

  it('fails a film that says silent but carries an audio stream', async () => {
    const r = await run({ manifest: (m) => { m.voice = null; m.captions = []; m.audio = { lufs: null, truePeakDb: null, silent: true } } })
    expect(get(r.report, 7).detail).toContain('says the film is silent')
  })
})

describe('8 Captions', () => {
  it('passes with no voiceover only for a type and brief that ask for none, and says why', async () => {
    const r = await run({ types: typesWith('listing', { requires_voiceover: false }), manifest: (m) => { m.voice = null; m.captions = []; m.audio.silent = false } })
    expect(get(r.report, 8).pass).toBe(true)
    expect(get(r.report, 8).detail).toContain('no voiceover')
  })

  it('fails a voiced film with no captions', async () => {
    const r = await run({ manifest: (m) => { m.captions = [] } })
    expect(get(r.report, 8).detail).toContain('no captions')
  })

  it('fails a caption over four words', async () => {
    const r = await run({ manifest: (m) => { m.captions[1].text = '63% CUT THEIR PRICE NOW' } })
    expect(get(r.report, 8).detail).toContain('has 5 words')
  })

  it('fails a caption under 0.4 s', async () => {
    const r = await run({ manifest: (m) => { m.captions[0].end = 0.4 } })
    expect(get(r.report, 8).detail).toContain('shows for')
  })

  it('fails a caption more than 0.08 s off its first word', async () => {
    const r = await run({ manifest: (m) => { m.captions[2].start = 1.97 } })
    expect(get(r.report, 8).detail).toContain('starts')
  })

  it('fails a spoken word no caption shows', async () => {
    const r = await run({ manifest: (m) => { m.captions.pop() } })
    expect(get(r.report, 8).detail).toContain('no caption shows')
  })

  it('fails caption text that is not the spoken words', async () => {
    const r = await run({ manifest: (m) => { m.captions[1].text = '36% CUT' } })
    expect(get(r.report, 8).detail).toContain('36%')
  })
})

describe('9 Numbers', () => {
  it('fails a figure with no numbers row', async () => {
    const r = await run({ manifest: (m) => { m.texts[0].text = '63% cut, 12 days' } })
    expect(get(r.report, 9).detail).toContain('figure "12 days" in texts[0] "63% cut, 12 days" has no numbers row')
  })

  it('fails a figure a row only contains, and a spoken figure no sourced caption shows', async () => {
    const sub = await run({ manifest: (m) => { m.texts[0].text = '63 homes'; m.numbers[0].onScreen = '63 mo' } })
    expect(get(sub.report, 9).detail).toContain('"63 homes" in texts[0]')
    // The same digits in another unit (F3).
    const unit = await run({ manifest: (m) => { m.texts[0].text = '63 days on market' } })
    expect(get(unit.report, 9).detail).toContain('figure "63 days" in texts[0] "63 days on market" has no numbers row')
    const said = await run({ manifest: (m) => { m.voice.words[6].word = 'twelve'; m.voice.words[7].word = 'percent'; m.captions[2].text = 'TWELVE PERCENT' } })
    expect(get(said.report, 9).detail).toContain('spoken "twelve percent" is not shown as a figure')
  })

  it('fails a row missing source, window, geography or definition', async () => {
    for (const field of ['source', 'window', 'geography', 'definition']) {
      const r = await run({ manifest: (m) => { delete m.numbers[0][field] } })
      expect(get(r.report, 9).detail, field).toContain(`missing ${field}`)
    }
    const blank = await run({ manifest: (m) => { m.numbers[0].source = '   ' } })
    expect(get(blank.report, 9).pass).toBe(false)
  })

  it('passes a spoken figure shown as its sourced figure', async () => {
    const { report } = await run()
    expect((get(report, 9).measured as any).spoken).toEqual(['"sixty three percent" shown as "63%"'])
  })

  it('does not count the locked phone number as a figure', async () => {
    const { report } = await run()
    expect((get(report, 9).measured as any).tokens).toEqual(['63%'])
  })
})

describe('10 Copy', () => {
  it('fails an em dash in a card, a caption and the voice words', async () => {
    expect(get((await run({ manifest: (m) => { m.texts[0].text = '63% cut \u2014 now' } })).report, 10).detail).toContain('em or en dash in texts[0]')
    expect(get((await run({ manifest: (m) => { m.captions[0].text = 'OKAY\u2013SO' } })).report, 10).detail).toContain('captions[0]')
  })

  it('fails a banned phrase from video_types.json', async () => {
    const r = await run({ manifest: (m) => { m.texts[0].text = '63% cut, nestled in Bend' } })
    expect(get(r.report, 10).detail).toContain('banned phrase "nestled"')
  })

  it('fails a fair housing flag on a card and in the voice, an address and a name', async () => {
    const card = await run({ manifest: (m) => { m.texts[0].text = 'Perfect for young professionals' ; m.numbers = [] } })
    expect(get(card.report, 10).detail).toContain('fair housing flag "young professionals" (describe homes and places, never people) in texts[0]')
    const vo = await run({ manifest: (m) => { m.voice.words[7].word = 'family-friendly' } })
    expect(get(vo.report, 10).detail).toContain('fair housing flag "family-friendly" (describe homes and places, never people) in voice')
    const place = await run({ manifest: (m) => { m.captions[0].text = '123 Main Street' } })
    expect(get(place.report, 10).detail).toContain('an address "123 Main Street"')
  })

  it('fails "top team" and "buyer\'s market" in the voice', async () => {
    const r = await run({ manifest: (m) => { m.voice.words[1].word = 'top'; m.voice.words[2].word = 'team' } })
    expect(get(r.report, 10).detail).toContain('"top team"')
    const r2 = await run({ manifest: (m) => { m.voice.words[1].word = "buyer\u2019s"; m.voice.words[2].word = 'market' } })
    expect(get(r2.report, 10).detail).toContain("buyer's market")
  })
})

describe('11 Safe area', () => {
  it('fails a box past x 960', async () => {
    const r = await run({ manifest: (m) => { m.texts[0].box.w = 900 } })
    expect(get(r.report, 11).detail).toContain('reaches x 990')
  })

  it('fails a box past y 1640 and ignores end card text', async () => {
    const r = await run({ manifest: (m) => { m.texts[1].box.y = 1600 } })
    expect(get(r.report, 11).pass).toBe(false)
    const ok = await run({ manifest: (m) => { m.texts[4].box = { x: 0, y: 1700, w: 1080, h: 200 } } })
    expect(get(ok.report, 11).pass).toBe(true)
  })
})

describe('12 End card', () => {
  it('fails a manifest with no end card when the type requires one', async () => {
    const r = await run({ manifest: (m) => { m.endcard = null } })
    expect(get(r.report, 12).detail).toContain('requires one')
  })

  it('fails steps out of order', async () => {
    const r = await run({ manifest: (m) => { m.endcard.local = 25.5 } })
    expect(get(r.report, 12).detail).toContain('out of order')
  })

  it('fails words over about 1.2 s', async () => {
    const r = await run({ manifest: (m) => { m.endcard.service = 25.8; m.endcard.call = 26.0 } })
    expect(get(r.report, 12).detail).toContain('the three words take')
  })

  it('fails a call hold under 1.5 s', async () => {
    const r = await run({ manifest: (m) => { m.endcard.call = 26.2 } })
    expect(get(r.report, 12).detail).toContain('Call now holds 1.3s')
  })

  it('fails an SSIM below 0.92 against the golden still, and passes 0.92', async () => {
    const low = await run({ fake: (f) => { f.endcardSsim = 0.91 } })
    expect(get(low.report, 12).detail).toContain('SSIM 0.91')
    const edge = await run({ fake: (f) => { f.endcardSsim = 0.92 } })
    expect(get(edge.report, 12).pass).toBe(true)
  })

  it('fails with a clear message when there is no golden still', async () => {
    const r = await run({ golden: false })
    expect(get(r.report, 12).pass).toBe(false)
    expect(get(r.report, 12).detail).toContain('no golden still at')
  })

  it('probes the frame at call + 0.5 s', async () => {
    const { frames } = await run()
    expect(frames).toContain(26.2)
  })

  it('fails an endcard.start that is not the end card beat\'s start', async () => {
    const r = await run({ manifest: (m) => { m.endcard.start = 20 } })
    expect(get(r.report, 12).detail).toContain("is not the end card beat's start 24.45s")
  })

  it('fails a start earlier than the pixels show the card, and check 5 still counts the cuts it would hide', async () => {
    // review finding: computeShots ignored every cut after a claimed early start
    const early = (m: Json) => {
      m.endcard.start = 9
      m.beats = [m.beats[0], m.beats[1], { id: 'payoff', role: 'payoff', start: 8, end: 9 }, { id: 'end', role: 'endcard', start: 9, end: 27.5 }]
    }
    const r = await run({ manifest: early, fake: (f) => { f.cuts = [14, 15.2] } })
    expect(get(r.report, 12).detail).toMatch(/the pixels show it from 24\.4\d*s/)
    expect(get(r.report, 5).detail).toContain('shot 14s to 15.2s holds 1.2s')
  })

  it('fails when the golden probe frame is not the cream card', async () => {
    const r = await run({ fake: (f) => { f.endcardFrom = null } })
    expect(get(r.report, 12).detail).toContain('is not the cream end card')
  })
})

describe('13 Loop', () => {
  it('fails an SSIM under 0.85 and passes 0.85', async () => {
    expect(get((await run({ fake: (f) => { f.loopSsim = 0.84 } })).report, 13).detail).toContain('under 0.85')
    expect(get((await run({ fake: (f) => { f.loopSsim = 0.85 } })).report, 13).pass).toBe(true)
  })

  it('fails a manifest with no loop when the type requires one', async () => {
    const r = await run({ manifest: (m) => { m.loop = null } })
    expect(get(r.report, 13).detail).toContain('requires one')
  })

  it('falls back to an earlier frame when the very last timestamp has none', async () => {
    let calls = 0
    const f = defaultFake()
    const base = fakeMeasure(f)
    const m: Measure = { ...base, async frameAt(p, t) { if (t > 27.45 && calls++ === 0) throw new Error('past the end'); return base.frameAt(p, t) } }
    writeFileSync(join(dir, 'final.mp4'), 'x')
    writeFileSync(join(dir, 'final.manifest.json'), JSON.stringify(goodManifest()))
    writeFileSync(join(dir, 'film-ledger.jsonl'), '')
    writeFileSync(join(dir, 'registry.json'), JSON.stringify(REGISTRY))
    writeFileSync(join(dir, 'golden.png'), GOLDEN_BYTES)
    const report = await checkVideo({ mp4Path: join(dir, 'final.mp4'), golden: join(dir, 'golden.png'), registryPath: join(dir, 'registry.json'), ledgerPath: join(dir, 'film-ledger.jsonl') }, { measure: m, pixels: fakePixels(goodManifest(), defaultPixels()) })
    expect(get(report, 13).pass).toBe(true)
  })
})

describe('14 Review (final only)', () => {
  const review = (over: Json = {}): Json => ({ sha256: SHA, reviewer: 'grok', watched: true, listened: true, verdict: 'ship', ...over })

  it('is not run without final', async () => {
    const { report } = await run({ review: review() })
    expect(report.checks.find((c) => c.id === 14)).toBeUndefined()
  })

  it('passes a complete review by someone other than the builder', async () => {
    const { report } = await run({ final: true, review: review() })
    expect(get(report, 14).pass).toBe(true)
    expect(report.pass).toBe(true)
    expect(report.final).toBe(true)
  })

  it('fails when the review file is missing', async () => {
    const { report } = await run({ final: true })
    expect(get(report, 14).detail).toContain('no review at')
    expect(report.pass).toBe(false)
  })

  it('fails a review of a different file', async () => {
    const { report } = await run({ final: true, review: review({ sha256: 'e'.repeat(64) }) })
    expect(get(report, 14).detail).toContain('different file')
  })

  it('fails the same author as the build, or a reviewer id that shares a word with it (F11)', async () => {
    const { report } = await run({ final: true, review: review({ reviewer: 'Claude' }) })
    expect(get(report, 14).detail).toContain('shares "claude" with the builder "claude"')
    const prefixed = await run({ final: true, review: review({ reviewer: 'claude-review' }) })
    expect(get(prefixed.report, 14).detail).toContain('may not share a word')
    // review finding: "anthropic-claude" got past a prefix rule
    const suffixed = await run({ final: true, review: review({ reviewer: 'anthropic-claude' }) })
    expect(get(suffixed.report, 14).detail).toContain('shares "claude"')
  })

  it('fails when not watched, not listened, or the verdict is not ship', async () => {
    expect(get((await run({ final: true, review: review({ watched: false }) })).report, 14).detail).toContain('not watched')
    expect(get((await run({ final: true, review: review({ listened: false }) })).report, 14).detail).toContain('not listened')
    expect(get((await run({ final: true, review: review({ verdict: 'revise' }) })).report, 14).detail).toContain('"ship"')
  })

  it('does not need listened when the film has no audio', async () => {
    const r = await run({
      final: true,
      review: review({ listened: false }),
      manifest: (m) => { m.voice = null; m.captions = []; m.audio = { lufs: null, truePeakDb: null, silent: true } },
      fake: (f) => { f.probe.hasAudio = false },
    })
    expect(get(r.report, 14).pass).toBe(true)
  })

  it('fails an unreadable review', async () => {
    writeFileSync(join(dir, 'final.review.json'), '{ no')
    const mp4 = join(dir, 'final.mp4')
    writeFileSync(mp4, 'x')
    writeFileSync(join(dir, 'final.manifest.json'), JSON.stringify(goodManifest()))
    writeFileSync(join(dir, 'registry.json'), JSON.stringify(REGISTRY))
    writeFileSync(join(dir, 'film-ledger.jsonl'), '')
    const report = await checkVideo({ mp4Path: mp4, final: true }, { measure: fakeMeasure(defaultFake()), pixels: fakePixels(goodManifest(), defaultPixels()), testPaths: { registryPath: join(dir, 'registry.json'), ledgerPath: join(dir, 'film-ledger.jsonl') } })
    expect(get(report, 14).detail).toContain('could not read the review')
  })
})

describe('15 Techniques ran', () => {
  it('fails a brief technique the renderer never ran', async () => {
    const r = await run({ brief: (b) => { b.techniques.push('measured_drop_sync') } })
    expect(get(r.report, 15).detail).toContain('never ran: measured_drop_sync')
  })

  it('fails with no brief', async () => {
    const r = await run({ brief: null })
    expect(get(r.report, 15).detail).toContain('no brief')
  })

  it('uses briefTechniques carried by the manifest when there is no brief file', async () => {
    const ok = await run({ brief: null, manifest: (m) => { m.briefTechniques = [...m.techniques] } })
    expect(get(ok.report, 15).pass).toBe(true)
    const missing = await run({ brief: null, manifest: (m) => { m.briefTechniques = [...m.techniques, 'measured_drop_sync'] } })
    expect(get(missing.report, 15).detail).toContain('measured_drop_sync')
  })

  it('fails when the registry has no categories', async () => {
    const r = await run({ registry: { techniques: { dollar_first_hook: {}, subframe_motion_blur: {}, eased_number_reveal: {} } } })
    expect(get(r.report, 15).detail).toContain('registry has no categories')
    expect(get(r.report, 16).detail).toContain('registry has no categories')
  })

  it('fails a film with no scene technique, no hook technique or no type technique', async () => {
    const noScene = await run({ manifest: (m) => { m.techniques = ['dollar_first_hook', 'eased_number_reveal'] }, brief: (b) => { b.techniques = ['dollar_first_hook'] } })
    expect(get(noScene.report, 15).detail).toContain('no scene technique ran')
    const noHook = await run({ manifest: (m) => { m.techniques = ['subframe_motion_blur', 'eased_number_reveal'] }, brief: (b) => { b.techniques = ['eased_number_reveal'] } })
    expect(get(noHook.report, 15).detail).toContain('no hook technique ran')
    const noType = await run({ manifest: (m) => { m.techniques = ['dollar_first_hook', 'subframe_motion_blur'] }, brief: (b) => { b.techniques = ['dollar_first_hook'] } })
    expect(get(noType.report, 15).detail).toContain('no type technique ran')
  })

  it('fails a film where no approved signature technique ran (the floor)', async () => {
    const r = await run({ registry: { techniques: { ...REGISTRY.techniques, subframe_motion_blur: { category: 'scene', status: 'ready', tier: 'signature' } } } })
    expect(get(r.report, 15).detail).toContain('at least one approved signature technique')
  })

  it('fails a manifest technique that is not in the registry', async () => {
    const r = await run({ manifest: (m) => { m.techniques.push('invented') } })
    expect(get(r.report, 15).detail).toContain('not in the registry: invented')
  })

  it('fails an unreadable registry rather than passing', async () => {
    const r = await run({ registry: null })
    expect(get(r.report, 15).pass).toBe(false)
    expect(get(r.report, 15).detail).toContain('cannot be measured')
  })
})

describe('16 Not a repeat', () => {
  const line = (over: Json = {}) => JSON.stringify({
    sha256: 'f'.repeat(64), videoType: 'listing', hookDevice: 'dollar_first_hook', sceneSet: ['subframe_motion_blur'],
    techniques: [], checkedAt: '2026-10-12T00:00:00.000Z', ...over,
  }) + '\n'

  it('passes against an empty ledger', async () => {
    const { report } = await run()
    expect(get(report, 16).pass).toBe(true)
    expect(get(report, 16).measured).toMatchObject({ hookDevice: 'dollar_first_hook', sceneSet: ['subframe_motion_blur'], compared: 0 })
  })

  it('fails the same hook device and scene set as a recent film', async () => {
    const { report } = await run({ ledger: line() })
    expect(get(report, 16).pass).toBe(false)
    expect(get(report, 16).detail).toContain('same hook device "dollar_first_hook"')
  })

  it('passes a near miss: same hook, different scene set', async () => {
    const { report } = await run({ ledger: line({ sceneSet: ['loop_seam_edit'] }) })
    expect(get(report, 16).pass).toBe(true)
  })

  it('skips a ledger line of this very file (its own sha256 and slug)', async () => {
    const { report } = await run({ ledger: line({ sha256: SHA, slug: 'bend-supply-check' }) })
    expect(get(report, 16).pass).toBe(true)
  })

  it('exempts only the previous version of the same film: same slug AND same one sentence (F7)', async () => {
    const sentence = goodManifest().creative.one_sentence
    const same = line({ slug: 'bend-supply-check', oneSentence: sentence })
    expect(get((await run({ ledger: same })).report, 16).pass).toBe(true)
    // review finding: reusing a slug made a new film a "revision"
    const reused = line({ slug: 'bend-supply-check', oneSentence: 'Redmond is balanced, so take your time.' })
    expect(get((await run({ ledger: reused })).report, 16).detail).toContain('same hook device "dollar_first_hook"')
    expect(get((await run({ ledger: line({ slug: 'other-film', oneSentence: sentence }) })).report, 16).pass).toBe(false)
    // Two earlier versions: only the latest is exempt, the older one is compared.
    const older = line({ sha256: 'a'.repeat(64), slug: 'bend-supply-check', oneSentence: sentence })
    const previous = line({ sha256: 'b'.repeat(64), slug: 'bend-supply-check', oneSentence: sentence })
    expect(get((await run({ ledger: older + previous })).report, 16).pass).toBe(false)
  })

  it('refuses a generic slug (F7)', async () => {
    const { report } = await run({ manifest: (m) => { m.slug = 'film' }, brief: (b) => { b.slug = 'film' } })
    expect(get(report, 16).detail).toContain('the slug "film" names no film')
  })

  it('lists the ready hook and scene pairs the type has not used lately', async () => {
    const registry = {
      techniques: {
        dollar_first_hook: { category: 'hook', status: 'ready' },
        question_secret_hook: { category: 'hook', status: 'ready' },
        subframe_motion_blur: { category: 'scene', status: 'ready' },
        line_draw_riding_dot: { category: 'scene', status: 'ready' },
        map_pins_pop: { category: 'scene', status: 'planned' },
        eased_number_reveal: { category: 'type', status: 'ready' },
      },
    }
    const { report } = await run({ registry, ledger: line() })
    const d = get(report, 16).detail
    expect(d).toContain('dollar_first_hook + line_draw_riding_dot')
    expect(d).toContain('question_secret_hook + subframe_motion_blur')
    expect(d).not.toContain('dollar_first_hook + subframe_motion_blur;')
    expect(d).not.toContain('map_pins_pop')
  })

  it('compares against every earlier film of the same type, not the last five (F7)', async () => {
    const filler = Array.from({ length: 8 }, (_, i) => line({ sha256: String(i).repeat(64), hookDevice: 'question_secret_hook' })).join('')
    const old = line({ sha256: 'a'.repeat(64) })
    expect(get((await run({ ledger: old + filler })).report, 16).pass).toBe(false)
    expect(get((await run({ ledger: filler })).report, 16).measured).toMatchObject({ compared: 8 })
  })

  it('fails a damaged ledger instead of ignoring the bad line', async () => {
    const { report } = await run({ ledger: '{broken\n' })
    expect(get(report, 16).detail).toContain('ledger is damaged')
  })

  it('records the film on a final pass, once, and not otherwise', async () => {
    const plain = await run()
    expect(plain.report.ledger).toBeNull()
    expect(readFileSync(plain.ledgerPath, 'utf8')).toBe('')

    const final = await run({ final: true, review: { sha256: SHA, reviewer: 'grok', watched: true, listened: true, verdict: 'ship' } })
    expect(final.report.pass).toBe(true)
    expect(final.report.ledger?.appended).toBe(true)
    const written = JSON.parse(readFileSync(final.ledgerPath, 'utf8').trim())
    expect(written).toMatchObject({ sha256: SHA, videoType: 'listing', hookDevice: 'dollar_first_hook', sceneSet: ['subframe_motion_blur'], checkedAt: '2026-10-13T12:00:00.000Z' })
    expect(written.techniques).toEqual(['dollar_first_hook', 'subframe_motion_blur', 'eased_number_reveal'])
  })

  it('does not record a failed final, or when recording is off', async () => {
    const failed = await run({ final: true })
    expect(failed.report.pass).toBe(false)
    expect(failed.report.ledger).toBeNull()
    expect(readFileSync(failed.ledgerPath, 'utf8')).toBe('')
  })

  it('does not append a second line when the same film passes final again', async () => {
    const review = { sha256: SHA, reviewer: 'grok', watched: true, listened: true, verdict: 'ship' }
    const first = await run({ final: true, review })
    const again = await run({ final: true, review, ledger: readFileSync(first.ledgerPath, 'utf8') })
    expect(again.report.pass).toBe(true)
    expect(readFileSync(again.ledgerPath, 'utf8').trim().split('\n')).toHaveLength(1)
    expect(again.report.ledger?.appended).toBe(false)
  })
})

describe('17 Pixels', () => {
  it('passes when the gate passes and every claimed text reads back off its box', async () => {
    const { report, reads } = await run()
    expect(get(report, 17).pass).toBe(true)
    expect(get(report, 17).measured).toMatchObject({ claims: 4, confirmed: 4 })
    expect(reads).toContain('1.225:63% CUT')
  })

  it('fails, with the install line, when the OCR tooling is missing', async () => {
    const r = await run({ pixels: (p) => { p.missing = 'tesseract is not installed: install the OCR tooling' } })
    expect(get(r.report, 17).pass).toBe(false)
    expect(get(r.report, 17).detail).toContain('cannot be measured, so it fails: tesseract is not installed')
  })

  it('fails when the gate cannot run', async () => {
    const r = await run({ pixels: (p) => { p.gate = new Error('the render gate could not run: cannot open') } })
    expect(get(r.report, 17).detail).toContain('cannot be measured: the render gate could not run')
  })

  it('keeps the gate\'s findings, but leaves its 15 to 30 s LENGTH to check 3', async () => {
    const r = await run({ pixels: (p) => { p.gate = { fails: ['LENGTH: runs 40.00s; must be 15-30 s.', 'TOP TEAM: \'top team\' wording on screen at [3.0] s.'], info: {}, samples: [] } } })
    expect(get(r.report, 17).detail).toContain('render gate: TOP TEAM')
    expect(get(r.report, 17).detail).not.toContain('LENGTH')
    expect((get(r.report, 17).measured as any).gateDropped[0]).toContain('check 3 holds')
  })

  it('fails a caption or a figure the manifest claims but the pixels do not show', async () => {
    // review finding: a hand-written manifest could claim captions and figures the film never drew
    const r = await run({ pixels: (p) => { p.read = (_t, text) => (text === '63% CUT' ? 'CUT' : text === '63% cut their price' ? '68% cut their price' : text ?? '') } })
    const d = get(r.report, 17).detail
    expect(d).toContain('the pixels do not show caption "63% CUT"')
    expect(d).toContain('the pixels do not show card "63% cut their price"')
  })

  it('fails a caption with no drawn box', async () => {
    const r = await run({ manifest: (m) => { m.texts.splice(2, 1) } })
    expect(get(r.report, 17).detail).toContain('caption "63% CUT" has no drawn box')
  })

  it('fails a figure the pixels show twice running that the manifest does not list', async () => {
    const samples = [{ t: 4, text: 'homes $612K closed' }, { t: 4.5, text: 'homes $612K closed' }, { t: 5, text: 'noise 3.5' }, { t: 6, text: 'once 88%' }]
    const r = await run({ pixels: (p) => { p.gate = { fails: [], info: {}, samples } } })
    expect(get(r.report, 17).detail).toContain('a figure the manifest does not list: "$612K" at 4s and 4.5s')
    expect(get(r.report, 17).detail).not.toContain('88%')
  })
})

describe('final runs use the committed paths only', () => {
  it('refuses --golden, --ledger, --registry and --types with final', async () => {
    writeFileSync(join(dir, 'final.mp4'), 'x')
    for (const key of ['golden', 'ledgerPath', 'registryPath', 'typesPath']) {
      await expect(checkVideo({ mp4Path: join(dir, 'final.mp4'), final: true, [key]: join(dir, 'x') }, { measure: fakeMeasure(defaultFake()) })).rejects.toThrow(`refusing ${key} with final`)
    }
  })

  it('records the overrides a draft run used', async () => {
    const { report } = await run({ options: { golden: join(dir, 'golden.png') } })
    expect(report.overrides).toEqual({ golden: join(dir, 'golden.png') })
  })
})

describe('the report', () => {
  it('carries the measured hash, the manifest path and the time', async () => {
    const { report } = await run()
    expect(report.sha256).toBe(SHA)
    expect(report.manifest).toBe(join(dir, 'final.manifest.json'))
    expect(report.checkedAt).toBe('2026-10-13T12:00:00.000Z')
    expect(report.mp4).toBe(join(dir, 'final.mp4'))
  })

  it('fails every measured check when ffprobe cannot read the file', async () => {
    const mp4 = join(dir, 'final.mp4')
    writeFileSync(mp4, 'x')
    writeFileSync(join(dir, 'final.manifest.json'), JSON.stringify(goodManifest()))
    const broken: Measure = { ...fakeMeasure(defaultFake()), async probe() { throw new Error('ffprobe exited 1: Invalid data') }, async sha256() { throw new Error('ENOENT') } }
    // A fake pixel probe: the unit project never reaches for the real OCR tooling (F10).
    const report = await checkVideo({ mp4Path: mp4, registryPath: join(dir, 'missing.json'), ledgerPath: join(dir, 'l.jsonl') }, { measure: broken, pixels: fakePixels(goodManifest(), defaultPixels()) })
    expect(report.pass).toBe(false)
    expect(report.sha256).toBeNull()
    for (const id of [1, 2, 3, 4, 5, 7, 12, 13]) expect(get(report, id).pass, `check ${id}`).toBe(false)
    expect(existsSync(join(dir, 'l.jsonl'))).toBe(false)
  })
})
