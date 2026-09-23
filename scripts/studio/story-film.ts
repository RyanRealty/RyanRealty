/**
 * scripts/studio/story-film.ts — produce a vintage story film, stage by stage.
 *
 * The engine lives in lib/studio/story (eras, beats, the visitor arc, cast) and
 * lib/studio/craft.ts (every prompt). This script is the production desk: it
 * runs one stage at a time against a resumable manifest in out/story/<piece>/,
 * so a person can look at the stills before paying for motion, swap a take,
 * and pick up tomorrow where today stopped. Every generation goes through
 * lib/grok and every dollar goes through the Studio spend ledger.
 *
 *   npx tsx scripts/studio/story-film.ts plan   --piece winter-1982
 *   npx tsx scripts/studio/story-film.ts cast   --piece winter-1982 [--takes 3]
 *   npx tsx scripts/studio/story-film.ts stills --piece winter-1982 [--roles hook,arrive] [--takes 2] [--judge on]
 *   npx tsx scripts/studio/story-film.ts motion --piece winter-1982 [--roles hook] [--takes 1] [--seconds 4] [--res 480p]
 *   npx tsx scripts/studio/story-film.ts select --piece winter-1982 --role hook (--still N [--note why] | --clip N)
 *   npx tsx scripts/studio/story-film.ts adopt  --piece winter-1982 [--no-judge]   (record orphaned takes after a crash)
 *   npx tsx scripts/studio/story-film.ts sheet  --piece winter-1982   (shot sheet for the Grok app: no API spend)
 *   npx tsx scripts/studio/story-film.ts ingest --piece winter-1982 --from <folder>   (file takes from the app)
 *   npx tsx scripts/studio/story-film.ts payoff --piece winter-1982
 *   npx tsx scripts/studio/story-film.ts phone  --piece winter-1982
 *   npx tsx scripts/studio/story-film.ts status --piece winter-1982
 *   npx tsx scripts/studio/story-film.ts look   --piece winter-1982 --era cine16_1978   (same footage, another stock)
 *
 * Then the film lab and the reel (docs/STORY_FILMS.md):
 *   python3 scripts/studio/story_reel.py --dir out/story/winter-1982
 *
 * Nothing here posts. The finished reel is a draft for Matt (CLAUDE.md §1).
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import sharp from 'sharp'
import { GROK_MODELS } from '@/lib/grok/client'
import { editGrokImage, generateGrokImages } from '@/lib/grok/image'
import { generateGrokVideo } from '@/lib/grok/video'
import { inspectFrame, STORY_FRAME_DEFECTS, type VisionVerdict } from '@/lib/grok/vision'
import { buildPeriodStillPrompt, assertCraftClean } from '@/lib/studio/craft'
import { addSpend, assertBudget, imageCost, videoCost, VISION_CALL_USD, type SpendLedger } from '@/lib/studio/spend'
import { planStory, type PlannedStoryShot, type StoryPlan } from '@/lib/studio/story/arc'
import type { BeatRole } from '@/lib/studio/story/beats'
import { castSheetSpec, type CastSlot } from '@/lib/studio/story/cast'
import { getEra, judgeContextFor, labParamsFor, type EraPack } from '@/lib/studio/story/eras'
import { getStoryPiece, type StoryPiece } from '@/lib/studio/story/pieces'
import { storyShotPrompts } from '@/lib/studio/story/shots'

// Story films bill to the creative xAI team when XAI_CREATIVE_API_KEY is set
// (lib/grok/client.ts grokApiKey), so a batch can never drain production's credits.
process.env.GROK_BILLING ??= 'creative'

const ROOT = process.cwd()
/**
 * A whole piece, every take included. Winter, 1982 cost about $30 at the first
 * defaults (3 takes, a judge on every still, 6s clips at 1080p). The defaults
 * below put a piece near $5; the cap leaves room for one round of retakes.
 */
const PIECE_CAP_USD = 12
/**
 * Motion defaults. The film lab resolves to ~68% of a 960px gate (about 650px),
 * so a 480p source loses nothing on screen; no trim in a finished cut used more
 * than 3s of a clip, so 4s leaves a second of handle.
 */
const MOTION_RESOLUTION = '480p' as const
const MOTION_SECONDS = 4
/** Stills are judged against this bar; below it the take is kept but not selected. */
const STORY_MIN_SCORE = 80
/** Parallel generations. xAI rate limits are per account; four is polite. */
const CONCURRENCY = 4

// ── manifest ───────────────────────────────────────────────────────────────

type StillTake = {
  file: string
  prompt: string
  sources: string[]
  verdict: VisionVerdict | null
  at: string
}

type ClipTake = {
  file: string
  fromStill: string
  prompt: string
  requestId: string
  model: string
  seconds: number
  at: string
}

type ShotState = {
  role: string
  beatId: string | null
  kind: PlannedStoryShot['kind']
  stills: StillTake[]
  selectedStill?: string
  /** Why a person picked a take the judge failed. Curation is authorship; it is also on the record. */
  selectionNote?: string
  clips: ClipTake[]
  selectedClip?: string
}

type Manifest = {
  piece: string
  eraId: string
  createdAt: string
  ledger: SpendLedger
  cast: Record<CastSlot, { takes: StillTake[]; selected?: string }>
  shots: Record<string, ShotState>
}

function dirFor(piece: StoryPiece): string {
  return path.join(ROOT, 'out', 'story', piece.id)
}

function rel(file: string): string {
  return path.relative(ROOT, file)
}

function emptyManifest(piece: StoryPiece): Manifest {
  return {
    piece: piece.id,
    eraId: piece.eraId,
    createdAt: new Date().toISOString(),
    ledger: { lines: [], totalUsd: 0, capUsd: PIECE_CAP_USD },
    cast: { A: { takes: [] }, B: { takes: [] } },
    shots: {},
  }
}

function readManifestFile(piece: StoryPiece): Manifest | null {
  const file = path.join(dirFor(piece), 'manifest.json')
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Manifest) : null
}

/**
 * What this process changed, so a save can merge instead of overwrite. Stages
 * run in parallel (stills for one beat while another animates); a whole-file
 * write from either would drop the other's paid takes.
 */
const session = { ledgerBase: 0, dirty: new Set<string>() }

function loadManifest(piece: StoryPiece): Manifest {
  const manifest = readManifestFile(piece) ?? emptyManifest(piece)
  session.ledgerBase = manifest.ledger.lines.length
  return manifest
}

function markSelected(key: string): void {
  session.dirty.add(key)
}

function unionByFile<T extends { file: string }>(disk: T[] = [], mem: T[] = []): T[] {
  const seen = new Map<string, T>()
  for (const t of [...disk, ...mem]) seen.set(t.file, t)
  return [...seen.values()]
}

/** Blocking sleep without burning a core: the save path is synchronous by design. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * A save holds the lock for milliseconds. One held past the deadline belongs to
 * a process that died mid-save; clear it and try again. Removing it must never
 * throw: a failed save here comes after the generation was paid for.
 */
function withWriteLock<T>(piece: StoryPiece, fn: () => T): T {
  const lock = path.join(dirFor(piece), '.write-lock')
  let deadline = Date.now() + 10_000
  for (;;) {
    try {
      writeFileSync(lock, String(process.pid), { flag: 'wx' })
      break
    } catch {
      if (Date.now() > deadline) {
        try {
          unlinkSync(lock)
        } catch {
          /* another process cleared it first */
        }
        deadline = Date.now() + 10_000
      }
      sleepSync(25)
    }
  }
  try {
    return fn()
  } finally {
    try {
      unlinkSync(lock)
    } catch {
      /* already gone */
    }
  }
}

function saveManifest(piece: StoryPiece, manifest: Manifest): void {
  mkdirSync(dirFor(piece), { recursive: true })
  withWriteLock(piece, () => {
    const disk = readManifestFile(piece) ?? emptyManifest(piece)
    const merged: Manifest = {
      ...disk,
      cast: { ...disk.cast },
      shots: { ...disk.shots },
    }
    for (const slot of ['A', 'B'] as CastSlot[]) {
      const d = disk.cast[slot] ?? { takes: [] }
      const m = manifest.cast[slot] ?? { takes: [] }
      merged.cast[slot] = {
        takes: unionByFile(d.takes, m.takes),
        selected: session.dirty.has(`cast:${slot}`) ? m.selected : (d.selected ?? m.selected),
      }
    }
    for (const [role, m] of Object.entries(manifest.shots)) {
      const d = disk.shots[role]
      if (!d) {
        merged.shots[role] = m
        continue
      }
      merged.shots[role] = {
        ...d,
        beatId: m.beatId ?? d.beatId,
        stills: unionByFile(d.stills, m.stills),
        clips: unionByFile(d.clips, m.clips),
        selectedStill: session.dirty.has(`still:${role}`) ? m.selectedStill : (d.selectedStill ?? m.selectedStill),
        selectionNote: session.dirty.has(`still:${role}`) ? m.selectionNote : d.selectionNote,
        selectedClip: session.dirty.has(`clip:${role}`) ? m.selectedClip : (d.selectedClip ?? m.selectedClip),
      }
    }
    const fresh = manifest.ledger.lines.slice(session.ledgerBase)
    const lines = [...disk.ledger.lines, ...fresh]
    merged.ledger = {
      capUsd: disk.ledger.capUsd ?? PIECE_CAP_USD,
      lines,
      totalUsd: Number(lines.reduce((sum, l) => sum + l.usd, 0).toFixed(6)),
    }
    writeFileSync(path.join(dirFor(piece), 'manifest.json'), JSON.stringify(merged, null, 2))
    // Adopt the merged state IN PLACE. Replacing the nested objects would orphan the
    // references that in-flight generations in this process still hold, and their
    // takes would be written into objects nobody saves (it lost four clips, 2026-09-23).
    for (const slot of ['A', 'B'] as CastSlot[]) {
      if (manifest.cast[slot]) Object.assign(manifest.cast[slot], merged.cast[slot])
      else manifest.cast[slot] = merged.cast[slot]
    }
    for (const [role, state] of Object.entries(merged.shots)) {
      if (manifest.shots[role]) Object.assign(manifest.shots[role], state)
      else manifest.shots[role] = state
    }
    manifest.ledger = merged.ledger
    session.ledgerBase = merged.ledger.lines.length
  })
}

// ── helpers ────────────────────────────────────────────────────────────────

function args(): { cmd: string; flags: Record<string, string> } {
  const [cmd = 'status', ...rest] = process.argv.slice(2)
  const flags: Record<string, string> = {}
  for (let i = 0; i < rest.length; i += 1) {
    const key = rest[i]
    if (!key.startsWith('--')) continue
    const next = rest[i + 1]
    flags[key.slice(2)] = next && !next.startsWith('--') ? next : 'true'
    if (next && !next.startsWith('--')) i += 1
  }
  return { cmd, flags }
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      out[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

type AssetRow = {
  id: string
  file_path: string
  storage_bucket?: string
  storage_object_path?: string
  license: string
  source: string
}

let assetIndex: Map<string, AssetRow> | null = null
function assetById(id: string): AssetRow {
  if (!assetIndex) {
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'data/asset-library/manifest.json'), 'utf8')) as {
      assets: AssetRow[]
    }
    assetIndex = new Map(manifest.assets.map((a) => [a.id, a]))
  }
  const row = assetIndex.get(id)
  if (!row) throw new Error(`reference asset ${id} is not in data/asset-library/manifest.json`)
  return row
}

/** A reference ("asset:<id>" or "file:<path>") as a local file, downloading from the bucket if needed. */
async function resolveRef(ref: string): Promise<string> {
  if (ref.startsWith('file:')) return path.join(ROOT, ref.slice(5))
  if (!ref.startsWith('asset:')) throw new Error(`unknown reference form: ${ref}`)
  const row = assetById(ref.slice(6))
  const local = path.join(ROOT, row.file_path)
  if (existsSync(local)) return local
  if (!row.storage_bucket || !row.storage_object_path)
    throw new Error(`asset ${row.id} has no local file and no bucket path`)
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error('Supabase env missing: cannot fetch reference from storage')
  const res = await fetch(`${base}/storage/v1/object/${row.storage_bucket}/${row.storage_object_path}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  })
  if (!res.ok) throw new Error(`storage fetch ${row.storage_object_path} returned ${res.status}`)
  mkdirSync(path.dirname(local), { recursive: true })
  writeFileSync(local, Buffer.from(await res.arrayBuffer()))
  return local
}

/** A JPEG data URI no larger than the generator needs (long edge 1536). */
async function dataUri(file: string): Promise<string> {
  const buf = await sharp(file)
    .rotate()
    .resize(1536, 1536, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

async function jpegBytes(file: string, longEdge = 1280): Promise<Buffer> {
  return sharp(file)
    .resize(longEdge, longEdge, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer()
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
}

function pieceAndEra(flags: Record<string, string>): {
  piece: StoryPiece
  era: EraPack
  plan: StoryPlan
} {
  const piece = getStoryPiece(flags.piece ?? '')
  if (!piece) throw new Error(`--piece is required (known: winter-1982)`)
  const era = getEra(piece.eraId)
  if (!era) throw new Error(`piece ${piece.id} names unknown era ${piece.eraId}`)
  const plan = planStory({ era, season: piece.season, beats: piece.beats })
  return { piece, era, plan }
}

function ensureShots(manifest: Manifest, plan: StoryPlan): void {
  for (const shot of plan.shots) {
    manifest.shots[shot.role] ??= {
      role: shot.role,
      beatId: shot.beat?.id ?? null,
      kind: shot.kind,
      stills: [],
      clips: [],
    }
  }
}

function bestPassing(takes: StillTake[]): StillTake | null {
  const passing = takes.filter((t) => t.verdict?.pass)
  passing.sort((a, b) => (b.verdict?.score ?? 0) - (a.verdict?.score ?? 0))
  return passing[0] ?? null
}

async function judge(input: {
  file: string
  intent: string
  era: EraPack
  alsoReject?: string[]
  allowAnachronism?: string
  references: Array<{ file: string; label: string }>
  ledger: SpendLedger
  step: string
  vocabulary?: readonly string[]
}): Promise<VisionVerdict> {
  assertBudget(input.ledger, VISION_CALL_USD, input.step)
  const context = [
    judgeContextFor(input.era),
    input.allowAnachronism
      ? `The one intentional anachronism in this frame is ${input.allowAnachronism}. Do not report it; judge everything else.`
      : '',
  ]
    .filter(Boolean)
    .join(' ')
  let verdict: VisionVerdict
  try {
    verdict = await inspectFrame({
      image: await jpegBytes(input.file),
      intent: input.intent,
      alsoReject: input.alsoReject,
      vocabulary: input.vocabulary ?? STORY_FRAME_DEFECTS,
      context,
      references: await Promise.all(
        input.references.map(async (r) => ({
          image: await jpegBytes(r.file, 768),
          label: r.label,
        })),
      ),
      minScore: STORY_MIN_SCORE,
      model: GROK_MODELS.judge,
    })
  } catch (err) {
    // A judge that times out has not judged: keep the take, unjudged, and move on.
    // A paid take is never lost to a slow reviewer.
    addSpend(input.ledger, {
      step: `${input.step} (failed)`,
      usd: VISION_CALL_USD,
      ticks: null,
    })
    return {
      pass: false,
      score: 0,
      defects: [],
      describes: '',
      fixHint: `unjudged: ${err instanceof Error ? err.message : String(err)}`,
      costUsd: null,
    }
  }
  addSpend(input.ledger, {
    step: input.step,
    usd: VISION_CALL_USD,
    ticks: verdict.costTicks ?? null,
  })
  return verdict
}

// ── stages ─────────────────────────────────────────────────────────────────

async function stagePlan(piece: StoryPiece, era: EraPack, plan: StoryPlan): Promise<void> {
  const dir = dirFor(piece)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ piece, era, plan }, null, 2))
  console.log(`${piece.title} — ${era.label}, ${piece.season}, ${plan.totalSeconds}s, ${plan.shots.length} shots`)
  for (const shot of plan.shots) {
    console.log(
      `  ${String(shot.index).padStart(2)} ${shot.role.padEnd(10)} ${shot.seconds.toFixed(1)}s  ${shot.kind.padEnd(10)} ${shot.beat?.id ?? ''}`,
    )
  }
  for (const warning of plan.warnings) console.log(`  WARNING: ${warning}`)
}

async function stageCast(
  piece: StoryPiece,
  era: EraPack,
  manifest: Manifest,
  takes: number,
  judgeTakes: boolean,
): Promise<void> {
  const dir = path.join(dirFor(piece), 'cast')
  mkdirSync(dir, { recursive: true })
  await pool(['A', 'B'] as CastSlot[], 2, async (slot) => {
    const member = piece.cast[slot]
    const sheet = castSheetSpec(member, era)
    const hair = member.pronoun === 'she' ? era.period.hair.she : era.period.hair.he
    const prompt = buildPeriodStillPrompt({
      year: era.year,
      move: 'hold',
      period: hair,
      camera: 'a plain reference portrait',
      ...sheet,
    })
    assertCraftClean(prompt, `cast ${slot}`)
    assertBudget(manifest.ledger, imageCost(GROK_MODELS.image, takes), `cast ${slot}`)
    const result = await generateGrokImages({
      prompt,
      aspectRatio: '3:4',
      resolution: '1k',
      n: takes,
    })
    addSpend(manifest.ledger, {
      step: `cast ${slot} x${result.images.length}`,
      usd: imageCost(result.model, result.images.length),
      ticks: result.costTicks,
    })
    const at = stamp()
    for (const [i, image] of result.images.entries()) {
      const file = path.join(dir, `${slot}-${at}-${i}.jpg`)
      writeFileSync(file, image)
      const verdict = judgeTakes
        ? await judge({
            file,
            intent: `a waist-up reference portrait of ${member.look}, in ${era.year} clothes and hair`,
            era,
            references: [],
            ledger: manifest.ledger,
            step: `judge cast ${slot}`,
            // A reference sheet has nothing to be mismatched against.
            vocabulary: STORY_FRAME_DEFECTS.filter((d) => d !== 'cast_mismatch'),
          })
        : null
      manifest.cast[slot].takes.push({
        file: rel(file),
        prompt,
        sources: [],
        verdict,
        at,
      })
      saveManifest(piece, manifest)
      console.log(
        verdict
          ? `cast ${slot} take ${i}: ${verdict.pass ? 'PASS' : 'fail'} ${verdict.score} [${verdict.defects.join(', ')}] ${verdict.describes}`
          : `cast ${slot} take ${i}: ${rel(file)} (unjudged)`,
      )
    }
    if (!manifest.cast[slot].selected) {
      manifest.cast[slot].selected = bestPassing(manifest.cast[slot].takes)?.file
      markSelected(`cast:${slot}`)
    }
  })
}

type SourcePlan = {
  files: string[]
  labels: string[]
  castRefs: Array<{ file: string; label: string }>
}

async function sourcesFor(piece: StoryPiece, shot: PlannedStoryShot, manifest: Manifest): Promise<SourcePlan> {
  const beat = shot.beat
  if (!beat) return { files: [], labels: [], castRefs: [] }
  const files: string[] = []
  const labels: string[] = []
  const castRefs: Array<{ file: string; label: string }> = []
  for (const slot of beat.cast) {
    const selected = manifest.cast[slot].selected
    if (!selected) throw new Error(`cast ${slot} has no selected sheet: run the cast stage first`)
    const label = `the reference photo of ${slot === 'A' ? 'the woman' : 'the man'} (same face and hair, different clothes)`
    files.push(path.join(ROOT, selected))
    labels.push(label)
    castRefs.push({ file: path.join(ROOT, selected), label })
  }
  const continuityRole = piece.continuity?.[beat.role as BeatRole]
  if (continuityRole) {
    const selected = manifest.shots[continuityRole]?.selectedStill
    if (selected) {
      files.push(path.join(ROOT, selected))
      labels.push('the same street and house a moment earlier in this film (keep the house, trees, and light the same)')
    }
  }
  for (const ref of beat.refs) {
    if (files.length >= 5) break
    files.push(await resolveRef(ref))
    labels.push(
      `a real photograph of the place (${beat.place.split(':')[0]}), for its landforms, trees, and buildings only; change the season, light, and era to this shot`,
    )
  }
  return { files, labels, castRefs }
}

async function stageStills(
  piece: StoryPiece,
  era: EraPack,
  plan: StoryPlan,
  manifest: Manifest,
  roles: string[] | null,
  takes: number,
  judgeTakes: boolean,
): Promise<void> {
  const shots = plan.shots.filter((s) => s.kind === 'generated' && (!roles || roles.includes(s.role)))
  // Continuity sources must exist before their dependents run, so go in arc order by dependency depth.
  const depth = (s: PlannedStoryShot): number => {
    const from = piece.continuity?.[s.role as BeatRole]
    const parent = from ? plan.shots.find((p) => p.role === from) : undefined
    return parent ? 1 + depth(parent) : 0
  }
  const levels = [...new Set(shots.map(depth))].sort()
  for (const level of levels) {
    await pool(
      shots.filter((s) => depth(s) === level),
      CONCURRENCY,
      async (shot) => {
        const beat = shot.beat!
        const state = manifest.shots[shot.role]
        const sources = await sourcesFor(piece, shot, manifest)
        const prompts = storyShotPrompts({
          beat,
          era,
          cast: piece.cast,
          sources: sources.labels,
        })
        assertBudget(manifest.ledger, imageCost(GROK_MODELS.image, takes), `stills ${shot.role}`)
        const result = sources.files.length
          ? await editGrokImage({
              prompt: prompts.still,
              sources: await Promise.all(sources.files.map(async (f) => ({ url: await dataUri(f) }))),
              aspectRatio: '4:3',
              resolution: '1k',
              n: takes,
            })
          : await generateGrokImages({
              prompt: prompts.still,
              aspectRatio: '4:3',
              resolution: '1k',
              n: takes,
            })
        addSpend(manifest.ledger, {
          step: `stills ${shot.role} x${result.images.length}`,
          usd: imageCost(result.model, result.images.length),
          ticks: result.costTicks,
        })
        const dir = path.join(dirFor(piece), 'stills', shot.role)
        mkdirSync(dir, { recursive: true })
        const at = stamp()
        for (const [i, image] of result.images.entries()) {
          const file = path.join(dir, `${at}-${i}.jpg`)
          writeFileSync(file, image)
          const verdict = judgeTakes
            ? await judge({
                file,
                intent: `${prompts.spec.action}; ${beat.place}`,
                era,
                alsoReject: beat.alsoReject,
                allowAnachronism: beat.allowAnachronism,
                references: sources.castRefs,
                ledger: manifest.ledger,
                step: `judge ${shot.role}`,
              })
            : null
          state.stills.push({
            file: rel(file),
            prompt: prompts.still,
            sources: sources.files.map(rel),
            verdict,
            at,
          })
          saveManifest(piece, manifest)
          console.log(
            verdict
              ? `${shot.role} take ${i}: ${verdict.pass ? 'PASS' : 'fail'} ${verdict.score} [${verdict.defects.join(', ')}] ${verdict.describes}${verdict.fixHint ? ` | fix: ${verdict.fixHint}` : ''}`
              : `${shot.role} take ${i}: ${rel(file)} (unjudged; curate from sheets/${shot.role}.jpg)`,
          )
        }
        if (!state.selectedStill && judgeTakes) {
          state.selectedStill = bestPassing(state.stills)?.file
          markSelected(`still:${shot.role}`)
        }
        saveManifest(piece, manifest)
        await writeContactSheet(piece, shot.role, state.stills)
      },
    )
  }
}

/**
 * Every take of one shot on one sheet, numbered by its manifest index so
 * `select --still N` reads straight off it. Curating by eye is free; a judge
 * call on every take was the largest line after motion in the first piece.
 */
async function writeContactSheet(piece: StoryPiece, role: string, takes: StillTake[]): Promise<void> {
  if (takes.length === 0) return
  const cellW = 480
  const cellH = 360
  const cols = Math.min(4, takes.length)
  const rows = Math.ceil(takes.length / cols)
  const composites = await Promise.all(
    takes.map(async (t, i) => {
      const img = await sharp(path.join(ROOT, t.file)).resize(cellW, cellH, { fit: 'cover' }).jpeg().toBuffer()
      const label = `${i}${t.verdict ? ` \u00b7 ${t.verdict.pass ? 'pass' : 'fail'} ${t.verdict.score}` : ''}`
      const tag = Buffer.from(
        `<svg width="${cellW}" height="${cellH}"><rect x="0" y="0" width="${24 + label.length * 13}" height="34" fill="#102742"/>` +
          `<text x="10" y="24" font-family="sans-serif" font-size="22" fill="#faf8f4">${label}</text></svg>`,
      )
      const cell = await sharp(img)
        .composite([{ input: tag, top: 0, left: 0 }])
        .toBuffer()
      return { input: cell, top: Math.floor(i / cols) * cellH, left: (i % cols) * cellW }
    }),
  )
  const dir = path.join(dirFor(piece), 'sheets')
  mkdirSync(dir, { recursive: true })
  await sharp({ create: { width: cols * cellW, height: rows * cellH, channels: 3, background: '#faf8f4' } })
    .composite(composites)
    .jpeg({ quality: 82 })
    .toFile(path.join(dir, `${role}.jpg`))
}

async function stageMotion(
  piece: StoryPiece,
  era: EraPack,
  plan: StoryPlan,
  manifest: Manifest,
  roles: string[] | null,
  takes: number,
  seconds: number,
  resolution: '480p' | '720p' | '1080p',
): Promise<void> {
  const jobs: Array<{ shot: PlannedStoryShot; take: number }> = []
  for (const shot of plan.shots) {
    if (shot.kind !== 'generated' || (roles && !roles.includes(shot.role))) continue
    if (shot.beat?.composite === 'yard_sign') {
      // The sign shot is a still moved in the lab (the brand never goes through a generator).
      console.log(`${shot.role}: still + lab camera, no motion generated`)
      continue
    }
    if (!manifest.shots[shot.role].selectedStill) {
      console.log(`${shot.role}: no selected still, skipped`)
      continue
    }
    for (let t = 0; t < takes; t += 1) jobs.push({ shot, take: t })
  }
  await pool(jobs, CONCURRENCY, async ({ shot }) => {
    const state = manifest.shots[shot.role]
    const still = path.join(ROOT, state.selectedStill!)
    const prompts = storyShotPrompts({
      beat: shot.beat!,
      era,
      cast: piece.cast,
    })
    assertBudget(manifest.ledger, videoCost(GROK_MODELS.video, seconds), `motion ${shot.role}`)
    const clip = await generateGrokVideo({
      prompt: prompts.motion,
      image: { url: await dataUri(still) },
      duration: seconds,
      aspectRatio: '4:3',
      resolution,
      generateAudio: false,
    })
    addSpend(manifest.ledger, {
      step: `motion ${shot.role} ${clip.durationSeconds}s ${resolution}`,
      usd: videoCost(clip.model, clip.durationSeconds),
      ticks: clip.costTicks,
    })
    const res = await fetch(clip.url)
    if (!res.ok) throw new Error(`clip download ${res.status}`)
    const dir = path.join(dirFor(piece), 'clips', shot.role)
    mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `${stamp()}-${clip.requestId.slice(0, 8)}.mp4`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    state.clips.push({
      file: rel(file),
      fromStill: state.selectedStill!,
      prompt: prompts.motion,
      requestId: clip.requestId,
      model: clip.model,
      seconds: clip.durationSeconds,
      at: stamp(),
    })
    if (!state.selectedClip) {
      state.selectedClip = rel(file)
      markSelected(`clip:${shot.role}`)
    }
    saveManifest(piece, manifest)
    console.log(`${shot.role}: clip ${rel(file)}`)
  })
}

/**
 * Record any take file on disk that the manifest does not know about. A stage
 * that dies mid-role (a judge timeout, a killed process) has already paid for
 * the images it wrote; they are judged and adopted here rather than lost.
 */
async function stageAdopt(
  piece: StoryPiece,
  era: EraPack,
  plan: StoryPlan,
  manifest: Manifest,
  judgeTakes: boolean,
): Promise<void> {
  const { readdirSync } = await import('node:fs')
  for (const shot of plan.shots) {
    if (shot.kind !== 'generated' || !shot.beat) continue
    const clipDir = path.join(dirFor(piece), 'clips', shot.role)
    if (existsSync(clipDir)) {
      const state = manifest.shots[shot.role]
      const knownClips = new Set(state.clips.map((c) => path.basename(c.file)))
      for (const name of readdirSync(clipDir)
        .filter((f) => f.endsWith('.mp4') && !knownClips.has(f))
        .sort()) {
        const motion = storyShotPrompts({ beat: shot.beat, era, cast: piece.cast }).motion
        state.clips.push({
          file: rel(path.join(clipDir, name)),
          fromStill: state.selectedStill ?? '',
          prompt: `(adopted) ${motion}`,
          requestId:
            name
              .replace(/\.mp4$/, '')
              .split('-')
              .pop() ?? '',
          model: GROK_MODELS.video,
          seconds: 6,
          at: stamp(),
        })
        if (!state.selectedClip) {
          state.selectedClip = rel(path.join(clipDir, name))
          markSelected(`clip:${shot.role}`)
        }
        saveManifest(piece, manifest)
        console.log(`${shot.role} adopted clip ${name}`)
      }
    }
    const dir = path.join(dirFor(piece), 'stills', shot.role)
    if (!existsSync(dir)) continue
    const state = manifest.shots[shot.role]
    const known = new Set(state.stills.map((t) => path.basename(t.file)))
    for (const name of readdirSync(dir)
      .filter((f) => f.endsWith('.jpg') && !known.has(f))
      .sort()) {
      const file = path.join(dir, name)
      const sources = await sourcesFor(piece, shot, manifest)
      const prompts = storyShotPrompts({ beat: shot.beat, era, cast: piece.cast, sources: sources.labels })
      const verdict = judgeTakes
        ? await judge({
            file,
            intent: `${prompts.spec.action}; ${shot.beat.place}`,
            era,
            alsoReject: shot.beat.alsoReject,
            allowAnachronism: shot.beat.allowAnachronism,
            references: sources.castRefs,
            ledger: manifest.ledger,
            step: `judge ${shot.role} (adopted)`,
          })
        : null
      state.stills.push({ file: rel(file), prompt: `(adopted) ${prompts.still}`, sources: [], verdict, at: stamp() })
      saveManifest(piece, manifest)
      console.log(
        `${shot.role} adopted ${name}: ${verdict ? `${verdict.pass ? 'PASS' : 'fail'} ${verdict.score} [${verdict.defects.join(', ')}]` : 'unjudged'}`,
      )
    }
  }
}

/**
 * The Grok app route: generation on the SuperGrok subscription instead of the
 * API. xAI does not expose the consumer subscription to code, and scripting
 * grok.com would breach its terms, so the handoff is files. `sheet` writes a
 * self-contained folder per shot (the reference images to upload, the exact
 * prompts to paste, the aspect, how many takes); a person runs it in Grok
 * Imagine; `ingest` files what comes back and records it. Zero API spend.
 */
async function stageSheet(
  piece: StoryPiece,
  era: EraPack,
  plan: StoryPlan,
  manifest: Manifest,
  roles: string[] | null,
): Promise<void> {
  const root = path.join(dirFor(piece), 'grok-app')
  mkdirSync(root, { recursive: true })
  const out: string[] = [
    `# ${piece.title}: shot sheet for the Grok app`,
    '',
    'For each folder, in Grok Imagine (SuperGrok):',
    '1. Upload the `ref-*.jpg` images in order (image 1 first).',
    '2. Paste `still-prompt.txt`. Aspect 4:3 if offered (anything else is center-cropped to 4:3 on ingest). Keep the 2 best takes.',
    '3. For shots marked MOTION: upload your chosen still, paste `motion-prompt.txt`, sound off, the shortest length offered.',
    '4. Save results named `<role>-anything.jpg` / `<role>-anything.mp4` (for example `hook-1.jpg`) into one folder and send it back.',
    '   `npx tsx scripts/studio/story-film.ts ingest --piece ' +
      piece.id +
      ' --from <that folder>` files and records them.',
    '',
  ]
  let n = 0
  for (const shot of plan.shots) {
    if (shot.kind !== 'generated' || !shot.beat || (roles && !roles.includes(shot.role))) continue
    n += 1
    const dir = path.join(root, `${String(n).padStart(2, '0')}-${shot.role}`)
    mkdirSync(dir, { recursive: true })
    const sources = await sourcesFor(piece, shot, manifest)
    for (const [i, file] of sources.files.entries()) {
      await sharp(file)
        .rotate()
        .resize(1536, 1536, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toFile(path.join(dir, `ref-${i + 1}.jpg`))
    }
    const prompts = storyShotPrompts({ beat: shot.beat, era, cast: piece.cast, sources: sources.labels })
    writeFileSync(path.join(dir, 'still-prompt.txt'), prompts.still + '\n')
    const motion = shot.beat.composite ? null : prompts.motion
    if (motion) writeFileSync(path.join(dir, 'motion-prompt.txt'), motion + '\n')
    out.push(
      `## ${String(n).padStart(2, '0')} ${shot.role}: ${shot.beat.label}`,
      `- references: ${sources.labels.map((l, i) => `ref-${i + 1} = ${l}`).join('; ') || 'none'}`,
      `- ${motion ? 'MOTION: yes, after you pick a still' : 'STILL ONLY: the lab moves this one (the sign is composited in post)'}`,
      `- on screen for ${shot.seconds.toFixed(1)}s`,
      '',
    )
  }
  writeFileSync(path.join(root, 'SHOTSHEET.md'), out.join('\n'))
  console.log(`sheet: ${n} shots -> ${rel(root)}/SHOTSHEET.md`)
}

/** Take what came back from the Grok app, crop it to the 4:3 gate, and record it. */
async function stageIngest(
  piece: StoryPiece,
  era: EraPack,
  plan: StoryPlan,
  manifest: Manifest,
  from: string | undefined,
): Promise<void> {
  if (!from || !existsSync(from)) throw new Error('ingest: pass --from <folder of returned takes>')
  const { readdirSync } = await import('node:fs')
  const { execFileSync } = await import('node:child_process')
  const roles = plan.shots.filter((s) => s.kind === 'generated').map((s) => s.role)
  // Longest role first so `play_pair-1.jpg` never files under `play`.
  const byLength = [...roles].sort((a, b) => b.length - a.length)
  let count = 0
  for (const name of readdirSync(from).sort()) {
    const role = byLength.find((r) => name.toLowerCase().startsWith(`${r}-`) || name.toLowerCase().startsWith(`${r}_`))
    if (!role) {
      console.log(`ingest: ${name} names no shot, skipped`)
      continue
    }
    const src = path.join(from, name)
    const base = `grokapp-${stamp()}-${name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '')}`
    if (/\.(jpe?g|png|webp)$/i.test(name)) {
      const dir = path.join(dirFor(piece), 'stills', role)
      mkdirSync(dir, { recursive: true })
      await sharp(src)
        .rotate()
        .resize(1152, 864, { fit: 'cover' })
        .jpeg({ quality: 92 })
        .toFile(path.join(dir, `${base}.jpg`))
      count += 1
    } else if (/\.(mp4|mov|webm)$/i.test(name)) {
      const dir = path.join(dirFor(piece), 'clips', role)
      mkdirSync(dir, { recursive: true })
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-i',
        src,
        '-an',
        '-vf',
        'crop=min(iw\\,ih*4/3):min(ih\\,iw*3/4),scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v',
        'libx264',
        '-crf',
        '14',
        '-pix_fmt',
        'yuv420p',
        path.join(dir, `${base}.mp4`),
      ])
      count += 1
    }
  }
  console.log(`ingest: filed ${count} take(s); recording them`)
  await stageAdopt(piece, era, plan, manifest, false)
  for (const role of roles) await writeContactSheet(piece, role, manifest.shots[role]?.stills ?? [])
}

function stageSelect(manifest: Manifest, flags: Record<string, string>): void {
  const state = manifest.shots[flags.role ?? '']
  const castSlot = flags.cast as CastSlot | undefined
  if (castSlot && manifest.cast[castSlot]) {
    const take = manifest.cast[castSlot].takes[Number(flags.take)]
    if (!take) throw new Error('no such cast take')
    manifest.cast[castSlot].selected = take.file
    markSelected(`cast:${castSlot}`)
    console.log(`cast ${castSlot} -> ${take.file}`)
    return
  }
  if (!state) throw new Error(`--role must be one of ${Object.keys(manifest.shots).join(', ')}`)
  if (flags.still !== undefined) {
    const take = state.stills[Number(flags.still)]
    if (!take) throw new Error('no such still')
    if (take.verdict && !take.verdict.pass && !flags.note) {
      throw new Error(
        `${state.role} still ${flags.still} failed the judge (${take.verdict.defects.join(', ')}); pass --note "<why it is fine on screen>" to override`,
      )
    }
    state.selectedStill = take.file
    state.selectionNote = flags.note
    markSelected(`still:${state.role}`)
    console.log(`${state.role} still -> ${take.file}${flags.note ? ` (override: ${flags.note})` : ''}`)
  }
  if (flags.clip !== undefined) {
    const take = state.clips[Number(flags.clip)]
    if (!take) throw new Error('no such clip')
    state.selectedClip = take.file
    markSelected(`clip:${state.role}`)
    console.log(`${state.role} clip -> ${take.file}`)
  }
}

/**
 * The phone's figure, pulled fresh through the DAL and traced (CLAUDE.md §0).
 * Two independent reads must agree before the figure is allowed on screen.
 */
async function stagePayoff(piece: StoryPiece): Promise<void> {
  if (piece.payoff.kind === 'none') {
    console.log('payoff: none (the phone shows no figure)')
    return
  }
  const stub = path.join(ROOT, 'test/server-only-stub.ts')
  const cacheStub = path.join(ROOT, 'test/next-cache-cli-stub.ts')
  const mod = Module as unknown as {
    _resolveFilename: (r: string, ...a: unknown[]) => string
  }
  const original = mod._resolveFilename
  mod._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
    const target =
      request === 'server-only' || request === 'client-only' ? stub : request === 'next/cache' ? cacheStub : request
    return original.call(this, target, ...rest)
  }
  const inventory = await import('@/lib/data/geo/neighborhood-public-inventory')
  const stats = await import('@/lib/data/geo/getBendNeighborhoodStats')
  const fetchedAt = new Date().toISOString()
  const primary = await inventory.getNeighborhoodPublicInventory(piece.payoff.geoSlug)
  const pulseRows = (await stats.getBendNeighborhoodStats()) as unknown as Array<{
    geoSlug: string
    activeCount: number
    medianListPrice: number | null
  }>
  const pulse = (Array.isArray(pulseRows) ? pulseRows : []).find((r) => r.geoSlug === piece.payoff.geoSlug)
  if (!primary || primary.medianListPrice == null || !pulse || pulse.medianListPrice == null) {
    throw new Error(
      `payoff: no figure for ${piece.payoff.geoSlug}; the phone must show no number rather than an unverified one`,
    )
  }
  const delta = Math.abs(primary.medianListPrice - pulse.medianListPrice) / primary.medianListPrice
  console.log(
    `payoff ${piece.payoff.placeLabel}: ${primary.activeCount} homes, median list $${primary.medianListPrice.toLocaleString('en-US')} (xref) vs $${pulse.medianListPrice.toLocaleString('en-US')} (pulse), delta ${(delta * 100).toFixed(2)}%`,
  )
  if (delta > 0.01 || primary.activeCount !== pulse.activeCount) {
    throw new Error('payoff: the two reads disagree by more than 1%; stop and surface to Matt (CLAUDE.md §0)')
  }
  const dir = dirFor(piece)
  mkdirSync(dir, { recursive: true })
  const payoff = {
    placeLabel: piece.payoff.placeLabel,
    geoSlug: piece.payoff.geoSlug,
    activeCount: primary.activeCount,
    medianListPrice: primary.medianListPrice,
    fetchedAt,
  }
  writeFileSync(path.join(dir, 'payoff.json'), JSON.stringify(payoff, null, 2))
  writeFileSync(
    path.join(dir, 'citations.json'),
    JSON.stringify(
      [
        {
          figure: `${primary.activeCount} homes for sale`,
          source: 'Supabase via DAL getNeighborhoodPublicInventory',
          table: 'listing_boundary_xref_mv',
          column: 'listing_key (count)',
          filter: `geo_type=neighborhood, geo_slug=${piece.payoff.geoSlug}, standard_status in public active statuses, property_type=A, property_sub_type=Single Family Residence`,
          rows: primary.activeCount,
          fetched_at: fetchedAt,
          query: 'lib/data/geo/neighborhood-public-inventory.ts fetchBendNeighborhoodPublicInventory',
          cross_check: {
            source: 'getBendNeighborhoodStats (market_pulse_live.active_count)',
            value: pulse.activeCount,
          },
        },
        {
          figure: `$${primary.medianListPrice.toLocaleString('en-US')} median list price`,
          source: 'Supabase via DAL getNeighborhoodPublicInventory',
          table: 'listing_boundary_xref_mv',
          column: 'list_price (median)',
          filter: `same as above, priced rows = ${primary.pricedCount}`,
          rows: primary.pricedCount,
          fetched_at: fetchedAt,
          query: 'lib/data/geo/neighborhood-public-inventory.ts medianListPrice(sorted list_price)',
          cross_check: {
            source: 'getBendNeighborhoodStats (market_pulse_live.median_list_price)',
            value: pulse.medianListPrice,
            delta_pct: Number((delta * 100).toFixed(3)),
          },
        },
      ],
      null,
      2,
    ),
  )
}

/**
 * The break: the present-day phone screen, rendered crisp from HTML with the
 * live payoff figures. The hero is the film's own house as it stands today,
 * made from the selected sign still, so the joke reads: same house, now.
 */
async function stagePhone(piece: StoryPiece, era: EraPack, manifest: Manifest): Promise<void> {
  const dir = dirFor(piece)
  const payoffFile = path.join(dir, 'payoff.json')
  if (!existsSync(payoffFile))
    throw new Error('phone: run the payoff stage first (the screen carries only verified figures)')
  const payoff = JSON.parse(readFileSync(payoffFile, 'utf8')) as {
    placeLabel: string
    activeCount: number
    medianListPrice: number
    fetchedAt: string
  }
  const assets = path.join(dir, 'assets')
  mkdirSync(assets, { recursive: true })
  // The hero is the neighbourhood the film just showed, crisp and ungraded: the same
  // place, now. Never a generated house above the figures: a house photo over a
  // price reads as a listing, and the house in the film is a mock-up (Matt 2026-09-23).
  const hero = path.join(assets, 'neighborhood-hero.jpg')
  if (!existsSync(hero)) {
    const heroRole = piece.phoneHeroRole ?? 'town'
    const still = manifest.shots[heroRole]?.selectedStill
    if (!still) throw new Error(`phone: select a ${heroRole} still first; the phone hero is that frame, crisp`)
    const meta = await sharp(path.join(ROOT, still)).metadata()
    const width = meta.width ?? 1152
    const height = Math.round(width / 1.56)
    const top = Math.max(0, Math.round(((meta.height ?? height) - height) / 2))
    await sharp(path.join(ROOT, still)).extract({ left: 0, top, width, height }).jpeg({ quality: 94 }).toFile(hero)
  }
  const { chromium } = await import('playwright')
  const template = readFileSync(path.join(ROOT, 'scripts/studio/story/phone-ui.html'), 'utf8')
  const fetched = new Date(payoff.fetchedAt)
  const source = `Active single-family listings \u00b7 ${fetched.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })}`
  const executablePath = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
    : undefined
  const browser = await chromium.launch(executablePath ? { executablePath } : {})
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 693 },
      deviceScaleFactor: 1080 / 390,
    })
    for (const state of ['page', 'pressed', 'calling']) {
      const html = template
        .replaceAll('{{ROOT}}', `file://${ROOT}`)
        .replaceAll('{{STATE}}', state)
        .replaceAll('{{HERO}}', `file://${hero}`)
        .replaceAll('{{PLACE}}', payoff.placeLabel)
        .replaceAll('{{COUNT}}', String(payoff.activeCount))
        .replaceAll('{{MEDIAN}}', `$${payoff.medianListPrice.toLocaleString('en-US')}`)
        .replaceAll('{{SOURCE}}', source)
        .replaceAll('{{CLOCK}}', '5:47')
        .replaceAll('{{PHONE}}', '541.703.3095')
      const file = path.join(assets, `phone-${state}.html`)
      writeFileSync(file, html)
      await page.goto(`file://${file}`)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(assets, `phone-${state}.png`) })
      if (state === 'page') {
        // Where the thumb lands: the reel draws the tap on the real button, not a guess.
        const box = await page.locator('.cta').boundingBox()
        if (box) {
          const tap = [(box.x + box.width / 2) / 390, (box.y + box.height / 2) / 693]
          writeFileSync(path.join(assets, 'phone.json'), JSON.stringify({ tap }, null, 2))
        }
      }
      console.log(`phone: ${state} rendered`)
    }
  } finally {
    await browser.close()
  }
  void era
}

function stageStatus(piece: StoryPiece, plan: StoryPlan, manifest: Manifest): void {
  console.log(`${piece.title}: spent $${manifest.ledger.totalUsd.toFixed(2)} of $${manifest.ledger.capUsd}`)
  for (const slot of ['A', 'B'] as CastSlot[]) {
    console.log(
      `  cast ${slot}: ${manifest.cast[slot].takes.length} takes, selected ${manifest.cast[slot].selected ?? '-'}`,
    )
  }
  for (const shot of plan.shots) {
    const s = manifest.shots[shot.role]
    if (!s) continue
    const passing = s.stills.filter((t) => t.verdict?.pass).length
    console.log(
      `  ${shot.role.padEnd(10)} stills ${s.stills.length} (${passing} pass) sel ${s.selectedStill ? path.basename(s.selectedStill) : '-'} | clips ${s.clips.length} sel ${s.selectedClip ? path.basename(s.selectedClip) : '-'}`,
    )
  }
}

/** Each shot's lab parameters in one era's stock, keyed by role. */
function labByRole(stock: EraPack, plan: StoryPlan) {
  return Object.fromEntries(
    plan.shots.filter((s) => s.beat).map((s) => [s.role, labParamsFor(stock, s.beat!.exposure)]),
  )
}

/** The lab parameters per shot, for scripts/studio/story_reel.py. */
function writeReelInputs(piece: StoryPiece, era: EraPack, plan: StoryPlan): void {
  const lab = labByRole(era, plan)
  writeFileSync(path.join(dirFor(piece), 'lab.json'), JSON.stringify({ era: era.id, sound: era.sound, lab }, null, 2))
}

/**
 * The same selected footage in another era's film stock: a free regrade, no
 * generation. Writes lab-<era>.json for `story_reel.py build --lab`. Each shot
 * keeps its own exposure (day, night, interior); only the stock changes.
 */
function stageLook(piece: StoryPiece, era: EraPack, plan: StoryPlan, lookId: string | undefined): void {
  const look = getEra(lookId ?? '')
  if (!look) throw new Error('--era is required: the era whose film stock to regrade in (e.g. cine16_1978)')
  const file = path.join(dirFor(piece), `lab-${look.id}.json`)
  writeFileSync(file, JSON.stringify({ era: look.id, sound: era.sound, lab: labByRole(look, plan) }, null, 2))
  console.log(`wrote ${path.relative(process.cwd(), file)}`)
  console.log(
    `next: python3 scripts/studio/story_reel.py build --dir ${path.relative(process.cwd(), dirFor(piece))} --lab lab-${look.id}.json --name reel-${look.id}`,
  )
}

async function main(): Promise<void> {
  const { cmd, flags } = args()
  const { piece, era, plan } = pieceAndEra(flags)
  const readOnly = cmd === 'plan' || cmd === 'status' || cmd === 'look'
  const manifest = loadManifest(piece)
  ensureShots(manifest, plan)
  const roles = flags.roles ? flags.roles.split(',').map((r) => r.trim()) : null
  const takes = Math.max(1, Math.min(4, Number(flags.takes ?? 2)))
  // The frame judge is opt-in: curating from sheets/<role>.jpg is free.
  const judgeTakes = flags.judge === 'on'
  try {
    if (cmd === 'plan') await stagePlan(piece, era, plan)
    else if (cmd === 'cast') await stageCast(piece, era, manifest, takes, judgeTakes)
    else if (cmd === 'stills') await stageStills(piece, era, plan, manifest, roles, takes, judgeTakes)
    else if (cmd === 'motion')
      await stageMotion(
        piece,
        era,
        plan,
        manifest,
        roles,
        Math.max(1, Number(flags.takes ?? 1)),
        Math.max(2, Math.min(15, Number(flags.seconds ?? MOTION_SECONDS))),
        (['480p', '720p', '1080p'].includes(flags.res) ? flags.res : MOTION_RESOLUTION) as '480p' | '720p' | '1080p',
      )
    else if (cmd === 'sheet') await stageSheet(piece, era, plan, manifest, roles)
    else if (cmd === 'ingest') await stageIngest(piece, era, plan, manifest, flags.from)
    else if (cmd === 'adopt') await stageAdopt(piece, era, plan, manifest, flags['no-judge'] !== 'true')
    else if (cmd === 'select') stageSelect(manifest, flags)
    else if (cmd === 'payoff') await stagePayoff(piece)
    else if (cmd === 'phone') await stagePhone(piece, era, manifest)
    else if (cmd === 'status') stageStatus(piece, plan, manifest)
    else if (cmd === 'look') stageLook(piece, era, plan, flags.era)
    else throw new Error(`unknown command ${cmd}`)
  } finally {
    if (!readOnly) saveManifest(piece, manifest)
    writeReelInputs(piece, era, plan)
  }
  console.log(`spend so far: $${manifest.ledger.totalUsd.toFixed(2)} / $${manifest.ledger.capUsd}`)
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  },
)
