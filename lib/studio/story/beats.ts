/**
 * lib/studio/story/beats.ts — the Bend beat library.
 *
 * A beat is one thing a visitor does here, written once and reused across
 * every era and every couple. Each carries the years it can honestly appear
 * in (the place or the activity existed), the seasons it belongs to, the real
 * local stills that condition its frame, and one action.
 *
 * The year range is the guardrail that keeps a period piece honest: a 1982 reel
 * cannot pull the brewery beat (Deschutes Brewery opened in 1988) or a stroll
 * through the Old Mill District shops (the mill ran until 1994; the shops came
 * after 2000). The arc planner refuses an out-of-range beat instead of trusting
 * whoever writes the piece to remember.
 *
 * Place stills are asset-library ids (data/asset-library/manifest.json) or
 * Wikimedia Commons file titles ("commons:File:...") with a free license. A
 * place beat with no still fails the reference test (creative-brain law 1);
 * interiors and the car do not need one.
 */
import type { HomeMovieMove } from '../craft'
import type { ExposureVariant } from './eras'
import type { CastSlot, WardrobeKey } from './cast'

export type Season = 'winter' | 'spring' | 'summer' | 'fall'

/** The slot a beat fills in an arc. */
export type BeatRole =
  | 'hook'
  | 'arrive'
  | 'play'
  | 'play_pair'
  | 'eat'
  | 'town'
  | 'stroll'
  | 'discover'
  | 'sign'
  | 'phone'
  | 'call'

export type BeatDef = {
  id: string
  role: BeatRole
  label: string
  /** Inclusive years this beat can honestly appear in. */
  years: [number, number]
  /** Why the range is what it is. Plain words, sourced in docs/STORY_FILMS.md. */
  yearsWhy?: string
  seasons: Season[]
  /** The real place, in a local's words. */
  place: string
  /** Real local stills that condition the frame. */
  refs: string[]
  cast: CastSlot[]
  wardrobe?: WardrobeKey
  /** Camera position and glass. */
  framing: string
  light: string
  exposure: ExposureVariant
  /** ONE action, written with cast handles {A} and {B}. */
  action: string
  /** Props and materials beyond wardrobe. */
  props?: string
  move: HomeMovieMove
  /** Extra hard fails for the judge on this beat. */
  alsoReject?: string[]
  /** The one thing in frame that is allowed to be out of period. */
  allowAnachronism?: string
  /** A post composite this beat needs (the brand never goes through a generator). */
  composite?: 'yard_sign'
  /**
   * Which era cues this frame needs. Default none. Era cues are scene
   * content: handing "brick storefronts" to every exterior put a downtown
   * main street under the ski run and on the road to the mountain (2026-09-23).
   */
  periodCues?: Array<'street' | 'vehicles' | 'rooms'>
}

const ALWAYS: [number, number] = [1900, 2100]

export const BEATS: BeatDef[] = [
  // ── hook ────────────────────────────────────────────────────────────────
  {
    id: 'car-wave',
    role: 'hook',
    label: 'She waves from the passenger seat',
    years: [1950, 2100],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    place: 'inside the car on the highway into Bend, tall ponderosa pines passing the passenger window',
    refs: [],
    cast: ['A'],
    wardrobe: 'travel',
    framing: 'filmed by the driver: the camera looks across the front seat at her in the PASSENGER seat, the passenger window and the pines behind her, 28mm',
    light: 'flat overcast daylight through the windshield, cool on her face, the cabin a stop darker',
    periodCues: ['vehicles'],
    exposure: 'day',
    action: '{A} turns from the window to the camera, laughing, and waves',
    props: 'a boxy period dashboard in brown vinyl',
    move: 'hold',
  },
  // ── arrive ──────────────────────────────────────────────────────────────
  {
    id: 'road-to-bachelor',
    role: 'arrive',
    label: 'The road runs at the mountain',
    years: ALWAYS,
    seasons: ['winter', 'fall', 'spring', 'summer'],
    place:
      'the Cascade Lakes Highway west of Bend: a straight two-lane road between tall ponderosa pines, ' +
      'snow-covered Mount Bachelor rising ahead',
    refs: ['asset:d7f06007-475f-4a93-ad09-f2aa31633aad'],
    cast: [],
    framing: 'through the windshield from the passenger seat, 35mm, the top of the dashboard along the bottom edge, an empty road ahead',
    light: 'clear winter afternoon sun from camera-left, 5600K, blue sky, bright snow on the shoulders',
    exposure: 'day',
    action: 'the road rolls toward the mountain as the car drives on',
    move: 'dashboard',
  },
  // ── play ────────────────────────────────────────────────────────────────
  {
    id: 'ski-toward-lens',
    role: 'play',
    label: 'She skis to the lens and stops in a spray',
    years: [1958, 2100],
    yearsWhy: 'Skiing opened on Bachelor Butte in 1958; it was renamed Mt. Bachelor in 1983. On-screen text in a pre-1983 piece says Bachelor Butte.',
    seasons: ['winter'],
    place: 'a groomed run high on Mount Bachelor, open snow all around, the snowy summit cone behind, wind-sculpted snow ghost trees, nothing but mountain in the background',
    refs: ['asset:9671ec09-6f90-4aea-9f11-8669d83feb4f'],
    cast: ['A'],
    wardrobe: 'ski',
    framing: 'from the edge of the run at snow level, 35mm',
    light: 'hard high-altitude sun from camera-left, 5600K, deep blue sky, bright snow',
    exposure: 'day',
    action: '{A} skis toward the camera and stops sideways in a spray of snow, poles raised, laughing',
    props: 'long, narrow, nearly straight early-1980s skis with no sidecut, thin aluminum poles with leather baskets',
    move: 'follow',
  },
  {
    id: 'float-the-river',
    role: 'play',
    label: 'Floating the Deschutes',
    years: ALWAYS,
    seasons: ['summer'],
    place: 'the Deschutes River through Bend on a hot afternoon, ponderosa and juniper on the banks',
    refs: [],
    cast: ['A', 'B'],
    wardrobe: 'summer',
    framing: 'from a third inner tube on the water, 28mm',
    light: 'high summer sun, 5600K, glitter on the water',
    exposure: 'day',
    action: '{A} and {B} drift past on inner tubes and wave',
    move: 'hold',
  },
  // ── play_pair ───────────────────────────────────────────────────────────
  {
    id: 'chairlift-selfie',
    role: 'play_pair',
    label: 'Both of them on the chair, camera at arm’s length',
    years: [1958, 2100],
    seasons: ['winter'],
    place: 'high above the snow on a two-person chairlift on Mount Bachelor, the snowy summit and ponderosa-dotted slopes falling away behind, nothing but mountain in the background',
    refs: ['asset:9671ec09-6f90-4aea-9f11-8669d83feb4f'],
    cast: ['A', 'B'],
    wardrobe: 'ski',
    framing: 'the camera held at arm’s length by him, 21mm wide, both faces in frame',
    light: 'hard high-altitude sun, 5600K, deep blue sky',
    exposure: 'day',
    action: '{A} and {B} lean their heads together to fit in the frame and grin, his arm reaching out of frame toward the camera',
    props: 'dull matte fabrics with no logos or emblems, a simple wooden-slat double chair with a single steel safety bar',
    move: 'armLength',
  },
  // ── eat ─────────────────────────────────────────────────────────────────
  {
    id: 'supper-toast',
    role: 'eat',
    label: 'Supper downtown, a toast',
    years: ALWAYS,
    seasons: ['winter', 'fall', 'spring', 'summer'],
    place: 'a warm, wood-paneled restaurant in downtown Bend, knotty pine walls, other diners soft in the background',
    refs: [],
    periodCues: ['rooms'],
    cast: ['A', 'B'],
    wardrobe: 'dinner',
    framing: 'across the table at seated eye level, 28mm',
    light: 'warm tungsten from a candle on the table and a low pendant lamp, 2700K, deep falloff into shadow',
    exposure: 'interior_low',
    action: '{A} and {B} clink wine glasses across the table and laugh',
    props: 'a candle in a red glass globe, a white tablecloth, heavy cutlery',
    move: 'hold',
  },
  // ── town ────────────────────────────────────────────────────────────────
  {
    id: 'downtown-night-bike',
    role: 'town',
    label: 'Downtown at night: a local on a bike, a dog alongside',
    years: [1930, 2100],
    seasons: ['winter'],
    place:
      'Wall Street in downtown Bend at night after a snowfall: two-story brick storefronts with lit ' +
      'shop windows, angled parking, packed snow on the street',
    refs: ['asset:0a37e880-6b0c-4274-b765-5412fb539fe6', 'asset:3998dd63-9c9a-4e1a-a301-f0371a4b2860'],
    periodCues: ['street', 'vehicles'],
    cast: [],
    framing: 'from the sidewalk, 35mm',
    light: 'warm shop windows and incandescent street lamps, 2400K, snow lit from below',
    exposure: 'night',
    action: 'a man in a wool coat rides a bicycle slowly past with a shaggy dog trotting beside him, and raises a hand to the camera',
    move: 'pan',
  },
  {
    id: 'drake-park-bike',
    role: 'town',
    label: 'Drake Park at dusk: a local on a bike, a dog alongside',
    years: [1925, 2100],
    yearsWhy: 'Drake Park and Mirror Pond date to the 1910s-1920s; the pond has looked this way since the 1910 dam.',
    seasons: ['winter', 'fall'],
    place:
      'the path along Mirror Pond in Drake Park at dusk after a snowfall: the still pond with snowy banks, ' +
      'tall ponderosa pines and bare shade trees, snow on the lawn, lit windows of houses across the water',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: [],
    framing: 'from the edge of the path at waist height, 35mm',
    light: 'deep blue dusk skylight with warm window light across the pond, 3000K practicals, soft shadows on the snow',
    exposure: 'night',
    action: 'a man in a wool coat and knit cap rides a bicycle slowly along the path past the camera with a shaggy dog trotting beside him, and raises a hand to wave',
    move: 'pan',
  },
  // ── stroll ──────────────────────────────────────────────────────────────
  {
    id: 'old-bend-walk',
    role: 'stroll',
    label: 'An after-dinner walk in Old Bend',
    years: [1925, 2100],
    yearsWhy: 'The Drake Park neighborhood’s 83 Craftsman-era houses date 1910-1954 (NRHP district, 2005).',
    seasons: ['winter'],
    place:
      'a residential street in Old Bend at dusk: 1920s craftsman bungalows with deep porches and lit ' +
      'windows under tall ponderosa pines, snow on the lawns and roofs, a plain sidewalk',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'evening',
    framing: 'from behind them on the sidewalk, 35mm',
    light: 'deep blue dusk skylight with warm porch lights and one incandescent street lamp, 3000K practicals',
    exposure: 'night',
    action: '{A} and {B} walk away from the camera arm in arm down the sidewalk',
    move: 'follow',
  },
  // ── discover ────────────────────────────────────────────────────────────
  {
    id: 'she-points',
    role: 'discover',
    label: 'She stops and points',
    years: [1925, 2100],
    seasons: ['winter'],
    place: 'the same Old Bend sidewalk at dusk, bungalows and ponderosas behind her, snow on the lawns',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A'],
    wardrobe: 'evening',
    framing: 'facing her on the sidewalk, 35mm',
    light: 'blue dusk skylight, a warm porch light catching one side of her face, 3000K',
    exposure: 'night',
    action: '{A} stops, points excitedly past the camera toward a front yard, and looks back into the lens',
    move: 'follow',
  },
  // ── sign ────────────────────────────────────────────────────────────────
  {
    id: 'yard-sign-bungalow',
    role: 'sign',
    label: 'The sign in front of the bungalow',
    years: [1925, 2100],
    seasons: ['winter'],
    place:
      'the front yard of a 1920s craftsman bungalow in Old Bend at dusk: porch light on, lit windows, ' +
      'snow on the lawn, a tall ponderosa pine beside the porch',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: [],
    framing: 'from the sidewalk, 50mm, the sign large in the right third of the frame and the house behind it',
    light: 'blue dusk skylight with the warm porch light and lit windows, 3000K practicals',
    exposure: 'night',
    action: 'a white wooden yard-sign post stands in the snow with a plain blank white square panel hanging still from its arm, facing the camera',
    move: 'hold',
    composite: 'yard_sign',
    alsoReject: ['any letters, numbers, or marks on the sign panel', 'the sign panel is not a clean flat rectangle facing the camera'],
  },
  // ── phone ───────────────────────────────────────────────────────────────
  {
    id: 'phone-out',
    role: 'phone',
    label: 'He pulls out a smartphone',
    years: ALWAYS,
    seasons: ['winter'],
    place: 'the Old Bend sidewalk at dusk in front of the bungalow, porch light behind them, snow on the lawn',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'evening',
    framing: 'a closer waist-up shot facing them on the sidewalk, 50mm, the lit porch soft behind them',
    light: 'blue dusk skylight with a warm porch light behind them, 3000K',
    exposure: 'night',
    action: '{B} pulls a thin black modern smartphone out of his jacket and looks down at it while {A} stands beside him looking straight into the lens',
    move: 'hold',
    alsoReject: ['a yard sign, sign post, or blank panel is in the frame (the sign belongs to the previous shot)'],
    allowAnachronism: 'the thin black modern smartphone in his hand (it is the joke)',
  },
  // ── call ────────────────────────────────────────────────────────────────
  {
    id: 'on-the-phone',
    role: 'call',
    label: 'On the phone, thumbs up',
    years: ALWAYS,
    seasons: ['winter'],
    place: 'the Old Bend sidewalk at dusk in front of the bungalow, porch light behind them, snow on the lawn',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'evening',
    framing: 'a closer waist-up shot facing them on the sidewalk, 50mm, the lit porch soft behind them',
    light: 'blue dusk skylight with a warm porch light behind them, 3000K',
    exposure: 'night',
    action: '{B} holds the black smartphone to his ear, grinning, and gives the camera a thumbs up while {A} hugs his arm',
    move: 'hold',
    alsoReject: ['a yard sign, sign post, or blank panel is in the frame (the sign belongs to the previous shot)'],
    allowAnachronism: 'the thin black modern smartphone at his ear (it is the joke)',
  },
]

export function getBeat(id: string): BeatDef | null {
  return BEATS.find((b) => b.id === id) ?? null
}

/** Can this beat honestly appear in this year and season? */
export function beatFits(beat: BeatDef, year: number, season: Season): boolean {
  return year >= beat.years[0] && year <= beat.years[1] && beat.seasons.includes(season)
}
