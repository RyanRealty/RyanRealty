/**
 * lib/studio/shotlist.ts — the sequence, chosen the way a director would.
 *
 * This is the piece that separates our films from a slideshow with motion on
 * it. The top Grok Imagine practitioners do not generate one long take; they
 * build a small number of locked beats and cut them, and the beats are
 * ordered for a reason. Applied to a property, that grammar is:
 *
 *   establish outside -> step into the main room -> the room that sells the
 *   house -> one specific thing you would remember -> back outside
 *
 * The inputs are OUR photographs, which is the half nobody else has. The
 * grammar is the half the best people on the platform already worked out.
 *
 * Two rules do most of the work and both come straight from the craft canon:
 *   - never the same subject twice in a row, or it reads as a slideshow
 *   - never the same camera move twice in a row, or it reads as a template
 */
import type { PhotoGrade, ShotSubject } from '@/lib/grok/classify'
import type { CameraMove } from './craft'

export type GradedPhoto = PhotoGrade & {
  /** High-resolution URL we will animate. */
  url: string
  /** Position in the MLS photo order, used only to break ties. */
  order: number
}

export type PlannedShot = {
  url: string
  subject: ShotSubject
  move: CameraMove
  seconds: number
  /** What the frame shows, for the audit trail and alt text. */
  describes: string
  quality: number
  /** Why this frame is in the film, in plain language. */
  because: string
}

/**
 * The order a property film wants, and what each slot will accept.
 * Earlier entries in each slot's list are preferred.
 */
type SlotRole = 'establish' | 'enter' | 'sell' | 'detail' | 'close'

const SEQUENCE: Array<{ role: SlotRole; accepts: ShotSubject[]; because: string }> = [
  { role: 'establish', accepts: ['exterior_front', 'aerial', 'exterior_rear'], because: 'Establishes the house.' },
  { role: 'enter', accepts: ['living', 'dining', 'kitchen'], because: 'The room you walk into.' },
  { role: 'sell', accepts: ['kitchen', 'primary_bedroom', 'living', 'view'], because: 'The room that sells the house.' },
  { role: 'detail', accepts: ['view', 'bathroom', 'office', 'land', 'outbuilding', 'bedroom'], because: 'The thing you would remember.' },
  { role: 'close', accepts: ['exterior_front', 'aerial', 'view', 'exterior_rear'], because: 'Back outside, to close.' },
]

/**
 * Camera move per role. Varied on purpose: three pushes in a row is the
 * template look, and the eye reads it as one long shot badly cut.
 */
const MOVE_FOR_ROLE: Record<SlotRole, CameraMove> = {
  establish: 'push',
  enter: 'riseUp',
  sell: 'panRight',
  detail: 'push',
  close: 'pull',
}

/** Alternative moves, used when the preferred one would repeat. */
const MOVE_ALTERNATES: Record<CameraMove, CameraMove[]> = {
  push: ['riseUp', 'panLeft', 'locked'],
  pull: ['push', 'panRight', 'locked'],
  locked: ['push', 'panLeft'],
  panLeft: ['panRight', 'push', 'locked'],
  panRight: ['panLeft', 'push', 'locked'],
  riseUp: ['push', 'panRight', 'locked'],
}

export type ShotListOptions = {
  /** How many beats. Three is a post; five is a film. */
  maxShots?: number
  /** A frame under this never makes the cut. */
  minQuality?: number
  /** Seconds per beat. Six, per the craft canon. */
  secondsPerShot?: number
}

/**
 * Choose the beats.
 *
 * Returns fewer shots than asked for rather than padding with a weak frame:
 * a two-beat film made of good frames beats a five-beat film carrying two
 * bad ones, and padding is how a sequence turns back into a slideshow.
 * Returns an empty list when nothing is usable, which the caller must treat
 * as "do not make this film".
 */
export function planShotList(photos: GradedPhoto[], options: ShotListOptions = {}): PlannedShot[] {
  const maxShots = Math.max(1, Math.min(6, options.maxShots ?? 4))
  const minQuality = options.minQuality ?? 70
  const seconds = options.secondsPerShot ?? 6

  const pool = photos
    .filter((p) => p.animatable && !p.hasOverlay && p.quality >= minQuality && p.url.trim().length > 0)
    .sort((a, b) => b.quality - a.quality || a.order - b.order)

  const used = new Set<string>()
  const usedSubjects = new Set<ShotSubject>()
  const shots: PlannedShot[] = []

  for (const slot of SEQUENCE) {
    if (shots.length >= maxShots) break

    const previous = shots[shots.length - 1]
    const available = slot.accepts
      .flatMap((subject) => pool.filter((p) => p.subject === subject))
      .filter((p) => !used.has(p.url) && p.subject !== previous?.subject)

    // Prefer a subject this film has not shown yet. Two front-porch beats in
    // one film is a repeat, not a bookend, and the first real film we cut did
    // exactly that. The closing beat is the one exception: going back outside
    // is the point of it, so it may reuse an exterior when nothing else is
    // left, as long as it is a different photograph.
    const pick =
      available.find((p) => !usedSubjects.has(p.subject)) ??
      (slot.role === 'close' ? available[0] : undefined)

    if (!pick) continue
    used.add(pick.url)
    usedSubjects.add(pick.subject)

    shots.push({
      url: pick.url,
      subject: pick.subject,
      move: chooseMove(
        MOVE_FOR_ROLE[slot.role] ?? 'push',
        previous?.move,
        shots.map((shot) => shot.move),
      ),
      seconds,
      describes: pick.describes,
      quality: pick.quality,
      because: slot.because,
    })
  }

  return shots
}

/**
 * Pick this beat's move.
 *
 * Two rules, in order of strictness:
 *   - never the same move as the beat before it, which reads as one long
 *     shot badly cut
 *   - prefer a move this film has not used at all, because four beats built
 *     from two moves still reads as a template even when no two are adjacent
 *
 * The second is a preference, not a hard rule: running out of moves is not a
 * reason to drop a good frame.
 */
export function chooseMove(
  preferred: CameraMove,
  previous: CameraMove | undefined,
  used: CameraMove[] = [],
): CameraMove {
  const seen = new Set(used)
  const candidates = [preferred, ...(MOVE_ALTERNATES[preferred] ?? [])].filter((m) => m !== previous)
  return candidates.find((m) => !seen.has(m)) ?? candidates[0] ?? preferred
}

/** The film's own alt text: what a viewer would see, in order. */
export function describeSequence(shots: PlannedShot[]): string {
  if (shots.length === 0) return ''
  return shots.map((s) => s.describes.replace(/\.$/, '')).join(', then ') + '.'
}
