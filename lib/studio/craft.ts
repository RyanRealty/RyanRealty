/**
 * lib/studio/craft.ts — the anti-slop layer, as code.
 *
 * Canon and its sourcing: docs/GROK_CRAFT_CANON.md.
 *
 * Nothing in the studio hand-writes a generator prompt. Every prompt is built
 * here, from a ShotSpec, in the order a director actually writes a shot:
 *
 *   glass and format -> light -> camera move with amplitude -> subject with
 *   ONE verb -> materials -> hard negatives
 *
 * That ordering is not decoration. The failure mode of Grok Imagine, and of
 * every model like it, is an unconstrained prompt: leave motion unspecified
 * and it defaults too hot, leave the light unnamed and you get two suns,
 * ask for a readable sign and you get letterforms that hold for two frames
 * and then collapse. A prompt that names all four constraints does not drift.
 *
 * The rules encoded here are not preferences. Each one maps to a specific
 * observed failure, noted at the rule.
 */
import type { GrokAspect } from '@/lib/grok/image'
import type { GrokVideoAspect } from '@/lib/grok/video'

/**
 * Booster tokens. They read as craft and do the opposite: they push the model
 * toward the oversaturated, plastic-HDR centre of its training distribution,
 * which is the exact look people mean by "AI slop".
 */
export const BANNED_PROMPT_TOKENS = [
  '8k', '4k uhd', 'masterpiece', 'photoreal', 'photorealistic', 'ultra detailed',
  'ultra-detailed', 'hyperrealistic', 'hyper-realistic', 'trending on artstation',
  'award winning', 'award-winning', 'stunning', 'breathtaking', 'epic', 'majestic',
  'unreal engine', 'octane render', 'ray tracing', 'highly detailed', 'intricate',
  'vibrant colors', 'dramatic lighting', 'cinematic vibes', 'anamorphic vibes',
  'cinematic lens', 'professional photography', 'dslr', 'bokeh-licious', '--stylize',
  'best quality', 'high quality', 'sharp focus', 'perfect composition',
] as const

/** Always appended. Generated type and marks are the loudest tell there is. */
export const UNIVERSAL_NEGATIVES = [
  'no text',
  'no signage',
  'no lettering',
  'no logos',
  'no watermark',
  'no captions',
] as const

/** Added unless a format explicitly casts a person. */
export const NO_PEOPLE_NEGATIVES = ['no people', 'no faces', 'no hands'] as const

/**
 * Six seconds. Identity and background geometry degrade at the tails first,
 * so a longer single take buys nothing: two locked six-second beats cut
 * together read better than one twelve-second drift.
 */
export const SHOT_SECONDS = 6

/** Camera moves that survive. One axis, stated amplitude, nothing stacked. */
export const CAMERA_MOVES = {
  push: 'slow dolly-in 30cm over 6 seconds, no pan, no tilt',
  pull: 'slow dolly-out 30cm over 6 seconds, no pan, no tilt',
  locked: 'locked-off tripod, no camera movement, 1cm handheld micro-sway only',
  panLeft: 'pan 8 degrees left over 6 seconds, no tilt, no dolly',
  panRight: 'pan 8 degrees right over 6 seconds, no tilt, no dolly',
  riseUp: 'slow crane up 40cm over 6 seconds, no pan, no tilt',
} as const

export type CameraMove = keyof typeof CAMERA_MOVES

export type ShotSpec = {
  /** Real glass, never "cinematic lens". e.g. '35mm spherical, T2.8'. */
  lens: string
  /** Height and framing. e.g. 'eye-level, wide'. */
  framing: string
  /** What is in frame. Concrete nouns and materials, no interiority. */
  subject: string
  /** Named like a gaffer: direction, quality, colour temperature, falloff. */
  light: string
  move: CameraMove
  /** What moves in the world. One completable action. */
  worldMotion?: string
  /** Extra hard negatives for this format. */
  negatives?: string[]
  /** Set true only for a format that deliberately casts a person. */
  allowPeople?: boolean
}

function negativesFor(spec: ShotSpec): string[] {
  return [
    ...UNIVERSAL_NEGATIVES,
    ...(spec.allowPeople ? [] : NO_PEOPLE_NEGATIVES),
    ...(spec.negatives ?? []),
  ]
}

/**
 * The hero still. This is the frame we inspect and, if it passes, the frame
 * we animate. Text-to-video without this step is previz, never a deliverable.
 */
export function buildStillPrompt(spec: ShotSpec): string {
  return [
    `${spec.lens}, ${spec.framing}.`,
    `${spec.subject}.`,
    `${spec.light}.`,
    'Natural contrast, true-to-life colour, photographic grain, deep focus.',
    negativesFor(spec).join(', ') + '.',
  ].join(' ')
}

/**
 * The motion prompt for image-to-video off an approved still.
 * States the move, its amplitude, and an explicit motion budget, because an
 * unstated motion amount is the default that ruins paid work.
 */
export function buildMotionPrompt(spec: ShotSpec): string {
  return [
    `Camera: ${CAMERA_MOVES[spec.move]}, 180 degree shutter.`,
    spec.worldMotion ? `The only motion in frame: ${spec.worldMotion}.` : 'The scene is otherwise still.',
    'Motion amount: minimal. Hold the composition. No camera shake, no zoom, no rack focus.',
    negativesFor(spec).join(', ') + '.',
  ].join(' ')
}

/**
 * Reject a prompt that carries booster tokens.
 * Exported so a gate can run it over every prompt the studio ships.
 */
export function findBannedTokens(prompt: string): string[] {
  const haystack = prompt.toLowerCase()
  return BANNED_PROMPT_TOKENS.filter((token) => haystack.includes(token))
}

/** Throws when a prompt would push the model toward the slop centre. */
export function assertCraftClean(prompt: string, label = 'prompt'): void {
  const banned = findBannedTokens(prompt)
  if (banned.length > 0) {
    throw new Error(
      `${label} contains booster tokens that degrade output: ${banned.join(', ')}. ` +
        'Name the lens, the light, and the move instead (docs/GROK_CRAFT_CANON.md).',
    )
  }
}

// ── Delivery formats ───────────────────────────────────────────────────────

/**
 * Aspect per destination. Note Instagram's preferred 4:5 feed portrait is NOT
 * in the Imagine enum, so portrait feed stills are generated 3:4 and the
 * platform letterboxes rather than us upscaling a crop.
 */
export const STILL_ASPECT: Record<'story' | 'feedPortrait' | 'feedSquare' | 'wide', GrokAspect> = {
  story: '9:16',
  feedPortrait: '3:4',
  feedSquare: '1:1',
  wide: '16:9',
}

export const VIDEO_ASPECT: Record<'story' | 'feedSquare' | 'wide', GrokVideoAspect> = {
  story: '9:16',
  feedSquare: '1:1',
  wide: '16:9',
}

// ── Period story films (lib/studio/story) ─────────────────────────────────

/**
 * Home-movie camera grammar. The listing moves above are a dolly grip's; these
 * are an amateur's, because a 1982 family did not own a slider. Zooms are NOT
 * here on purpose: a zoom asked of the generator drifts and breathes, so every
 * zoom in a story film is a crop keyframe in the film lab, exact to the frame.
 */
export const HOME_MOVIE_MOVES = {
  hold: 'handheld by an amateur and held on the subject, a gentle breathing sway of a centimetre or two, no pan, no zoom',
  follow: 'handheld by an amateur who follows the subject with small late corrections, no zoom',
  pan: 'handheld pan of about fifteen degrees at an uneven amateur speed, then it settles, no zoom',
  dashboard: 'camera braced on the dashboard, only road vibration moves it, no pan, no zoom',
  armLength: 'camera held at arm’s length facing the two of them, a small wobble, no zoom',
  tripod: 'locked off on a tripod and composed like a photograph: subject centered, level horizon, no camera movement, no zoom',
} as const

export type HomeMovieMove = keyof typeof HOME_MOVIE_MOVES

export type PeriodShotSpec = {
  /** The year every detail must pass for. */
  year: number
  /** Where the camera is and what glass, e.g. 'from the driver seat, 28mm'. */
  framing: string
  /** Gaffer-named light: direction, quality, colour temperature. */
  light: string
  move: HomeMovieMove
  /** Who is in frame and the ONE thing they do. */
  action: string
  /** Wardrobe, props, and materials, concrete nouns only. */
  materials: string
  /** The real place, in a local's words. */
  place: string
  /** Period content cues from the era pack (hair, cars, rooms). */
  period: string
  /** How an amateur of the era behaved with the camera. */
  camera: string
  /**
   * What each source image is, in order, when the still is an edit
   * conditioned on references (place still, cast sheets).
   */
  sources?: string[]
}

/**
 * The hero still for a period shot. Positive phrasing only: Grok Imagine
 * ignores negatives, and naming a thing in a negative induces it (LESSONS #2).
 * The film look is NOT requested here; the lab applies one stock to every shot.
 */
export function buildPeriodStillPrompt(spec: PeriodShotSpec): string {
  const sources = spec.sources?.length
    ? spec.sources.map((s, i) => `Image ${i + 1} is ${s}.`).join(' ') +
      ' Keep the people exactly as they appear in their reference images and keep the real place recognisable.'
    : ''
  return [
    sources,
    `Candid color photograph, ${spec.year}, ${spec.framing}, ${spec.camera}.`,
    `${spec.light}.`,
    `${spec.place}.`,
    `${spec.action}.`,
    `${spec.materials}.`,
    `Everything in frame belongs to ${spec.year}: ${spec.period}.`,
    'Real skin with pores and fine lines, natural unretouched faces, natural restrained color, soft optics, deep focus.',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Motion for image-to-video off an approved period still. One action, the
 * camera grammar, and an explicit hold on everything else. Identity is named
 * because face drift is the failure that kills a cast film.
 */
export function buildPeriodMotionPrompt(spec: Pick<PeriodShotSpec, 'move' | 'action' | 'year'>): string {
  return [
    `Home movie from ${spec.year}.`,
    `Camera: ${HOME_MOVIE_MOVES[spec.move]}.`,
    `Action: ${spec.action}, at natural real-time speed.`,
    'Everyone keeps the same face, hair, and clothes from the first frame to the last. The background stays put.',
  ].join(' ')
}
