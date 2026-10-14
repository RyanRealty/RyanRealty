/**
 * lib/studio/timeline/render.ts: brief + timeline in, film + manifest out.
 *
 * The one factory's renderer (docs/plans/STUDIO_ONE_FACTORY.md). Every Studio
 * video, from any bot, renders here, through the EXISTING motion stage:
 *
 *   validate  brief.json + timeline.json, strictly (validate.ts)
 *   footage   https clips downloaded once to a cache, every clip measured
 *   voice     ElevenLabs v3 with timestamps, cached; words and captions on the film clock (voice.ts)
 *   plan      cards, captions, the locked end card, the loop seam, the plate (plan.ts)
 *   §0        figureLeaks on the plan: a number with no brief.numbers row aborts
 *   plate     every beat's footage cut to the beat, cream paper, frame 0 under the end card (lib/video/plate.ts)
 *   sound     composeScore bed + the voice via mixVoiceOverScore, -14 LUFS
 *   draw      buildMotionPage + renderMotion: Chromium draws each frame over the plate, ffmpeg encodes
 *   §0 again  figureLeaks on what the page actually drew
 *   prove     each technique counts only when the page drew its proof
 *   manifest  measured from the file, validated with lib/studio/qa/manifest.ts, written beside final.mp4
 *
 * Never publishes and never writes under public/. Grok and Imagine are not
 * called: footage comes in as files or URLs.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { Browser } from 'puppeteer-core'
import { REPO_ROOT } from '../qa/thresholds'
import { MANIFEST_FACTORY, MANIFEST_VERSION, type Manifest, type ManifestText, type TextKind } from '../qa/manifest'
import { createMeasure, type Measure } from '../qa/measure'
import { composeScore, SAMPLE_RATE } from '../score'
import { parseWav } from '../voice/decode'
import { mixVoiceOverScore } from '../voice/mix'
import { manifestVoice } from '../voice/elevenlabs'
import type { StereoAudio } from '../voice/types'
import { loadMotionAssets, type MotionAssets } from '../motion/assets'
import { figureLeaks, frameState, stillTimes, type MotionCue } from '../motion/cues'
import { buildMotionPage } from '../motion/page'
import { renderMotion, type DrawnText } from '../motion/render'
import { scoreFor } from '../motion/sound'
import { buildPlate, type PlateRecord } from '@/lib/video/plate'
import { endcardStartSeconds, planFilm, type FilmPlan, type PlannedTechnique, type ResolvedFootage } from './plan'
import type { StudioBrief, Timeline, TimelineFootage } from './types'
import { formatIssues, parseBrief, parseTimeline } from './validate'
import { speakTimeline, type FilmVoice, type VoiceProvider } from './voice'
import { writeManifest } from './manifest'

export const FILM_WIDTH = 1080
export const FILM_HEIGHT = 1920

export class RenderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RenderError'
  }
}

export type RenderDeps = {
  ffmpeg: string
  voiceProvider: VoiceProvider
  launchBrowser: (viewport: { width: number; height: number }) => Promise<Browser>
  measure?: Measure
  loadAssets?: () => Promise<MotionAssets>
  /** Download a footage URL to a file. Default: fetch. */
  download?: (url: string, dest: string) => Promise<void>
  env?: NodeJS.ProcessEnv
  log?: (line: string) => void
}

export type RenderOptions = {
  brief: unknown
  timeline: unknown
  /** Where relative footage paths resolve from (the timeline file's folder). */
  baseDir: string
  /** The film's folder: final.mp4, final.manifest.json, final.brief.json and work/ land here. */
  outDir: string
  /** Footage downloads and voice syntheses are cached here across films. */
  cacheDir: string
  /** Who built the film (check 14 refuses a review by the same author). */
  builtBy?: string
  /** Override the voice id (tests); otherwise the named voice's environment variable. */
  voiceId?: string
}

export type TechniqueRecord = { name: string; ran: boolean; detail: string; why?: string }

export type RenderResult = {
  mp4Path: string
  manifestPath: string
  briefPath: string
  manifest: Manifest
  techniques: TechniqueRecord[]
  plate: PlateRecord[]
  film: FilmPlan
  voice: Pick<FilmVoice, 'model' | 'voiceId' | 'offset' | 'cached' | 'outputFormat'> | null
  audio: { lufs: number | null; truePeakDb: number | null; mixLufs: number | null; mixTruePeakDb: number | null }
  loopSsim: number | null
  notes: string[]
  ms: number
}

/** Refuse any output path under the repo's public/ folder: drafts never land where the site serves them. */
export function assertNotPublic(path: string): void {
  const rel = relative(REPO_ROOT, resolve(path))
  if (!rel.startsWith('..') && !isAbsolute(rel) && (rel === 'public' || rel.startsWith(`public${sep}`))) {
    throw new RenderError(`refusing to write a render under public/ (${path}); drafts go to out/`)
  }
}

async function defaultDownload(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) })
  if (!res.ok) throw new RenderError(`footage download failed: HTTP ${res.status} for ${url}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

function footageSources(timeline: Timeline): TimelineFootage[] {
  return [...timeline.beats.flatMap((b) => (b.footage ? [b.footage] : [])), ...(timeline.cta?.footage ? [timeline.cta.footage] : [])]
}

/** Every clip on disk and measured. URLs download once into the cache; local paths must exist. */
async function resolveFootage(
  timeline: Timeline,
  opts: { baseDir: string; cacheDir: string },
  measure: Measure,
  download: (url: string, dest: string) => Promise<void>,
  log: (line: string) => void,
): Promise<Record<string, ResolvedFootage>> {
  const out: Record<string, ResolvedFootage> = {}
  for (const f of footageSources(timeline)) {
    if (out[f.src]) continue
    let path: string
    if (/^https:\/\//i.test(f.src)) {
      const dir = join(opts.cacheDir, 'footage')
      mkdirSync(dir, { recursive: true })
      const ext = extname(new URL(f.src).pathname) || '.mp4'
      path = join(dir, `${createHash('sha256').update(f.src).digest('hex').slice(0, 24)}${ext}`)
      if (!existsSync(path)) {
        log(`footage: downloading ${f.src}`)
        await download(f.src, path)
      }
    } else {
      path = isAbsolute(f.src) ? f.src : resolve(opts.baseDir, f.src)
      if (!existsSync(path)) throw new RenderError(`footage ${f.src} does not exist (looked at ${path})`)
    }
    const probe = await measure.probe(path)
    out[f.src] = { path, width: probe.width, height: probe.height, duration: probe.videoDuration }
  }
  return out
}

const opacityTables = new WeakMap<FilmPlan, Array<Map<string, number>>>()

/** Every element's opacity on every frame, computed once per film from the same frameState the page applied. */
function opacityTable(film: FilmPlan): Array<Map<string, number>> {
  let table = opacityTables.get(film)
  if (!table) {
    table = []
    for (let i = 0; i < film.frames; i++) table.push(new Map(frameState(film.plan, i / film.fps).map((s) => [s.id, s.opacity])))
    opacityTables.set(film, table)
  }
  return table
}

/** Contiguous runs of frames on which an element is readable (opacity at least 0.5). */
export function visibleSpans(film: FilmPlan, elementId: string): Array<{ start: number; end: number }> {
  const table = opacityTable(film)
  const spans: Array<{ start: number; end: number }> = []
  let open: number | null = null
  for (let i = 0; i < film.frames; i++) {
    const on = (table[i].get(elementId) ?? 0) >= 0.5
    if (on && open === null) open = i
    if (!on && open !== null) {
      spans.push({ start: open / film.fps, end: i / film.fps })
      open = null
    }
  }
  if (open !== null) spans.push({ start: open / film.fps, end: film.frames / film.fps })
  return spans.map((s) => ({ start: round3(s.start), end: round3(s.end) }))
}

const round3 = (n: number) => Math.round(n * 1000) / 1000
const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

function kindFor(cue: MotionCue): TextKind {
  if (cue.kind === 'caption') return 'caption'
  if (cue.kind === 'cta') return 'cta'
  if (cue.kind === 'endcard') return 'endcard'
  return 'card'
}

/** The probe times: each card's settled still, each caption's middle, the end card's golden frame, every proof. */
function probeTimes(film: FilmPlan): Map<string, number> {
  const times = new Map<string, number>()
  for (const s of stillTimes(film.plan)) times.set(s.cueId, s.t)
  return times
}

/**
 * The manifest's texts from what the page drew: every visible text node of
 * each cue at its settled still, with its box; its time on screen from the
 * plan's own curves (the same frameState the page applied).
 */
export function textsFromProbes(
  film: FilmPlan,
  probed: Array<{ t: number; texts: DrawnText[] }>,
): { texts: ManifestText[]; missing: string[] } {
  const stills = probeTimes(film)
  const texts: ManifestText[] = []
  const missing: string[] = []
  for (const cue of film.plan.cues) {
    const t = stills.get(cue.id)
    const probe = t === undefined ? undefined : probed.find((p) => Math.abs(p.t - t) < 1e-9)
    const drawn = probe ? probe.texts.filter((d) => d.cue === cue.id) : []
    if (drawn.length === 0) {
      missing.push(`${cue.id} (${cue.kind}) drew no text at ${t}s`)
      continue
    }
    if (cue.kind === 'endcard') {
      const T = cue.times
      const when: Record<string, number> = {
        [cue.words[0]]: T.quality,
        [cue.words[1]]: T.local,
        [cue.words[2]]: T.service,
        [cue.cta]: T.call,
        [cue.phone]: T.call,
      }
      for (const d of drawn) {
        const start = when[squash(d.text)] ?? T.start
        texts.push({ text: squash(d.text), start: round3(start), end: round3(T.out), box: boxOf(d), kind: 'endcard' })
      }
      continue
    }
    const spans =
      cue.kind === 'caption' ? [{ start: cue.start, end: cue.end }] : visibleSpans(film, `${cue.id}-card`)
    for (const span of spans) {
      for (const d of drawn) {
        const text = squash(d.text)
        if (!text) continue
        texts.push({ text, start: round3(span.start), end: round3(span.end), box: boxOf(d), kind: kindFor(cue) })
      }
    }
  }
  return { texts: texts.sort((a, b) => a.start - b.start), missing }
}

function boxOf(d: DrawnText): ManifestText['box'] {
  return { x: round3(d.x), y: round3(d.y), w: round3(d.w), h: round3(d.h) }
}

/** A technique counts only when every proof text was on the page at its time. */
export function proveTechniques(
  planned: PlannedTechnique[],
  probed: Array<{ t: number; texts: DrawnText[] }>,
  extra: { scored: boolean; loopRan: boolean },
): TechniqueRecord[] {
  return planned.map((p) => {
    if (p.name === 'composed_score') return { name: p.name, ran: extra.scored, detail: p.detail, ...(extra.scored ? {} : { why: 'no score was mixed into the file' }) }
    if (p.name === 'loop_seam_edit') return { name: p.name, ran: extra.loopRan, detail: p.detail, ...(extra.loopRan ? {} : { why: 'the seam did not run' }) }
    const failed = p.proofs.filter((proof) => {
      const probe = probed.find((x) => Math.abs(x.t - proof.t) < 1e-9)
      return !probe?.texts.some((d) => d.cue === proof.cue && squash(d.text) === squash(proof.text))
    })
    if (p.proofs.length === 0 || failed.length) {
      return {
        name: p.name,
        ran: false,
        detail: p.detail,
        why: failed.length ? `not drawn: ${failed.map((f) => `"${f.text}" (${f.cue}) at ${f.t}s`).join(', ')}` : 'no proof',
      }
    }
    return { name: p.name, ran: true, detail: p.detail }
  })
}

export async function renderTimelineFilm(opts: RenderOptions, deps: RenderDeps): Promise<RenderResult> {
  const started = Date.now()
  const log = deps.log ?? (() => undefined)
  const measure = deps.measure ?? createMeasure()
  const env = deps.env ?? process.env
  assertNotPublic(opts.outDir)

  const b = parseBrief(opts.brief)
  const t = parseTimeline(opts.timeline)
  const issues = [...(b.ok ? [] : b.issues.map((i) => ({ ...i, path: `brief.${i.path}` }))), ...(t.ok ? [] : t.issues.map((i) => ({ ...i, path: `timeline.${i.path}` })))]
  if (!b.ok || !t.ok) throw new RenderError(`the brief or timeline is not valid:\n${formatIssues(issues)}`)
  const brief: StudioBrief = b.value
  const timeline: Timeline = t.value

  const briefScript = brief.spec_rules?.voiceover?.script
  if (timeline.voice && briefScript && briefScript.trim() !== timeline.voice.script.trim()) {
    throw new RenderError('the brief approved one voiceover script (spec_rules.voiceover.script) and the timeline speaks another; make them identical')
  }

  mkdirSync(opts.outDir, { recursive: true })
  const work = join(opts.outDir, 'work')
  mkdirSync(work, { recursive: true })

  // Footage, measured.
  const footage = await resolveFootage(timeline, opts, measure, deps.download ?? defaultDownload, log)

  // The voice and its captions, on the film clock.
  let voice: FilmVoice | null = null
  if (timeline.voice) {
    voice = await speakTimeline(timeline.voice, {
      provider: deps.voiceProvider,
      cacheDir: join(opts.cacheDir, 'voice'),
      ffmpeg: deps.ffmpeg,
      captionsUntil: endcardStartSeconds(timeline),
      env,
      voiceId: opts.voiceId,
    })
    log(`voice: ${voice.words.length} words, ${voice.captions.length} captions, ${voice.cached ? 'from the cache' : 'synthesized'} (${voice.model})`)
  }

  const scored = Boolean(timeline.score)
  const film = planFilm({ brief, timeline, voice, footage, scored })
  const notes = [...film.notes]

  // §0: no number on screen without a brief.numbers row.
  const planned = figureLeaks(film.plan, film.subject)
  if (planned.length) throw new RenderError(`unverified number on screen (no brief.numbers row): ${planned.join(', ')}`)

  // The plate.
  const plate = await buildPlate({ ffmpeg: deps.ffmpeg, segments: film.segments, outPath: join(work, 'plate.mp4') })
  if (plate.frames !== film.frames) throw new RenderError(`the plate has ${plate.frames} frames; the film needs ${film.frames}`)
  log(`plate: ${plate.records.map((r) => `${r.label ?? r.kind} ${r.kind}${r.crop ? ` x${r.crop.scale}` : ''} ${r.seconds}s`).join(', ')}`)

  // The sound: the score as the bed, the voice over it.
  let audioPath: string | null = null
  let mixLufs: number | null = null
  let mixTruePeakDb: number | null = null
  const seed = createHash('sha256').update(`${brief.title}|${brief.video_type}`).digest('hex').slice(0, 16)
  const samples = Math.round(film.duration * SAMPLE_RATE)
  let scoreAudio: StereoAudio = { left: new Float32Array(samples), right: new Float32Array(samples) }
  let scoreRan = false
  if (timeline.score) {
    const input = scoreFor(film.plan, { lead: 'market', closer: 'brand', sound: timeline.score }, film.subject, seed)
    if (!input) throw new RenderError('the score had nothing to follow')
    const composed = composeScore({ ...input, duration: film.duration })
    const parsed = parseWav(composed.wav)
    if (!parsed) throw new RenderError('the composed score did not parse')
    scoreAudio = { left: parsed.left, right: parsed.right }
    scoreRan = true
    if (!voice) {
      audioPath = join(work, 'mix.wav')
      writeFileSync(audioPath, composed.wav)
      mixLufs = composed.report.lufs
      mixTruePeakDb = composed.report.truePeakDb
    }
  }
  if (voice) {
    const mixed = mixVoiceOverScore({ score: scoreAudio, voice: voice.audio, words: voice.voiceWords }, { voiceOffsetSeconds: voice.offset, seed })
    audioPath = join(work, 'mix.wav')
    writeFileSync(audioPath, mixed.wav)
    mixLufs = mixed.report.lufs
    mixTruePeakDb = mixed.report.truePeakDb
    notes.push(...mixed.report.warnings.map((w) => `mix: ${w}`))
  }

  // Draw: the existing motion stage over the plate.
  const assets = await (deps.loadAssets ?? (() => loadMotionAssets()))()
  const html = buildMotionPage({ plan: film.plan, width: FILM_WIDTH, height: FILM_HEIGHT, assets })
  const probes = new Set<number>()
  for (const s of stillTimes(film.plan)) probes.add(s.t)
  for (const p of film.techniques) for (const proof of p.proofs) probes.add(proof.t)
  const rendered = await renderMotion({
    plan: film.plan,
    html,
    width: FILM_WIDTH,
    height: FILM_HEIGHT,
    fps: film.fps,
    basePath: plate.path,
    audioPath,
    ffmpeg: deps.ffmpeg,
    stills: [],
    probes: [...probes].sort((a, c) => a - c),
    launchBrowser: deps.launchBrowser,
  })
  if (rendered.frames !== film.frames) throw new RenderError(`rendered ${rendered.frames} frames, planned ${film.frames}`)
  const probed = rendered.probed ?? []

  // §0 again, on what the page actually drew.
  const drawn = figureLeaks(film.plan, film.subject, rendered.renderedText)
  if (drawn.length) throw new RenderError(`unverified number rendered: ${drawn.join(', ')}`)

  const mp4Path = join(opts.outDir, 'final.mp4')
  writeFileSync(mp4Path, rendered.body)

  // Measure the file, not the plan.
  const probe = await measure.probe(mp4Path)
  const sha256 = await measure.sha256(mp4Path)
  let lufs: number | null = null
  let truePeakDb: number | null = null
  if (probe.hasAudio) {
    const l = await measure.loudness(mp4Path)
    lufs = l.integratedLufs
    truePeakDb = l.truePeakDb
  }
  let loopSsim: number | null = null
  if (film.loop) {
    const first = await measure.frameAt(mp4Path, 0)
    let last: Buffer | null = null
    for (let back = 1; back <= 4 && !last; back++) {
      try {
        last = await measure.frameAt(mp4Path, Math.max(0, probe.videoDuration - back / probe.fps))
      } catch {
        last = null
      }
    }
    if (last) loopSsim = Math.round((await measure.ssim(last, first)) * 10000) / 10000
  }

  // What ran, proven off the page.
  const techniques = proveTechniques(film.techniques, probed, { scored: scoreRan && Boolean(audioPath), loopRan: Boolean(film.loop) })
  for (const tech of techniques.filter((x) => !x.ran)) notes.push(`technique ${tech.name} did not run: ${tech.why}`)

  const { texts, missing } = textsFromProbes(film, probed)
  if (missing.length) throw new RenderError(`the page did not draw what the plan asked: ${missing.join('; ')}`)

  const manifest: Manifest = {
    factory: MANIFEST_FACTORY,
    manifestVersion: MANIFEST_VERSION,
    video: { file: 'final.mp4', sha256, width: probe.width, height: probe.height, fps: Math.round(probe.fps * 1000) / 1000, duration: Math.round(probe.duration * 1000) / 1000 },
    videoType: brief.video_type,
    techniques: techniques.filter((x) => x.ran).map((x) => x.name),
    beats: film.beats,
    texts,
    numbers: film.numbers,
    voice: voice ? manifestVoice(voice, voice.words) : null,
    captions: voice ? voice.captions : [],
    audio: { lufs, truePeakDb, silent: !probe.hasAudio },
    endcard: film.endcard
      ? { start: film.endcard.start, quality: film.endcard.quality, local: film.endcard.local, service: film.endcard.service, call: film.endcard.call, out: film.endcard.out }
      : null,
    loop: film.loop,
    builtBy: opts.builtBy ?? 'claude',
    briefTechniques: brief.techniques,
  }
  const manifestPath = join(opts.outDir, 'final.manifest.json')
  writeManifest(manifestPath, manifest)
  const briefPath = join(opts.outDir, 'final.brief.json')
  writeFileSync(briefPath, `${JSON.stringify(opts.brief, null, 2)}\n`)
  writeFileSync(join(work, 'plate.json'), `${JSON.stringify(plate.records, null, 2)}\n`)

  return {
    mp4Path,
    manifestPath,
    briefPath,
    manifest,
    techniques,
    plate: plate.records,
    film,
    voice: voice ? { model: voice.model, voiceId: voice.voiceId, offset: voice.offset, cached: voice.cached, outputFormat: voice.outputFormat } : null,
    audio: { lufs, truePeakDb, mixLufs, mixTruePeakDb },
    loopSsim,
    notes,
    ms: Date.now() - started,
  }
}

/** Read a JSON file, with the path in the error. */
export function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new RenderError(`could not read ${path}: ${(e as Error).message}`)
  }
}
