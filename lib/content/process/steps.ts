/**
 * lib/content/process/steps.ts - the steps every deliverable goes through
 * (docs/plans/CONTENT_PROCESS.md, "The steps").
 *
 * A step is cheaper than the one after it, and a step runs only when the one
 * before it has a stamp that still holds (stamp.ts). The order is the point:
 * the paid voice comes after the brief, generated motion after the board.
 */
import type { DeliverableType, StepId } from './rules'

/** Every step, in the order they run for a video. */
export const ALL_STEPS: readonly StepId[] = Object.freeze(['brief', 'voice', 'stills', 'board', 'animatic', 'motion', 'master', 'certify', 'approve'])

const VIDEO: StepId[] = ['brief', 'voice', 'stills', 'board', 'animatic', 'motion', 'master', 'certify', 'approve']
const STILL: StepId[] = ['brief', 'stills', 'board', 'master', 'certify', 'approve']

/**
 * The steps of each deliverable. A paid ad is its creative's steps (a video's
 * or a still's), then certify and approve: this entry is the video creative,
 * and stepsFor gives the still one.
 */
export const STEPS_BY_TYPE: Record<DeliverableType, StepId[]> = {
  video: VIDEO,
  still: STILL,
  carousel: [...STILL],
  post_copy: ['brief', 'certify', 'approve'],
  paid_ad: [...VIDEO],
}

/** The steps for one deliverable; a paid ad takes the steps of its creative, a video's unless it says 'still'. */
export function stepsFor(deliverable: DeliverableType, creative: 'video' | 'still' = 'video'): StepId[] {
  if (deliverable === 'paid_ad') return creative === 'still' ? [...STILL] : [...VIDEO]
  return [...STEPS_BY_TYPE[deliverable]]
}

export const STEP_LABELS: Record<StepId, string> = {
  brief: 'Brief',
  voice: 'Voice',
  stills: 'Stills',
  board: 'Board',
  animatic: 'Animatic',
  motion: 'Generated motion',
  master: 'Master',
  certify: 'Certify',
  approve: 'Approve',
}

/** The step a person reads first when a step is not built: the build order in CONTENT_PROCESS.md. */
export const NOT_BUILT_YET = 'not built yet: CONTENT_PROCESS.md build order step 3 (the server certifier, the two doors and the token move)'

/** Steps phase 1 does not build at all. The run stops at them and says so. */
export const UNBUILT_STEPS: readonly StepId[] = Object.freeze(['certify', 'approve'])

/** Steps that exist but build nothing yet, and may be passed with --allow-unbuilt-step (the stamp records it). */
export const PASSABLE_UNBUILT_STEPS: readonly StepId[] = Object.freeze(['animatic', 'motion'])

/** The steps that spend a capped attempt each time they run (caps.ts). */
export const CAPPED_STEPS: Readonly<Partial<Record<StepId, 'boards' | 'animatics' | 'masters'>>> = Object.freeze({
  board: 'boards',
  animatic: 'animatics',
  master: 'masters',
})

export function stepIndex(steps: readonly StepId[], id: StepId): number {
  return steps.indexOf(id)
}
