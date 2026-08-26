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
