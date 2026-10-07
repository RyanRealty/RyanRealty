/**
 * lib/studio/score/types.ts — what a score request looks like and what comes back.
 *
 * The Studio's films are silent. The score is composed in code from the film's
 * own timeline: scene boundaries pick the chords, card entrances and figure
 * landings play single soft notes, a drawing line chart is sonified month by
 * month, the closer lockup gets one bell. The caller describes WHEN things
 * happen; this module decides what they sound like. The personality is the
 * brokerage's (calm, precise, expensive, warm): felt keys, a warm pad, a single
 * bell, air. There is no percussion, no riser, no boom, no drop, on any film.
 */

/** The sample rate of every buffer in this module and of the WAV it writes. */
export const SAMPLE_RATE = 48000

/** 'calm': pad + felt notes on events only (listings). 'measured': adds a soft quarter-note felt pulse on chord tones (market and place films). */
export type ScoreMood = 'calm' | 'measured'

export type ScoreEvent =
  /** A card arrives: one felt note on a chord tone, at t (the entrance start; an ease-out entrance has its velocity peak at its start). */
  | { kind: 'enter'; t: number; weight: number }
  /** A figure lands: a soft tuned mallet tick, pitched on the chord. */
  | { kind: 'land'; t: number; weight: number }
  /** Data sonification: one short felt note whose pitch maps value within [min,max] onto the key's major-pentatonic scale over ~1.5 octaves (higher value = higher pitch; equal values = equal pitch). Used as a line chart draws month by month. */
  | { kind: 'datum'; t: number; value: number; min: number; max: number; weight: number }
  /** A reveal over [start,end]: the pad's low-pass opens and its level rises ~4 dB across the span (e.g. a map outline drawing on). */
  | { kind: 'swell'; start: number; end: number }
  /** The closer lockup at t: the pulse stops 0.2 s before, the pad resolves to the tonic chord and thins, one FM bell (tonic, octave 5) on t plus a low warm tonic dyad; everything tails to silence by the film's end. */
  | { kind: 'lockup'; t: number }

/** Scene boundaries. The chord changes on each section start (one chord per section; voice-led). The first section starts at 0. */
export type ScoreSection = { start: number; end: number }

export type ScoreInput = {
  /** Seconds; output length = Math.round(duration * SAMPLE_RATE) samples exactly. */
  duration: number
  /** E.g. the draft id; picks key and voicing details. */
  seed: string
  mood: ScoreMood
  /** May be empty, which means one section [0, duration]. */
  sections: ScoreSection[]
  events: ScoreEvent[]
  /** Integrated loudness target, default -14. */
  lufs?: number
}

export type ScoreReport = {
  /** E.g. "D major". */
  key: string
  /** One per section, e.g. ["Dmaj9","Bm7","Gmaj7","D"]. */
  chords: string[]
  /** Measured integrated loudness of the final samples (BS.1770-4). */
  lufs: number
  /** Measured true peak, dBTP (4x oversampled). */
  truePeakDb: number
  events: Array<{ kind: ScoreEvent['kind']; t: number; note?: string }>
  /** E.g. an event inside the end fade, an event past duration (dropped), a section overlap. */
  warnings: string[]
}

export type ScoreResult = { wav: Buffer; samples: number; report: ScoreReport }
