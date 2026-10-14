/**
 * reachability: entry-point test-support: rules.test.ts, run.test.ts and board.test.ts run on these fakes.
 * lib/content/process/test-harness.ts - the fakes every rule's fixture runs on.
 * Tests only: nothing in the product imports this file.
 * reachability: entry-point test support, imported only by *.test.ts files (rules.test.ts, run.test.ts)
 *
 * A fixture (fixtures/R-xxx.json) is a small recipe: edits to the base film's
 * brief and timeline, plus a `setup` that bends one fake (the ledger, the
 * registry, the clips, the layout, the manifest, the measurements). The harness
 * builds every dependency the steps need as a fake, so a run reaches no
 * network, no paid voice, no browser, no ffmpeg and no git of the real checkout:
 *  - the voice is the real speakTimeline behind a provider that answers from the
 *    recorded sample timing (lib/studio/timeline/fixtures/bend-mos.words.json);
 *  - footage "downloads" write a few bytes, and the Measure answers from setup;
 *  - the layout probe reads back what the plan draws, every text in its own box;
 *  - the master is built from the same plan and the same probe the real render
 *    uses, then held to the REAL checkVideo with a fake Measure and PixelProbe
 *    (the way lib/studio/qa/check.test.ts does).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON documents and fakes: the fixtures edit raw briefs, timelines and manifests */
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cueTexts, stillTimes } from '../../studio/motion/cues'
import type { DrawnText } from '../../studio/motion/render'
import { TEST_ONLY_APPROVAL } from '../../studio/qa/fixtures/test-approval'
import type { Interval, Loudness, Measure, ProbeResult } from '../../studio/qa/measure'
import { sha256File } from '../../studio/qa/measure'
import type { GateRun, PixelProbe } from '../../studio/qa/pixels'
import { REPO_ROOT } from '../../studio/qa/thresholds'
import { dryWords, scriptWords } from '../../studio/timeline/preflight'
import { boundNumbers, footageFilePath, textsFromProbes } from '../../studio/timeline/render'
import { manifestVoice } from '../../studio/voice/elevenlabs'
import type { CharacterAlignment, SpokenWord } from '../../studio/voice/types'
import type { Synthesis } from '../../studio/voice/elevenlabs'
import { boardTimes } from './board'
import { FileClaimStore } from './caps'
import type { RenderedFilm, RunContext, StepDeps } from './context'
import { checkFreshness, gitRunner, type Freshness } from './freshness'
import { runStep, runSteps, type RunResult } from './run'
import type { StepId } from './rules'
import { readStamp } from './stamp'
import { makeTempRepo, type RepoShape } from './test-git'
import { planTheFilm } from './steps/board'
import type { VoiceProvider } from '../../studio/timeline/voice'

export const FIXTURES = join(REPO_ROOT, 'lib', 'content', 'process', 'fixtures')

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'))

// ---------------------------------------------------------------------------
// Small JSON edits

export type Edit = { path: string; set?: unknown; delete?: boolean }

/**
 * Set or delete a value by dotted path ('beats.1.end'); numeric parts index arrays and `*` means every
 * key at that level ('techniques.*.category'). Mutates and returns the document.
 */
export function applyEdits<T>(doc: T, edits: readonly Edit[] = []): T {
  const apply = (at: any, parts: string[], e: Edit): void => {
    const [head, ...rest] = parts
    if (head === '*') {
      for (const key of Object.keys(at)) apply(at[key], rest, e)
      return
    }
    if (rest.length === 0) {
      if (e.delete) {
        if (Array.isArray(at)) at.splice(Number(head), 1)
        else delete at[head]
      } else at[head] = e.set
      return
    }
    if (at[head] === undefined) at[head] = {}
    apply(at[head], rest, e)
  }
  for (const e of edits) apply(doc, e.path.split('.'), e)
  return doc
}

// ---------------------------------------------------------------------------
// The fixture and its setup

export type FakeMeasureSetup = {
  probe?: Partial<ProbeResult>
  loudness?: Loudness
  freezes?: Interval[]
  cuts?: number[]
  hookVariance?: number
  endcardSsim?: number
  loopSsim?: number
  failFrame?: boolean
  endcardFrom?: number | null
  sha?: string
}

export type Setup = {
  registry?: Edit[]
  /** Lines for film-ledger.jsonl. */
  ledger?: unknown[]
  ledgerRaw?: string
  voice?: { stretch?: number }
  /** Per footage src: the scene cuts the Measure finds in the clip. */
  clips?: Record<string, { cuts?: number[] }>
  /** Edits to what the layout probe reads back. */
  layout?: Array<{ drop?: string; dropCue?: string; box?: { index: number; x?: number; y?: number; w?: number; h?: number } }>
  manifest?: Edit[]
  measure?: FakeMeasureSetup
  pixels?: { missing?: string | null; gateFails?: string[]; readWrong?: boolean; samples?: Array<{ t: number; text: string }> }
  golden?: false
  allowUnbuilt?: StepId[]
  /** Run only the named step, with no earlier step run. */
  single?: boolean
  /** After running up to `step`, change the brief or the timeline, then run `then`. */
  stale?: { after: StepId; edits: Array<Edit & { in: 'brief' | 'timeline' }>; then: StepId }
  /** Attempts already spent on the job. */
  attempts?: Array<{ step: StepId; minutesAgo?: number }>
  /** A throwaway repository in this relation to origin/main. */
  repo?: RepoShape
  /** Send the output folder under public/ (the run must refuse before writing anything). */
  publicOut?: boolean
  /** false: write no whiteboard.json beside the brief (CONTENT_PROCESS.md step 0). */
  whiteboard?: false
}

export type Fixture = {
  rule: string
  step: StepId
  what: string
  edits?: Array<Edit & { in: 'brief' | 'timeline' | 'whiteboard' }>
  setup?: Setup
}

export function loadFixture(file: string): Fixture {
  return readJson(join(FIXTURES, file)) as Fixture
}

/** The base film: its brief, its timeline, and the ad-strategist's whiteboard that sits beside the brief. */
export function baseFilm(): { brief: any; timeline: any; whiteboard: any } {
  return {
    brief: readJson(join(FIXTURES, 'base.brief.json')),
    timeline: readJson(join(FIXTURES, 'base.timeline.json')),
    whiteboard: readJson(join(FIXTURES, 'base.whiteboard.json')),
  }
}

// ---------------------------------------------------------------------------
// The voice

const FIXTURE_WORDS: SpokenWord[] = readJson(join(REPO_ROOT, 'lib', 'studio', 'timeline', 'fixtures', 'bend-mos.words.json')).words
const FIXTURE_SCRIPT: string = baseFilm().timeline.voice.script

/** The words a provider answers with on the voice's own clock: the recorded timing for the sample's script, its tokens for a changed one. */
function voiceWords(script: string, stretch: number): SpokenWord[] {
  const said = scriptWords(script)
  const base = script === FIXTURE_SCRIPT ? FIXTURE_WORDS : said.length === FIXTURE_WORDS.length ? FIXTURE_WORDS.map((w, i) => ({ ...w, word: said[i] })) : dryWords(script)
  return base.map((w) => ({ word: w.word, start: w.start * stretch, end: w.end * stretch }))
}

/** A character alignment for words: letters share each word's time, punctuation sits at its edge. */
function alignmentOf(words: SpokenWord[]): CharacterAlignment {
  const characters: string[] = []
  const starts: number[] = []
  const ends: number[] = []
  words.forEach((w, wi) => {
    if (wi > 0) {
      characters.push(' ')
      starts.push(words[wi - 1].end)
      ends.push(words[wi - 1].end)
    }
    const chars = Array.from(w.word)
    const alnum = chars.filter((c) => /[\p{L}\p{N}]/u.test(c)).length
    let k = 0
    for (const c of chars) {
      if (/[\p{L}\p{N}]/u.test(c)) {
        const s = w.start + ((w.end - w.start) * k) / alnum
        const e = w.start + ((w.end - w.start) * (k + 1)) / alnum
        characters.push(c)
        starts.push(s)
        ends.push(e)
        k++
      } else {
        characters.push(c)
        starts.push(k === 0 ? w.start : w.end)
        ends.push(k === 0 ? w.start : w.end)
      }
    }
  })
  return { characters, characterStartTimesSeconds: starts, characterEndTimesSeconds: ends }
}

export function fakeVoiceProvider(stretch = 1): VoiceProvider {
  return async (req) => {
    const words = voiceWords(req.text.replace(/\[[^\]]*\]/g, ' '), stretch)
    const s: Synthesis = {
      engine: 'elevenlabs', model: req.model, voiceId: req.voiceId, text: req.text, voiceSettings: null,
      outputFormat: 'pcm_48000', audio: Buffer.alloc(9600), alignment: alignmentOf(words), normalizedAlignment: null, requestId: null, refusedFormats: [],
    }
    return s
  }
}

// ---------------------------------------------------------------------------
// The page

const SQUARE: Array<[number, number]> = [[-121.32, 44.05], [-121.3, 44.05], [-121.3, 44.07], [-121.32, 44.07], [-121.32, 44.05]]
const AROUND: Array<[number, number]> = [[-121.4, 44.0], [-121.22, 44.0], [-121.22, 44.12], [-121.4, 44.12], [-121.4, 44.0]]

/** What a page that drew the plan would read back: every cue's texts (the meter's scale marks too), each in its own small box. */
export function drawnBy(plan: Parameters<typeof stillTimes>[0], times: number[], layout: NonNullable<Setup['layout']> = []): Array<{ t: number; texts: DrawnText[] }> {
  let n = 0
  let all: DrawnText[] = plan.cues.flatMap((cue) =>
    [...cueTexts(cue), ...(cue.kind === 'meter' ? [...cue.thresholds.map(String), '4 mo', '6 mo', `${Math.round(cue.domainMax)} mo`] : [])]
      .filter(Boolean)
      .map((text): DrawnText => {
        const at = n++
        return { cue: cue.id, text, x: 20 + (at % 20) * 45, y: 100 + Math.floor(at / 20) * 60, w: 40, h: 36, opacity: 1 }
      }),
  )
  for (const edit of layout) {
    if (edit.drop !== undefined) all = all.filter((d) => d.text !== edit.drop)
    if (edit.dropCue !== undefined) all = all.filter((d) => !(d.cue ?? '').includes(edit.dropCue!))
    if (edit.box) all = all.map((d, i) => (i === edit.box!.index ? { ...d, ...edit.box, index: undefined } as DrawnText : d))
  }
  return times.map((t) => ({ t, texts: all }))
}

// ---------------------------------------------------------------------------
// The measurements

const GOLDEN = Buffer.from('GOLDEN')

function filmMeasure(s: FakeMeasureSetup): Measure {
  const manifestNextTo = (path: string) => readJson(join(path, '..', 'final.manifest.json'))
  const probeOf = (path: string): ProbeResult => {
    if (!path.endsWith('final.mp4')) return { width: 1080, height: 1920, fps: 30, codec: 'h264', pixFmt: 'yuv420p', duration: 24, videoDuration: 24, hasAudio: false }
    const d = manifestNextTo(path).video.duration as number
    return { width: 1080, height: 1920, fps: 30, codec: 'h264', pixFmt: 'yuv420p', duration: d, videoDuration: d, hasAudio: true, ...s.probe }
  }
  return {
    async probe(p) { return probeOf(p) },
    async loudness() { return s.loudness ?? { integratedLufs: -14, truePeakDb: -1.7 } },
    async freezes() { return s.freezes ?? [] },
    async sceneCuts() { return s.cuts ?? [] },
    async frameAt(_p, t) {
      if (s.failFrame) throw new Error('no frame')
      return Buffer.from(`frame@${t.toFixed(3)}`)
    },
    async ssim(a, b) { return a.equals(GOLDEN) || b.equals(GOLDEN) ? (s.endcardSsim ?? 0.97) : (s.loopSsim ?? 0.9) },
    async lumaStats() { return { mean: 120, variance: s.hookVariance ?? 900 } },
    async creamFractions(p, from, to) {
      const start = s.endcardFrom === undefined ? (manifestNextTo(p).endcard.start as number) : s.endcardFrom
      const out: Array<{ t: number; fraction: number }> = []
      for (let t = from; t <= to + 1e-9; t += 1 / 30) {
        const at = Math.round(t * 1000) / 1000
        out.push({ t: at, fraction: start !== null && at >= start - 1e-6 ? 0.9 : 0.001 })
      }
      return out
    },
    async sha256(p) { return s.sha ?? sha256File(p) },
  }
}

function filmPixels(mp4: string, p: NonNullable<Setup['pixels']>): PixelProbe {
  return {
    async missingTooling() { return p.missing ?? null },
    async gate(): Promise<GateRun> { return { fails: p.gateFails ?? [], info: {}, samples: p.samples ?? [] } },
    async readBox(_mp4, t, box) {
      if (p.readWrong) return 'something else'
      const m = readJson(join(mp4, '..', 'final.manifest.json'))
      const hit = (m.texts as any[]).find((x) => x.box.x === box.x && x.box.y === box.y && x.box.w === box.w && t >= x.start && t <= x.end)
      return hit?.text ?? ''
    },
  }
}

// ---------------------------------------------------------------------------
// The harness

export type Harness = {
  dir: string
  outRoot: string
  work: string
  briefPath: string
  timelinePath: string
  deps: StepDeps
  ledgerPath: string
  registryPath: string
  claims: FileClaimStore
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex')

/** Build every fake into `dir` and write the film's brief and timeline (the base, with the fixture's edits). */
export function makeHarness(setup: Setup = {}, edits: Fixture['edits'] = [], dir = mkdtempSync(join(tmpdir(), 'rr-process-'))): Harness {
  const work = join(dir, 'work')
  mkdirSync(work, { recursive: true })
  const outRoot = setup.publicOut ? join(dir, 'public', 'out') : join(dir, 'out')
  const base = baseFilm()
  for (const e of edits ?? []) applyEdits(e.in === 'brief' ? base.brief : e.in === 'whiteboard' ? base.whiteboard : base.timeline, [e])
  const briefPath = join(work, 'brief.json')
  const timelinePath = join(work, 'timeline.json')
  writeFileSync(briefPath, JSON.stringify(base.brief, null, 2))
  writeFileSync(timelinePath, JSON.stringify(base.timeline, null, 2))
  // The whiteboard sits in the brief's own folder, where the brief step reads it.
  if (setup.whiteboard !== false) writeFileSync(join(work, 'whiteboard.json'), JSON.stringify(base.whiteboard, null, 2))

  // The registry: the real one, with the sample's signature technique approved by the TEST approver (never "matt").
  const reg = readJson(join(REPO_ROOT, '.claude', 'skills', 'ryan-studio', 'techniques', 'registry.json'))
  reg.techniques.outline_draw_zoom = { ...reg.techniques.outline_draw_zoom, status: 'approved', ...TEST_ONLY_APPROVAL }
  applyEdits(reg, setup.registry)
  const registryPath = join(dir, 'registry.test-only.json')
  writeFileSync(registryPath, JSON.stringify(reg))
  const ledgerPath = join(dir, 'film-ledger.jsonl')
  writeFileSync(ledgerPath, setup.ledgerRaw ?? (setup.ledger ?? []).map((l) => JSON.stringify(l)).join('\n') + ((setup.ledger ?? []).length ? '\n' : ''))
  const golden = join(dir, 'golden.png')
  if (setup.golden !== false) writeFileSync(golden, GOLDEN)

  const claims = new FileClaimStore(outRoot)
  const slug = 'bend-go-in-with-a-plan'
  for (const a of setup.attempts ?? []) {
    const at = new Date(Date.now() - (a.minutesAgo ?? 1) * 60000).toISOString()
    const n = claims.attempts(slug).filter((x) => x.step === a.step).length + 1
    claims.recordStart(slug, { kind: 'start', step: a.step, attempt: n, at, builder: 'claude', machine: 'test' })
    claims.recordEnd(slug, { kind: 'end', step: a.step, attempt: n, at, verdict: 'fail', problems: [`${a.step} attempt ${n} failed (seeded by the test)`] })
  }

  const cacheDir = join(outRoot, 'studio', '.cache')
  const clipCuts = (path: string): number[] => {
    for (const [src, c] of Object.entries(setup.clips ?? {})) if (footageFilePath(src, { baseDir: work, cacheDir }) === path) return c.cuts ?? []
    return []
  }
  const clipMeasure: Measure = {
    ...filmMeasure({}),
    async probe() { return { width: 1080, height: 1920, fps: 30, codec: 'h264', pixFmt: 'yuv420p', duration: 24, videoDuration: 24, hasAudio: false } },
    async sceneCuts(path) { return clipCuts(path) },
    async frameAt(_p, t) { return Buffer.from(`clip-frame@${t}`) },
  }

  const planTimes = (film: Awaited<ReturnType<typeof planTheFilm>>['film']) => [...new Set([...stillTimes(film.plan).map((x) => x.t), ...film.techniques.flatMap((p) => p.proofs.map((x) => x.t))])].sort((a, b) => a - b)

  const master = async (ctx: RunContext): Promise<RenderedFilm> => {
    const stills = readStamp(ctx.outRoot, ctx.slug, 'stills')
    const clips = stills.ok ? stills.stamp.outputs.clips : {}
    const planned = await planTheFilm(ctx, clips, false)
    const { film, voice, brief } = planned
    const probed = drawnBy(film.plan, planTimes(film))
    const { texts, cues } = textsFromProbes(film, probed)
    const numbers = boundNumbers(film.numbers, texts, cues)
    mkdirSync(ctx.filmDir, { recursive: true })
    const mp4Path = join(ctx.filmDir, 'final.mp4')
    writeFileSync(mp4Path, 'not really a video')
    const briefText = `${JSON.stringify(ctx.brief, null, 2)}\n`
    const manifest: any = {
      factory: 'lib/studio', manifestVersion: 2,
      video: { file: 'final.mp4', sha256: sha('not really a video'), width: 1080, height: 1920, fps: 30, duration: film.duration },
      videoType: brief.video_type, techniques: film.techniques.map((t) => t.name), beats: film.beats, texts, numbers: numbers.ok ? numbers.rows : [],
      voice: voice ? manifestVoice(voice, voice.words) : null, captions: voice ? voice.captions : [],
      audio: { lufs: -14, truePeakDb: -1.7, silent: false },
      endcard: film.endcard ? { start: film.endcard.start, quality: film.endcard.quality, local: film.endcard.local, service: film.endcard.service, call: film.endcard.call, out: film.endcard.out } : null,
      loop: film.loop, builtBy: 'claude', briefSha256: sha(briefText), slug: ctx.slug, creative: { ...brief.creative }, briefTechniques: brief.techniques,
    }
    applyEdits(manifest, setup.manifest)
    const manifestPath = join(ctx.filmDir, 'final.manifest.json')
    const briefPath = join(ctx.filmDir, 'final.brief.json')
    writeFileSync(manifestPath, JSON.stringify(manifest))
    writeFileSync(briefPath, briefText)
    return { mp4Path, manifestPath, briefPath }
  }

  const deps: StepDeps = {
    render: {
      ffmpeg: join(dir, 'no-ffmpeg-here'),
      voiceProvider: fakeVoiceProvider(setup.voice?.stretch ?? 1),
      launchBrowser: async () => {
        throw new Error('a browser was launched: the harness never draws')
      },
      measure: clipMeasure,
      loadAssets: async () => {
        const f = 'data:font/ttf;base64,AA=='
        return { fonts: { amboqia: f, amboqiaI: f, azo: f, geist400: f, geist500: f, geist600: f, geist700: f }, wordmark: f, endcardLogo: f, headshots: {} }
      },
      download: async (url, dest) => writeFileSync(dest, `clip:${url}`),
      log: () => undefined,
      layoutProbe: async (input) => drawnBy(input.plan, input.times, setup.layout),
      resolveOutline: async ({ geoSlug }) => (geoSlug === 'bend' ? [AROUND] : [SQUARE]),
      registryPath,
    },
    voiceId: 'test-voice',
    board: async (input) => ({
      shots: boardTimes(input.film).map(({ beat, t }) => ({ beat: beat.id, role: beat.role, t, png: Buffer.from(`png:${beat.id}@${t}`) })),
      sheet: Buffer.from('sheet'),
    }),
    master,
    check: {
      measure: filmMeasure(setup.measure ?? {}),
      get pixels() {
        return filmPixels(join(outRoot, 'studio', slug, 'final.mp4'), setup.pixels ?? {})
      },
      testPaths: { golden, ledgerPath, registryPath },
    },
  }
  return { dir, outRoot, work, briefPath, timelinePath, deps, ledgerPath, registryPath, claims }
}

/** The freshness a fixture's setup describes: level with main, or a throwaway repo in the shape it names (real git, in the temp folder only). */
export function freshnessFor(setup: Setup, dir: string): () => Freshness {
  if (!setup.repo) return () => ({ ok: true, head: 'a'.repeat(40), main: 'a'.repeat(40) })
  const repo = makeTempRepo(join(dir, 'git'), setup.repo)
  return () => checkFreshness(gitRunner({ env: repo.env }))
}

/** Run a fixture the way the rule says: up to its step (or just that step), and give back what the runner said. */
export async function runFixture(fx: Fixture, dir?: string): Promise<{ result: RunResult; h: Harness }> {
  const setup = fx.setup ?? {}
  const h = makeHarness(setup, fx.edits, dir)
  const opts = {
    briefPath: h.briefPath,
    timelinePath: h.timelinePath,
    root: h.dir,
    outRoot: h.outRoot,
    deps: h.deps,
    freshness: freshnessFor(setup, h.dir),
    claims: h.claims,
    ledgerPath: h.ledgerPath,
    gitHead: () => 'f'.repeat(40),
    machine: 'test-machine',
    builder: 'claude',
    allowUnbuilt: setup.allowUnbuilt ?? (['animatic'] as StepId[]),
  }
  if (setup.single) return { result: await runStep(opts, fx.step), h }
  if (setup.stale) {
    const first = await runSteps({ ...opts, to: setup.stale.after })
    if (!first.ok) return { result: first, h }
    const brief = readJson(h.briefPath)
    const timeline = readJson(h.timelinePath)
    for (const e of setup.stale.edits) applyEdits(e.in === 'brief' ? brief : timeline, [e])
    writeFileSync(h.briefPath, JSON.stringify(brief, null, 2))
    writeFileSync(h.timelinePath, JSON.stringify(timeline, null, 2))
    return { result: await runStep(opts, setup.stale.then), h }
  }
  return { result: await runSteps({ ...opts, to: fx.step }), h }
}

export { appendFileSync }
