/**
 * lib/studio/story/eras.ts — what a year looks like, as data.
 *
 * An era pack is everything the story engine needs to make footage pass for
 * a given year on the format a family would actually have owned that year:
 * the period content the generator is asked for, the camera grammar of an
 * amateur in that decade, the anachronisms the judge must reject, and the
 * film-lab parameters that give every shot the same stock.
 *
 * The split that matters (research 2026-09-23, docs/STORY_FILMS.md):
 * the GENERATOR is asked for period CONTENT (wardrobe, cars, rooms, how people
 * behaved in front of a home-movie camera) and never for a "vintage look".
 * The LOOK is applied afterward by scripts/studio/filmlab.py from `lab`, so
 * ten generations from ten calls come out as one reel of one stock. Model-baked
 * grain varies take to take; ours does not.
 *
 * Adding an era is adding a row here. A row starts as `draft` and becomes
 * `proven` only when a piece built on it has shipped past Matt.
 */

export type EraId =
  | 'super8_1982'
  | 'regular8_1962'
  | 'bw16mm_1955'
  | 'silent16mm_1926'
  | 'vhs_1989'

export type ExposureVariant = 'day' | 'interior_low' | 'night'

/**
 * The contract with scripts/studio/filmlab.py. Units are the lab's working
 * units: pixels at gate resolution, luminance on 0..1, degrees, frames.
 */
export type LabParams = {
  /** Projection rate. Super 8 silent ran at 18; we never interpolate to smooth it. */
  fps: number
  gate: {
    width: number
    height: number
    /** Corner radius of the camera gate, px. Real gates were not sharp rectangles. */
    corner: number
    sprockets: 'super8' | 'regular8' | '16mm' | 'none'
  }
  /** Tone and dye model. Each is a named curve set inside the lab. */
  stock: 'kodachrome40' | 'kodachrome2' | 'plusx' | 'vhs'
  /** Per-frame grain: std on 0..1 at mid-grey, grain clump size px, share carried in chroma. */
  grain: { strength: number; size: number; chroma: number }
  /** Optical softness, gaussian sigma px at gate resolution. */
  softness: number
  /**
   * Effective resolving power as a fraction of gate width. A Super 8 frame on
   * a consumer zoom resolves far less than a generator's 1080p; adding grain
   * to a sharp frame reads as a modern photo with noise on it.
   */
  resolve: number
  /** Low-level highlight diffusion of an uncoated consumer zoom lens, 0..1. */
  bloom: number
  /** Band-limited gate weave: translation px, rotation deg, correlation period in frames. */
  weave: { px: number; rotDeg: number; period: number }
  /** Red-orange bloom around highlights on dark ground. */
  halation: { threshold: number; radius: number; strength: number }
  /** Corner falloff, 0 none to 1 heavy. */
  vignette: number
  /** Frame-to-frame exposure flicker amplitude. */
  flicker: number
  /** Dye fade toward the stock's aging cast, 0 fresh to 1 attic box. */
  fade: number
  /** Expected dust / hair specks per frame. */
  dust: number
  /** Overexposed frames at the head of each shot (camera motor spin-up in an in-camera edit). */
  startFlash: number
  /** Multipliers for the under-lit interior and night variants. */
  lowLight: { grainMul: number; satMul: number; warm: number; exposure: number }
  monochrome: boolean
}

export type EraPack = {
  id: EraId
  label: string
  /** The year every frame must pass for. */
  year: number
  /** The format a family would have shot this on, in plain words. */
  format: string
  /** Why this format for this year. Sourced in docs/STORY_FILMS.md. */
  why: string
  gateAspect: '4:3'
  /**
   * Period content, handed to the still prompt. Content only: never a film
   * look word, the lab owns the look.
   */
  period: {
    /**
     * Hair and grooming, per person. Split by pronoun because era cues apply
     * to everyone in frame: a shared "full moustaches" cue put a moustache on
     * the woman in two of three cast takes (2026-09-23).
     */
    hair: { she: string; he: string }
    wardrobe: string
    vehicles: string
    rooms: string
    street: string
  }
  /** How an amateur behaved with this camera: the grammar the frames obey. */
  camera: string
  /** Everything the judge must treat as a hard fail for this year. */
  anachronisms: string[]
  lab: LabParams
  sound: {
    /** The machine you hear under the music. Silent formats get the projector. */
    bed: 'projector' | 'tape' | 'none'
    /** One line for the score: era, instrumentation, tempo. */
    music: string
  }
  status: 'proven' | 'draft'
}

const SUPER8_LAB: LabParams = {
  fps: 18,
  gate: { width: 960, height: 720, corner: 18, sprockets: 'super8' },
  stock: 'kodachrome40',
  grain: { strength: 0.05, size: 1.5, chroma: 0.15 },
  softness: 0.9,
  resolve: 0.68,
  bloom: 0.14,
  weave: { px: 1.3, rotDeg: 0.07, period: 5 },
  halation: { threshold: 0.8, radius: 14, strength: 0.2 },
  vignette: 0.4,
  flicker: 0.028,
  fade: 0.12,
  dust: 0.22,
  startFlash: 2,
  lowLight: { grainMul: 1.7, satMul: 0.82, warm: 0.07, exposure: 0.92 },
  monochrome: false,
}

export const ERAS: Record<EraId, EraPack> = {
  super8_1982: {
    id: 'super8_1982',
    label: 'Super 8, 1982',
    year: 1982,
    format: 'Super 8 silent cartridge, Kodachrome 40, a zoom-lens home-movie camera',
    why:
      'Super 8 was the family format through the early 1980s; consumer camcorders only arrived ' +
      'in 1983 (Betamovie) and cost over $1,000. On-screen date stamps are a late-80s VHS tell.',
    gateAspect: '4:3',
    period: {
      hair: { she: 'feathered, layered hair with soft volume', he: 'hair over the tops of the ears, a side part, no modern fade or undercut' },
      wardrobe:
        'down vests, cable-knit turtlenecks, corduroy, sheepskin-collar jackets, knit caps; ' +
        'on the mountain matte nylon ski wear in solid colors with a single chest stripe, bib pants, straight skis, knit hats',
      vehicles: 'a boxy late-1970s or early-1980s model (a Volvo 240 wagon, a Subaru wagon, a full-size pickup)',
      rooms: 'wood paneling, amber glass, candles in red glass globes, cloth napkins, no screens anywhere',
      street: 'brick storefronts, incandescent window light, sodium and incandescent street lamps, no LED signage',
    },
    camera:
      'filmed by one of the couple on a handheld home-movie camera: amateur framing, horizon a few ' +
      'degrees off, nothing staged like a commercial',
    anachronisms: [
      'any vehicle styled after 1984',
      'LED or flat-panel lighting, screens, or signage',
      'modern outerwear: technical shells, puffer jackets with glossy fabric, logos of brands founded after 1982',
      'helmets or shaped (parabolic) skis on the mountain',
      'modern hairstyles, veneers, or eyebrow grooming',
      'phones of any kind, EXCEPT where the shot intent names the smartphone',
    ],
    lab: SUPER8_LAB,
    sound: {
      bed: 'projector',
      music: 'original early-1980s soft-rock instrumental: warm electric piano, chorused clean guitar, soft live drums, about 104 bpm, AM-radio warmth',
    },
    status: 'draft',
  },
  regular8_1962: {
    id: 'regular8_1962',
    label: 'Regular 8, 1962',
    year: 1962,
    format: 'Regular 8mm (Double 8), Kodachrome II, a spring-wound family camera',
    why: 'Kodachrome II launched in 1961; Double 8 was the household format until Super 8 in 1965.',
    gateAspect: '4:3',
    period: {
      hair: { she: 'short set curls or a bouffant', he: 'a pomaded side part or a crew cut' },
      wardrobe: 'wool car coats, cardigans, skirts below the knee, fedoras giving way to bare heads, leather ski boots with lace-up fronts',
      vehicles: 'late-1950s and early-1960s American sedans and wagons with chrome, fins fading out',
      rooms: 'knotty pine, formica, chrome diner stools, pendant lamps',
      street: 'neon and painted signs, angled parking, wide sidewalks',
    },
    camera: 'spring-wound camera held at the chest, short bursts of a few seconds, stiff family framing',
    anachronisms: ['any vehicle styled after 1963', 'synthetic ski suits', 'color television screens', 'phones except where named'],
    lab: {
      ...SUPER8_LAB,
      fps: 16,
      gate: { width: 960, height: 720, corner: 22, sprockets: 'regular8' },
      stock: 'kodachrome2',
      grain: { strength: 0.06, size: 1.7, chroma: 0.25 },
      softness: 1.2,
      weave: { px: 2.0, rotDeg: 0.1, period: 4 },
      fade: 0.25,
      dust: 0.35,
    },
    sound: { bed: 'projector', music: 'original early-1960s lounge instrumental: vibraphone, upright bass, brushed snare, about 96 bpm' },
    status: 'draft',
  },
  bw16mm_1955: {
    id: 'bw16mm_1955',
    label: '16mm black and white, 1955',
    year: 1955,
    format: '16mm black-and-white reversal on a turret home-movie camera',
    why: '16mm reversal was the serious amateur format of the 1950s; color was expensive and many families shot black and white.',
    gateAspect: '4:3',
    period: {
      hair: { she: 'short permanent waves or pin curls', he: 'short back and sides with a neat part' },
      wardrobe: 'wool overcoats, hats on men, gloves, long wool skirts, leather lace-up ski boots, wooden skis',
      vehicles: 'rounded early-1950s sedans and pickups',
      rooms: 'wood booths, counter service, table lamps with cloth shades',
      street: 'painted signs, neon, angled parking',
    },
    camera: 'turret camera held steady at eye level, formal centered framing',
    anachronisms: ['any vehicle styled after 1956', 'synthetic fabrics', 'phones except where named'],
    lab: {
      ...SUPER8_LAB,
      fps: 18,
      gate: { width: 960, height: 720, corner: 14, sprockets: '16mm' },
      stock: 'plusx',
      grain: { strength: 0.045, size: 1.3, chroma: 0 },
      softness: 0.8,
      halation: { threshold: 0.85, radius: 10, strength: 0.08 },
      monochrome: true,
    },
    sound: { bed: 'projector', music: 'original 1950s small-combo swing: clarinet, piano, brushed drums, about 112 bpm' },
    status: 'draft',
  },
  silent16mm_1926: {
    id: 'silent16mm_1926',
    label: 'Silent 16mm, 1926',
    year: 1926,
    format: 'Cine-Kodak 16mm black-and-white, hand-cranked pace, projected with amber and blue tints',
    why: 'Kodak introduced 16mm Cine-Kodak for amateurs in 1923; silent projection ran near 16-18 fps.',
    gateAspect: '4:3',
    period: {
      hair: { she: 'bobbed hair under a cloche hat', he: 'slicked side part' },
      wardrobe: 'long wool coats, flapper-era dresses, three-piece suits, knickerbockers for winter sport',
      vehicles: 'Model T and Model A era cars, horse teams still on rural roads',
      rooms: 'pressed-tin ceilings, bentwood chairs, oil and early electric lamps',
      street: 'false-front wooden buildings beside new brick, dirt and early paved streets, a lumber town',
    },
    camera: 'tripod-mounted, long static takes, the frame set like a stage',
    anachronisms: ['any vehicle after 1927', 'zippers on outerwear', 'phones except where named'],
    lab: {
      ...SUPER8_LAB,
      fps: 16,
      gate: { width: 960, height: 720, corner: 10, sprockets: '16mm' },
      stock: 'plusx',
      grain: { strength: 0.07, size: 1.9, chroma: 0 },
      softness: 1.4,
      weave: { px: 2.6, rotDeg: 0.15, period: 3 },
      flicker: 0.07,
      fade: 0.3,
      dust: 0.8,
      monochrome: true,
    },
    sound: { bed: 'projector', music: 'original silent-film piano accompaniment, ragtime-inflected, about 100 bpm' },
    status: 'draft',
  },
  vhs_1989: {
    id: 'vhs_1989',
    label: 'VHS-C camcorder, 1989',
    year: 1989,
    format: 'VHS-C palm camcorder with an on-screen date stamp',
    why: 'By 1989 palm-size VHS-C and 8mm camcorders had replaced Super 8 in most families.',
    gateAspect: '4:3',
    period: {
      hair: { she: 'big permed hair with a scrunchie', he: 'a short mullet' },
      wardrobe: 'neon ski jackets, Starter-style jackets, acid-wash denim, pleated pants',
      vehicles: 'late-1980s Jeep Cherokees, Toyota pickups, minivans',
      rooms: 'oak trim, mauve and teal, brass fixtures, a tube TV in the corner',
      street: 'backlit plastic signs, early brewpub windows',
    },
    camera: 'camcorder held at arm height, auto-focus hunting, casual off-center framing',
    anachronisms: ['any vehicle styled after 1990', 'flat screens', 'phones except where named'],
    lab: {
      ...SUPER8_LAB,
      fps: 30,
      gate: { width: 960, height: 720, corner: 0, sprockets: 'none' },
      stock: 'vhs',
      grain: { strength: 0.035, size: 1.0, chroma: 0.6 },
      softness: 1.6,
      weave: { px: 0, rotDeg: 0, period: 1 },
      halation: { threshold: 0.9, radius: 6, strength: 0.05 },
      startFlash: 0,
      dust: 0,
    },
    sound: { bed: 'tape', music: 'original late-1980s synth-pop instrumental: DX7 electric piano, gated snare, about 116 bpm' },
    status: 'draft',
  },
}

export function getEra(id: string): EraPack | null {
  return (ERAS as Record<string, EraPack>)[id] ?? null
}

/** The lab parameters for one shot: the era's stock, bent for the light it was shot in. */
export function labParamsFor(era: EraPack, exposure: ExposureVariant): LabParams & { exposure: ExposureVariant } {
  return { ...era.lab, exposure }
}

/**
 * The context handed to the frame judge. It describes the world the frame
 * claims to be from; it is never a source for any figure.
 */
export function judgeContextFor(era: EraPack): string {
  return [
    `This frame is one shot of an authored period film and must pass as a candid photograph taken in ${era.year} on ${era.format}.`,
    'People in the frame are intended: they are the cast.',
    `Anything that did not exist or was not in common use in ${era.year} is an anachronism: ${era.anachronisms.join('; ')}.`,
    'A film look (grain, fade, weave) is added later; judge content, faces, hands, and period accuracy, not grain.',
  ].join(' ')
}
