/**
 * lib/studio/motion/reveal.ts: how a held card arrives and why it never freezes.
 *
 * Two pure curves of t, used by cues.ts frameState for every card a timeline
 * film holds (the ryan-studio technique `eased_number_reveal`, RULEBOOK 2b):
 *
 *  - The reveal. A hero number scales 0.92 to 1 and fades 0 to 1 over 12
 *    frames on the brand ease-out, cubic-bezier(.22,.61,.36,1). Calm and eased,
 *    never a slam (RULEBOOK 2b, 2026-10-09), and no overshoot: overshoot is kept
 *    for the end card's own landings (motion-design contract 6).
 *  - The hold drift. Once a card has landed it keeps moving: a slow, linear
 *    rise of about 8 px across the whole hold ("words ... keep a slight drift or
 *    scale while holding", RULEBOOK 2). Linear on purpose: a constant velocity
 *    means every frame differs from the one 1.2 s before it, which is what
 *    video:check check 6 (ffmpeg freezedetect) measures. On a cream paper beat
 *    the drift is the only thing moving, so it matters most there.
 *
 * Every number here is a pure function of t: no clock, no state between frames.
 */
import { BRAND_EASE_OUT, cubicBezier, progress } from './ease'

/** The reveal's length, in frames at the film's 30 fps (the recipe's 12 frames). */
export const REVEAL_FRAMES = 12
export const REVEAL_FPS = 30
export const REVEAL_SECONDS = REVEAL_FRAMES / REVEAL_FPS
/** The scale a number starts its reveal from. */
export const REVEAL_SCALE_FROM = 0.92
/** How far a held card rises across its hold, px at 1080 wide. */
export const HOLD_DRIFT_PX = 8

const ease = (p: number) => cubicBezier(BRAND_EASE_OUT[0], BRAND_EASE_OUT[1], BRAND_EASE_OUT[2], BRAND_EASE_OUT[3], p)

const r3 = (n: number) => Math.round(n * 1000) / 1000 + 0
const r5 = (n: number) => Math.round(n * 100000) / 100000 + 0

export type RevealPose = {
  /** 0..1. */
  opacity: number
  /** Scale about the card's own centre. */
  scale: number
}

/**
 * The eased number reveal at t for a card that starts at `start`. Before the
 * start it is invisible at the reveal's first scale; after REVEAL_SECONDS it is
 * fully in at scale 1.
 */
export function revealPose(t: number, start: number): RevealPose {
  if (t < start) return { opacity: 0, scale: REVEAL_SCALE_FROM }
  const p = ease(progress(t, start, REVEAL_SECONDS))
  return { opacity: r3(p), scale: r5(REVEAL_SCALE_FROM + (1 - REVEAL_SCALE_FROM) * p) }
}

/**
 * The hold drift at t, in px (positive is up), for a card that has landed at
 * `landed` and holds until `until`. Zero before landing, HOLD_DRIFT_PX at
 * `until` and after it, linear between.
 */
export function holdDrift(t: number, landed: number, until: number, px: number = HOLD_DRIFT_PX): number {
  if (!(until > landed)) return 0
  return Math.round(px * progress(t, landed, until - landed) * 100) / 100 + 0
}

/**
 * The drift a card has moved between two times: what freezedetect compares.
 * Exported for the tests that hold the drift above the freeze threshold.
 */
export function driftBetween(a: number, b: number, landed: number, until: number, px: number = HOLD_DRIFT_PX): number {
  return Math.abs(holdDrift(b, landed, until, px) - holdDrift(a, landed, until, px))
}
