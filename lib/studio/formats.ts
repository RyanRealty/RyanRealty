/**
 * lib/studio/formats.ts — what the studio knows how to make.
 *
 * A format is a small, declarative record: what subject it needs, how its
 * hero frame is built, what the vision gate must reject, where it posts, and
 * whether it carries figures that need a §0 trace. Adding a format is adding
 * a row here, not a new pipeline.
 *
 * Every shot spec goes through lib/studio/craft.ts. No format writes a raw
 * generator prompt.
 */
import type { ShotSpec } from './craft'
import { STILL_ASPECT, VIDEO_ASPECT } from './craft'
import type { GrokAspect } from '@/lib/grok/image'
import type { GrokVideoAspect } from '@/lib/grok/video'

export type StudioFormatId =
  | 'listing_film'
  | 'listing_motion'
  | 'market_pulse'
  | 'place_video'
  | 'trend_reactive'

export type StudioMediaKind = 'video' | 'image'

export type StudioFormat = {
  id: StudioFormatId
  label: string
  /** One line for the console, in Matt's language, not the pipeline's. */
  what: string
  media: StudioMediaKind
  /**
   * 'listing'  needs an MLS number or address
   * 'place'    needs a neighborhood, community, or city
   * 'none'     runs off live market data with no subject
   */
  subject: 'listing' | 'place' | 'none'
  /**
   * Where the hero frame comes from.
   * 'mls_photo' is the real listing photograph, never a generated house.
   * 'generated' builds a still and inspects it before animating.
   */
  frameSource: 'mls_photo' | 'generated'
  stillAspect: GrokAspect
  videoAspect: GrokVideoAspect
  seconds: number
  /** Platforms the draft proposes. Matt can trim before approving. */
  platforms: string[]
  /** True when the caption carries figures and needs a §0 citation set. */
  carriesFigures: boolean
  /** Extra hard-fail conditions handed to the vision gate. */
  alsoReject: string[]
  /**
   * Beats. 1 is a single animated frame. More than 1 builds a cut sequence
   * from the listing's own photo set (lib/studio/film.ts).
   */
  shots?: number
}

export const STUDIO_FORMATS: Record<StudioFormatId, StudioFormat> = {
  listing_film: {
    id: 'listing_film',
    label: 'Listing film',
    what: 'Four beats cut from the listing\u2019s own photos: outside, in, the room that sells it, back out.',
    media: 'video',
    subject: 'listing',
    frameSource: 'mls_photo',
    stillAspect: STILL_ASPECT.story,
    videoAspect: VIDEO_ASPECT.story,
    seconds: 6,
    shots: 4,
    platforms: ['instagram', 'facebook'],
    carriesFigures: true,
    alsoReject: [
      'the house has been altered from the source photograph',
      'furniture, landscaping, or structures that were not in the source photograph',
    ],
  },
  listing_motion: {
    id: 'listing_motion',
    label: 'Listing motion',
    what: 'A live listing photo, given a slow push. Price and address from the MLS row.',
    media: 'video',
    subject: 'listing',
    frameSource: 'mls_photo',
    stillAspect: STILL_ASPECT.story,
    videoAspect: VIDEO_ASPECT.story,
    seconds: 6,
    platforms: ['instagram', 'facebook'],
    carriesFigures: true,
    alsoReject: [
      'the house has been altered from the source photograph',
      'furniture, landscaping, or structures that were not in the source photograph',
    ],
  },
  market_pulse: {
    id: 'market_pulse',
    label: 'Market pulse',
    what: 'This week in Central Oregon, in verified numbers, over a landscape plate.',
    media: 'video',
    subject: 'none',
    frameSource: 'generated',
    stillAspect: STILL_ASPECT.story,
    videoAspect: VIDEO_ASPECT.story,
    seconds: 6,
    platforms: ['instagram', 'facebook', 'google_business_profile'],
    carriesFigures: true,
    alsoReject: ['any house, building, or for-sale sign', 'any chart, graph, or number rendered in the image'],
  },
  place_video: {
    id: 'place_video',
    label: 'Place film',
    what: 'One neighborhood or resort community, shot like a place, with its live inventory.',
    media: 'video',
    subject: 'place',
    frameSource: 'generated',
    stillAspect: STILL_ASPECT.story,
    videoAspect: VIDEO_ASPECT.story,
    seconds: 6,
    platforms: ['instagram', 'facebook'],
    carriesFigures: true,
    alsoReject: [
      'any identifiable real house presented as a specific listing',
      'any street sign, address number, or community entry sign',
    ],
  },
  trend_reactive: {
    id: 'trend_reactive',
    label: 'Answer the room',
    what: 'What Bend is actually saying about the market this week, answered with our data.',
    media: 'image',
    subject: 'none',
    frameSource: 'generated',
    stillAspect: STILL_ASPECT.feedPortrait,
    videoAspect: VIDEO_ASPECT.feedSquare,
    seconds: 6,
    platforms: ['instagram', 'facebook', 'x'],
    carriesFigures: true,
    alsoReject: ['any chart, graph, headline, or number rendered in the image'],
  },
}

export function getStudioFormat(id: string): StudioFormat | null {
  return (STUDIO_FORMATS as Record<string, StudioFormat>)[id] ?? null
}

export const STUDIO_FORMAT_LIST: StudioFormat[] = Object.values(STUDIO_FORMATS)

// ── Shot specs ─────────────────────────────────────────────────────────────

/**
 * The Central Oregon plate. Named landscape, named light, no second sun.
 * `wrong_region` is a real failure here: ask a model for "beautiful
 * landscape" and it returns palms or eastern hardwoods.
 */
export function centralOregonPlate(options: {
  timeOfDay: 'golden hour' | 'blue hour' | 'clear morning'
  place?: string
}): ShotSpec {
  const light =
    options.timeOfDay === 'golden hour'
      ? 'Low sun key from camera-left, 5400K, long raking shadows, two stop falloff into shadow, no second sun'
      : options.timeOfDay === 'blue hour'
        ? 'Ambient blue skylight key, 8000K, no direct sun, soft shadowless falloff, warm 2700K point far in the distance'
        : 'High soft overcast key, 6200K, even shadowless light, no direct sun'

  const subject = options.place
    ? `The high desert landscape around ${options.place}, Central Oregon: weathered juniper, sage flat, basalt rimrock, ponderosa stands, the snow-capped Cascade peaks on the far horizon`
    : 'Central Oregon high desert: weathered juniper, sage flat, basalt rimrock, ponderosa stands, the snow-capped Cascade peaks on the far horizon'

  return {
    lens: '35mm spherical, T2.8',
    framing: 'eye-level, wide establishing',
    subject,
    light,
    move: 'push',
    worldMotion: 'sage and juniper moving in a light breeze, slow high cloud drift',
    negatives: ['no houses', 'no buildings', 'no roads', 'no vehicles', 'no for-sale signs'],
  }
}

/**
 * The listing shot. The source is a real photograph, so there is no still to
 * generate and nothing to restyle: we lock frame one and push. Changing how a
 * listed home looks misrepresents a real property.
 */
export function listingShot(): ShotSpec {
  return {
    lens: 'matched to the source photograph',
    framing: 'as photographed',
    subject: 'this exact photograph, unchanged',
    light: 'the light already in the photograph, unchanged',
    move: 'push',
    worldMotion: 'nothing in the scene moves',
    negatives: [
      'do not add or remove objects',
      'do not change the house',
      'do not change the landscaping',
      'do not change the sky',
      'no people',
    ],
  }
}
