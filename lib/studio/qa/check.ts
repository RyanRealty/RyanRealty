/**
 * lib/studio/qa/check.ts - the measured output check (`npm run video:check`).
 *
 * checkVideo opens the finished MP4, measures it, and holds it to the contract in
 * docs/plans/STUDIO_ONE_FACTORY.md: the sixteen checks in its table, numbered as
 * there. The review (14) runs only with `final: true`; on a final pass the film
 * is also recorded in the film ledger (see ledger.ts).
 *
 * Rule that outranks all others here: a check that cannot be measured FAILS. Any
 * missing input (no manifest, no brief where one is needed, no golden still, an
 * ffmpeg error) turns into a failed check with the reason in `detail`. Nothing
 * passes by default.
 *
 * Measurement goes through an injected `Measure`, so the logic is tested with
 * fakes (check.test.ts) and against real ffmpeg (check.int.test.ts).
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import {
  captionProblems,
  computeShots,
  evaluateCaptions,
  evaluateCopy,
  evaluateEndcardTiming,
  evaluateHook,
  evaluateNumbers,
  evaluateReview,
  evaluateSafeArea,
  judgeLoudness,
  round,
  shortHolds,
  silentFilmDeclared,
  type ReviewFile,
} from './evaluate'
import { appendLedgerEntry, buildLedgerEntry, comparedCount, findRepeat, readLedger, type LedgerEntry } from './ledger'
import {
  MANIFEST_FACTORY,
  formatManifestIssues,
  parseManifestJson,
  type Manifest,
} from './manifest'
import { measure as realMeasure, type Measure, type ProbeResult } from './measure'
import { evaluateTechniques, loadTechniqueRegistry, type TechniqueRegistry } from './techniques'
import {
  FILM_LEDGER_PATH,
  LEDGER_WINDOW,
  QA_THRESHOLDS,
  REPO_ROOT,
  REQUIRED_TECHNIQUE_CATEGORIES,
  bannedPhrases,
  loadVideoTypes,
  typeRulesFor,
  type TypeRules,
  type VideoTypesFile,
} from './thresholds'

const T = QA_THRESHOLDS

export type CheckValue = string | number | boolean | null | CheckValue[] | { [key: string]: CheckValue }

export interface CheckResult {
  id: number
  name: string
  pass: boolean
  measured: CheckValue
  expected: CheckValue
  detail: string
}

export interface CheckOptions {
  mp4Path: string
  /** Defaults to `<name>.manifest.json` beside the MP4. */
  manifestPath?: string
  /** Defaults to `<name>.brief.json` beside the MP4 when that file exists. */
  briefPath?: string
  /** Also run check 14 (the review) and record the film in the ledger on a pass. */
  final?: boolean
  /** The locked end card golden still. Defaults to lib/studio/motion/endcard.golden.png. */
  golden?: string
  /** Defaults to `<name>.review.json` beside the MP4. */
  reviewPath?: string
  /** Defaults to data/studio/film-ledger.jsonl. */
  ledgerPath?: string
  /** On a final pass, append the film to the ledger (default true). */
  recordInLedger?: boolean
  typesPath?: string
  registryPath?: string
}

export interface CheckDeps {
  measure?: Measure
  now?: () => Date
}

export interface CheckReport {
  pass: boolean
  final: boolean
  mp4: string
  manifest: string | null
  checkedAt: string
  /** sha256 of the file as measured now, or null when it could not be read. */
  sha256: string | null
  checks: CheckResult[]
  ledger: { path: string; appended: boolean; entry: LedgerEntry } | null
}

interface Body {
  pass: boolean
  measured: CheckValue
  expected: CheckValue
  detail: string
}

const done = (measured: CheckValue, expected: CheckValue, detail: string): Body => ({ pass: true, measured, expected, detail })
const bad = (measured: CheckValue, expected: CheckValue, detail: string): Body => ({ pass: false, measured, expected, detail })
const verdict = (problems: string[], measured: CheckValue, expected: CheckValue, ok: string): Body =>
  problems.length === 0 ? done(measured, expected, ok) : bad(measured, expected, problems.join('; '))

class Ctx {
  readonly dir: string
  readonly name: string
  manifestPath: string
  manifest: Manifest | null = null
  manifestProblem = ''
  briefPath: string | null = null
  brief: Record<string, unknown> | null = null
  briefProblem = ''
  types: VideoTypesFile | null = null
  typesProblem = ''
  rules: TypeRules | null = null
  rulesProblem = ''
  ledgerEntry: LedgerEntry | null = null
  private memo = new Map<string, Promise<unknown>>()

  constructor(readonly opts: CheckOptions, readonly measure: Measure, readonly now: () => Date) {
    this.dir = dirname(opts.mp4Path)
    this.name = basename(opts.mp4Path).replace(/\.mp4$/i, '')
    this.manifestPath = opts.manifestPath ?? join(this.dir, `${this.name}.manifest.json`)
  }

  /** Read the manifest, brief and type rules. Never throws; problems are recorded. */
  load(): void {
    if (!existsSync(this.manifestPath)) {
      this.manifestProblem = `${this.manifestPath} does not exist`
    } else {
      try {
        const parsed = parseManifestJson(readFileSync(this.manifestPath, 'utf8'))
        if (parsed.ok) this.manifest = parsed.manifest
        else this.manifestProblem = formatManifestIssues(parsed.errors)
      } catch (e) {
        this.manifestProblem = `could not read the manifest: ${(e as Error).message}`
      }
    }

    const explicit = this.opts.briefPath
    const candidate = explicit ?? join(this.dir, `${this.name}.brief.json`)
    if (explicit || existsSync(candidate)) {
      this.briefPath = candidate
      try {
        const raw = JSON.parse(readFileSync(candidate, 'utf8')) as unknown
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) this.brief = raw as Record<string, unknown>
        else this.briefProblem = `${candidate} is not a JSON object`
      } catch (e) {
        this.briefProblem = `could not read the brief ${candidate}: ${(e as Error).message}`
      }
    }

    try {
      this.types = loadVideoTypes(this.opts.typesPath)
    } catch (e) {
      this.typesProblem = `could not read video_types.json: ${(e as Error).message}`
    }
    if (this.manifest && this.types) {
      try {
        this.rules = typeRulesFor(this.manifest.videoType, this.types)
        if (!this.rules) this.rulesProblem = `videoType "${this.manifest.videoType}" is not in video_types.json (${Object.keys(this.types.types).join(', ')})`
      } catch (e) {
        this.rulesProblem = (e as Error).message
      }
    } else if (!this.manifest) {
      this.rulesProblem = 'no valid manifest, so the video type is unknown'
    } else {
      this.rulesProblem = this.typesProblem
    }
  }

  once<V>(key: string, fn: () => Promise<V>): Promise<V> {
    let p = this.memo.get(key) as Promise<V> | undefined
    if (!p) {
      p = fn()
      this.memo.set(key, p)
    }
    return p
  }

  probe(): Promise<ProbeResult> {
    return this.once('probe', () => this.measure.probe(this.opts.mp4Path))
  }

  sha(): Promise<string> {
    return this.once('sha', () => this.measure.sha256(this.opts.mp4Path))
  }

  /** PNG of the frame at t, clamped to the last frame of the film. */
  async frame(t: number): Promise<Buffer> {
    const p = await this.probe()
    const last = Math.max(0, p.videoDuration - 1 / p.fps)
    const at = Math.min(Math.max(0, t), last)
    return this.once(`frame:${at.toFixed(3)}`, () => this.measure.frameAt(this.opts.mp4Path, at))
  }

  /** The final frame. The very last timestamp can fall past the stream, so back off a frame at a time. */
  lastFrame(): Promise<Buffer> {
    return this.once('lastFrame', async () => {
      const p = await this.probe()
      let err: unknown
      for (let back = 1; back <= 4; back++) {
        try {
          return await this.measure.frameAt(this.opts.mp4Path, Math.max(0, p.videoDuration - back / p.fps))
        } catch (e) {
          err = e
        }
      }
      throw err
    })
  }

  noManifest(expected: CheckValue): Body {
    return bad(null, expected, `cannot be measured: no valid manifest (${this.manifestProblem})`)
  }

  noRules(expected: CheckValue): Body {
    return bad(null, expected, `cannot be measured: ${this.rulesProblem}`)
  }
}

// ---------------------------------------------------------------------------
// The checks

async function provenance(c: Ctx): Promise<Body> {
  const expected = { manifest: 'present and valid', sha256: 'equals manifest.video.sha256', factory: MANIFEST_FACTORY }
  const m = c.manifest
  if (!m) return c.noManifest(expected)
  const actual = await c.sha()
  const problems: string[] = []
  if (actual !== m.video.sha256) problems.push(`the file's sha256 ${actual.slice(0, 12)} differs from the manifest's ${m.video.sha256.slice(0, 12)}`)
  if (m.factory !== MANIFEST_FACTORY) problems.push(`factory is "${m.factory}", not "${MANIFEST_FACTORY}"`)
  const briefType = c.brief?.video_type
  if (typeof briefType === 'string' && briefType !== m.videoType) problems.push(`the brief says video_type "${briefType}" but the manifest says "${m.videoType}"`)
  return verdict(problems, { sha256: actual, manifestSha256: m.video.sha256, factory: m.factory, videoType: m.videoType }, expected, `hash matches, built by ${m.factory}`)
}

async function format(c: Ctx): Promise<Body> {
  const f = T.format
  const expected = { width: f.width, height: f.height, fps: f.fps, codec: f.codec, pixFmt: f.pixFmt, durationWithin: T.durationToleranceSeconds }
  const p = await c.probe()
  const m = c.manifest
  const measured: CheckValue = { width: p.width, height: p.height, fps: round(p.fps, 3), codec: p.codec, pixFmt: p.pixFmt, duration: round(p.duration), manifestDuration: m ? m.video.duration : null }
  if (!m) return bad(measured, expected, `cannot be measured: no valid manifest to compare the duration with (${c.manifestProblem})`)
  const problems: string[] = []
  if (p.width !== f.width || p.height !== f.height) problems.push(`size is ${p.width}x${p.height}, not ${f.width}x${f.height}`)
  if (Math.abs(p.fps - f.fps) > f.fpsTolerance) problems.push(`frame rate is ${round(p.fps, 3)}, not ${f.fps}`)
  if (p.codec !== f.codec) problems.push(`codec is ${p.codec}, not ${f.codec}`)
  if (p.pixFmt !== f.pixFmt) problems.push(`pixel format is ${p.pixFmt}, not ${f.pixFmt}`)
  const delta = Math.abs(p.duration - m.video.duration)
  if (delta > T.durationToleranceSeconds + T.epsilon) problems.push(`duration ${round(p.duration)}s differs from the manifest's ${m.video.duration}s by ${round(delta)}s`)
  if (m.video.width !== p.width || m.video.height !== p.height) problems.push(`the manifest says ${m.video.width}x${m.video.height}`)
  return verdict(problems, measured, expected, `${p.width}x${p.height}, ${round(p.fps, 3)} fps, ${p.codec} ${p.pixFmt}, ${round(p.duration)}s`)
}

async function length(c: Ctx): Promise<Body> {
  const r = c.rules
  if (!r) return c.noRules({ min_s: null, max_s: null, hard_max_s: null })
  const expected = { min_s: r.min_s, max_s: r.max_s, hard_max_s: r.hard_max_s }
  const p = await c.probe()
  const d = p.duration
  const problems: string[] = []
  const reason = typeof c.brief?.length_reason === 'string' ? c.brief.length_reason.trim() : ''
  if (d < r.min_s) problems.push(`runs ${round(d)}s, under the ${r.min_s}s minimum`)
  if (d > r.hard_max_s) problems.push(`runs ${round(d)}s, over the ${r.hard_max_s}s hard maximum`)
  else if (d > r.max_s && reason === '') {
    problems.push(`runs ${round(d)}s, over ${r.max_s}s, with no length_reason in the brief${c.brief ? '' : ` (${c.briefProblem || 'no brief supplied'})`}`)
  }
  return verdict(problems, { duration: round(d), length_reason: reason || null }, expected, `${round(d)}s is inside ${r.min_s} to ${r.max_s}s${d > r.max_s ? ' with a length_reason' : ''}`)
}

async function hook(c: Ctx): Promise<Body> {
  const r = c.rules
  const m = c.manifest
  if (!m) return c.noManifest({ hook_max_s: null })
  if (!r) return c.noRules({ hook_max_s: null })
  const expected = { firstBeat: 'hook', nonCaptionTextBy: r.hook_max_s, frameAtHookMaxNotBlank: true }
  const found = evaluateHook(m.beats, m.texts, r.hook_max_s)
  const problems = [...found.problems]
  const luma = await c.measure.lumaStats(await c.frame(r.hook_max_s))
  if (luma.variance < T.blankFrameLumaVarianceMin) problems.push(`the frame at ${r.hook_max_s}s is blank (luma variance ${round(luma.variance, 2)})`)
  return verdict(
    problems,
    { firstBeatRole: found.firstBeatRole, firstBeatStart: found.firstBeatStart, hookTextStart: found.hookTextStart, lumaVarianceAtHookMax: round(luma.variance, 2) },
    expected,
    `hook text on screen at ${found.hookTextStart}s (limit ${r.hook_max_s}s), frame at ${r.hook_max_s}s has detail`,
  )
}

async function holds(c: Ctx): Promise<Body> {
  const r = c.rules
  const m = c.manifest
  if (!m) return c.noManifest({ min_hold_s: null })
  if (!r) return c.noRules({ min_hold_s: null })
  const expected = { everyBeatAndShotAtLeast: r.min_hold_s }
  const p = await c.probe()
  const cuts = await c.once('cuts', () => c.measure.sceneCuts(c.opts.mp4Path, T.sceneCutScore))
  const beats = m.beats.map((b) => ({ id: b.id, duration: round(b.end - b.start) }))
  const shortBeats = shortHolds(beats, r.min_hold_s)
  const { shots, ignoredCuts } = computeShots(cuts, p.duration, m.endcard ? m.endcard.start : null)
  const shortShots = shortHolds(shots, r.min_hold_s)
  const problems = [
    ...shortBeats.map((b) => `beat "${b.id}" holds ${b.duration}s`),
    ...shortShots.map((s) => `shot ${s.start}s to ${s.end}s holds ${s.duration}s`),
  ]
  const shortest = shots.length ? Math.min(...shots.map((s) => s.duration)) : null
  return verdict(
    problems.map((x) => `${x} (minimum ${r.min_hold_s}s)`),
    { beats: beats.length, shortBeats: shortBeats.map((b) => b.id), shots: shots.length, shortestShot: shortest, shortShots: shortShots.map((s) => `${s.start}-${s.end}`), cuts: cuts.map((t) => round(t)), endcardWordPops: ignoredCuts },
    expected,
    `${beats.length} beats and ${shots.length} shots, all at least ${r.min_hold_s}s${ignoredCuts.length ? ` (${ignoredCuts.length} end card cut(s) ignored)` : ''}`,
  )
}

async function motion(c: Ctx): Promise<Body> {
  const expected = { frozenStretchUnder: T.freezeSeconds }
  const raw = await c.once('freezes', () => c.measure.freezes(c.opts.mp4Path, { seconds: T.freezeSeconds, noise: T.freezeNoise }))
  const frozen = raw.filter((i) => i.duration >= T.freezeSeconds - T.epsilon)
  const list = frozen.map((i) => ({ start: round(i.start), end: round(i.end), duration: round(i.duration) }))
  return verdict(
    list.map((i) => `frozen from ${i.start}s to ${i.end}s (${i.duration}s)`),
    { frozen: list },
    expected,
    `nothing frozen for ${T.freezeSeconds}s or more`,
  )
}

async function sound(c: Ctx): Promise<Body> {
  const a = T.audio
  const expected = { lufs: `${a.lufsMin} to ${a.lufsMax}`, truePeakDbAtMost: a.truePeakMaxDb }
  const p = await c.probe()
  const m = c.manifest
  if (!p.hasAudio) {
    if (m && silentFilmDeclared(m.voice, m.audio)) return done({ audioStream: false }, expected, 'a silent film, declared silent in the manifest, with no voice')
    const why = !m ? `no valid manifest to say the film is silent (${c.manifestProblem})` : m.voice ? 'the film has a voiceover' : 'the manifest does not declare the film silent'
    return bad({ audioStream: false }, expected, `no audio stream in the file; ${why}`)
  }
  if (m && m.audio.silent) return bad({ audioStream: true }, expected, 'the manifest says the film is silent but the file has an audio stream')
  const l = await c.once('loudness', () => c.measure.loudness(c.opts.mp4Path))
  const j = judgeLoudness(l.integratedLufs, l.truePeakDb)
  return verdict(j.problems, { integratedLufs: l.integratedLufs, truePeakDb: l.truePeakDb }, expected, `${l.integratedLufs} LUFS, true peak ${l.truePeakDb} dBTP`)
}

async function captions(c: Ctx): Promise<Body> {
  const m = c.manifest
  const k = T.caption
  const expected = { maxWords: k.maxWords, minSeconds: k.minSeconds, syncSeconds: k.syncSeconds, everySpokenWordShown: true }
  if (!m) return c.noManifest(expected)
  if (m.voice === null) return done({ voice: null }, expected, 'no voiceover, so there are no spoken words to caption')
  const f = evaluateCaptions(m.voice, m.captions)
  return verdict(captionProblems(f), { ...f }, expected, `${f.captions} captions cover all ${f.spokenWords} spoken words, in sync`)
}

async function numbers(c: Ctx): Promise<Body> {
  const m = c.manifest
  const expected = { everyFigureHasARow: true, rowFields: 'source, window, geography, definition' }
  if (!m) return c.noManifest(expected)
  const f = evaluateNumbers(m.texts, m.captions, m.numbers)
  const problems = [...f.unmatched.map((t) => `figure "${t}" has no numbers row`), ...f.incompleteRows]
  return verdict(problems, { ...f }, expected, f.tokens.length ? `${f.tokens.length} figure(s), each with a complete numbers row` : 'no figures on screen')
}

async function copy(c: Ctx): Promise<Body> {
  const m = c.manifest
  const expected = { dashes: 0, bannedPhrases: 0 }
  if (!m) return c.noManifest(expected)
  if (!c.types) return bad(null, expected, `cannot be measured: ${c.typesProblem}`)
  const hits = evaluateCopy(m.texts, m.captions, m.voice, bannedPhrases(c.types))
  return verdict(hits.map((h) => `${h.what} in ${h.where}`), { hits: hits.map((h) => `${h.what} in ${h.where}`) }, expected, 'no dashes and no banned phrases in texts, captions or voice')
}

async function safeArea(c: Ctx): Promise<Body> {
  const m = c.manifest
  const expected = { maxRight: T.safeArea.maxX, maxBottom: T.safeArea.maxY }
  if (!m) return c.noManifest(expected)
  const off = evaluateSafeArea(m.texts)
  return verdict(off.map((o) => `"${o.text}" reaches x ${o.right}, y ${o.bottom}`), { offenders: off.map((o) => `${o.text} (${o.right}, ${o.bottom})`) }, expected, `all ${m.texts.filter((t) => t.kind !== 'endcard').length} non-end-card text boxes are inside x ${T.safeArea.maxX}, y ${T.safeArea.maxY}`)
}

function goldenPathFor(c: Ctx): string {
  return c.opts.golden ? resolve(c.opts.golden) : resolve(REPO_ROOT, T.endcard.goldenPath)
}

async function endCard(c: Ctx): Promise<Body> {
  const m = c.manifest
  const e = T.endcard
  const expected = { order: 'start, Quality, Local, Service, Call now, out', wordPopsAtMost: e.wordPopBudgetSeconds, callHoldAtLeast: e.callHoldMinSeconds, ssimAtLeast: e.ssimMin }
  if (!m) return c.noManifest(expected)
  if (!c.rules) return c.noRules(expected)
  if (!m.endcard) {
    return c.rules.requires_end_card
      ? bad({ endcard: null }, expected, `the manifest has no end card and ${m.videoType} requires one`)
      : done({ endcard: null }, expected, `${m.videoType} does not require an end card`)
  }
  const p = await c.probe()
  const timing = evaluateEndcardTiming(m.endcard, m.beats, p.videoDuration)
  const problems = [...timing.problems]
  const golden = goldenPathFor(c)
  let score: number | null = null
  if (!existsSync(golden)) {
    problems.push(`no golden still at ${golden}`)
  } else {
    const frame = await c.frame(m.endcard.call + e.callProbeOffsetSeconds)
    score = await c.measure.ssim(frame, readFileSync(golden))
    if (score < e.ssimMin) problems.push(`the frame at Call now + ${e.callProbeOffsetSeconds}s matches the golden still at SSIM ${round(score)}, under ${e.ssimMin}`)
  }
  return verdict(
    problems,
    { wordsSpan: timing.wordsSpan, callHold: timing.callHold, ssim: score === null ? null : round(score, 4), golden },
    expected,
    `end card in order, words ${timing.wordsSpan}s, Call now held ${timing.callHold}s, SSIM ${score === null ? 'n/a' : round(score, 4)}`,
  )
}

async function loop(c: Ctx): Promise<Body> {
  const m = c.manifest
  const expected = { ssimLastFrameVsFirstAtLeast: T.loopSsimMin }
  if (!m) return c.noManifest(expected)
  if (!c.rules) return c.noRules(expected)
  if (!m.loop) {
    return c.rules.requires_loop
      ? bad({ loop: null }, expected, `the manifest has no loop and ${m.videoType} requires one`)
      : done({ loop: null }, expected, `${m.videoType} does not require a loop`)
  }
  const score = await c.measure.ssim(await c.lastFrame(), await c.frame(0))
  return verdict(
    score < T.loopSsimMin ? [`the last frame matches frame 0 at SSIM ${round(score)}, under ${T.loopSsimMin}`] : [],
    { ssim: round(score, 4), loopSeconds: m.loop.seconds },
    expected,
    `last frame returns to frame 0 (SSIM ${round(score, 4)})`,
  )
}

async function review(c: Ctx): Promise<Body> {
  const expected = { reviewFile: `${c.name}.review.json`, sha256: 'equals the file', reviewer: 'not the builder', watched: true, listened: true, verdict: 'ship' }
  const path = c.opts.reviewPath ?? join(c.dir, `${c.name}.review.json`)
  if (!existsSync(path)) return bad({ reviewFile: null }, expected, `no review at ${path}`)
  let raw: ReviewFile
  try {
    raw = JSON.parse(readFileSync(path, 'utf8')) as ReviewFile
  } catch (e) {
    return bad({ reviewFile: path }, expected, `could not read the review: ${(e as Error).message}`)
  }
  if (!raw || typeof raw !== 'object') return bad({ reviewFile: path }, expected, 'the review is not a JSON object')
  const p = await c.probe()
  const problems = evaluateReview(raw, await c.sha(), c.manifest?.builtBy, p.hasAudio)
  return verdict(problems, { reviewer: typeof raw.reviewer === 'string' ? raw.reviewer : null, watched: raw.watched === true, listened: raw.listened === true, verdict: typeof raw.verdict === 'string' ? raw.verdict : null }, expected, `reviewed by ${String(raw.reviewer)}, verdict ship`)
}

function loadRegistry(c: Ctx): TechniqueRegistry {
  return loadTechniqueRegistry(c.opts.registryPath)
}

async function techniquesRan(c: Ctx): Promise<Body> {
  const m = c.manifest
  const expected = { briefTechniquesAllRan: true, categories: [...REQUIRED_TECHNIQUE_CATEGORIES] }
  if (!m) return c.noManifest(expected)
  let briefList: string[] | null = null
  const fromBrief = c.brief?.techniques
  if (Array.isArray(fromBrief) && fromBrief.every((t) => typeof t === 'string')) briefList = fromBrief as string[]
  else if (m.briefTechniques) briefList = m.briefTechniques
  if (!briefList) {
    return bad({ briefTechniques: null, manifestTechniques: m.techniques }, expected, c.briefProblem ? `no brief techniques: ${c.briefProblem}` : 'no brief (and the manifest carries no briefTechniques)')
  }
  const registry = loadRegistry(c)
  const ev = evaluateTechniques(briefList, m.techniques, registry)
  const problems: string[] = []
  if (ev.noCategories) problems.push('registry has no categories')
  if (briefList.length === 0) problems.push('the brief names no techniques')
  if (ev.notRun.length) problems.push(`brief technique(s) the renderer never ran: ${ev.notRun.join(', ')}`)
  if (ev.unknown.length) problems.push(`manifest technique(s) not in the registry: ${ev.unknown.join(', ')}`)
  if (!ev.noCategories && ev.missingCategories.length) problems.push(`no ${ev.missingCategories.join(', ')} technique ran`)
  return verdict(
    problems,
    { briefTechniques: briefList, ran: m.techniques, byCategory: ev.byCategory as CheckValue, notRun: ev.notRun, missingCategories: ev.missingCategories },
    expected,
    `all ${briefList.length} brief technique(s) ran; ${REQUIRED_TECHNIQUE_CATEGORIES.join(', ')} each covered`,
  )
}

async function notARepeat(c: Ctx): Promise<Body> {
  const m = c.manifest
  const expected = { notSameHookAndSceneSetAsLast: LEDGER_WINDOW, sameVideoType: true }
  if (!m) return c.noManifest(expected)
  const registry = loadRegistry(c)
  const sha = await c.sha()
  const built = buildLedgerEntry({ sha256: sha, videoType: m.videoType, techniques: m.techniques, checkedAt: c.now().toISOString() }, registry)
  if (!built.ok) return bad({ hookDevice: null, sceneSet: [] }, expected, `cannot be compared: ${built.reason}`)
  const ledgerPath = c.opts.ledgerPath ?? FILM_LEDGER_PATH
  const ledger = readLedger(ledgerPath)
  if (ledger.errors.length) return bad({ ledger: ledgerPath }, expected, `the ledger is damaged: ${ledger.errors.slice(0, 3).join('; ')}`)
  c.ledgerEntry = built.entry
  const repeat = findRepeat(built.entry, ledger.entries)
  const compared = comparedCount(built.entry, ledger.entries)
  const measured = { hookDevice: built.entry.hookDevice, sceneSet: built.entry.sceneSet, compared, repeatOf: repeat ? repeat.sha256.slice(0, 12) : null }
  if (repeat) {
    return bad(measured, expected, `same hook device "${repeat.hookDevice}" and scene set [${repeat.sceneSet.join(', ')}] as film ${repeat.sha256.slice(0, 12)} (${repeat.checkedAt}), one of the last ${LEDGER_WINDOW} ${m.videoType} films`)
  }
  return done(measured, expected, `hook "${built.entry.hookDevice}" with scenes [${built.entry.sceneSet.join(', ')}] differs from the last ${compared} ${m.videoType} film(s)`)
}

// ---------------------------------------------------------------------------
// Orchestration

async function runCheck(id: number, name: string, fn: () => Promise<Body>): Promise<CheckResult> {
  try {
    return { id, name, ...(await fn()) }
  } catch (e) {
    return { id, name, pass: false, measured: null, expected: null, detail: `cannot be measured: ${(e as Error).message}` }
  }
}

/** Open the MP4, measure it, and judge it against the contract. */
export async function checkVideo(opts: CheckOptions, deps: CheckDeps = {}): Promise<CheckReport> {
  const now = deps.now ?? (() => new Date())
  const c = new Ctx(opts, deps.measure ?? realMeasure, now)
  c.load()

  const plan: Array<[number, string, () => Promise<Body>]> = [
    [1, 'Provenance', () => provenance(c)],
    [2, 'Format', () => format(c)],
    [3, 'Length', () => length(c)],
    [4, 'Hook', () => hook(c)],
    [5, 'Holds', () => holds(c)],
    [6, 'Motion', () => motion(c)],
    [7, 'Sound', () => sound(c)],
    [8, 'Captions', () => captions(c)],
    [9, 'Numbers', () => numbers(c)],
    [10, 'Copy', () => copy(c)],
    [11, 'Safe area', () => safeArea(c)],
    [12, 'End card', () => endCard(c)],
    [13, 'Loop', () => loop(c)],
  ]
  if (opts.final) plan.push([14, 'Review', () => review(c)])
  plan.push([15, 'Techniques ran', () => techniquesRan(c)], [16, 'Not a repeat', () => notARepeat(c)])

  const checks: CheckResult[] = []
  for (const [id, name, fn] of plan) checks.push(await runCheck(id, name, fn))
  const pass = checks.every((k) => k.pass)

  let sha: string | null = null
  try {
    sha = await c.sha()
  } catch {
    sha = null
  }

  let ledger: CheckReport['ledger'] = null
  if (opts.final && pass && opts.recordInLedger !== false && c.ledgerEntry) {
    const path = opts.ledgerPath ?? FILM_LEDGER_PATH
    ledger = { path, appended: appendLedgerEntry(c.ledgerEntry, path), entry: c.ledgerEntry }
  }

  return {
    pass,
    final: opts.final === true,
    mp4: opts.mp4Path,
    manifest: c.manifest ? c.manifestPath : null,
    checkedAt: now().toISOString(),
    sha256: sha,
    checks,
    ledger,
  }
}
