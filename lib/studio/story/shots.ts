/**
 * lib/studio/story/shots.ts — a beat, an era, and a cast become one shot spec.
 *
 * This is the only place a story beat meets a generator prompt, and it does
 * not write the prompt: it assembles a PeriodShotSpec and hands it to
 * lib/studio/craft.ts, which owns prompt order and wording (CLAUDE.md §4).
 */
import { assertCraftClean, buildPeriodMotionPrompt, buildPeriodStillPrompt, type PeriodShotSpec } from '../craft'
import type { BeatDef } from './beats'
import { castHandle, wardrobeFor, type Cast } from './cast'
import type { EraPack } from './eras'

/** Replace {A}/{B} with cast handles ("the woman", "the man"). */
export function castAction(action: string, cast: Cast): string {
  return action.replace(/\{A\}/g, castHandle(cast.A)).replace(/\{B\}/g, castHandle(cast.B))
}

function materialsFor(beat: BeatDef, cast: Cast): string {
  const worn = beat.cast.map((slot) => {
    const member = cast[slot]
    const outfit = beat.wardrobe ? wardrobeFor(member, beat.wardrobe) : ''
    return `${castHandle(member)}: ${member.look}${outfit ? `, wearing ${outfit}` : ''}`
  })
  return [...worn, beat.props ?? ''].filter(Boolean).join('; ')
}

function periodFor(beat: BeatDef, era: EraPack, cast: Cast): string {
  const p = era.period
  const cues = beat.cast.map((slot) => {
    const member = cast[slot]
    const hair = member.pronoun === 'she' ? p.hair.she : member.pronoun === 'he' ? p.hair.he : ''
    return hair ? `${castHandle(member)}: ${hair}` : ''
  })
  const wanted = beat.periodCues ?? []
  if (wanted.includes('rooms')) cues.push(p.rooms)
  if (wanted.includes('street')) cues.push(p.street)
  // Conditional on purpose: stated as scene content, cars appear in every frame.
  if (wanted.includes('vehicles')) cues.push(`any car in frame is ${p.vehicles}`)
  // The cast's clothes are named per scene; the era wardrobe dresses anyone else.
  if (!beat.cast.length) cues.push(`anyone else in frame wears ${p.wardrobe}`)
  return cues.filter(Boolean).join('; ')
}

export type StoryShotPrompts = {
  spec: PeriodShotSpec
  still: string
  motion: string
}

/**
 * Build the still and motion prompts for one beat.
 * `sources` labels, in order, what each conditioning image is.
 */
export function storyShotPrompts(input: {
  beat: BeatDef
  era: EraPack
  cast: Cast
  sources?: string[]
}): StoryShotPrompts {
  const { beat, era, cast } = input
  const action = castAction(beat.action, cast)
  const spec: PeriodShotSpec = {
    year: era.year,
    framing: beat.framing,
    light: beat.light,
    move: beat.move,
    action,
    materials: materialsFor(beat, cast) || 'no people in frame',
    place: beat.place,
    period: periodFor(beat, era, cast),
    camera: era.camera,
    sources: input.sources,
  }
  const still = buildPeriodStillPrompt(spec)
  const motion = buildPeriodMotionPrompt(spec)
  assertCraftClean(still, `still (${beat.id})`)
  assertCraftClean(motion, `motion (${beat.id})`)
  return { spec, still, motion }
}
