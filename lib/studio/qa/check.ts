/**
 * lib/studio/qa/check.ts - the measured output check (`npm run video:check`).
 *
 * checkVideo opens the finished MP4, measures it, and holds it to the contract in
 * docs/plans/STUDIO_ONE_FACTORY.md: the seventeen checks in its table, numbered
 * as there. The review (14) runs only with `final: true`; on a final pass the
 * film is also recorded in the film ledger (see ledger.ts). Check 17 reads the
 * pixels back against the manifest (pixels.ts), so a hand-written manifest
 * cannot claim what the film does not show.
 *
 * A final run uses the committed golden still, ledger, registry and type rules
 * only: an override path is refused with --final, and recorded in the report
 * when used on a draft run.
 *
 * Rule that outranks all others here: a check that cannot be measured FAILS. Any
 * missing input (no manifest, no brief where one is needed, no golden still, an
 * ffmpeg error) turns into a failed check with the reason in `detail`. Nothing
 * passes by default.
 *
 * Measurement goes through an injected `Measure`, so the logic is tested with
 * fakes (check.test.ts) and against real ffmpeg (check.int.test.ts).
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import {
  captionProblems,
  beatHoldProblems,
  captionPresenceProblem,
  computeShots,
  endcardStartFromPixels,
  evaluateLength,
  missingVoiceProblem,
  requiredPartProblem,
  shotsCutoff,
  evaluateCaptions,
  evaluateCopy,
  evaluateVerdictWords,
  evaluateEndcardTiming,
  evaluateHook,
  evaluateNumbers,
  evaluateReview,
  evaluateSafeArea,
  judgeLoudness,
  numberProblems,
  round,
  shortHolds,
  silentFilmDeclared,
  voiceoverRequired,
  type ReviewFile,
} from './evaluate'
import { appendLedgerEntry, buildLedgerEntry, comparedCount, findRepeat, readLedger, repeatProblem, unusedCombinations, type LedgerEntry } from './ledger'
import {
  MANIFEST_FACTORY,
  formatManifestIssues,
  parseManifestJson,
  safeSlug,
  type Manifest,
} from './manifest'
import { measure as realMeasure, type Measure, type ProbeResult } from './measure'
import { checkName } from './phases'
import {
  boxClaims,
  captionsWithoutBoxes,
  claimConfirmed,
  createPixelProbe,
  gateFindings,
  listedFigures,
  unlistedFigures,
  type PixelProbe,
} from './pixels'
import { evaluateTechniques, loadCheckedTechniqueRegistry, techniqueProblems, type TechniqueRegistry } from './techniques'
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
  /** Defaults to data/studio/film-ledger.jsonl. Refused with `final`. */
  ledgerPath?: string
  /** On a final pass, append the film to the ledger (default true). */
  recordInLedger?: boolean
  /** Refused with `final`. */
  typesPath?: string
  /** Refused with `final`. */
  registryPath?: string
}

/** The four paths a final run may not override: the golden still, the ledger, the registry, the type rules. */
export const FINAL_LOCKED_OPTIONS = ['golden', 'ledgerPath', 'registryPath', 'typesPath'] as const

export interface CheckDeps {
  measure?: Measure
  /** Check 17's OCR and render gate. Default: python3 + opencv + tesseract. */
  pixels?: PixelProbe
  now?: () => Date
  /**
   * Test seam only (never reachable from the command line): stand-in paths for
   * the golden still, ledger, registry and type rules, allowed on a final run
   * so the tests can record into a scratch ledger.
   */
  testPaths?: { golden?: string; ledgerPath?: string; registryPath?: string; typesPath?: string }
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
  /** Override paths this run used instead of the committed ones (never on a final run). */
  overrides: Record<string, string>
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
  /** sha256 of the brief file's bytes, as read. */
  briefSha256: string | null = null
  briefProblem = ''
  types: VideoTypesFile | null = null
  typesProblem = ''
  rules: TypeRules | null = null
  rulesProblem = ''
  ledgerEntry: LedgerEntry | null = null
  /** True when the registry came from CheckDeps.testPaths (a test), never from the CLI. */
  registryTestOnly = false
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
        const bytes = readFileSync(candidate)
        this.briefSha256 = createHash('sha256').update(bytes).digest('hex')
        const raw = JSON.parse(bytes.toString('utf8')) as unknown
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) this.brief = raw as Record<string, unknown>
        else this.briefProblem = `${candidate} is not a JSON object`
      } catch (e) {
        this.briefProblem = `could not read the brief ${candidate}: ${(e as Error).message}`
      }
    }

    if (!this.brief && !this.briefProblem) this.briefProblem = `no brief beside the film (${candidate})`
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

  /**
   * Where the pixels show the end card starting (evaluate.ts
   * endcardStartFromPixels), measured once for checks 5 and 12. Null when the
   * manifest has no end card or the golden probe frame is not the cream card.
   */
  endcardFromPixels(): Promise<number | null> {
    return this.once('endcardFromPixels', async () => {
      const ec = this.manifest?.endcard
      if (!ec) return null
      const probeT = ec.call + T.endcard.callProbeOffsetSeconds
      const fractions = await this.measure.creamFractions(this.opts.mp4Path, Math.max(0, probeT - 8), probeT + 0.05)
      return endcardStartFromPixels(fractions, probeT)
    })
  }

  noManifest(expected: CheckValue): Body {
    return bad(null, expected, `cannot be measured: no valid manifest (${this.manifestProblem})`)
  }

  noRules(expected: CheckValue): Body {
    return bad(null, expected, `cannot be measured: ${this.rulesProblem}`)
  }

  /** Does this film need a voiceover (its type, or its brief's spec_rules.voiceover)? */
  voiceRequired(): boolean {
    return voiceoverRequired(this.rules, this.brief)
  }
}

// ---------------------------------------------------------------------------
// The checks

async function provenance(c: Ctx): Promise<Body> {
  const expected = { manifest: 'present and valid', sha256: 'equals manifest.video.sha256', briefSha256: 'equals manifest.briefSha256', factory: MANIFEST_FACTORY }
  const m = c.manifest
  if (!m) return c.noManifest(expected)
  const actual = await c.sha()
  const problems: string[] = []
  if (actual !== m.video.sha256) problems.push(`the file's sha256 ${actual.slice(0, 12)} differs from the manifest's ${m.video.sha256.slice(0, 12)}`)
  if (m.factory !== MANIFEST_FACTORY) problems.push(`factory is "${m.factory}", not "${MANIFEST_FACTORY}"`)
  // The brief the film was rendered from, unchanged since.
  if (!c.brief || !c.briefSha256) problems.push(`no brief to hold the film to: ${c.briefProblem}`)
  else {
    if (c.briefSha256 !== m.briefSha256) problems.push(`the brief's sha256 ${c.briefSha256.slice(0, 12)} differs from the one the film was rendered from (${m.briefSha256.slice(0, 12)}): the brief changed after the render`)
    const briefType = c.brief.video_type
    if (briefType !== m.videoType) problems.push(`the brief says video_type ${JSON.stringify(briefType ?? null)} but the manifest says "${m.videoType}"`)
    const slugFrom = typeof c.brief.slug === 'string' ? c.brief.slug : typeof c.brief.title === 'string' ? c.brief.title : ''
    if (slugFrom && safeSlug(slugFrom) !== m.slug) problems.push(`the manifest's slug "${m.slug}" is not the brief's ("${safeSlug(slugFrom)}")`)
  }
  return verdict(
    problems,
    { sha256: actual, manifestSha256: m.video.sha256, briefSha256: c.briefSha256, manifestBriefSha256: m.briefSha256, factory: m.factory, videoType: m.videoType, slug: m.slug },
    expected,
    `hash matches, brief unchanged since the render, built by ${m.factory}`,
  )
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
  const reason = typeof c.brief?.length_reason === 'string' ? c.brief.length_reason.trim() : ''
  const problems = evaluateLength(d, r, reason).map((x) => (x.includes('length_reason') && !c.brief ? `${x} (${c.briefProblem || 'no brief supplied'})` : x))
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
  const beatProblems = beatHoldProblems(m.beats, r.min_hold_s)
  // The end card start the PIXELS support, not the manifest's word alone (evaluate.ts shotsCutoff).
  const measuredStart = m.endcard ? await c.endcardFromPixels() : null
  const { shots, ignoredCuts } = computeShots(cuts, p.duration, shotsCutoff(m.endcard ? m.endcard.start : null, measuredStart))
  const shortShots = shortHolds(shots, r.min_hold_s)
  const problems = [...beatProblems, ...shortShots.map((s) => `shot ${s.start}s to ${s.end}s holds ${s.duration}s (minimum ${r.min_hold_s}s)`)]
  const shortest = shots.length ? Math.min(...shots.map((s) => s.duration)) : null
  return verdict(
    problems,
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
  const expected = { lufs: `${a.lufsMin} to ${a.lufsMax}`, truePeakDbAtMost: a.truePeakMaxDb, voiceover: 'present when the type or brief asks for one' }
  const p = await c.probe()
  const m = c.manifest
  if (!m) return bad({ audioStream: p.hasAudio }, expected, `cannot be measured: no valid manifest (${c.manifestProblem})`)
  if (!c.rules) return c.noRules(expected)
  const required = c.voiceRequired()
  const voiceProblem = missingVoiceProblem(m.voice, required, m.videoType)
  if (!p.hasAudio) {
    if (silentFilmDeclared(m.voice, m.audio, required)) return done({ audioStream: false, voiceRequired: false }, expected, 'a silent film, declared silent in the manifest, of a type and brief that ask for no voiceover')
    const why = voiceProblem ?? (m.voice ? 'the film has a voiceover' : required ? 'the type or brief asks for a voiceover' : 'the manifest does not declare the film silent')
    return bad({ audioStream: false, voiceRequired: required }, expected, `no audio stream in the file; ${why}`)
  }
  if (m.audio.silent) return bad({ audioStream: true }, expected, 'the manifest says the film is silent but the file has an audio stream')
  const l = await c.once('loudness', () => c.measure.loudness(c.opts.mp4Path))
  const j = judgeLoudness(l.integratedLufs, l.truePeakDb)
  const problems = [...(voiceProblem ? [voiceProblem] : []), ...j.problems]
  return verdict(problems, { integratedLufs: l.integratedLufs, truePeakDb: l.truePeakDb, voiceRequired: required, voice: m.voice !== null }, expected, `${l.integratedLufs} LUFS, true peak ${l.truePeakDb} dBTP${m.voice ? ', with its voiceover' : ''}`)
}

async function captions(c: Ctx): Promise<Body> {
  const m = c.manifest
  const k = T.caption
  const expected = { maxWords: k.maxWords, minSeconds: k.minSeconds, syncSeconds: k.syncSeconds, everySpokenWordShown: true }
  if (!m) return c.noManifest(expected)
  if (!c.rules) return c.noRules(expected)
  const required = c.voiceRequired()
  const presence = captionPresenceProblem(m.voice, m.captions, required, m.videoType)
  if (presence) return bad({ voice: m.voice ? m.voice.words.length : null, captions: m.captions.length }, expected, presence)
  if (m.voice === null) return done({ voice: null }, expected, 'a type and brief with no voiceover, so there are no spoken words to caption')
  const f = evaluateCaptions(m.voice, m.captions)
  return verdict(captionProblems(f), { ...f }, expected, `${f.captions} captions cover all ${f.spokenWords} spoken words, in sync`)
}

async function numbers(c: Ctx): Promise<Body> {
  const m = c.manifest
  const expected = { everyFigureHasARowThatIsThatFigure: true, spokenFiguresShownAsSourcedFigures: true, rowFields: 'source, window, geography, definition' }
  if (!m) return c.noManifest(expected)
  const f = evaluateNumbers(m.texts, m.captions, m.numbers, m.voice)
  return verdict(
    numberProblems(f),
    { ...f },
    expected,
    f.tokens.length || f.spoken.length
      ? `${f.tokens.length} figure(s) on screen and ${f.spoken.length} said in words, each with its own complete numbers row`
      : 'no figures on screen or in the voice',
  )
}

async function copy(c: Ctx): Promise<Body> {
  const m = c.manifest
  const expected = { dashes: 0, bannedPhrases: 0, fairHousingFlags: 0, addresses: 0, names: 0 }
  if (!m) return c.noManifest(expected)
  if (!c.types) return bad(null, expected, `cannot be measured: ${c.typesProblem}`)
  const hits = [
    ...evaluateCopy(m.texts, m.captions, m.voice, bannedPhrases(c.types), c.types.fair_housing_flags),
    ...evaluateVerdictWords(m.numbers, m.texts, m.captions, m.voice),
  ]
  return verdict(
    hits.map((h) => `${h.what} in ${h.where}`),
    { hits: hits.map((h) => `${h.what} in ${h.where}`) },
    expected,
    'no dashes, banned phrases, fair housing flags, addresses or names, and no verdict words that disagree with a months-of-supply figure',
  )
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
  const expected = { order: 'start, Quality, Local, Service, Call now, out', startIsTheEndCardBeat: true, startNotBeforeThePixels: true, wordPopsAtMost: e.wordPopBudgetSeconds, callHoldAtLeast: e.callHoldMinSeconds, ssimAtLeast: e.ssimMin }
  if (!m) return c.noManifest(expected)
  if (!c.rules) return c.noRules(expected)
  if (!m.endcard) {
    const missing = requiredPartProblem('end card', false, c.rules.requires_end_card, m.videoType)
    return missing ? bad({ endcard: null }, expected, missing) : done({ endcard: null }, expected, `${m.videoType} does not require an end card`)
  }
  const p = await c.probe()
  const timing = evaluateEndcardTiming(m.endcard, m.beats, p.videoDuration)
  const problems = [...timing.problems]
  // The card's start as the pixels show it: a start claimed earlier would let check 5 skip real cuts.
  const fromPixels = await c.endcardFromPixels()
  if (fromPixels === null) problems.push(`the frame at Call now + ${e.callProbeOffsetSeconds}s is not the cream end card`)
  else if (m.endcard.start < fromPixels - 0.1) problems.push(`the manifest starts the end card at ${round(m.endcard.start)}s but the pixels show it from ${round(fromPixels)}s`)
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
    { wordsSpan: timing.wordsSpan, callHold: timing.callHold, startFromPixels: fromPixels, ssim: score === null ? null : round(score, 4), golden },
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
    const missing = requiredPartProblem('loop', false, c.rules.requires_loop, m.videoType)
    return missing ? bad({ loop: null }, expected, missing) : done({ loop: null }, expected, `${m.videoType} does not require a loop`)
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

/**
 * The registry, approved rows' reels checked (repo files on disk, https reels by HEAD).
 * A registry a test handed in (CheckDeps.testPaths) approves only with TEST_APPROVER;
 * the committed file and a CLI --registry approve only with "matt".
 */
function loadRegistry(c: Ctx): Promise<TechniqueRegistry> {
  return c.once('registry', () => loadCheckedTechniqueRegistry(c.opts.registryPath, { testOnly: c.registryTestOnly }))
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
  const registry = await loadRegistry(c)
  const ev = evaluateTechniques(briefList, m.techniques, registry)
  const problems = techniqueProblems(briefList, m.techniques, registry)
  return verdict(
    problems,
    { briefTechniques: briefList, ran: m.techniques, byCategory: ev.byCategory as CheckValue, notRun: ev.notRun, missingCategories: ev.missingCategories },
    expected,
    `all ${briefList.length} brief technique(s) ran; ${REQUIRED_TECHNIQUE_CATEGORIES.join(', ')} each covered`,
  )
}

async function notARepeat(c: Ctx): Promise<Body> {
  const m = c.manifest
  const expected = { notSameHookAndSceneSetAsLast: LEDGER_WINDOW, sameVideoType: true, revisionsOfTheSameSlug: 'not a repeat' }
  if (!m) return c.noManifest(expected)
  const registry = await loadRegistry(c)
  const sha = await c.sha()
  const built = buildLedgerEntry({ sha256: sha, slug: m.slug, videoType: m.videoType, techniques: m.techniques, checkedAt: c.now().toISOString() }, registry)
  if (!built.ok) return bad({ hookDevice: null, sceneSet: [] }, expected, `cannot be compared: ${built.reason}`)
  const ledgerPath = c.opts.ledgerPath ?? FILM_LEDGER_PATH
  const ledger = readLedger(ledgerPath)
  if (ledger.errors.length) return bad({ ledger: ledgerPath }, expected, `the ledger is damaged: ${ledger.errors.slice(0, 3).join('; ')}`)
  c.ledgerEntry = built.entry
  const repeat = findRepeat(built.entry, ledger.entries)
  const compared = comparedCount(built.entry, ledger.entries)
  const measured = { hookDevice: built.entry.hookDevice, sceneSet: built.entry.sceneSet, slug: m.slug, compared, repeatOf: repeat ? repeat.sha256.slice(0, 12) : null }
  const problem = repeatProblem(built.entry, ledger.entries, registry)
  if (problem) return bad({ ...measured, unusedReadyCombinations: unusedCombinations(built.entry, ledger.entries, registry) }, expected, problem)
  return done(measured, expected, `hook "${built.entry.hookDevice}" with scenes [${built.entry.sceneSet.join(', ')}] differs from the last ${compared} other ${m.videoType} film(s)`)
}

async function pixels(c: Ctx, probe: PixelProbe): Promise<Body> {
  const m = c.manifest
  const expected = { renderGate: 'passes (LENGTH is check 3)', claimedTextsReadOffTheirBoxes: 'all', unlistedFiguresInThePixels: 0, ocrTooling: 'installed' }
  if (!m) return c.noManifest(expected)
  if (!c.rules) return c.noRules(expected)
  const missing = await probe.missingTooling()
  if (missing) return bad({ ocrTooling: 'missing' }, expected, `cannot be measured, so it fails: ${missing}`)
  const words = m.voice?.words ?? []
  const silent = m.voice === null && m.audio.silent && !c.voiceRequired()
  const gate = await probe.gate(c.opts.mp4Path, {
    videoType: m.videoType,
    silent,
    voStart: words.length ? words[0].start : null,
    voEnd: words.length ? words[words.length - 1].end : null,
  })
  const { kept, dropped } = gateFindings(gate.fails, m, c.rules)
  const problems = kept.map((f) => `render gate: ${f}`)

  // Every claimed text, read off its own box at its own time.
  const claims = boxClaims(m)
  const notShown: string[] = []
  for (const claim of claims) {
    const reading = await probe.readBox(c.opts.mp4Path, claim.t, claim.box, claim.mode)
    if (!claimConfirmed(reading, claim.text)) notShown.push(`${claim.kind} "${claim.text}" at ${claim.t}s (read "${reading.slice(0, 60)}")`)
  }
  problems.push(...notShown.map((x) => `the pixels do not show ${x}`))
  const boxless = captionsWithoutBoxes(m)
  problems.push(...boxless.map((t) => `caption "${t}" has no drawn box in texts, so the pixels cannot confirm it`))

  // Figures the pixels show that the manifest does not list.
  const unlisted = unlistedFigures(gate.samples, listedFigures(m), m.endcard ? m.endcard.start : null)
  problems.push(...unlisted.map((u) => `the pixels show a figure the manifest does not list: ${u}`))

  return verdict(
    problems,
    {
      gateFails: kept,
      gateDropped: dropped,
      claims: claims.length,
      confirmed: claims.length - notShown.length,
      notShown,
      captionsWithoutBoxes: boxless,
      unlistedFigures: unlisted,
      samples: gate.samples.length,
    },
    expected,
    `render gate passed${dropped.length ? ` (${dropped.length} finding(s) left to other checks)` : ''}; all ${claims.length} claimed texts read off their boxes; no unlisted figure in ${gate.samples.length} OCR samples`,
  )
}

// ---------------------------------------------------------------------------
// Orchestration

/** Every check, by its number in the contract (phases.ts classifies each as preflight or file-only). */
const RUNNERS: Record<number, (c: Ctx, probe: PixelProbe) => Promise<Body>> = {
  1: provenance,
  2: format,
  3: length,
  4: hook,
  5: holds,
  6: motion,
  7: sound,
  8: captions,
  9: numbers,
  10: copy,
  11: safeArea,
  12: endCard,
  13: loop,
  14: review,
  15: techniquesRan,
  16: notARepeat,
  17: pixels,
}

/** The check numbers video:check runs, in order (14 only with final). */
export const CHECK_IDS: readonly number[] = Object.keys(RUNNERS).map(Number).sort((a, b) => a - b)

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
  const overrides: Record<string, string> = {}
  for (const key of FINAL_LOCKED_OPTIONS) {
    const v = opts[key]
    if (typeof v === 'string' && v !== '') overrides[key] = v
  }
  if (opts.final && Object.keys(overrides).length) {
    throw new Error(`a final check uses the committed golden still, ledger, registry and type rules; refusing ${Object.keys(overrides).join(', ')} with final`)
  }
  const effective: CheckOptions = { ...opts, ...(deps.testPaths ?? {}) }
  const c = new Ctx(effective, deps.measure ?? realMeasure, now)
  c.registryTestOnly = Boolean(deps.testPaths?.registryPath)
  c.load()
  const probe = deps.pixels ?? createPixelProbe()

  const plan = CHECK_IDS.filter((id) => id !== 14 || opts.final).map((id) => [id, checkName(id), () => RUNNERS[id](c, probe)] as const)

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
    const path = effective.ledgerPath ?? FILM_LEDGER_PATH
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
    overrides,
  }
}
