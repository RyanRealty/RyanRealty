/**
 * lib/studio/story/pieces.ts — the story films we have written.
 *
 * A piece is a row: an era, a season, a couple, the beats it pins, and what
 * the phone shows at the break. The engine (arc, eras, beats, craft, the film
 * lab) is shared; a new piece is a new row, not new code.
 *
 * The phone payoff never carries an invented number (CLAUDE.md §0). It shows a
 * live figure resolved through the DAL at render time and traced in the
 * piece's citations.json, or it shows no figure at all.
 */
import type { BeatRole, Season } from './beats'
import type { Cast } from './cast'
import type { EraId } from './eras'

export type PhonePayoff =
  | {
      /** A live neighborhood figure from getNeighborhoodPublicInventory. */
      kind: 'neighborhood_inventory'
      geoSlug: string
      placeLabel: string
    }
  | { kind: 'none' }

export type StoryPiece = {
  id: string
  title: string
  /** Patrick Clair's test: the idea in one sentence. */
  oneSentence: string
  eraId: EraId
  season: Season
  cast: Cast
  beats: Partial<Record<BeatRole, string>>
  /**
   * Continuity: a role whose selected still is handed to another role as a
   * source image, so the house on the phone beat is the house on the sign beat.
   */
  continuity?: Partial<Record<BeatRole, BeatRole>>
  payoff: PhonePayoff
  /**
   * The shot whose still becomes the phone screen's hero, crisp and ungraded.
   * A neighbourhood frame, never the mock-up house (a house over a price reads
   * as a listing). Default 'town'.
   */
  phoneHeroRole?: BeatRole
  /** Top caption over the reel's first seconds. */
  openCaption: string
  /** The end-card line under the wordmark. */
  endLine: string
}

export const STORY_PIECES: StoryPiece[] = [
  {
    id: 'winter-1982',
    title: 'Winter, 1982',
    oneSentence:
      'A couple’s 1982 Super 8 home movie of a ski weekend in Bend ends with him pulling a smartphone out of his coat to call Ryan Realty.',
    eraId: 'super8_1982',
    season: 'winter',
    cast: {
      A: {
        slot: 'A',
        pronoun: 'she',
        look: 'a woman of about thirty-two with feathered, shoulder-length chestnut hair, a light dusting of freckles, hazel eyes, and a wide easy laugh',
        wardrobe: {
          travel: 'a cream cable-knit turtleneck under a burgundy down vest, grey wool mittens',
          ski: 'a fitted powder-blue one-piece ski suit in matte nylon with one thin red and white stripe across the chest, a white knit hat with a pom-pom',
          dinner: 'a dark green wrap dress and small gold hoop earrings, her hair down',
          evening: 'a long camel wool coat, a cream knit scarf, and a cream knit cap',
        },
      },
      B: {
        slot: 'B',
        pronoun: 'he',
        look: 'a man of about thirty-four with a full brown moustache, side-parted brown hair over the tops of his ears, and deep laugh lines',
        wardrobe: {
          travel: 'a tan corduroy jacket with a sheepskin collar over a navy turtleneck',
          ski: 'a boxy, dull navy nylon ski parka with no emblem over red bib ski pants, a red knit cap',
          dinner: 'a pale blue oxford shirt under a brown tweed blazer',
          evening: 'the tan corduroy jacket with the sheepskin collar turned up, a navy knit cap',
        },
      },
    },
    beats: {
      hook: 'car-wave',
      arrive: 'road-to-bachelor',
      play: 'ski-toward-lens',
      play_pair: 'chairlift-selfie',
      eat: 'supper-toast',
      town: 'drake-park-bike',
      stroll: 'old-bend-walk',
      discover: 'she-points',
      sign: 'yard-sign-bungalow',
      phone: 'phone-out',
      call: 'on-the-phone',
    },
    continuity: { discover: 'stroll', sign: 'stroll', phone: 'sign', call: 'sign' },
    payoff: { kind: 'neighborhood_inventory', geoSlug: 'bend-old-bend', placeLabel: 'Old Bend' },
    openCaption: 'Bend, Oregon. Winter, 1982.',
    endLine: 'People have been falling for Bend on a weekend visit for a long time. We’ll help you stay.',
  },
]

export function getStoryPiece(id: string): StoryPiece | null {
  return STORY_PIECES.find((p) => p.id === id) ?? null
}
