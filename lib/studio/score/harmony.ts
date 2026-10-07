/**
 * lib/studio/score/harmony.ts — which notes, and why those.
 *
 * One key per film, picked from the warm major keys by the seed. One chord per
 * scene, from a short progression table by scene index, ending on the tonic for
 * the scene that holds the closer lockup. The pad's voicing is chosen by search:
 * of every legal arrangement of the chord's tones, the one that moves least from
 * the previous chord's notes, so a scene change is a shift of colour and never
 * a jump. Legal means the way a pad stays warm instead of muddy: root, third or
 * fifth at the bottom, nothing closer than a fourth above a bass note below C4,
 * no hole wider than a ninth in the stack.
 *
 * Everything here is pure arithmetic on pitch classes and MIDI numbers.
 */
import type { ScoreMood } from './types'

export type KeySpec = {
  name: string
  /** Pitch class of the tonic, 0 = C. */
  tonic: number
  /** Spell black keys as flats (E-flat and F major) or sharps (the rest). */
  flats: boolean
}

/** The warm major keys: tonics D, E-flat, E, F, G, A. */
export const KEYS: KeySpec[] = [
  { name: 'D', tonic: 2, flats: false },
  { name: 'Eb', tonic: 3, flats: true },
  { name: 'E', tonic: 4, flats: false },
  { name: 'F', tonic: 5, flats: true },
  { name: 'G', tonic: 7, flats: false },
  { name: 'A', tonic: 9, flats: false },
]

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** "C#" for pitch class 1 in a sharp key, "Db" in a flat one. */
export function pitchClassName(pc: number, flats: boolean): string {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12]
}

/** "F#5" for MIDI 78. Octave numbering where middle C (MIDI 60) is C4. */
export function noteName(midi: number, flats: boolean): string {
  return `${pitchClassName(midi, flats)}${Math.floor(midi / 12) - 1}`
}

/** The first MIDI note at or above `low` with pitch class `pc`. */
export function noteAtOrAbove(pc: number, low: number): number {
  const target = ((pc % 12) + 12) % 12
  const delta = (((target - low) % 12) + 12) % 12
  return low + delta
}

/** Every MIDI note in [low, high] with pitch class `pc`, ascending. */
export function notesInRange(pc: number, low: number, high: number): number[] {
  const out: number[] = []
  for (let m = noteAtOrAbove(pc, low); m <= high; m += 12) out.push(m)
  return out
}

/** Chord qualities as semitones above the root. Indexes 0..2 are root, third, fifth; the rest are colour. */
const QUALITIES = {
  maj9: { suffix: 'maj9', tones: [0, 4, 7, 11, 14] },
  maj7: { suffix: 'maj7', tones: [0, 4, 7, 11] },
  m7: { suffix: 'm7', tones: [0, 3, 7, 10] },
  m9: { suffix: 'm9', tones: [0, 3, 7, 10, 14] },
  six: { suffix: '6', tones: [0, 4, 7, 9] },
  add9: { suffix: 'add9', tones: [0, 4, 7, 14] },
  triad: { suffix: '', tones: [0, 4, 7] },
} as const

type QualityName = keyof typeof QUALITIES

/** Scale degrees as semitones above the tonic. */
const DEGREES = { I: 0, vi: 9, IV: 5, V: 7 } as const
export type Degree = keyof typeof DEGREES

type ChordPick = { degree: Degree; quality: QualityName }

/** Calm films (listings): colour, no tension. Imaj9, vi7, IVmaj7, I6, then round again. */
const CALM_PROGRESSION: ChordPick[] = [
  { degree: 'I', quality: 'maj9' },
  { degree: 'vi', quality: 'm7' },
  { degree: 'IV', quality: 'maj7' },
  { degree: 'I', quality: 'six' },
  { degree: 'vi', quality: 'm9' },
  { degree: 'IV', quality: 'maj7' },
]

/** Measured films (market, place): I, vi, IV, V, I with added ninths. */
const MEASURED_PROGRESSION: ChordPick[] = [
  { degree: 'I', quality: 'add9' },
  { degree: 'vi', quality: 'm7' },
  { degree: 'IV', quality: 'add9' },
  { degree: 'V', quality: 'add9' },
  { degree: 'I', quality: 'maj9' },
]

export type PlannedChord = {
  /** "Dmaj9", "Bm7", "D". */
  name: string
  degree: Degree
  /** Pitch classes, in the quality's tone order: root, third, fifth, then colour. */
  pcs: number[]
  /** MIDI notes of the pad voicing, ascending. */
  voicing: number[]
}

/**
 * The chord for each of `count` scenes. The scene holding the lockup (if any)
 * is the tonic triad: the film ends by resolving, whatever the table says.
 */
export function chooseProgression(
  mood: ScoreMood,
  count: number,
  lockupIndex: number | null,
  key: KeySpec,
): Array<Omit<PlannedChord, 'voicing'>> {
  const table = mood === 'calm' ? CALM_PROGRESSION : MEASURED_PROGRESSION
  const out: Array<Omit<PlannedChord, 'voicing'>> = []
  for (let i = 0; i < count; i++) {
    let pick = table[i % table.length]
    if (i === lockupIndex) {
      // A lone scene keeps the tonic's colour (a bare triad for the whole film is a loop);
      // the lockup's own thinning still strips it at the bell.
      pick = { degree: 'I', quality: count === 1 ? (mood === 'calm' ? 'maj9' : 'add9') : 'triad' }
    }
    const rootPc = (key.tonic + DEGREES[pick.degree]) % 12
    const quality = QUALITIES[pick.quality]
    out.push({
      name: `${pitchClassName(rootPc, key.flats)}${quality.suffix}`,
      degree: pick.degree,
      pcs: quality.tones.map((interval) => (rootPc + interval) % 12),
    })
  }
  return out
}

/** The lowest note a pad voicing may use (C3) and the highest bottom note (B3). */
const BOTTOM_LOW = 48
const BOTTOM_HIGH = 59
const TOP_LIMIT = 79
/** Below this a close interval turns to mud (C4). */
const MUD_LINE = 60
/** The smallest gap above a note under the mud line, in semitones (a perfect fourth). */
const MUD_GAP = 5
const MAX_GAP = 14

/**
 * Voice a chord for the pad: the legal arrangement nearest the previous one.
 * `rootBias` makes a non-root bass costlier (the resolving tonic wants root
 * position). `rand` adds a hair of seeded variety so two films on the same
 * chord do not always pick the same one of two near-equal voicings.
 */
export function voiceChord(
  pcs: number[],
  previous: number[] | null,
  rand: () => number,
  rootBias = 0,
): number[] {
  const best: { notes: number[] | null; cost: number } = { notes: null, cost: Infinity }
  for (let bottomTone = 0; bottomTone < Math.min(3, pcs.length); bottomTone++) {
    const bottom = noteAtOrAbove(pcs[bottomTone], BOTTOM_LOW)
    if (bottom > BOTTOM_HIGH) continue
    const others = pcs.filter((_, i) => i !== bottomTone)
    const placements = others.map((pc) => notesInRange(pc, bottom + MUD_GAP, TOP_LIMIT))
    if (placements.some((p) => p.length === 0)) continue
    const pick: number[] = []
    const visit = (depth: number) => {
      if (depth === placements.length) {
        const notes = [bottom, ...pick].sort((a, b) => a - b)
        if (!legal(notes)) return
        const cost = voicingCost(notes, bottomTone, previous, rootBias) + rand() * 0.3
        if (cost < best.cost) {
          best.cost = cost
          best.notes = notes
        }
        return
      }
      for (const m of placements[depth]) {
        pick[depth] = m
        visit(depth + 1)
      }
    }
    visit(0)
  }
  if (!best.notes) throw new Error(`no legal voicing for pitch classes ${pcs.join(',')}`)
  return best.notes
}

function legal(notes: number[]): boolean {
  for (let i = 0; i + 1 < notes.length; i++) {
    const gap = notes[i + 1] - notes[i]
    if (gap <= 0 || gap > MAX_GAP) return false
    if (notes[i] < MUD_LINE && gap < MUD_GAP) return false
  }
  return true
}

function voicingCost(notes: number[], bottomTone: number, previous: number[] | null, rootBias: number): number {
  // A third in the bass (first inversion) is warm but less settled than the root or the fifth.
  let cost = bottomTone === 0 ? 0 : bottomTone === 1 ? 2.5 : 1
  if (bottomTone !== 0) cost += rootBias
  const top = notes[notes.length - 1]
  cost += Math.max(0, top - 76) * 1.5
  if (!previous) {
    // First chord: settle the bass around G3 and the stack around the middle of the staff.
    return cost + Math.abs(notes[0] - 52) * 0.5 + Math.abs(top - 72) * 0.3
  }
  for (const note of notes) {
    let nearest = Infinity
    for (const p of previous) nearest = Math.min(nearest, Math.abs(note - p))
    cost += nearest
  }
  return cost + 2 * Math.abs(notes[0] - previous[0])
}

/** Major pentatonic steps from the tonic, spanning one and a half octaves (nine notes, 19 semitones). */
export const PENTATONIC_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19] as const

/** The tonic nearest the middle of the staff for datum notes: D4 to A3 across the six keys. */
export function datumBase(key: KeySpec): number {
  return noteAtOrAbove(key.tonic, 57)
}

/**
 * Map a value in [min, max] onto the pentatonic ladder, higher value to higher
 * pitch. Rounding a monotone map stays monotone, so a larger value never lands
 * on a lower note and equal values land on the same one. A collapsed range or a
 * non-finite value sits in the middle of the ladder.
 */
export function datumStep(value: number, min: number, max: number): number {
  const top = PENTATONIC_STEPS.length - 1
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return Math.round(top / 2)
  const u = Math.min(1, Math.max(0, (value - min) / (max - min)))
  return Math.round(u * top)
}
