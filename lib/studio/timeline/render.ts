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
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { Browser } from 'puppeteer-core'
import { FILM_LEDGER_PATH, REPO_ROOT, loadVideoTypes, typeRulesFor } from '../qa/thresholds'
import { MANIFEST_FACTORY, MANIFEST_VERSION, safeSlug, type Manifest } from '../qa/manifest'
import { layoutPreflight, planPreflight, plannedManifest, refuse, textPreflight, type PreflightContext } from './preflight'
import { readLedger } from '../qa/ledger'
import { loadCheckedTechniqueRegistry } from '../qa/techniques'
import { createMeasure, type Measure } from '../qa/measure'
import { composeScore, SAMPLE_RATE } from '../score'
import { parseWav } from '../voice/decode'
import { mixVoiceOverScore } from '../voice/mix'
import { manifestVoice } from '../voice/elevenlabs'
import type { StereoAudio } from '../voice/types'
import { loadMotionAssets, type MotionAssets } from '../motion/assets'
import { figureLeaks, stillTimes } from '../motion/cues'
import { buildMotionPage } from '../motion/page'
import { probeMotionLayout, renderMotion, type DrawnText } from '../motion/render'
import { scoreFor } from '../motion/sound'
import { buildPlate, type PlateRecord } from '@/lib/video/plate'
import { endcardStartSeconds, planFilm, type FilmPlan, type PlannedTechnique, type ResolvedFootage } from './plan'
import type { OutlineGeoType, StudioBrief, Timeline, TimelineFootage } from './types'
import { findOutline, formatIssues, parseBrief, parseTimeline } from './validate'
import type { LngLatRing, MotionOutline } from '../motion/map'
import { speakTimeline, type FilmVoice, type VoiceProvider } from './voice'
import { writeManifest } from './manifest'
import { boundNumbers, squash, textsFromDrawn, textsFromProbes, visibleSpans } from './texts'

export { boundNumbers, textsFromDrawn, textsFromProbes, visibleSpans }

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
  /** Test seam: speak the timeline (default speakTimeline: the provider, the cache, ffmpeg decode). */
  speak?: typeof speakTimeline
  /** Test seam: the layout probe (default probeMotionLayout in Chromium). */
  layoutProbe?: typeof probeMotionLayout
  /**
   * Read a place's recorded outline (boundaries table) as [lng, lat] rings, or
   * null when it has none. The CLI passes the DAL's getBoundaryGeoJSON; a film
   * with an outline scene and no resolver is refused.
   */
  resolveOutline?: (geo: { geoType: OutlineGeoType; geoSlug: string }) => Promise<LngLatRing[] | null>
  /** Test seam only (the CLI never sets it): a stand-in technique registry for the preflight. */
  registryPath?: string
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
  /** Override the voice id (tests); otherwise the named voice's environment variable. */
  voiceId?: string
  /** The film ledger the repeat rule reads (default data/studio/film-ledger.jsonl). */
  ledgerPath?: string
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

/** The real path of p: the nearest existing ancestor resolved through symlinks, the rest appended. */
export function realPathOf(p: string): string {
  let head = resolve(p)
  const tail: string[] = []
  for (;;) {
    try {
      return join(realpathSync(head), ...tail.reverse())
    } catch {
      const parent = dirname(head)
      if (parent === head) return resolve(p)
      tail.push(basename(head))
      head = parent
    }
  }
}

/** The repo roots a render must stay out of the public/ folder of: this checkout, and the main checkout of a worktree. */
export function checkoutRoots(repoRoot: string = REPO_ROOT): string[] {
  const roots = new Set<string>([realPathOf(repoRoot)])
  const r = spawnSync('git', ['-C', repoRoot, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' })
  // A worktree's common dir is the main checkout's .git; its parent is the main checkout.
  if (r.status === 0 && r.stdout.trim()) roots.add(realPathOf(dirname(resolve(repoRoot, r.stdout.trim()))))
  return [...roots]
}

/**
 * Refuse any output path with a `public` segment under the repo root or the
 * main checkout's root: drafts never land where the site serves them. The path
 * is resolved through symlinks first and compared without case (macOS disks
 * are case-insensitive, so Public/ is public/).
 */
export function assertNotPublic(path: string, roots: readonly string[] = checkoutRoots()): void {
  const real = realPathOf(path).toLowerCase()
  for (const root of roots) {
    const rel = relative(root.toLowerCase(), real)
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) continue
    if (rel.split(sep).includes('public')) {
      throw new RenderError(`refusing to write a render under a public/ folder of the repo (${path}); drafts go to out/`)
    }
  }
}

export async function defaultDownload(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) })
  if (!res.ok) throw new RenderError(`footage download failed: HTTP ${res.status} for ${url}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

export function footageSources(timeline: Timeline): TimelineFootage[] {
  return [...timeline.beats.flatMap((b) => (b.footage ? [b.footage] : [])), ...(timeline.cta?.footage ? [timeline.cta.footage] : [])]
}

/**
 * Where a footage source lives on disk: a URL's cached copy (named from the URL, so the same
 * URL is the same file on every film), or the local path resolved from the timeline's folder.
 */
export function footageFilePath(src: string, opts: { baseDir: string; cacheDir: string }): string {
  if (/^https:\/\//i.test(src)) {
    const ext = extname(new URL(src).pathname) || '.mp4'
    return join(opts.cacheDir, 'footage', `${createHash('sha256').update(src).digest('hex').slice(0, 24)}${ext}`)
  }
  return isAbsolute(src) ? src : resolve(opts.baseDir, src)
}

/** Every clip on disk and measured. URLs download once into the cache; local paths must exist. */
export async function resolveFootage(
  timeline: Timeline,
  opts: { baseDir: string; cacheDir: string },
  measure: Measure,
  download: (url: string, dest: string) => Promise<void>,
  log: (line: string) => void,
): Promise<Record<string, ResolvedFootage>> {
  const out: Record<string, ResolvedFootage> = {}
  for (const f of footageSources(timeline)) {
    if (out[f.src]) continue
    const path = footageFilePath(f.src, opts)
    if (/^https:\/\//i.test(f.src)) {
      mkdirSync(join(opts.cacheDir, 'footage'), { recursive: true })
      if (!existsSync(path)) {
        log(`footage: downloading ${f.src}`)
        await download(f.src, path)
      }
    } else if (!existsSync(path)) throw new RenderError(`footage ${f.src} does not exist (looked at ${path})`)
    const probe = await measure.probe(path)
    out[f.src] = { path, width: probe.width, height: probe.height, duration: probe.videoDuration }
  }
  return out
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

/** The outlines the timeline's scenes draw, read from the boundaries table by the injected resolver. */
export async function resolveOutlines(
  brief: StudioBrief,
  timeline: Timeline,
  resolve: RenderDeps['resolveOutline'],
): Promise<Record<string, MotionOutline>> {
  const keys = [...new Set(timeline.beats.flatMap((b) => (b.scene?.kind === 'outline_draw_zoom' ? [b.scene.outline] : [])))]
  const out: Record<string, MotionOutline> = {}
  if (keys.length === 0) return out
  if (!resolve) throw new RenderError('the timeline draws an outline but no outline resolver was given (the CLI reads the boundaries table)')
  for (const key of keys) {
    const row = findOutline(brief, key)
    if (!row) continue // planFilm names the missing row
    const subject = await resolve({ geoType: row.geo_type, geoSlug: row.geo_slug })
    if (!subject || subject.length === 0) throw new RenderError(`no recorded outline for ${row.geo_type} "${row.geo_slug}" in the boundaries table`)
    const context = row.context ? await resolve({ geoType: row.context.geo_type, geoSlug: row.context.geo_slug }) : null
    if (row.context && !context) throw new RenderError(`no recorded outline for the context ${row.context.geo_type} "${row.context.geo_slug}"`)
    out[key] = { subject, context: context && context.length ? context : null }
  }
  return out
}

/**
 * Who built the film, from the environment the factory runs in (F11,
 * 2026-10-14): STUDIO_BUILDER, else "claude". Not a CLI flag, so a render cannot
 * name its builder to suit the review it wants. Check 14 refuses a reviewer id
 * that shares a word with it. This is still self-reported: the real reviewer
 * identity comes from the server certifier later, not from these files.
 */
export function builderOf(env: Record<string, string | undefined>): string {
  return env.STUDIO_BUILDER?.trim() || 'claude'
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

  // The rules refuse before render (preflight.ts; the step table is lib/studio/qa/phases.ts).
  const types = loadVideoTypes()
  const rules = typeRulesFor(brief.video_type, types)
  if (!rules) throw new RenderError(`video_type "${brief.video_type}" is not in video_types.json`)
  // The film's slug comes from its brief alone (its slug, else its title), so check 1 can hold it to the brief.
  const slug = safeSlug(typeof brief.slug === 'string' ? brief.slug : brief.title)
  const ledger = readLedger(opts.ledgerPath ?? FILM_LEDGER_PATH)
  if (ledger.errors.length) throw new RenderError(`the film ledger is damaged: ${ledger.errors.slice(0, 3).join('; ')}`)
  // A registry handed in through deps.registryPath is a test's: it approves only with TEST_APPROVER.
  const registry = await loadCheckedTechniqueRegistry(deps.registryPath, { testOnly: Boolean(deps.registryPath) })
  const ctx: PreflightContext = { types, rules, registry, ledger: ledger.entries, slug, oneSentence: brief.creative.one_sentence }
  // b: the script and every authored string, before any download or the paid voice.
  refuse('text', textPreflight(brief, timeline, ctx))
  log('preflight b (script and authored strings): clear')

  mkdirSync(opts.outDir, { recursive: true })
  const work = join(opts.outDir, 'work')
  mkdirSync(work, { recursive: true })

  // Footage, measured.
  const footage = await resolveFootage(timeline, opts, measure, deps.download ?? defaultDownload, log)

  // The voice and its captions, on the film clock.
  let voice: FilmVoice | null = null
  if (timeline.voice) {
    voice = await (deps.speak ?? speakTimeline)(timeline.voice, {
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
  const outlines = await resolveOutlines(brief, timeline, deps.resolveOutline)
  const film = planFilm({ brief, timeline, voice, footage, scored, outlines })
  const notes = [...film.notes]

  // §0: no number on screen without a brief.numbers row.
  const planned = figureLeaks(film.plan, film.subject)
  if (planned.length) throw new RenderError(`unverified number on screen (no brief.numbers row): ${planned.join(', ')}`)

  // c: the planned manifest, before any frame.
  const draft = plannedManifest(film, brief, voice)
  refuse('plan', planPreflight(draft, brief, ctx))
  log('preflight c (planned manifest): clear')

  // d: the layout probe, the same page read back at each card's still, no frames encoded.
  const assets = await (deps.loadAssets ?? (() => loadMotionAssets()))()
  const html = buildMotionPage({ plan: film.plan, width: FILM_WIDTH, height: FILM_HEIGHT, assets })
  const layout = await (deps.layoutProbe ?? probeMotionLayout)({
    plan: film.plan,
    html,
    width: FILM_WIDTH,
    height: FILM_HEIGHT,
    times: [...new Set(stillTimes(film.plan).map((x) => x.t))].sort((a, c) => a - c),
    launchBrowser: deps.launchBrowser,
  })
  refuse('layout', layoutPreflight(draft, film, layout, textsFromProbes))
  log('preflight d (layout probe): clear')

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

  // e: only now the full render, the existing motion stage over the plate.
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
  if (rendered.frames !== film.frames) throw new RenderError(`wrote ${rendered.frames} frames to ffmpeg, planned ${film.frames}`)
  const probed = rendered.probed ?? []

  // §0 again, on what the page actually drew.
  const drawn = figureLeaks(film.plan, film.subject, rendered.renderedText)
  if (drawn.length) throw new RenderError(`unverified number rendered: ${drawn.join(', ')}`)

  const mp4Path = join(opts.outDir, 'final.mp4')
  writeFileSync(mp4Path, rendered.body)

  // Measure the file, not the plan. A short encode is refused here, not shipped.
  const probe = await measure.probe(mp4Path)
  if (probe.frames != null && probe.frames !== film.frames) throw new RenderError(`the encoded film has ${probe.frames} frames; the plan has ${film.frames}`)
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

  const { texts, cues, missing } = textsFromProbes(film, probed)
  if (missing.length) throw new RenderError(`the page did not draw what the plan asked: ${missing.join('; ')}`)
  const numbers = boundNumbers(film.numbers, texts, cues)
  if (!numbers.ok) throw new RenderError(`an authored figure was not drawn where the plan put it: ${numbers.missing.join('; ')}`)

  // The brief exactly as written beside the film; its sha256 binds the two (check 1).
  const briefText = `${JSON.stringify(opts.brief, null, 2)}\n`
  const briefSha256 = createHash('sha256').update(briefText).digest('hex')

  const manifest: Manifest = {
    factory: MANIFEST_FACTORY,
    manifestVersion: MANIFEST_VERSION,
    video: { file: 'final.mp4', sha256, width: probe.width, height: probe.height, fps: Math.round(probe.fps * 1000) / 1000, duration: Math.round(probe.duration * 1000) / 1000 },
    videoType: brief.video_type,
    techniques: techniques.filter((x) => x.ran).map((x) => x.name),
    beats: film.beats,
    texts,
    numbers: numbers.rows,
    voice: voice ? manifestVoice(voice, voice.words) : null,
    captions: voice ? voice.captions : [],
    audio: { lufs, truePeakDb, silent: !probe.hasAudio },
    endcard: film.endcard
      ? { start: film.endcard.start, quality: film.endcard.quality, local: film.endcard.local, service: film.endcard.service, call: film.endcard.call, out: film.endcard.out }
      : null,
    loop: film.loop,
    builtBy: builderOf(env),
    briefSha256,
    slug,
    creative: { ...brief.creative },
    briefTechniques: brief.techniques,
  }
  const manifestPath = join(opts.outDir, 'final.manifest.json')
  writeManifest(manifestPath, manifest)
  const briefPath = join(opts.outDir, 'final.brief.json')
  writeFileSync(briefPath, briefText)
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
