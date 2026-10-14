/**
 * lib/studio/qa/thresholds.ts - every number the measured output check holds a
 * video to, in one place (docs/plans/STUDIO_ONE_FACTORY.md, "What video:check
 * measures"). Changing a threshold is one line here and one test.
 *
 * Two kinds of limit:
 *  - QA_THRESHOLDS: the contract's own constants (freeze, captions, loudness,
 *    SSIM, safe area, end card timing). They are the same for every video type.
 *  - Type rules (min_s, max_s, hard_max_s, hook_max_s, min_hold_s, requires_*):
 *    READ from .claude/skills/ryan-studio/tools/video_types.json, defaults merged
 *    with the type, the same merge video_gate.mjs does. They are never copied
 *    here, so the paperwork gate and this check cannot drift apart.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const QA_THRESHOLDS = Object.freeze({
  /** Output format every video must have (check 2). */
  format: Object.freeze({
    width: 1080,
    height: 1920,
    fps: 30,
    /** A real 30 fps stream reports 30/1; this only absorbs float parsing. */
    fpsTolerance: 0.01,
    codec: 'h264',
    pixFmt: 'yuv420p',
  }),
  /** |ffprobe duration - manifest.video.duration| must not exceed this (check 2). */
  durationToleranceSeconds: 0.05,

  /** Motion (check 6): any frozen stretch this long or longer fails. */
  freezeSeconds: 1.2,
  /** ffmpeg freezedetect noise tolerance as a difference ratio. */
  freezeNoise: 0.003,

  /** Shots (check 5): ffmpeg scene score above this is a cut. */
  sceneCutScore: 0.35,

  /** Hook (check 4): a frame whose luma variance is under this is blank. */
  blankFrameLumaVarianceMin: 4,

  /** Sound (check 7). */
  audio: Object.freeze({
    lufsMin: -15,
    lufsMax: -13,
    truePeakMaxDb: -1.0,
  }),

  /** Captions (check 8). */
  caption: Object.freeze({
    maxWords: 4,
    minSeconds: 0.4,
    /** A caption may start this far off its first spoken word. */
    syncSeconds: 0.08,
  }),

  /** Safe area (check 11): a box's right edge and bottom edge. */
  safeArea: Object.freeze({ maxX: 960, maxY: 1640 }),

  /** End card (check 12), from templates/END_CARD_SPEC.md. */
  endcard: Object.freeze({
    /** SSIM of the frame at call + callProbeOffsetSeconds vs the golden still. */
    ssimMin: 0.92,
    callProbeOffsetSeconds: 0.5,
    /** Quality hit to Service hit. The spec's three word pops take about 1 s. */
    wordPopBudgetSeconds: 1.2,
    /** Call now + phone hold, Call to out. */
    callHoldMinSeconds: 1.5,
    /** The card's hard out must land on the last frame of the film, give or take this. */
    outToleranceSeconds: 0.1,
    /** The locked phone number, the one number exempt from check 9. */
    phone: '541.703.3095',
    /** Default locked golden still. Another worker owns the file. */
    goldenPath: 'lib/studio/motion/endcard.golden.png',
  }),

  /** Loop (check 13): SSIM of the last frame vs frame 0. */
  loopSsimMin: 0.85,

  /** Float slack for "at least" comparisons on seconds read from JSON. */
  epsilon: 1e-6,
})

/** Techniques (check 15) and the film ledger (check 16). */
export const TECHNIQUE_CATEGORIES = ['hook', 'scene', 'type', 'transition', 'cta', 'sound', 'footage', 'process'] as const
export type TechniqueCategory = (typeof TECHNIQUE_CATEGORIES)[number]

/** A film must have run at least one technique of each of these (check 15). */
export const REQUIRED_TECHNIQUE_CATEGORIES: readonly TechniqueCategory[] = Object.freeze(['hook', 'scene', 'type'])

/** Phrases the contract bans on top of video_types.json banned_phrases (check 10). */
export const EXTRA_BANNED_PHRASES: readonly string[] = Object.freeze(['top team', "buyer's market"])

export interface TypeRules {
  hook_max_s: number
  min_s: number
  max_s: number
  hard_max_s: number
  max_hero_numbers: number
  min_hold_s: number
  requires_end_card: boolean
  requires_real_footage: boolean
  requires_loop: boolean
  /** The film must carry a voiceover with captions (checks 7 and 8). */
  requires_voiceover: boolean
  requires_sources?: boolean
  requires_special_ad_category?: string
  requires_persona?: boolean
}

export interface VideoTypesFile {
  defaults: Partial<TypeRules>
  types: Record<string, Partial<TypeRules>>
  banned_phrases: string[]
  /** video_gate's fair housing words (check 10 and the renderer read the same list). */
  fair_housing_flags: string[]
}

/**
 * The repo root, found from this file's own location (lib/studio/qa is three
 * levels down). Plain path math rather than `new URL(..., import.meta.url)`,
 * which a bundler would read as an asset to ship.
 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export const TECHNIQUE_REGISTRY_PATH = join(REPO_ROOT, '.claude', 'skills', 'ryan-studio', 'techniques', 'registry.json')

/** The committed film ledger every machine shares (check 16). */
export const FILM_LEDGER_PATH = join(REPO_ROOT, 'data', 'studio', 'film-ledger.jsonl')

export const VIDEO_TYPES_PATH = join(REPO_ROOT, '.claude', 'skills', 'ryan-studio', 'tools', 'video_types.json')

const REQUIRED_RULE_KEYS: ReadonlyArray<keyof TypeRules> = [
  'hook_max_s',
  'min_s',
  'max_s',
  'hard_max_s',
  'min_hold_s',
  'requires_end_card',
  'requires_loop',
  'requires_voiceover',
]

let cached: { path: string; file: VideoTypesFile } | null = null

/** Read video_types.json. Throws when it is missing or not shaped as expected. */
export function loadVideoTypes(path: string = VIDEO_TYPES_PATH): VideoTypesFile {
  if (cached && cached.path === path) return cached.file
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<VideoTypesFile>
  if (!raw || typeof raw !== 'object' || !raw.defaults || !raw.types || !Array.isArray(raw.banned_phrases) || !Array.isArray(raw.fair_housing_flags)) {
    throw new Error(`${path} must hold defaults, types, banned_phrases and fair_housing_flags`)
  }
  const file: VideoTypesFile = { defaults: raw.defaults, types: raw.types, banned_phrases: raw.banned_phrases, fair_housing_flags: raw.fair_housing_flags }
  cached = { path, file }
  return file
}

/**
 * The rules for one video type: defaults merged with the type's own overrides.
 * Returns null for a type video_types.json does not list. Throws when the merged
 * rules lack a key the check needs (a broken video_types.json fails loudly).
 */
export function typeRulesFor(videoType: string, file: VideoTypesFile = loadVideoTypes()): TypeRules | null {
  if (!Object.prototype.hasOwnProperty.call(file.types, videoType)) return null
  const merged = { ...file.defaults, ...file.types[videoType] } as Partial<TypeRules>
  for (const key of REQUIRED_RULE_KEYS) {
    if (merged[key] === undefined) throw new Error(`video_types.json: type "${videoType}" has no ${key} after merging defaults`)
  }
  return merged as TypeRules
}

/** Every phrase check 10 bans: video_types.json plus the contract's extras. */
export function bannedPhrases(file: VideoTypesFile = loadVideoTypes()): string[] {
  const all = [...file.banned_phrases, ...EXTRA_BANNED_PHRASES].map((p) => p.toLowerCase())
  return [...new Set(all)]
}
