/**
 * aimAtPointer — how far to turn the whole Jax head so its eye looks at the
 * pointer (V3DogFloater, Matt 2026-09-24: "whole dog rotates so that its eyes
 * are following ball, not eyes moving, eyes are fixed").
 *
 * The art (public/brand/jax-head-*.png) is a side profile facing LEFT, so at
 * rest the head looks along 180 degrees. To look at a point it turns about
 * its own center by (pointer angle - 180). The floater sits on the page's
 * trailing edge, so the pointer is nearly always to its left and that turn
 * stays within about a quarter circle either way, upright. When the pointer
 * is clearly to its RIGHT, the head mirrors to face right instead of turning
 * past vertical and hanging upside down.
 *
 * Pure and DOM-free: `center` and `pointer` are in the same space (viewport
 * px in the caller). CSS rotate() turns clockwise for a positive angle
 * because screen y points down, which is also atan2's sense here.
 *
 * `restRadius` (the floater's own circle) is a dead zone: a pointer on the
 * dog himself, a cursor about to click him or a finger tapping him, reads as
 * rest. Near the center a pixel of travel swings the angle a quarter turn,
 * so without it the head spins under the very pointer that opens the menu.
 */

export type HeadAim = { deg: number; mirror: boolean }

export const HEAD_AT_REST: HeadAim = { deg: 0, mirror: false }

/** cos(angle) above this and the pointer counts as "to the right": mirror. */
const MIRROR_COS = 0.2

export function aimAtPointer(
  center: { x: number; y: number },
  pointer: { x: number; y: number } | null,
  restRadius = 0,
): HeadAim {
  if (!pointer) return HEAD_AT_REST
  const dx = pointer.x - center.x
  const dy = pointer.y - center.y
  if ((dx === 0 && dy === 0) || Math.hypot(dx, dy) < restRadius) return HEAD_AT_REST
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  if (Math.cos((angle * Math.PI) / 180) > MIRROR_COS) {
    return { deg: round1(angle), mirror: true }
  }
  // Left-facing: turn by (angle - 180), wrapped into (-180, 180].
  let deg = angle - 180
  while (deg <= -180) deg += 360
  while (deg > 180) deg -= 360
  return { deg: round1(deg), mirror: false }
}

/** The CSS transform for an aim: mirror first, then turn. */
export function headAimTransform(aim: HeadAim): string {
  return aim.mirror ? `rotate(${aim.deg}deg) scaleX(-1)` : `rotate(${aim.deg}deg)`
}

function round1(n: number): number {
  const r = Math.round(n * 10) / 10
  return Object.is(r, -0) ? 0 : r
}
