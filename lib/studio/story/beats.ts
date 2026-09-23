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
  | 'apres'
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
  /**
   * A post composite this beat needs. The brand and any lettering never go
   * through a generator: the frame carries a blank panel, marquee board, or
   * lit screen, and story_reel.py lays ours on it.
   */
  composite?: 'yard_sign' | 'marquee' | 'phone_screen'
  /** A still moved by the lab camera instead of generated motion. */
  stillOnly?: boolean
  /**
   * Which era cues this frame needs. Default none. Era cues are scene
   * content: handing "brick storefronts" to every exterior put a downtown
   * main street under the ski run and on the road to the mountain (2026-09-23).
   */
  periodCues?: Array<'street' | 'vehicles' | 'rooms'>
}

const ALWAYS: [number, number] = [1900, 2100]

/** The Tower Theatre on Wall Street, a freely licensed photograph in the asset library. */
// Another Believer, 2012, CC BY-SA 3.0: the restored facade, straight on (the 1982 marquee is undocumented).
const TOWER_REF = 'asset:f135a831-63b5-4aa4-a083-22be32f832b4'

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
    framing:
      'filmed by the driver: the camera looks across the front seat at her in the PASSENGER seat, the passenger window and the pines behind her, 28mm',
    light: 'flat overcast daylight through the windshield, cool on her face, the cabin a stop darker',
    periodCues: ['vehicles'],
    exposure: 'day',
    action: '{A} turns from the window to the camera, laughing, and waves',
    props: 'a boxy period dashboard in brown vinyl',
    move: 'hold',
  },
  {
    id: 'car-wave-lab',
    role: 'hook',
    label: 'She waves; the Lab gets there first',
    years: [1950, 2100],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    place: 'inside the car on the highway into Bend, tall ponderosa pines passing the passenger window',
    refs: [],
    cast: ['A'],
    wardrobe: 'travel',
    framing:
      'filmed by the driver: the camera looks across the front seat at her in the PASSENGER seat, the passenger window and ' +
      'the pines behind her, the dog pushing forward between the two front seats, 28mm',
    light: 'flat overcast daylight through the windshield, cool on her face, the cabin a stop darker',
    periodCues: ['vehicles'],
    exposure: 'day',
    action:
      '{A} turns from the window to the camera, laughing and waving, while their black Labrador pushes its head between the front seats and licks her cheek',
    props:
      'a boxy period dashboard in brown vinyl; a young black Labrador retriever with a red collar in the back seat',
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
    framing:
      'through the windshield from the passenger seat, 35mm, the top of the dashboard along the bottom edge, an empty road ahead',
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
    yearsWhy:
      'Skiing opened on Bachelor Butte in 1958; it was renamed Mt. Bachelor in 1983. On-screen text in a pre-1983 piece says Bachelor Butte.',
    seasons: ['winter'],
    place:
      'a groomed run high on Mount Bachelor, open snow all around, the snowy summit cone behind, wind-sculpted snow ghost trees, nothing but mountain in the background',
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
    id: 'ski-follow',
    role: 'play',
    label: 'She leads, he follows in her tracks',
    years: [1958, 2100],
    yearsWhy:
      'Skiing opened on Bachelor Butte in 1958; it was renamed Mt. Bachelor in 1983. On-screen text in a pre-1983 piece says Bachelor Butte.',
    seasons: ['winter'],
    place:
      'a groomed run high on Mount Bachelor, open snow all around, the snowy summit cone behind, wind-sculpted snow ghost trees, nothing but mountain in the background',
    refs: ['asset:9671ec09-6f90-4aea-9f11-8669d83feb4f'],
    cast: ['A', 'B'],
    wardrobe: 'ski',
    framing:
      'from low on the run looking up the fall line, 85mm: the two of them skiing single file straight toward the camera, ' +
      'she in front, he a few turns behind her and smaller in the frame, the summit cone behind them',
    light: 'hard high-altitude sun from camera-left, 5600K, deep blue sky, bright snow',
    exposure: 'day',
    action:
      '{A} carves toward the camera in smooth linked turns and {B} keeps his place a few meters behind her, following her exact line; ' +
      'both concentrate on the snow',
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
    place:
      'high above the snow on a two-person chairlift on Mount Bachelor, the snowy summit and ponderosa-dotted slopes falling away behind, nothing but mountain in the background',
    refs: ['asset:9671ec09-6f90-4aea-9f11-8669d83feb4f'],
    cast: ['A', 'B'],
    wardrobe: 'ski',
    framing: 'the camera held at arm’s length by him, 21mm wide, both faces in frame',
    light: 'hard high-altitude sun, 5600K, deep blue sky',
    exposure: 'day',
    action:
      '{A} and {B} lean their heads together to fit in the frame and grin, his arm reaching out of frame toward the camera',
    props:
      'dull matte fabrics with no logos or emblems, a simple wooden-slat double chair with a single steel safety bar',
    move: 'armLength',
  },
  // ── apres ───────────────────────────────────────────────────────────────
  {
    id: 'apres-lodge',
    role: 'apres',
    label: 'Après with another couple by the fire',
    years: [1958, 2100],
    yearsWhy: 'Skiing opened on Bachelor Butte in 1958.',
    seasons: ['winter'],
    place:
      'the bar of a timber ski lodge at the foot of the mountain at dusk: log beams, a big stone fireplace burning, ' +
      'wet parkas and wool hats on pegs, the tall windows gone deep blue with falling snow',
    refs: [],
    periodCues: ['rooms'],
    cast: ['A', 'B'],
    wardrobe: 'ski',
    framing:
      'a wide shot at table height from the end of a wooden table, 28mm: the couple side by side on the left; across from them, ' +
      'side by side on the right, their friends: a blonde woman and her bearded husband; the fire behind',
    light: 'warm firelight and amber pendant lamps, 2700K, faces glowing, the windows cool blue behind',
    exposure: 'interior_low',
    action:
      'both couples burst out laughing at something {B} just said; {A} laughs into his shoulder; the blonde woman and her husband clink mugs',
    props:
      'the friend is a woman of about thirty with feathered blonde hair in a red-and-white snowflake ski sweater; her husband has ' +
      'a full brown beard and a grey turtleneck; glass mugs of hot buttered rum and Irish coffee, a pitcher of beer, ski gloves on the table',
    move: 'hold',
  },
  // ── eat ─────────────────────────────────────────────────────────────────
  {
    id: 'supper-tower-window',
    role: 'eat',
    label: 'Supper at a Wall Street window, the Tower across the street',
    years: [1940, 2100],
    yearsWhy:
      'The Tower Theatre opened on Wall Street on March 6, 1940, ran as a single-screen movie house until it was twinned in March 1983, and showed films into the early 1990s (Cinema Treasures; Oregon Theater Project).',
    seasons: ['winter', 'fall', 'spring', 'summer'],
    place:
      'a window table in a small restaurant on Wall Street in downtown Bend at night; through the tall front window, ' +
      'across the snowy street, the Tower Theatre with its tall vertical blade sign and its lit marquee',
    refs: [TOWER_REF],
    periodCues: ['rooms', 'street', 'vehicles'],
    cast: ['A', 'B'],
    wardrobe: 'dinner',
    framing:
      'a symmetrical two-shot from inside at table height, 85mm compressing the street: the two of them in profile facing each ' +
      'other across a small table set against the window, the theater directly across the street, its lit marquee large and ' +
      'centered in the window between their profiles',
    light:
      'warm tungsten from a candle on the table, 2700K, with the marquee glowing white through the glass behind them, the room a stop darker',
    exposure: 'interior_low',
    action: '{A} and {B} raise their wine glasses to each other and drink',
    props:
      'a candle in a red glass globe, a white tablecloth, two wine glasses, light snow falling past the window, the marquee board lit plain white',
    move: 'tripod',
    composite: 'marquee',
    alsoReject: ['the theater is missing from the window', 'the marquee is hidden behind a head'],
  },
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
    action:
      'a man in a wool coat rides a bicycle slowly past with a shaggy dog trotting beside him, and raises a hand to the camera',
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
    action:
      'a man in a wool coat and knit cap rides a bicycle slowly along the path past the camera with a shaggy dog trotting beside him, and raises a hand to wave',
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
    action:
      'a white wooden yard-sign post stands in the snow with a plain blank white square panel hanging still from its arm, facing the camera',
    move: 'hold',
    composite: 'yard_sign',
    stillOnly: true,
    alsoReject: [
      'any letters, numbers, or marks on the sign panel',
      'the sign panel is not a clean flat rectangle facing the camera',
    ],
  },
  // ── phone ───────────────────────────────────────────────────────────────
  {
    id: 'phone-glow',
    role: 'phone',
    label: 'Over his shoulder, the phone lights his glove',
    years: ALWAYS,
    seasons: ['winter'],
    place: 'the Old Bend sidewalk at dusk, snow on the ground, the warm porch light of the bungalow soft behind them',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'evening',
    framing:
      'an insert close-up, 50mm: his brown-gloved hand holds a thin black modern smartphone upright in the center of the frame, ' +
      'the lit screen facing the camera square-on and a third of the frame tall; behind it, soft and out of focus, her face and the porch light',
    light: 'blue dusk skylight, the phone screen glowing cool white and lighting his glove and both faces from below',
    exposure: 'night',
    action:
      '{B} holds the phone still in his gloved hand while {A}, soft in the background, looks at it with a straight face',
    props: 'brown leather gloves, the phone screen an evenly lit plain white rectangle',
    move: 'hold',
    composite: 'phone_screen',
    alsoReject: ['a yard sign, sign post, or blank panel is in the frame (the sign belongs to the previous shot)'],
    allowAnachronism: 'the thin black modern smartphone in his hand (it is the joke)',
  },
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
    action:
      '{B} pulls a thin black modern smartphone out of his jacket and looks down at it while {A} stands beside him looking straight into the lens',
    move: 'hold',
    alsoReject: ['a yard sign, sign post, or blank panel is in the frame (the sign belongs to the previous shot)'],
    allowAnachronism: 'the thin black modern smartphone in his hand (it is the joke)',
  },
  // ── call ────────────────────────────────────────────────────────────────
  {
    id: 'call-deadpan',
    role: 'call',
    label: 'He makes the call; nobody smiles',
    years: [1925, 2100],
    seasons: ['winter'],
    place:
      'the front yard of the same 1920s craftsman bungalow in Old Bend at dusk: porch light on, lit windows, snow on the lawn, ' +
      'a white wooden yard-sign post in the snow with a plain blank white square panel hanging from its arm',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'evening',
    framing:
      'a centered, frontal medium-wide shot from the sidewalk, 40mm, level horizon: the two of them standing side by side ' +
      'on the snowy lawn facing the camera, the lit porch centered behind them, the sign post in the right third of the frame',
    light: 'blue dusk skylight with the warm porch light and lit windows behind them, 3000K practicals',
    exposure: 'night',
    action:
      '{B} holds the black smartphone to his ear and waits while {A} stands beside him with her hands in her coat pockets; ' +
      'both look straight into the lens with calm, straight faces',
    move: 'tripod',
    composite: 'yard_sign',
    alsoReject: [
      'any letters, numbers, or marks on the sign panel',
      'either of them grinning or gesturing at the camera',
    ],
    allowAnachronism: 'the thin black modern smartphone at his ear (it is the joke)',
  },
  {
    id: 'call-deadpan-lab',
    role: 'call',
    label: 'He makes the call; nobody smiles, including the dog',
    years: [1925, 2100],
    seasons: ['winter'],
    place:
      'the front yard of the same 1920s craftsman bungalow in Old Bend at dusk: porch light on, lit windows, snow on the lawn, ' +
      'a white wooden yard-sign post in the snow with a plain blank white square panel hanging from its arm',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'evening',
    framing:
      'a centered, frontal medium-wide shot from the sidewalk, 40mm, level horizon: the two of them standing side by side ' +
      'on the snowy lawn facing the camera, the lit porch centered behind them, the sign post in the right third of the frame',
    light: 'blue dusk skylight with the warm porch light and lit windows behind them, 3000K practicals',
    exposure: 'night',
    action:
      '{B} holds the black smartphone to his ear and waits while {A} stands beside him with her hands in her coat pockets ' +
      'and their black Labrador sits in the snow at their feet; all three look straight into the lens with calm, straight faces',
    props: 'a young black Labrador retriever with a red collar, sitting still',
    move: 'tripod',
    composite: 'yard_sign',
    alsoReject: [
      'any letters, numbers, or marks on the sign panel',
      'either of them grinning or gesturing at the camera',
    ],
    allowAnachronism: 'the thin black modern smartphone at his ear (it is the joke)',
  },
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
    action:
      '{B} holds the black smartphone to his ear, grinning, and gives the camera a thumbs up while {A} hugs his arm',
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
