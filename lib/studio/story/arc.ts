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
 * Pure: no I/O, no generator calls. The CLI and the tests both run it.
 */
import { BEATS, beatFits, getBeat, type BeatDef, type BeatRole, type Season } from './beats'
import type { EraPack } from './eras'

export type ArcRole = BeatRole | 'break' | 'end'

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

export type PlannedStoryShot = {
  index: number
  role: ArcRole
  seconds: number
  because: string
  /** 'generated' goes through Grok; 'phone_ui' and 'end_card' are built in code. */
  kind: 'generated' | 'phone_ui' | 'end_card'
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
  arc?: ArcSlot[]
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
  const arc = (input.arc ?? VISITOR_ARC).filter((slot) => !omit.has(slot.role) && !(noBreak && slot.role === 'break'))
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
    shots.push({ index, ...slot, kind: 'generated', beat })
  })

  // Three identical camera moves in a row reads as a template, even handheld.
  for (let i = 2; i < shots.length; i += 1) {
    const [a, b, c] = [shots[i - 2].beat, shots[i - 1].beat, shots[i].beat]
    if (a && b && c && a.move === b.move && b.move === c.move) {
      warnings.push(`three "${c.move}" moves in a row ending at shot ${i} (${c.id})`)
    }
  }
  // The reference test: a place frame with no real still behind it is prompt-only scenic.
  for (const shot of shots) {
    const beat = shot.beat
    if (!beat || beat.refs.length > 0) continue
    const interior = beat.exposure === 'interior_low' || beat.id.startsWith('car-wave') // the cabin is the place
    if (!interior) warnings.push(`${beat.id} has no reference still: it fails the reference test until one is added`)
  }

  const totalSeconds = Math.round(shots.reduce((sum, s) => sum + s.seconds, 0) * 10) / 10
  return { eraId: input.era.id, year, season: input.season, shots, totalSeconds, warnings }
}
