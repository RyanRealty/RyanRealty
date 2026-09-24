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
  | 'stay'
  | 'pack'
  | 'leave'
  | 'commute'
  | 'work_b'
  | 'work_a'
  | 'home'
  | 'lift'
  | 'summit'
  | 'photo'
  | 'snapshot'
  | 'prints'
  | 'number'
  | 'radio'
  | 'depart'
  | 'rearview'
  | 'return'
  | 'look'

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
   * through a generator: the frame carries a blank panel, marquee board, lit
   * screen, or blank snapshot card, and story_reel.py lays ours on it.
   */
  composite?: 'yard_sign' | 'marquee' | 'phone_screen' | 'photo_print'
  /**
   * Set in the city they came from, not in Central Oregon. The reference test
   * guards local place chrome; a freeway or an office far from here has no
   * local still to condition on, and it must not read as Bend.
   */
  elsewhere?: boolean
  /** A still moved by the lab camera instead of generated motion. */
  stillOnly?: boolean
  /**
   * No generation at all: the plate is the selected still of this earlier
   * role, and the lab camera does the rest (an amateur zooming into a frame we
   * already have). Keeps the house, the light, and the dog the same by
   * construction instead of by prompt.
   */
  plateFrom?: BeatRole
  /**
   * A photograph they took, generated as a still and only ever seen inside
   * other frames (a Polaroid on a table, on a dashboard). Never cut in on its
   * own, never moved.
   */
  prop?: boolean
  /**
   * The piece's companion (a dog) is in frame: its one reference photo goes
   * to the generator with the cast sheets, so it is the same dog every shot.
   */
  companion?: boolean
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
    // Matt 2026-09-24: the dog read as a puppy here. The companion photo makes it their dog.
    companion: true,
    framing:
      'filmed by the driver: the camera looks across the front seat at her in the PASSENGER seat, the passenger window and ' +
      'the pines behind her, the dog pushing forward between the two front seats, 28mm',
    light: 'flat overcast daylight through the windshield, cool on her face, the cabin a stop darker',
    periodCues: ['vehicles'],
    exposure: 'day',
    action:
      '{A} turns from the window to the camera, laughing and waving, while their grown black Labrador with the red collar pushes its head between the front seats and licks her cheek',
    props:
      'a boxy period dashboard in brown vinyl; their full-grown black Labrador retriever with the red collar in the back seat',
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
      'their parkas and wet wool hats hung on pegs by the door, the tall windows gone deep blue with falling snow',
    refs: [],
    periodCues: ['rooms'],
    cast: ['A', 'B'],
    wardrobe: 'apres',
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
    id: 'drake-park-lab',
    role: 'town',
    label: 'Drake Park at dusk: he rides by, the Lab trotting alongside',
    years: [1925, 2100],
    yearsWhy: 'Drake Park and Mirror Pond date to the 1910s-1920s; the pond has looked this way since the 1910 dam.',
    seasons: ['winter', 'fall'],
    place:
      'the path along Mirror Pond in Drake Park at dusk after a snowfall: the still pond with snowy banks, ' +
      'tall ponderosa pines and bare shade trees, snow on the lawn, lit windows of houses across the water',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['B'],
    wardrobe: 'evening',
    companion: true,
    framing: 'from the edge of the path at waist height, 35mm',
    light: 'deep blue dusk skylight with warm window light across the pond, 3000K practicals, soft shadows on the snow',
    exposure: 'night',
    action:
      '{B} rides a bicycle slowly along the path past the camera with their black Labrador with the red collar trotting beside him, and raises a hand to wave',
    move: 'pan',
  },
  {
    id: 'drake-park-walk-lab',
    role: 'town',
    label: 'Drake Park at dusk: she walks the Lab along Mirror Pond',
    years: [1925, 2100],
    yearsWhy: 'Drake Park and Mirror Pond date to the 1910s-1920s; the pond has looked this way since the 1910 dam.',
    seasons: ['winter', 'fall'],
    place:
      'the path along Mirror Pond in Drake Park at dusk after a snowfall: the still pond with snowy banks, ' +
      'tall ponderosa pines and bare shade trees, snow on the lawn, lit windows of houses across the water',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A'],
    wardrobe: 'evening',
    companion: true,
    framing:
      'filmed by him a few steps behind her on the path, 35mm: she and the dog on the left half of the frame walking away ' +
      'along the path, the still pond and the lit houses across the water on the right',
    light: 'deep blue dusk skylight with warm window light across the pond, 3000K practicals, soft shadows on the snow',
    exposure: 'night',
    action:
      '{A} walks along the snowy path with their black Labrador with the red collar on a leash beside her, and turns her head back to the camera with a smile',
    props: 'a red leather leash',
    move: 'follow',
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
    id: 'she-points-sign',
    role: 'discover',
    label: 'She stops and points: the sign is already in the yard',
    years: [1925, 2100],
    seasons: ['winter'],
    place:
      'the Old Bend sidewalk at dusk in front of a 1920s craftsman bungalow: porch light on, lit windows, snow on the lawn, ' +
      'a white wooden yard-sign post standing in the snowy front lawn with a plain blank white square panel hanging from its arm',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A'],
    wardrobe: 'evening',
    companion: true,
    framing:
      'from the sidewalk just behind her shoulder, 35mm: she is on the left third, the bungalow and its lawn fill the right ' +
      'two thirds, the sign post and its blank panel clear on the lawn, the dog at her side',
    light: 'blue dusk skylight with the warm porch light and lit windows, 3000K practicals',
    exposure: 'night',
    action:
      '{A} stops, points at the house and the sign on its lawn, and looks back at the camera while their black Labrador with the red collar sits beside her',
    move: 'hold',
    composite: 'yard_sign',
    alsoReject: ['any letters, numbers, or marks on the sign panel'],
  },
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
  {
    id: 'sign-zoom-discover',
    role: 'sign',
    label: 'He zooms in on the sign she pointed at',
    years: [1925, 2100],
    seasons: ['winter'],
    place:
      'the front yard of the same 1920s craftsman bungalow in Old Bend at dusk: porch light on, lit windows, snow on the lawn, ' +
      'a white wooden yard-sign post in the snow',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: [],
    framing: 'the discover frame, power-zoomed by an amateur from her pointing arm into the sign on the lawn',
    light: 'blue dusk skylight with the warm porch light and lit windows, 3000K practicals',
    exposure: 'night',
    action: 'the camera zooms into the yard sign until its phone number fills the frame',
    move: 'hold',
    composite: 'yard_sign',
    stillOnly: true,
    plateFrom: 'discover',
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
  // ── stay ────────────────────────────────────────────────────────────────
  {
    id: 'stay-deadpan-lab',
    role: 'stay',
    label: 'The three of them in front of the house; nobody says anything',
    years: [1925, 2100],
    seasons: ['winter'],
    place:
      'the front yard of the same 1920s craftsman bungalow in Old Bend at dusk: porch light on, lit windows, snow on the lawn, ' +
      'a white wooden yard-sign post in the snow with a plain blank white square panel hanging from its arm',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'evening',
    companion: true,
    framing:
      'a centered, frontal medium-wide shot from the sidewalk, 40mm, level horizon: the two of them standing side by side ' +
      'on the snowy lawn facing the camera, the dog sitting in front of them, the lit porch centered behind, the sign post in the right third',
    light: 'blue dusk skylight with the warm porch light and lit windows behind them, 3000K practicals',
    exposure: 'night',
    action:
      '{A} and {B} stand side by side with their hands in their coat pockets and their black Labrador with the red collar sits still at their feet; ' +
      'all three look straight into the lens with calm, straight faces',
    move: 'tripod',
    composite: 'yard_sign',
    alsoReject: [
      'any letters, numbers, or marks on the sign panel',
      'anyone holding a phone',
      'either of them grinning or gesturing at the camera',
    ],
  },
  // ── the homecoming (Matt 2026-09-24) ───────────────────────────────────
  // They go home. The week back at work reminds them what they left, and the
  // call comes from their own kitchen on the phone they own. Everything after
  // the drive out is set in the city they came from: locked off, grey, and
  // square to the lens (Tati's Playtime, Roy Andersson's offices), against the
  // warm handheld home movie of the trip. The only warm thing in those frames
  // is the snapshot from Bend.
  {
    id: 'pack-wagon-lab',
    role: 'pack',
    label: 'The wagon loaded, the Lab jumps in last',
    years: [1965, 1995],
    yearsWhy:
      'A wood-panelled full-size station wagon with skis on the roof rack: the family ski car from the late 1960s until minivans replaced it in the 1990s.',
    seasons: ['winter'],
    place:
      'the curb of a quiet Old Bend street on a bright cold morning after a snowfall: 1920s bungalows, tall ponderosa pines, snow banked along the curb',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'travel',
    companion: true,
    framing:
      'from the sidewalk at the back corner of the car, 35mm: the open tailgate of the station wagon on the left half of the frame, ' +
      'two pairs of skis strapped on the roof rack, the two of them beside the tailgate, the license plate out of frame',
    light: 'low bright morning sun from the side, 5000K, long blue shadows on the snow',
    exposure: 'day',
    periodCues: ['vehicles'],
    action:
      'their black Labrador with the red collar jumps up into the back of the loaded station wagon while {A} and {B} stand at the open tailgate and watch',
    props:
      'a brown full-size American station wagon from the late 1970s with wood-grain side panels and a roof rack, no badges or lettering on the car; ' +
      'suitcases and a cooler in the cargo area',
    move: 'follow',
    alsoReject: ['any badge, license plate, or lettering on the car'],
  },
  {
    // Round 3 (Matt): "view of dog and mt bachelor should be in the rearview where the man can also be seen and he smiles slightly".
    id: 'rearview-bachelor-dog',
    role: 'leave',
    label: 'Driving home: the Lab and Bachelor in the rearview mirror, he smiles a little',
    years: [1965, 1995],
    seasons: ['winter', 'spring'],
    place:
      'the straight highway out of Bend through tall ponderosa pines, the snow-covered volcanic cone of Mount Bachelor behind them',
    refs: ['asset:d7f06007-475f-4a93-ad09-f2aa31633aad'],
    cast: ['B'],
    wardrobe: 'travel',
    companion: true,
    framing:
      'from the front passenger seat, 40mm, a tall frame: he drives on the left side of the car, seen in three-quarter profile, both hands ' +
      'on the wheel; the rearview mirror at the top of the windshield, and in the mirror their black Labrador sitting in the back seat and, ' +
      'through the rear window behind it, Mount Bachelor small and white; the pine-lined road ahead through the windshield',
    light: 'soft late-morning light, the cabin a stop darker',
    exposure: 'day',
    periodCues: ['vehicles'],
    action:
      '{B} drives, glances up at the rearview mirror at the dog and the mountain behind them, and smiles slightly; he never looks at the camera',
    props: 'the same boxy brown vinyl dashboard and wood-grain trim of the station wagon; a plain rectangular rearview mirror',
    move: 'hold',
    alsoReject: ['a face in the mirror', 'lettering on signs or the road', 'the dog in the front seat'],
  },
  {
    // Round 3 (Matt): the dog jumped out of the back and back in; one jump, into the back seat, the cargo area full.
    id: 'pack-wagon-backseat-spring',
    role: 'pack',
    label: 'Packed to go home: the Lab hops into the back seat',
    years: [1965, 1995],
    yearsWhy:
      'A wood-panelled full-size station wagon with skis on the roof rack: the family ski car from the late 1960s until minivans replaced it in the 1990s.',
    seasons: ['spring'],
    place:
      'the curb of a quiet Old Bend street on a bright cool April morning: 1920s bungalows, tall ponderosa pines, green lawns, bare trees budding',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'travel',
    companion: true,
    framing:
      'from the sidewalk, 35mm, a tall frame: the whole side of the station wagon at the curb, the cargo area packed full of suitcases behind ' +
      'the rear windows, two pairs of skis on the roof rack, the rear side door open, the two of them standing on the sidewalk beside it',
    light: 'low bright morning sun from the side, 5200K, long soft shadows',
    exposure: 'day',
    periodCues: ['vehicles'],
    action:
      'their black Labrador with the red collar hops up through the open rear door onto the back seat once and settles there; ' +
      '{A} and {B} watch, quiet smiles, and he closes the door; calm, unhurried movements',
    props:
      'a brown full-size American station wagon from the late 1970s with wood-grain side panels and a roof rack, no badges or lettering on the car',
    move: 'tripod',
    alsoReject: ['any badge, license plate, or lettering on the car', 'snow on the ground in town', 'the dog in the cargo area', 'the dog jumping back out'],
  },
  {
    id: 'rear-window-lab',
    role: 'leave',
    label: 'The Lab in the way-back watches the mountain go',
    years: [1965, 1995],
    yearsWhy: 'The cargo area of a full-size station wagon, where the dog rode before the minivan.',
    seasons: ['winter', 'spring'],
    place:
      'the straight highway out of Bend through tall ponderosa pines, the snow-covered volcanic cone of Mount Bachelor behind them at the far end of the road',
    refs: ['asset:d7f06007-475f-4a93-ad09-f2aa31633aad'],
    cast: [],
    companion: true,
    framing:
      'from the back seat looking back over the cargo area and out through the rear window, 28mm: the dog in the cargo area on the left, ' +
      'the road running back to the mountain framed in the rear window',
    light: 'flat bright winter daylight outside, the car interior a stop darker',
    exposure: 'day',
    action:
      'their black Labrador with the red collar sits in the cargo area and looks out the rear window at the mountain getting smaller as the empty road runs away behind the car',
    props:
      'brown vinyl upholstery and wood-grain trim inside the station wagon; suitcases and a cooler beside the dog; ' +
      'the tips of the skis on the roof rack just visible at the top of the rear window',
    move: 'hold',
    alsoReject: [
      'a person in the cargo area',
      'people standing on the road or behind the car',
      'an open tailgate',
      'lettering on the window or the road',
    ],
  },
  {
    id: 'commute-gridlock',
    role: 'commute',
    label: 'A week later: the same car, going nowhere',
    years: [1960, 2100],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'an eight-lane big-city freeway at a standstill on a hazy brown morning: brake lights to the horizon, concrete overpasses, no trees and no mountains',
    refs: [],
    cast: ['B'],
    wardrobe: 'work',
    framing:
      'from a camera braced on the dashboard facing him across the front seat, 28mm: he is behind the wheel on the left, ' +
      'the driver window and the stopped traffic beyond it',
    light: 'flat hazy smog-filtered daylight, 4800K, grey and low contrast',
    exposure: 'day',
    periodCues: ['vehicles'],
    action: '{B} sits behind the wheel in stopped traffic, rests his forehead in his hand, and lets out a long breath',
    props: 'the same boxy brown vinyl dashboard and wood-grain trim of the station wagon',
    move: 'dashboard',
    alsoReject: ['snow', 'pine trees', 'mountains', 'a dog in the car', 'anyone else in the car'],
  },
  {
    id: 'desk-his',
    role: 'work_b',
    label: 'His desk: the phones, and the snapshot from the trip',
    years: [1955, 1990],
    yearsWhy: 'A bullpen of steel desks and multi-line telephones with no computer screens: a brokerage office before the PC.',
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'a crowded stockbroker’s office in a downtown high-rise: rows of grey steel desks under flat fluorescent ceiling panels, ' +
      'men in shirtsleeves on telephones, paper everywhere, grey concrete towers through the windows',
    refs: [],
    cast: ['B'],
    wardrobe: 'work',
    framing:
      'locked off square to his desk, 50mm: a small brass picture frame standing on the front right corner of the desk angled toward the camera, ' +
      'large and sharp in the foreground; he sits behind the desk at center, the office soft behind him',
    light: 'flat cool fluorescent overhead light, 4000K, greenish and shadowless',
    exposure: 'day',
    action:
      '{B}, tired and frowning, holds the telephone to his ear, then lowers it and looks down at the picture frame on his desk',
    props:
      'a grey steel desk, a beige multi-line push-button telephone with lit line buttons, stacks of paper, a coffee mug; ' +
      'the small brass picture frame holds a plain blank white card',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: [
      'any picture, letters, or marks inside the picture frame',
      'a computer screen',
      'readable text on papers',
      'snow or mountains',
    ],
  },
  {
    id: 'desk-hers',
    role: 'work_a',
    label: 'Her desk in the newsroom: deadline, and the same snapshot',
    years: [1930, 1985],
    yearsWhy: 'A city newsroom of typewriters and wire baskets; terminals replaced the typewriters through the late 1970s and 1980s.',
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'a big-city newspaper newsroom on deadline: rows of cluttered desks with typewriters, wire baskets of copy paper, ' +
      'hanging fluorescent lights, cigarette haze, reporters on the phone, tall windows onto a grey city',
    refs: [],
    cast: ['A'],
    wardrobe: 'work',
    framing:
      'locked off square to her desk, 50mm: a small brass picture frame standing on the front left corner of the desk angled toward the camera, ' +
      'large and sharp in the foreground; she sits behind a typewriter at center, the newsroom soft behind her',
    light: 'flat cool fluorescent overhead light mixed with grey window light, 4200K',
    exposure: 'day',
    action:
      '{A}, harried and frowning, pulls a sheet of paper out of the typewriter, then stops and looks at the picture frame on her desk',
    props:
      'a manual typewriter, stacks of copy paper, a black desk telephone, a coffee cup; the small brass picture frame holds a plain blank white card',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: [
      'any picture, letters, or marks inside the picture frame',
      'a computer screen',
      'readable text on papers',
      'snow or mountains',
    ],
  },
  {
    id: 'kitchen-snapshot',
    role: 'home',
    label: 'That night: the snapshot of the house on the table between them',
    years: [1960, 1995],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'the small kitchen of a city apartment at night: yellow linoleum floor, avocado-green appliances, ' +
      'a harvest-gold rotary telephone on the wall, a window onto dark city lights',
    refs: [],
    cast: ['A', 'B'],
    wardrobe: 'work',
    companion: true,
    framing:
      'locked off at the end of the small kitchen table, 35mm: the two of them sitting across from each other, ' +
      'a single snapshot lying face up on the table between them in the foreground, the dog lying on the floor beside the table',
    light: 'a single warm pendant lamp over the table, 2800K, the rest of the kitchen falling off into shadow',
    exposure: 'interior_low',
    action: '{A} looks up from the snapshot on the table at {B}, and he looks back at her and slowly nods',
    props:
      'a Formica kitchen table with two plates and two glasses of wine; the snapshot is a plain blank white card with nothing on it; ' +
      'their black Labrador with the red collar lying on the floor',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: ['any picture, letters, or marks on the snapshot card', 'snow or mountains through the window'],
  },
  {
    id: 'call-kitchen-rotary',
    role: 'call',
    label: 'He makes the call from the kitchen wall phone; it rings',
    years: [1955, 1995],
    yearsWhy:
      'A rotary wall telephone with a long coiled cord, standard in American kitchens until push-button and cordless phones replaced it.',
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'the same small city apartment kitchen at night: yellow linoleum floor, avocado-green appliances, a window onto dark city lights',
    refs: [],
    cast: ['A', 'B'],
    wardrobe: 'work',
    companion: true,
    framing:
      'locked off from the kitchen doorway, 35mm: he stands on the right against the wall directly under the harvest-gold rotary wall telephone, ' +
      'its handset at his ear and its long coiled cord running up to the phone base beside his head; she sits at the table on the left watching him, the dog between them',
    light: 'the single warm pendant lamp over the table, 2800K, the rest of the kitchen falling off into shadow',
    exposure: 'interior_low',
    action: '{B} stands with the telephone handset at his ear, waiting while it rings, and looks over at {A}, who smiles',
    props:
      'one harvest-gold rotary wall telephone with a harvest-gold handset and a long coiled cord, the only telephone in the room; ' +
      'their black Labrador with the red collar sitting on the floor',
    move: 'tripod',
    alsoReject: ['a mobile phone or cordless phone', 'push buttons on the telephone'],
  },
  // ── April, 1982: the Polaroid story (Matt 2026-09-24) ──────────────────
  // Spring skiing on Bachelor Butte, the view from the top, a photo at the
  // bottom, the house on a walk the next day, drinks outside the Tower with
  // the Polaroids, and the week back home. Framed for a tall 9:16 frame.
  {
    // Matt 2026-09-24: "show them packing the car and then the city in the rearview when driving to Bend"; "make sure dog is in the packing car scene".
    id: 'pack-wagon-city-dawn',
    role: 'depart',
    label: 'Home, before sunup: the wagon loaded for Bend, the Lab jumps in',
    years: [1965, 1995],
    yearsWhy:
      'A wood-panelled full-size station wagon with skis on the roof rack: the family ski car from the late 1960s until minivans replaced it in the 1990s.',
    seasons: ['spring', 'winter'],
    elsewhere: true,
    place:
      // Round 3 (Matt): "more of an urban neighborhood". Their home is a city fourplex, the same building they come home to.
      'the curb in front of their two-story stucco fourplex on a dense big-city street in Southern California just before sunrise: ' +
      'apartment buildings shoulder to shoulder, cars parked bumper to bumper along both curbs, telephone wires overhead, a corner market ' +
      'with its lights on, tall palm trees against a pale dawn sky, the streetlights still on',
    refs: [],
    cast: ['A', 'B'],
    wardrobe: 'travel',
    companion: true,
    framing:
      // Round 3 (Matt): she read as climbing out of the car, everyone too animated, and the dog will not fit in a full cargo area.
      'from across the street, 35mm, a tall frame: the whole side of the station wagon at the curb in the lower half, the cargo area packed full ' +
      'of suitcases behind the rear windows, two pairs of skis on the roof rack, the rear side door open; she stands on the sidewalk beside ' +
      'the car, her whole figure clear of it, and he stands at the open rear door; the palm trees and the dawn sky above',
    light: 'blue dawn light, the streetlights and the dome light in the open cargo area warm',
    exposure: 'day',
    periodCues: ['vehicles'],
    action:
      'their black Labrador with the red collar hops up through the open rear door onto the back seat and sits; {B} closes the door gently ' +
      'and {A}, standing on the sidewalk, smiles; calm, unhurried movements, early-morning quiet',
    props:
      'a brown full-size American station wagon from the late 1970s with wood-grain side panels and a roof rack, no badges or lettering on the car; ' +
      'suitcases and a cooler in the cargo area',
    move: 'tripod',
    alsoReject: ['any badge, license plate, or lettering on the car', 'snow', 'pine trees'],
  },
  {
    id: 'rearview-city-receding',
    role: 'rearview',
    label: 'Driving north: the city in the rearview mirror',
    years: [1965, 1995],
    seasons: ['spring', 'winter'],
    elsewhere: true,
    place:
      'the freeway leaving a big Southern California city at sunrise: the downtown towers small and hazy behind them, ' +
      'palm trees along the embankment, the open road and dry brown hills ahead',
    refs: [],
    cast: ['A', 'B'],
    wardrobe: 'travel',
    framing:
      // Someone drives: the first takes with nobody in the seats read as a driverless car.
      'from the middle of the back seat, 50mm, a tall frame: the two of them in the front seats seen from behind, he drives on the left side ' +
      'of the car with the steering wheel in front of him, she sits on the right; the rearview mirror at the top of the windshield between them ' +
      'with the city skyline small and hazy in it; through the windshield, the open freeway running ahead toward brown hills',
    light: 'low warm sunrise light from the side, the car interior in soft shade',
    exposure: 'day',
    periodCues: ['vehicles'],
    action:
      '{A} and {B} talk as he drives and the city in the rearview mirror slowly gets smaller behind them, the empty road running on ahead; ' +
      'neither of them looks back at the camera',
    props:
      'the same boxy brown vinyl dashboard and wood-grain trim of the station wagon; a plain rectangular rearview mirror on a short stem',
    move: 'dashboard',
    alsoReject: ['a face in the mirror', 'lettering on signs or the road', 'snow', 'pine trees'],
  },
  {
    // Round 3 (Matt 2026-09-24): "who is she waving at? the dog should be in back seat, this should also show mt bachelor on the horizon."
    id: 'car-back-seat-bachelor',
    role: 'hook',
    label: 'On the road up: the Lab in the back seat, Bachelor ahead',
    years: [1950, 2100],
    seasons: ['winter', 'spring'],
    place:
      'the straight highway into Bend through tall ponderosa pines, the snow-covered volcanic cone of Mount Bachelor on the horizon at the far end of the road',
    refs: ['asset:d7f06007-475f-4a93-ad09-f2aa31633aad'],
    cast: ['A', 'B'],
    wardrobe: 'travel',
    companion: true,
    framing:
      'from the back seat on the passenger side, 35mm, a tall frame: their black Labrador sitting up in the back seat beside the camera, ' +
      'its head and shoulders in the lower right, looking forward between the front seats; the two of them in the front seats seen from behind, ' +
      'he drives on the left; through the windshield the road runs straight through the pines to Mount Bachelor on the horizon',
    light: 'bright spring morning light through the windshield, the cabin a stop darker',
    exposure: 'day',
    periodCues: ['vehicles'],
    action:
      'their black Labrador with the red collar sits in the back seat watching the road ahead; {A} reaches back and rubs its ears and turns to smile at {B}; ' +
      'calm, easy movements; nobody waves and nobody looks at the camera',
    props: 'the same boxy brown vinyl dashboard and wood-grain trim of the station wagon',
    move: 'hold',
    alsoReject: ['anyone waving', 'the dog between the front seats', 'a face turned to the camera'],
  },
  {
    id: 'radio-on-insert',
    role: 'radio',
    label: 'On the way up, she turns on the car radio (the song starts here)',
    years: [1965, 1995],
    yearsWhy: 'An in-dash car radio with a round volume knob and chrome push-buttons, standard until tape decks and CDs took over.',
    seasons: ['winter', 'fall', 'spring', 'summer'],
    place: 'inside the car on the highway toward the mountain, ponderosa pines passing the windshield',
    refs: [],
    cast: ['A'],
    wardrobe: 'travel',
    framing:
      // One hand (Matt 2026-09-24: "there should not be 2 hands on the radio").
      'from the front passenger seat, 50mm, a tall frame: one hand only, her right hand in a grey wool mitten pulled half off, reaches in ' +
      'from the right side of the frame to the round volume knob of the radio in the middle of the dashboard; her other hand stays out of frame; ' +
      'the steering wheel at the far left edge of the frame; the radio face and its dial soft and out of focus, the windshield and the pines blurred beyond',
    light: 'bright morning daylight through the windshield, the dashboard in soft shade',
    exposure: 'day',
    periodCues: ['vehicles'],
    action: '{A} turns the radio knob with one hand and the dial lights up warm',
    props: 'a late-1970s in-dash car radio with a round chrome volume knob and five chrome push-buttons in a brown vinyl dashboard',
    move: 'hold',
    alsoReject: ['readable numbers or letters on the radio dial', 'a cassette or CD player', 'two hands at the radio'],
  },
  {
    id: 'chairlift-ride-up',
    role: 'lift',
    label: 'Riding the chair up, seen from the chair behind',
    years: [1958, 2100],
    yearsWhy: 'Skiing opened on Bachelor Butte in 1958; the mountain was renamed Mt. Bachelor in 1983.',
    seasons: ['winter', 'spring'],
    place:
      'a two-person chairlift climbing the upper slopes of Mount Bachelor on a clear April morning: spring snow, ' +
      'the lift towers marching up toward the snowy summit cone, a few snow-plastered trees below',
    refs: ['asset:9671ec09-6f90-4aea-9f11-8669d83feb4f'],
    cast: ['A', 'B'],
    wardrobe: 'ski',
    framing:
      'from the next chair up the cable behind them, 35mm, a tall frame: we see only the backs of their heads, their hats, and their shoulders ' +
      'side by side on the chair in the lower third, both facing away from the camera toward the summit; ' +
      'the cable and the next towers rising ahead of them up the middle, the summit cone at the top under a deep blue sky',
    light: 'hard high-altitude April sun, 5600K, deep blue sky, bright spring snow',
    exposure: 'day',
    action: '{A} and {B} ride up side by side facing the summit, and {A} points ahead up the mountain toward the top',
    props: 'a simple double chair with a single steel safety bar; their skis dangling below the chair; ' + 'long, narrow, nearly straight early-1980s skis with no sidecut, thin aluminum poles with leather baskets',
    move: 'pan',
    alsoReject: ['lettering on the lift or towers'],
  },
  {
    id: 'summit-three-sisters',
    role: 'summit',
    label: 'At the top: the Three Sisters and Broken Top',
    years: [1958, 2100],
    yearsWhy: 'Skiing opened on Bachelor Butte in 1958; the mountain was renamed Mt. Bachelor in 1983.',
    seasons: ['winter', 'spring'],
    place:
      'the snowy summit of Mount Bachelor on a clear April day, looking north across the Cascades at three separate volcanoes rising ' +
      'from a forested plateau: South Sister, a huge broad smooth snow-covered cone; Middle and North Sister behind it; and Broken Top, ' +
      'a jagged broken crater rim buried in deep snow; forested valleys and snowfields far below, nothing man-made in view',
    refs: ['asset:21d81297-0e90-4b58-817c-19cc154ed1e0', 'asset:9506b768-5f1a-409e-9157-762cc71d3abb', 'asset:eb61a753-46a9-4b94-90ff-8e7ad8c954ee'],
    cast: ['A', 'B'],
    wardrobe: 'ski',
    framing:
      'from a few steps behind them with a long lens, 85mm, a tall frame: the two of them at the bottom seen from behind, ' +
      'and the snow-capped volcanoes stacked huge and close behind them, filling the middle of the frame; deep blue sky above',
    light: 'clear high-altitude April sun from the side, 5600K, crisp deep blue sky, the far peaks bright',
    exposure: 'day',
    action: '{A} slips her arm through his and they stand still, looking out at the mountains',
    props: 'long, narrow, nearly straight early-1980s skis with no sidecut, thin aluminum poles with leather baskets',
    move: 'hold',
    alsoReject: ['buildings, towers, or signs at the summit', 'anyone else on the summit'],
  },
  {
    id: 'ski-down-spring',
    role: 'play',
    label: 'Skiing down on spring snow, one after the other',
    years: [1958, 2100],
    yearsWhy: 'Skiing opened on Bachelor Butte in 1958; the mountain was renamed Mt. Bachelor in 1983.',
    seasons: ['winter', 'spring'],
    place:
      'a wide open run high on Mount Bachelor in April: soft corn snow, and behind the skiers the snow-capped Cascade peaks, ' +
      'Broken Top and the Three Sisters, bright white against a deep blue sky',
    refs: ['asset:b041c668-0c24-4292-b894-697151f8aa8b', 'asset:eb61a753-46a9-4b94-90ff-8e7ad8c954ee', 'asset:9506b768-5f1a-409e-9157-762cc71d3abb'],
    cast: ['A', 'B'],
    wardrobe: 'ski',
    framing:
      'from low on the run looking up the slope, 85mm, a tall frame: the two of them skiing single file toward the camera, ' +
      'she in front, he a few turns behind and smaller, the peaks behind them at the top of the frame',
    light: 'bright April afternoon sun, 5600K, soft warm light on the snow, blue sky',
    exposure: 'day',
    action:
      '{A} carves toward the camera in smooth linked turns and {B} keeps his place a few meters behind her, following her line',
    props: 'long, narrow, nearly straight early-1980s skis with no sidecut, thin aluminum poles with leather baskets',
    move: 'follow',
  },
  {
    id: 'base-polaroid-pose',
    role: 'photo',
    label: 'A stranger takes their picture at the bottom',
    years: [1972, 2100],
    yearsWhy: 'Polaroid instant cameras of this kind date from 1972 (the SX-70).',
    seasons: ['winter', 'spring'],
    place:
      'the base area of the ski mountain on an April afternoon: packed spring snow, a timber lodge behind, the mountain rising above it',
    refs: ['asset:9671ec09-6f90-4aea-9f11-8669d83feb4f'],
    cast: ['A', 'B'],
    wardrobe: 'ski',
    framing:
      'straight on at eye level from a stranger holding the camera, 40mm, a tall frame: the two of them centered, full length, ' +
      'their skis planted upright in the snow beside them, the lodge and the mountain behind',
    light: 'warm late-afternoon April sun on their faces, 5000K, blue sky',
    exposure: 'day',
    action:
      '{A} and {B} stand with their arms around each other beside their upright skis and grin at the camera, posing for a photograph ' +
      '(the stranger takes two, one for each of them)',
    props: 'long, narrow, nearly straight early-1980s skis with no sidecut, thin aluminum poles with leather baskets',
    move: 'hold',
    alsoReject: ['lettering on the lodge'],
  },
  {
    id: 'drake-park-walk-both-lab',
    role: 'town',
    label: 'The next day: walking the Lab along Mirror Pond',
    years: [1925, 2100],
    yearsWhy: 'Drake Park and Mirror Pond date to the 1910s-1920s; the pond has looked this way since the 1910 dam.',
    seasons: ['spring'],
    place:
      'the path along Mirror Pond in Drake Park on an April afternoon: the still pond, green lawn coming back, tall ponderosa pines ' +
      'and bare shade trees with the first buds, old houses across the water',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'spring',
    companion: true,
    framing:
      'following a few steps behind them on the path, 35mm, a tall frame: the two of them walking away side by side in the lower half, ' +
      'the dog on its leash beside her, the pond and the trees rising above them',
    light: 'soft April afternoon sun through thin cloud, 5200K, cool air, gentle shadows',
    exposure: 'day',
    action:
      '{A} and {B} stroll along the path with their black Labrador with the red collar on a leash, and {B} puts his arm around her',
    props: 'a red leather leash',
    move: 'follow',
  },
  {
    id: 'house-polaroid-take',
    role: 'discover',
    label: 'They stop at the house; she takes its picture',
    years: [1972, 2100],
    yearsWhy: 'Polaroid instant cameras of this kind date from 1972 (the SX-70).',
    seasons: ['spring'],
    place:
      'a quiet street in the old neighborhood by Drake Park on an April afternoon: a 1920s craftsman bungalow with a deep porch, ' +
      'a green lawn coming back, a tall ponderosa pine, and a white wooden yard-sign post in the lawn with a plain blank white square panel hanging from its arm',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'spring',
    companion: true,
    framing:
      'from the sidewalk just behind them, 35mm, a tall frame: their backs and shoulders in the lower third, the dog at his feet, ' +
      'the bungalow filling the middle of the frame, the sign post small on the lawn to the right',
    light: 'soft April afternoon sun, 5200K, the porch in gentle shade',
    exposure: 'day',
    action:
      // The lens named outright: "raises it to her eye" came back with the camera turned round at the viewer (Matt 2026-09-24).
      '{A} holds a boxy folding instant camera up to her eye with both hands, its lens pointed at the house and the back of the camera toward us, ' +
      'and takes a picture of the house while {B} stands beside her holding the leash of their black Labrador with the red collar; ' +
      'the camera stays pointed at the house the whole time',
    props: 'a folding instant camera with a leather front, seen from behind: its back and her hands toward us',
    move: 'hold',
    composite: 'yard_sign',
    alsoReject: ['any letters, numbers, or marks on the sign panel', 'the camera lens pointing toward the viewer'],
  },
  {
    id: 'house-snapshot',
    role: 'snapshot',
    label: 'The photograph she took of the house',
    years: [1925, 2100],
    seasons: ['spring'],
    place:
      'the front yard of the same 1920s craftsman bungalow on an April afternoon: a deep porch, a green lawn, a tall ponderosa pine, ' +
      'and a white wooden yard-sign post in the lawn with a plain blank white square panel hanging from its arm',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: [],
    framing:
      'a square amateur snapshot taken from the sidewalk where they stood, one step closer: the sign post and its blank panel large ' +
      'in the right foreground, the bungalow behind it; the sidewalk and the lawn empty',
    light: 'soft April afternoon sun, 5200K',
    exposure: 'day',
    action: 'the empty front yard in the afternoon light: the house and the sign post, nobody on the lawn or the sidewalk',
    move: 'hold',
    composite: 'yard_sign',
    stillOnly: true,
    prop: true,
    alsoReject: ['any letters, numbers, or marks on the sign panel', 'people in frame'],
  },
  {
    id: 'tower-drinks-outside',
    role: 'eat',
    label: 'That night: drinks outside across from the Tower, the Polaroids out',
    years: [1940, 2100],
    yearsWhy: 'The Tower Theatre opened on Wall Street in 1940.',
    seasons: ['spring', 'summer'],
    place:
      'a small table on the sidewalk on Wall Street in downtown Bend on an April evening, across the street from the Tower Theatre, ' +
      'its tall neon tower and marquee lit, the marquee letter boards plain and blank',
    refs: [TOWER_REF],
    cast: ['A', 'B'],
    wardrobe: 'evening',
    framing:
      'across the little table at their level, 50mm, a tall frame: the two of them side by side at the table in the lower half, ' +
      'the lit Tower Theatre tower and marquee across the street rising behind them in the upper half, soft',
    light: 'blue dusk with the warm neon of the Tower and a candle on the table, 3000K practicals',
    exposure: 'night',
    periodCues: ['street'],
    action:
      '{A} and {B} laugh together over a few instant photographs in their hands, the white backs of the photographs toward the camera, two drinks on the table',
    props: 'two short cocktails and a candle in a red glass on the table',
    move: 'hold',
    composite: 'marquee',
    alsoReject: ['readable lettering on the marquee or storefronts'],
  },
  {
    // Round 3 (Matt): "too animated, tone it down some, photo is flipped backwards, nothing on marquee".
    // An instant print's back is black: "white backs toward the camera" turned the pictures out at the lens.
    id: 'tower-drinks-quiet',
    role: 'eat',
    label: 'That night: a quiet drink across from the Tower, the Polaroids between them',
    years: [1940, 2100],
    yearsWhy: 'The Tower Theatre opened on Wall Street in 1940.',
    seasons: ['spring', 'summer'],
    place:
      'a small table on the sidewalk on Wall Street in downtown Bend on an April evening, across the street from the Tower Theatre, ' +
      'its tall neon tower and marquee lit, the marquee letter boards plain and blank',
    refs: [TOWER_REF],
    cast: ['A', 'B'],
    wardrobe: 'evening',
    framing:
      'across the little table at their level, 50mm, a tall frame: the two of them side by side at the table in the lower half, ' +
      'the lit Tower Theatre tower and marquee across the street rising behind them in the upper half, soft',
    light: 'blue dusk with the warm neon of the Tower and a candle on the table, 3000K practicals',
    exposure: 'night',
    periodCues: ['street'],
    action:
      // The first motion shuffled the cards and turned pictures out at the lens: two cards, held still.
      '{A} and {B} sit very still, heads close, looking down at the two photographs she holds low between them, quiet smiles; ' +
      'the black backs of the photographs face the camera and their pictures face the two of them; the photographs stay where they are; ' +
      'only the candle flickers',
    props: 'two short cocktails and a candle in a red glass on the table; instant photographs with black backs and white borders',
    move: 'hold',
    composite: 'marquee',
    alsoReject: ['readable lettering on the marquee or storefronts', 'a photograph with its picture turned to the camera', 'big laughter'],
  },
  {
    id: 'polaroids-on-table',
    role: 'prints',
    label: 'The Polaroids come down on the table, the house last',
    years: [1972, 2100],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    place: 'the top of the same small outdoor table at night: a candle in a red glass, two short cocktails, a paper napkin',
    refs: [],
    cast: [],
    framing: 'straight down from above the table, 40mm, a tall frame, the tabletop filling the frame with open space in the middle',
    light: 'warm candlelight and the neon glow of the street, 2800K, soft shadows',
    exposure: 'night',
    action: 'the tabletop waits, still, with open space in the middle for the photographs',
    move: 'tripod',
    stillOnly: true,
    composite: 'photo_print',
    elsewhere: true,
    alsoReject: ['photographs, cards, or paper in the open middle of the table'],
  },
  {
    id: 'pack-wagon-lab-spring',
    role: 'pack',
    label: 'The wagon loaded, the Lab jumps in last',
    years: [1965, 1995],
    yearsWhy:
      'A wood-panelled full-size station wagon with skis on the roof rack: the family ski car from the late 1960s until minivans replaced it in the 1990s.',
    seasons: ['spring'],
    place:
      'the curb of a quiet Old Bend street on a bright cool April morning: 1920s bungalows, tall ponderosa pines, green lawns, bare trees budding',
    refs: ['asset:0c6777d4-f8b3-4b2c-a399-67810745cea3'],
    cast: ['A', 'B'],
    wardrobe: 'travel',
    companion: true,
    framing:
      'from the sidewalk at the back of the car, 35mm, a tall frame: the open tailgate of the station wagon in the lower half, ' +
      'two pairs of skis on the roof rack, the two of them beside it, the license plate out of frame',
    light: 'low bright morning sun from the side, 5200K, long soft shadows',
    exposure: 'day',
    periodCues: ['vehicles'],
    action:
      'their black Labrador with the red collar jumps up into the back of the loaded station wagon while {A} and {B} stand at the open tailgate and watch',
    props:
      'a brown full-size American station wagon from the late 1970s with wood-grain side panels and a roof rack, no badges or lettering on the car; ' +
      'suitcases and a cooler in the cargo area',
    move: 'follow',
    alsoReject: ['any badge, license plate, or lettering on the car', 'snow on the ground in town'],
  },
  {
    id: 'commute-dash-polaroid',
    role: 'commute',
    label: 'Back home: stopped in traffic, the ski Polaroid on the dash',
    years: [1972, 2100],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'a big-city freeway in slow afternoon traffic under a hazy warm sky: lanes of cars, an overpass ahead, palm trees along the embankment',
    refs: [],
    cast: ['B'],
    wardrobe: 'work',
    framing:
      'from the back seat on the passenger side, 35mm, a tall frame: he sits in the driver seat on the left side of the car with the ' +
      'steering wheel directly in front of him, his back and shoulders in the left half of the frame; the empty front passenger seat on the right; ' +
      'a single instant photograph tucked upright on the dashboard in front of the empty passenger seat, its picture facing back toward him ' +
      'and the camera; the stopped traffic ahead through the windshield',
    light: 'warm hazy afternoon sun through the windshield, 4800K',
    exposure: 'day',
    periodCues: ['vehicles'],
    // Eyes named outright: "glances across" turned him on past the photo into the lens (Matt 2026-09-24 LHD pass).
    action: '{B} sits in the slow traffic with both hands on the wheel, eyes on the road; his eyes drop to the photograph on the dashboard for a moment with a small smile, then go back to the road; he never looks toward the back seat or the camera',
    props:
      'the same boxy brown vinyl dashboard and wood-grain trim of the station wagon; the instant photograph has a white border and a plain blank white picture',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: ['any picture, letters, or marks on the photograph', 'snow', 'a dog in the car', 'anyone else in the car'],
  },
  {
    // Matt 2026-09-24: the photo rides on his sun visor; stuck in traffic he flips it down, pulls the photo from the strap, and looks at it.
    id: 'commute-visor-polaroid',
    role: 'commute',
    label: 'Back home: stopped in traffic, he pulls the ski Polaroid from the sun visor',
    years: [1972, 2100],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'a big-city freeway at a standstill under a hazy warm sky: lanes of stopped cars, an overpass ahead, palm trees along the embankment',
    refs: [],
    cast: ['B'],
    wardrobe: 'work',
    framing:
      'from the back seat on the passenger side, 35mm, a tall frame: he sits in the driver seat on the left side of the car with the ' +
      'steering wheel directly in front of him, seen from behind and in profile; the driver sun visor flipped down above the windshield in front of him, ' +
      'a single instant photograph tucked behind the elastic strap on the visor, its picture facing back toward him and the camera; ' +
      'the stopped traffic ahead through the windshield',
    light: 'warm hazy morning sun through the windshield, 4800K',
    exposure: 'day',
    periodCues: ['vehicles'],
    action:
      '{B}, stopped in traffic, reaches up to the lowered sun visor, slides the photograph out from behind its strap and holds it low over the ' +
      'steering wheel to look at it with a small smile; he never looks toward the back seat or the camera',
    props:
      'the same boxy brown vinyl dashboard and wood-grain trim of the station wagon; a padded brown sun visor with an elastic strap; ' +
      'the instant photograph has a white border and a plain blank white picture',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: ['any picture, letters, or marks on the photograph', 'snow', 'a dog in the car', 'anyone else in the car'],
  },
  {
    // Matt 2026-09-24: busy at work answering calls, then she stops what she is doing to look at the photo on her desk.
    id: 'office-busy-polaroid',
    role: 'work_a',
    label: 'Her office, phones going; she stops for the ski Polaroid by her lamp',
    years: [1960, 1990],
    yearsWhy: 'An office of the era: electric typewriters and multi-line desk telephones with lit line buttons, no computer screens.',
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'a bright, busy city office in the afternoon: phones ringing, colleagues hurrying past with folders, tall windows, potted plants',
    refs: [],
    cast: ['A'],
    wardrobe: 'work',
    framing:
      'at desk height from her right side, 50mm, a tall frame: she is seen in profile on the left, the desk telephone receiver at her ear; ' +
      'in the foreground on the right a single instant photograph is propped against the base of her desk lamp at an angle, ' +
      'turned halfway between her and the camera so both she and the camera see its picture; the busy office soft beyond',
    light: 'warm afternoon window light, 5000K, soft',
    exposure: 'day',
    action:
      '{A}, busy, finishes a call and hangs up the desk telephone, then stops, and turns to the photograph propped by her lamp and looks at it ' +
      'with a slow smile, remembering, while the office keeps moving behind her',
    props:
      'an electric typewriter, a multi-line desk telephone with lit buttons, a stack of pink message slips, a coffee mug, a brass desk lamp; ' +
      'the instant photograph has a white border and a plain blank white picture',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: ['any picture, letters, or marks on the photograph', 'a computer screen', 'readable text on papers'],
  },
  {
    // Matt 2026-09-24: they both get home to a busy urban neighborhood; the dog barks happily at the window.
    id: 'arrive-home-dog-window',
    role: 'return',
    label: 'Home from work on a busy street, the Lab barking at the window',
    years: [1965, 1995],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      // Round 3 (Matt): "the dog looks huge, and i want more of an urban neighborhood".
      'their two-story stucco fourplex on a busy big-city street at dusk: apartment buildings shoulder to shoulder, cars parked along both curbs ' +
      'and more passing with their headlights on, neighbors on the sidewalk, a city bus at the corner, palm trees and telephone wires against a pink sky',
    refs: [],
    cast: ['A', 'B'],
    wardrobe: 'work',
    companion: true,
    framing:
      'from the sidewalk across the street, 35mm, a tall frame: the front of the fourplex with their ground-floor front window in the middle, ' +
      'their black Labrador at the lit window behind the glass, an ordinary-sized adult Lab with only its head and front paws on the sill, small ' +
      'in the frame; the two of them walking up the front steps from the street, seen from behind in three-quarter view; a passing car soft in the foreground',
    light: 'dusk, the sky pink and fading, the front window lit warm from inside',
    exposure: 'day',
    periodCues: ['vehicles'],
    action:
      // The first motion let the dog out the front door and up to the size of a pony: it stays inside, behind the glass.
      'inside the house, their black Labrador with the red collar barks happily and wags behind the closed front window glass, staying inside and small, ' +
      'as {A} and {B} walk hand in hand toward the front steps from the busy street; the front door stays shut',
    props: 'the same two-story stucco fourplex with its front steps; the ground-floor front window with the curtains open',
    move: 'tripod',
    alsoReject: ['lettering on cars, signs, or the house', 'snow', 'pine trees', 'a second dog', 'an oversized dog', 'a suburban lawn'],
  },
  {
    // Round 3 (Matt): he looked like a different man; standstill traffic; the sun in his eyes, so he lowers the visor, finds the photo,
    // pulls it out, and looks at it fondly, remembering Bend.
    id: 'commute-visor-sun',
    role: 'commute',
    label: 'Standstill traffic, sun in his eyes: down comes the visor, and the ski Polaroid with it',
    years: [1972, 2100],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'a big-city freeway at a dead standstill under a low morning sun: bumper-to-bumper stopped cars in every lane, brake lights, ' +
      'an overpass ahead, palm trees along the embankment',
    refs: [],
    cast: ['B'],
    wardrobe: 'work',
    framing:
      'from the back seat on the passenger side, 35mm, a tall frame: he sits in the driver seat on the left side of the car with the ' +
      'steering wheel directly in front of him, seen from behind and in profile; the driver sun visor folded up flat against the roof above ' +
      'the windshield; low sun glaring through the windshield into his eyes; the stopped traffic ahead; once the visor is down, the photograph ' +
      'behind its strap is facing back toward him and the camera',
    light: 'low hard morning sun straight through the windshield, flaring, warm 4000K',
    exposure: 'day',
    periodCues: ['vehicles'],
    action:
      '{B} squints into the sun, reaches up and flips the sun visor down; a photograph is tucked behind the strap on the visor; ' +
      'he slides it out and holds it low over the steering wheel, looking at it fondly, remembering; he never looks toward the back seat or the camera',
    props:
      'the same boxy brown vinyl dashboard and wood-grain trim of the station wagon; a padded brown sun visor with an elastic strap; ' +
      'the instant photograph has a white border and a plain blank white picture',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: ['any picture, letters, or marks on the photograph', 'moving traffic', 'a dog in the car', 'anyone else in the car'],
  },
  {
    // Round 3 (Matt): "the shot should be more from the back and the photo is on her desk, she is working busily and notices the photo,
    // stops what she is doing and picks it up and also looks at it fondly".
    id: 'office-back-polaroid',
    role: 'work_a',
    label: 'Her busy desk: she stops typing, picks up the ski Polaroid, and looks at it',
    years: [1960, 1990],
    yearsWhy: 'An office of the era: electric typewriters and multi-line desk telephones with lit buttons, no computer screens.',
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'a bright, busy city office in the afternoon: phones ringing, colleagues hurrying past with folders, tall windows, potted plants',
    refs: [],
    cast: ['A'],
    wardrobe: 'work',
    framing:
      'from just behind her right shoulder, 40mm, a tall frame: the back of her head and her shoulder in the foreground; her desk ahead with an ' +
      'electric typewriter, a multi-line telephone, stacks of papers, and a single instant photograph lying face up on the desk beside the ' +
      'typewriter, its picture facing her; the busy office soft beyond',
    light: 'warm afternoon window light, 5000K, soft',
    exposure: 'day',
    action:
      '{A}, busy, types fast on the electric typewriter, notices the photograph on the desk, stops, picks it up and holds it up in front of her, ' +
      'looking at it fondly, remembering; she never looks at the camera',
    props:
      'an electric typewriter, a multi-line desk telephone with lit buttons, stacks of papers and pink message slips, a coffee mug; ' +
      'the instant photograph has a white border and a plain blank white picture',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: ['any picture, letters, or marks on the photograph', 'a computer screen', 'readable text on papers', 'her face turned to the camera'],
  },
  {
    id: 'office-desk-polaroid',
    role: 'work_a',
    label: 'Her office: her copy of the ski Polaroid propped by her lamp',
    years: [1960, 1990],
    yearsWhy: 'An office of the era: electric typewriters and desk telephones, no computer screens.',
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'a bright, busy city office in the afternoon: tall windows, potted plants, colleagues at nearby desks, a warm and friendly room',
    refs: [],
    cast: ['A'],
    wardrobe: 'work',
    framing:
      'at desk height from her right side, 50mm, a tall frame: she is seen in profile on the left, looking to the right at the desk; ' +
      'in the foreground on the right a single instant photograph is propped against the base of her desk lamp at an angle, ' +
      'turned halfway between her and the camera so both she and the camera see its picture; the bright office soft beyond',
    light: 'warm afternoon window light, 5000K, soft',
    exposure: 'day',
    action: '{A}, in profile, sets down her desk telephone and looks at the photograph propped by her lamp, and a small smile comes',
    props:
      'an electric typewriter, a desk telephone, a coffee mug, a brass desk lamp; the instant photograph has a white border and a plain blank white picture',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: ['any picture, letters, or marks on the photograph', 'a computer screen', 'readable text on papers'],
  },
  {
    id: 'kitchen-table-polaroid',
    role: 'home',
    label: 'That night at the kitchen table, the house between them',
    years: [1960, 1995],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'the small kitchen of a city apartment at night: yellow linoleum floor, avocado-green appliances, ' +
      'a harvest-gold rotary telephone on the wall, a window onto dark city lights',
    refs: [],
    cast: ['A', 'B'],
    wardrobe: 'work',
    companion: true,
    framing:
      'from just behind his shoulder at the small kitchen table, 35mm, a tall frame: the back of his shoulder in the lower right, ' +
      'a single instant photograph lying face up on the table in the middle, facing them, she across the table looking at it, the dog on the floor',
    light: 'a single warm pendant lamp over the table, 2800K, the rest of the kitchen falling off into shadow',
    exposure: 'interior_low',
    action: '{A} rests a fingertip on the edge of the photograph on the table and looks up at {B}, smiling',
    props:
      'a Formica kitchen table with two glasses of wine; the instant photograph has a white border and a plain blank white picture; ' +
      'their black Labrador with the red collar lying on the floor',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: ['any picture, letters, or marks on the photograph'],
  },
  {
    // Matt 2026-09-24: they see the house photo with the number, "look at each other like they are thinking the same thing".
    id: 'look-same-thought',
    role: 'look',
    label: 'Across the kitchen table: the same thought, no words',
    years: [1960, 1995],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place: 'the same small kitchen at night after dinner, the plates cleared, the window dark',
    refs: [],
    cast: ['A', 'B'],
    wardrobe: 'work',
    framing:
      'from the side of the small kitchen table at table height, 50mm, a tall frame: the two of them facing each other across the corner ' +
      'of the table, both in profile, the instant photograph lying flat on the table between them seen edge-on, two wine glasses',
    light: 'a single warm pendant lamp over the table, 2800K, the rest of the kitchen falling off into shadow',
    exposure: 'interior_low',
    action:
      '{A} and {B} lift their eyes from the photograph on the table at the same moment and look at each other; neither says a word, ' +
      'and the same slow smile comes to both of them; neither looks at the camera',
    props: 'a Formica kitchen table with two glasses of wine; the instant photograph lies flat with its white back and border toward the camera',
    move: 'tripod',
    alsoReject: ['any picture, letters, or marks on the photograph', 'either of them looking at the camera'],
  },
  {
    // Matt 2026-09-24: "man on phone holding photo with his wife excitedly looking on".
    id: 'kitchen-call-polaroid',
    role: 'call',
    label: 'He calls from the kitchen phone, the house in his hand; she can hardly stand still',
    years: [1960, 1995],
    yearsWhy: 'A wall-mounted rotary telephone with a long coiled cord: every American kitchen until push-button phones took over in the late 1980s.',
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place:
      'the same small kitchen at night: yellow linoleum floor, avocado-green appliances, a harvest-gold rotary telephone on the wall with a long coiled cord',
    refs: [],
    cast: ['A', 'B'],
    wardrobe: 'work',
    framing:
      'from just behind his left shoulder, 35mm, a tall frame: he stands at the harvest-gold wall telephone with the receiver at his ear, ' +
      'holding the single instant photograph in his other hand at chest height, its picture facing him and the camera; she stands close ' +
      'at his side in three-quarter view, looking at the photograph and then at him',
    light: 'warm kitchen light from the pendant lamp, 2800K, soft shadows',
    exposure: 'interior_low',
    action:
      // Round 3 (Matt): "the woman is way too excited". Hopeful, not screaming.
      '{B} waits with the telephone receiver at his ear, holding the photograph, while {A} beside him holds his arm, excited but quiet, ' +
      'a hopeful smile with her lips closed, looking from the photograph to him; neither looks at the camera',
    props:
      'a harvest-gold wall-mounted rotary telephone with a coiled cord; the instant photograph has a white border and a plain blank white picture',
    move: 'tripod',
    composite: 'photo_print',
    alsoReject: ['any picture, letters, or marks on the photograph', 'a mobile phone', 'either of them looking at the camera', 'an open-mouthed laugh or scream'],
  },
  {
    id: 'house-polaroid-closeup',
    role: 'number',
    label: 'The house on the table; the sign, and the number on it',
    years: [1972, 2100],
    seasons: ['winter', 'fall', 'spring', 'summer'],
    elsewhere: true,
    place: 'the Formica top of the same kitchen table at night, the edge of a wine glass',
    refs: [],
    cast: [],
    framing:
      'a close shot straight down onto the tabletop, 100mm, a tall frame: a plain blank white card the size of an instant photograph ' +
      'fills the middle of the frame, about two thirds of the frame width, the rim of a wine glass at one edge and the table pattern around it',
    light: 'the single warm pendant lamp from above, 2800K, soft falloff to the edges',
    exposure: 'interior_low',
    action: 'the card lies still on the table under the lamp',
    move: 'tripod',
    stillOnly: true,
    composite: 'photo_print',
    alsoReject: ['any picture, letters, or marks on the card'],
  },
]

export function getBeat(id: string): BeatDef | null {
  return BEATS.find((b) => b.id === id) ?? null
}

/** Can this beat honestly appear in this year and season? */
export function beatFits(beat: BeatDef, year: number, season: Season): boolean {
  return year >= beat.years[0] && year <= beat.years[1] && beat.seasons.includes(season)
}
