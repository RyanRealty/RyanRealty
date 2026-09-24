/**
 * lib/studio/story/arc.ts — the visitor arc, and the planner that fills it.
 *
 * Every vintage piece tells the same true story in a different year: someone
 * from somewhere busier comes to Bend for a few days, lives the place, and
 * does not want to leave. The arc is that story's skeleton, timed in seconds
 * the way a Ghibli e-konte is:
 *
 *   hook -> arrive -> play -> play (together) -> eat -> town -> stroll (ma)
 *   -> discover -> the sign -> the phone -> BREAK (the present) -> the call -> end
 *
 * The break is the formal device: the whole reel obeys its era until the
 * modern object appears, and at that beat the period gate gives way to a crisp
 * present-day phone screen. It is the only sharp frame in the film. The brand
 * is on that screen, so the joke and the name land in the same beat.
 *
 * The homecoming arc (Matt 2026-09-24, "the quintessential Bend story") keeps
 * the trip and takes them home before the call: they leave, the week back at
 * work shows them what they left, and he calls from their own kitchen on the
 * phone they own. No break, no present-day object; the film never leaves 1982.
 *
 * Pure: no I/O, no generator calls. The CLI and the tests both run it.
 */
import { BEATS, beatFits, getBeat, type BeatDef, type BeatRole, type Season } from './beats'
import type { EraPack } from './eras'

export type ArcRole = BeatRole | 'break' | 'end'

export type ArcId = 'visitor' | 'homecoming' | 'polaroid'

export type ArcSlot = {
  role: ArcRole
  /** Seconds on screen in the finished cut. */
  seconds: number
  because: string
  /** Kept only when the piece pins a beat or one fits the year and season (no summer après). */
  optional?: boolean
}

export const VISITOR_ARC: ArcSlot[] = [
  {
    role: 'hook',
    seconds: 2.6,
    because: 'A face at the lens in unmistakable period film reads at gist speed and promises a trip.',
  },
  { role: 'arrive', seconds: 2.6, because: 'The road runs at the mountain: where they are, before anything happens.' },
  { role: 'play', seconds: 2.8, because: 'The thing people come here to do, done badly and happily.' },
  { role: 'play_pair', seconds: 2.6, because: 'Both of them in one frame: the period selfie is the first laugh.' },
  {
    role: 'apres',
    seconds: 2.9,
    because: 'Friends and a fire after the cold: the biggest laugh in the reel, before it goes quiet.',
    optional: true,
  },
  { role: 'eat', seconds: 3.0, because: 'Warmth after cold; the reel gets darker and closer.' },
  {
    role: 'town',
    seconds: 2.8,
    because: 'The lifestyle cue a city visitor notices: a stranger waves, a dog trots along.',
  },
  { role: 'stroll', seconds: 3.4, because: 'Ma. The breathing beat before the turn, no cut inside it.' },
  { role: 'discover', seconds: 2.8, because: 'She sees something off-frame: the gap opens.' },
  {
    role: 'sign',
    seconds: 2.4,
    because: 'The answer, zoomed to like an amateur would: our sign in front of a lamplit house.',
  },
  { role: 'phone', seconds: 2.4, because: 'The violation: a modern phone comes out of a period coat.' },
  { role: 'break', seconds: 3.6, because: 'The present, full frame and sharp: the app, the price, the call button.' },
  { role: 'call', seconds: 2.8, because: 'Back in the reel, resolved: on the phone, thumbs up, a hug.' },
  {
    role: 'stay',
    seconds: 3.4,
    because: 'The last frame: they have decided, and nobody says so. The sign is in it.',
    optional: true,
  },
  { role: 'end', seconds: 3.7, because: 'The reel runs out into the end card: peak-end with the brand present.' },
]

/** The trip half of the visitor arc: everything up to the sign on the lawn. */
const TRIP_ROLES = new Set<ArcRole>([
  'hook',
  'arrive',
  'play',
  'play_pair',
  'apres',
  'eat',
  'town',
  'stroll',
  'discover',
  'sign',
])

export const HOMECOMING_ARC: ArcSlot[] = [
  ...VISITOR_ARC.filter((slot) => TRIP_ROLES.has(slot.role)),
  { role: 'pack', seconds: 2.6, because: 'The trip ends at the curb: the car loaded, the dog jumps in last.' },
  { role: 'leave', seconds: 2.8, because: 'The mountain in the rear window, getting smaller. The dog watches it go.' },
  { role: 'commute', seconds: 2.4, because: 'A week later, the other life: the same car, going nowhere.' },
  { role: 'work_b', seconds: 2.8, because: 'His desk. The snapshot from the trip is the only warm thing in the room.' },
  { role: 'work_a', seconds: 2.8, because: 'Her desk across town. The same snapshot: they had doubles printed.' },
  { role: 'home', seconds: 3.0, because: 'Their kitchen that night: the house from the trip on the table between them.' },
  { role: 'call', seconds: 3.4, because: 'He calls the number from the sign on the kitchen phone. It rings. Fade out.' },
  { role: 'end', seconds: 3.7, because: 'The line lands in the dark: we are here when they are ready.' },
]

/**
 * The Polaroid arc (Matt 2026-09-24, April): the same homecoming, told slower
 * and carried by the photographs they take. The mountain from the top, a
 * stranger's picture of them at the bottom, the house on a walk the next day
 * (the sign is only there, never pushed), the Polaroids over drinks with the
 * house last, the drive home, one of them in traffic and one at a desk with
 * the photograph, and the kitchen table, where the house Polaroid carries the
 * sign and the number: the call is the card. Shots hold 3.2-4.4s so each
 * place settles; `snapshot` is a prop (the photograph she took), never cut in.
 */
export const POLAROID_ARC: ArcSlot[] = [
  { role: 'hook', seconds: 3.2, because: 'A face and a dog inside the first second, on the way up.' },
  { role: 'lift', seconds: 3.2, because: 'Riding up: the mountain before the view.' },
  { role: 'summit', seconds: 4.4, because: 'The top: the Three Sisters and Broken Top. The longest hold in the film.' },
  { role: 'play', seconds: 3.4, because: 'Down on spring snow, one after the other.' },
  { role: 'photo', seconds: 3.6, because: 'A stranger takes their picture: the photograph the rest of the film carries.' },
  { role: 'town', seconds: 3.8, because: 'The next day, the park and the dog: the pace drops.' },
  { role: 'discover', seconds: 4.2, because: 'The house. She takes its picture. Our sign is in the yard and nobody points at it.' },
  { role: 'snapshot', seconds: 0, because: 'The photograph she took: only ever seen inside other frames.' },
  { role: 'eat', seconds: 3.8, because: 'That night, drinks outside the Tower, laughing over the Polaroids.' },
  { role: 'prints', seconds: 4.4, because: 'The Polaroids land on the table one by one; the house comes last.' },
  { role: 'pack', seconds: 3.2, because: 'The next morning, the dog jumps in last.' },
  { role: 'leave', seconds: 3.2, because: 'The mountain in the rear window.' },
  { role: 'commute', seconds: 3.8, because: 'Home: in traffic, the photograph on the dash.' },
  { role: 'work_a', seconds: 3.8, because: 'Her desk, her copy of the photograph by the lamp.' },
  { role: 'home', seconds: 3.8, because: 'The kitchen table: the house between them.' },
  { role: 'number', seconds: 4.0, because: 'The Polaroid up close: the sign, and the number on it. He is already dialing.' },
  { role: 'end', seconds: 4.0, because: 'We are here when you are ready to make the call.' },
]

export const ARCS: Record<ArcId, ArcSlot[]> = { visitor: VISITOR_ARC, homecoming: HOMECOMING_ARC, polaroid: POLAROID_ARC }

export type PlannedStoryShot = {
  index: number
  role: ArcRole
  seconds: number
  because: string
  /**
   * 'generated' goes through Grok; 'plate' reuses an earlier role's selected
   * still (beat.plateFrom); 'prop' is a generated still seen only inside other
   * frames (beat.prop); 'phone_ui' and 'end_card' are built in code.
   */
  kind: 'generated' | 'plate' | 'prop' | 'phone_ui' | 'end_card'
  beat: BeatDef | null
}

export type StoryPlan = {
  eraId: string
  year: number
  season: Season
  shots: PlannedStoryShot[]
  totalSeconds: number
  /** Problems a person must look at before money is spent. */
  warnings: string[]
}

export type PlanStoryInput = {
  era: EraPack
  season: Season
  /** Pin a beat id per role; unpinned roles take the first beat that fits. */
  beats?: Partial<Record<BeatRole, string>>
  /** Roles this piece leaves out entirely (no phone: Matt 2026-09-23). */
  omit?: BeatRole[]
  /** Which arc to fill. Default the visitor arc. */
  arc?: ArcId | ArcSlot[]
}

/**
 * Fill the arc. Throws when a pinned beat cannot honestly appear in the era
 * or season (a 1982 reel asking for the 1988 brewery is a bug, not a warning).
 */
export function planStory(input: PlanStoryInput): StoryPlan {
  // A phone beat whose screen is composited inside the film carries the
  // present on its own; the full-frame break would say it twice.
  const pinnedPhone = input.beats?.phone ? getBeat(input.beats.phone) : null
  const phoneInFilm = pinnedPhone?.composite === 'phone_screen'
  const omit = new Set<string>(input.omit ?? [])
  // No phone at all means no break either: the present never enters the film.
  const noBreak = phoneInFilm || omit.has('phone')
  const slots = typeof input.arc === 'string' ? ARCS[input.arc] : (input.arc ?? VISITOR_ARC)
  const arc = slots.filter((slot) => !omit.has(slot.role) && !(noBreak && slot.role === 'break'))
  const year = input.era.year
  const warnings: string[] = []
  const shots: PlannedStoryShot[] = []

  arc.forEach((slot) => {
    const index = shots.length
    if (slot.role === 'break') {
      shots.push({ index, ...slot, kind: 'phone_ui', beat: null })
      return
    }
    if (slot.role === 'end') {
      shots.push({ index, ...slot, kind: 'end_card', beat: null })
      return
    }
    const pinned = input.beats?.[slot.role]
    let beat: BeatDef | null
    if (pinned) {
      beat = getBeat(pinned)
      if (!beat) throw new Error(`planStory: no beat "${pinned}" for role ${slot.role}`)
      if (beat.role !== slot.role)
        throw new Error(`planStory: beat "${pinned}" is a ${beat.role} beat, not ${slot.role}`)
      if (!beatFits(beat, year, input.season)) {
        throw new Error(
          `planStory: beat "${pinned}" cannot appear in ${input.season} ${year} ` +
            `(valid ${beat.years[0]}-${beat.years[1]}, seasons ${beat.seasons.join('/')})`,
        )
      }
    } else {
      beat = BEATS.find((b) => b.role === slot.role && beatFits(b, year, input.season)) ?? null
      if (!beat && slot.optional) return
      if (!beat) throw new Error(`planStory: no ${slot.role} beat fits ${input.season} ${year}`)
    }
    if (beat.plateFrom) {
      // The plate is a frame we already have; its source must be earlier in this film.
      if (!shots.some((s) => s.role === beat!.plateFrom && s.kind === 'generated')) {
        throw new Error(`planStory: beat "${beat.id}" takes its plate from ${beat.plateFrom}, which is not earlier in the film`)
      }
      shots.push({ index, ...slot, kind: 'plate', beat })
      return
    }
    if (beat.prop) {
      shots.push({ index, ...slot, seconds: 0, kind: 'prop', beat })
      return
    }
    shots.push({ index, ...slot, kind: 'generated', beat })
  })

  // Three identical camera moves in a row reads as a template, even handheld.
  // Props and plates are not generated shots on screen; only generated motion counts.
  const onScreen = shots.filter((s) => s.kind === 'generated')
  for (let i = 2; i < onScreen.length; i += 1) {
    const [a, b, c] = [onScreen[i - 2].beat, onScreen[i - 1].beat, onScreen[i].beat]
    // The city after the trip is locked off on purpose: the register change is the point.
    const lockedOffCity = [a, b, c].every((x) => x?.elsewhere && x.move === 'tripod')
    if (a && b && c && a.move === b.move && b.move === c.move && !lockedOffCity) {
      warnings.push(`three "${c.move}" moves in a row ending at shot ${onScreen[i].index} (${c.id})`)
    }
  }
  // The reference test: a place frame with no real still behind it is prompt-only scenic.
  for (const shot of shots) {
    const beat = shot.beat
    if (!beat || beat.refs.length > 0 || beat.elsewhere) continue
    const interior = beat.exposure === 'interior_low' || beat.id.startsWith('car-wave') // the cabin is the place
    if (!interior) warnings.push(`${beat.id} has no reference still: it fails the reference test until one is added`)
  }

  const totalSeconds = Math.round(shots.reduce((sum, s) => sum + s.seconds, 0) * 10) / 10
  return { eraId: input.era.id, year, season: input.season, shots, totalSeconds, warnings }
}
