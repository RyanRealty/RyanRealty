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
import type { ArcId } from './arc'
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
  /** Which arc the piece fills. Default the visitor arc. */
  arc?: ArcId
  beats: Partial<Record<BeatRole, string>>
  /**
   * Continuity: a role whose selected still is handed to another role as a
   * source image, so the house on the phone beat is the house on the sign beat.
   * A bare role reuses the street-and-house label; `keeps` says what the
   * earlier frame is for when it is not a street (the car's inside, a kitchen).
   */
  continuity?: Partial<Record<BeatRole, BeatRole | { from: BeatRole; keeps: string }>>
  payoff: PhonePayoff
  /** Roles the piece leaves out (winter-1982 has no phone: Matt 2026-09-23). */
  omit?: BeatRole[]
  /** One companion (the dog): its reference photo keeps it the same animal in every shot that has it. */
  companion?: { ref: string; label: string }
  /**
   * The shot whose still becomes the phone screen's hero, crisp and ungraded.
   * A neighbourhood frame, never the mock-up house (a house over a price reads
   * as a listing). Default 'town'.
   */
  phoneHeroRole?: BeatRole
  /**
   * A real photograph for the phone screen's hero (an asset-library ref),
   * preferred over phoneHeroRole: the phone is the present, so it shows the
   * real place, not a frame of the cast.
   */
  phoneHeroRef?: string
  /** Top caption over the reel's first seconds. */
  openCaption: string
  /** A caption over the first seconds of a later shot (the time jump home). */
  roleCaptions?: Partial<Record<BeatRole, string>>
  /** The end-card line under the wordmark. Omit for a card with only the wordmark and contact. */
  endLine?: string
}

export const STORY_PIECES: StoryPiece[] = [
  {
    id: 'winter-1982',
    title: 'Winter, 1982',
    oneSentence:
      'A couple’s 1982 ski weekend in Bend follows them home, and one week of city life later he calls the number on the yard sign they walked past.',
    eraId: 'super8_1982',
    season: 'winter',
    // Matt 2026-09-24: the quintessential Bend story. They come, they live it,
    // they go home, and home no longer compares.
    arc: 'homecoming',
    cast: {
      A: {
        slot: 'A',
        pronoun: 'she',
        look: 'a woman of about thirty-two with feathered, shoulder-length chestnut hair, a light dusting of freckles, hazel eyes, and a wide easy laugh',
        wardrobe: {
          travel: 'a cream cable-knit turtleneck under a burgundy down vest, grey wool mittens',
          ski: 'a fitted powder-blue one-piece ski suit in matte nylon with one thin red and white stripe across the chest, a white knit hat with a pom-pom',
          apres:
            'a navy Nordic ski sweater with a white snowflake yoke over a turtleneck, the white knit hat pushed back on her head',
          dinner: 'a dark green wrap dress and small gold hoop earrings, her hair down',
          evening: 'a long camel wool coat, a cream knit scarf, and a cream knit cap',
          work: 'a cream blouse with a soft bow at the collar under a camel wool blazer, small gold hoop earrings',
        },
      },
      B: {
        slot: 'B',
        pronoun: 'he',
        look: 'a man of about thirty-four with a full brown moustache, side-parted brown hair over the tops of his ears, and deep laugh lines',
        wardrobe: {
          travel: 'a tan corduroy jacket with a sheepskin collar over a navy turtleneck',
          ski: 'a boxy, dull navy nylon ski parka with no emblem over red bib ski pants, a red knit cap',
          apres: 'a cream fisherman cable-knit sweater, the red knit cap still on',
          dinner: 'a pale blue oxford shirt under a brown tweed blazer',
          evening: 'the tan corduroy jacket with the sheepskin collar turned up, a navy knit cap',
          work: 'a white dress shirt with the sleeves rolled to the forearm and a burgundy tie pulled loose at the collar, grey suit trousers',
        },
      },
    },
    beats: {
      hook: 'car-wave-lab',
      arrive: 'road-to-bachelor',
      play: 'ski-follow',
      play_pair: 'chairlift-selfie',
      apres: 'apres-lodge',
      eat: 'supper-tower-window',
      town: 'drake-park-walk-lab',
      discover: 'she-points-sign',
      sign: 'sign-zoom-discover',
      pack: 'pack-wagon-lab',
      leave: 'rear-window-lab',
      commute: 'commute-gridlock',
      work_b: 'desk-his',
      work_a: 'desk-hers',
      home: 'kitchen-snapshot',
      call: 'call-kitchen-rotary',
    },
    // The walk by Mirror Pond (Matt 2026-09-24) replaces the Old Bend stroll: one walk, the dog in it.
    omit: ['stroll'],
    companion: {
      ref: 'asset:c9fce792-26ab-4837-81a0-cfaf943b8c43',
      label: 'the reference photo of their dog (the same black Labrador: same face, coat, build, and red collar)',
    },
    continuity: {
      commute: { from: 'hook', keeps: 'the inside of the same car (keep the dashboard, seats, and trim; not the people or the view)' },
      call: { from: 'home', keeps: 'the same kitchen a moment earlier (keep the room, the table, the lamp, and the light the same)' },
    },
    payoff: { kind: 'none' },
    openCaption: 'Bend, Oregon. Winter, 1982.',
    roleCaptions: { commute: 'One week later.' },
    // Matt 2026-09-24, his words. The film fades out on the ring; the card answers it.
    endLine: 'We’re here when you’re ready to make the call.',
  },
]

export function getStoryPiece(id: string): StoryPiece | null {
  return STORY_PIECES.find((p) => p.id === id) ?? null
}

/** The earlier role a shot takes its continuity still from, and what that still is for. */
export function continuityFor(piece: StoryPiece, role: BeatRole): { from: BeatRole; label: string } | null {
  const entry = piece.continuity?.[role]
  if (!entry) return null
  if (typeof entry === 'string') {
    return {
      from: entry,
      label: 'the same street and house a moment earlier in this film (keep the house, trees, and light the same)',
    }
  }
  return { from: entry.from, label: entry.keeps }
}
