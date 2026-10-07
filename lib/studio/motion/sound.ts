/**
 * lib/studio/motion/sound.ts — the score's cue sheet, read off the plan.
 *
 * One timeline for picture and sound. Every sound event is a moment the
 * picture already has: a card's entrance, the meter's marker landing, the
 * trend line passing a month, the map's outline closing, the closer's mark.
 * Nothing here types a timestamp; each time comes from the same plan and the
 * same curves frameState draws with, so a note lands on the frame its cause
 * does (the prompt-motion research: hand-typed sync points land 8-11 frames
 * off; computed ones land on the frame).
 *
 * Coverage is all or nothing: every card entrance gets its note and every
 * plotted month gets its own, never some of them.
 */
import type { ScoreEvent, ScoreInput, ScoreSection } from '../score'
import { CUE_PARTS, ENTER_SECONDS, type MotionPlan, type MotionSpec, type MotionSubject } from './cues'
import { CHART_DRAW_SECONDS, monthTimes } from './chart'

/** The meter's marker lands this long after its card starts (frameState). */
const METER_LANDS = ENTER_SECONDS + 0.6

/** When a cue's content (not its picture) arrives: its last staggered entrance with text. */
function contentStart(cue: MotionPlan['cues'][number]): number {
  const head = CUE_PARTS[cue.kind].find((p) => p.part === 'head')
  return cue.start + (head?.delay ?? 0)
}

/** The score for a plan, or null when the format is silent. */
export function scoreFor(plan: MotionPlan, spec: MotionSpec, subject: MotionSubject, seed: string): ScoreInput | null {
  if (!spec.sound || plan.cues.length === 0) return null
  const events: ScoreEvent[] = []
  const sections: ScoreSection[] = []

  for (const cue of plan.cues) {
    // A new chord on every card: the music turns the page with the picture.
    sections.push({ start: sections.length === 0 ? 0 : cue.start, end: cue.end })
    switch (cue.kind) {
      case 'closer':
        // The mark is the most resolved moment, not the loudest.
        events.push({ kind: 'lockup', t: cue.start + (CUE_PARTS.closer.find((p) => p.part === 'mark')?.delay ?? 0) })
        break
      case 'meter':
        events.push({ kind: 'enter', t: cue.start, weight: 1 })
        events.push({ kind: 'land', t: cue.start + METER_LANDS, weight: 0.7 })
        break
      case 'chart': {
        events.push({ kind: 'enter', t: contentStart(cue), weight: 1 })
        // One note per plotted month, pitched by its own verified value, on
        // the frame the dot passes it. The sound of the line is the data.
        const values = subject.series?.points.map((p) => p.value) ?? []
        const plotted = values.filter((v): v is number => v != null && Number.isFinite(v))
        const min = Math.min(...plotted)
        const max = Math.max(...plotted)
        for (const { index, t } of monthTimes(cue, cue.drawStart)) {
          const value = values[index]
          if (value == null || !Number.isFinite(value)) continue
          events.push({ kind: 'datum', t, value, min, max, weight: 0.55 })
        }
        events.push({ kind: 'land', t: cue.drawStart + CHART_DRAW_SECONDS, weight: 1.2 })
        break
      }
      case 'map':
        events.push({ kind: 'enter', t: contentStart(cue), weight: 1 })
        events.push({ kind: 'swell', start: cue.drawStart, end: cue.drawStart + cue.drawSeconds })
        events.push({ kind: 'land', t: cue.drawStart + cue.drawSeconds, weight: 1 })
        break
      default:
        events.push({ kind: 'enter', t: cue.start, weight: 1 })
    }
  }
  // Sections tile the film: each runs to the next one's start.
  for (let i = 0; i < sections.length; i++) {
    sections[i] = { start: sections[i].start, end: sections[i + 1]?.start ?? plan.duration }
  }
  // Times to the millisecond, well under a frame, so the sheet reads cleanly
  // on the draft row and float noise never moves a note.
  const ms = (n: number) => Math.round(n * 1000) / 1000
  const timed = events.map((e) => (e.kind === 'swell' ? { ...e, start: ms(e.start), end: ms(e.end) } : { ...e, t: ms(e.t) }))
  return { duration: plan.duration, seed, mood: spec.sound, sections, events: timed }
}
