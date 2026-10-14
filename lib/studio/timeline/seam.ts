/**
 * lib/studio/timeline/seam.ts: the loop seam (technique `loop_seam_edit`).
 *
 * Matt's core recipe: the film is loopable, the last frame flows back into
 * frame 0 (RULEBOOK §2a.6). The locked end card already carries the move: over
 * its last 0.3 s an iris closes on the cream field (endcard.ts `loop`). What the
 * iris opens onto is the renderer's job, and three things make it the opening
 * picture exactly:
 *
 *  1. The plate under the end card is the film's own frame 0, held
 *     (lib/video/plate.ts segment 'opening'), decoded the same way frame 0 was.
 *  2. From the moment the iris starts, every other card is drawn as it is at
 *     t = 0 (MotionPlan.loopEcho, cues.ts frameState), so the type layer matches
 *     frame 0 too.
 *  3. The film runs to the first whole frame at or after the card's out, where
 *     the iris radius is 0: the last frame IS the opening picture, and
 *     video:check check 13 (SSIM of the last frame against frame 0, at least
 *     0.85) measures it on the file.
 *
 * Pure: frame arithmetic only.
 */
import { ENDCARD } from '../motion/endcard'

/** The iris's length (END_CARD_SPEC: the last 0.3 s of the card). */
export const LOOP_SECONDS = ENDCARD.loop.seconds

/** The frame index on screen at time t: the first frame at or after t. */
export function frameAtOrAfter(t: number, fps: number): number {
  return Math.ceil(t * fps - 1e-6)
}

/**
 * How many frames the film runs, given its end card's out. With the seam, the
 * last frame sits at or after `out` (the iris is closed); without it, the last
 * frame is the one before `out`.
 */
export function filmFrames(out: number, fps: number, loop: boolean): number {
  const last = frameAtOrAfter(out, fps)
  return loop ? last + 1 : Math.max(1, last)
}

/** Seconds, for the plate's opening segment: from the end card's first frame to the film's last. */
export function openingSeconds(endcardStartFrame: number, frames: number, fps: number): number {
  return (frames - endcardStartFrame) / fps
}

/** The time the echo starts: the iris's first frame. */
export function echoFrom(out: number, loopSeconds: number = LOOP_SECONDS): number {
  return Math.round((out - loopSeconds) * 1e6) / 1e6
}
