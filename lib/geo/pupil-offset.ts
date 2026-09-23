/**
 * pupilOffset — how far a drawn pupil drifts toward the pointer, clamped to
 * a small radius so it never leaves the iris (V3DogFloater, Matt 2026-09-23:
 * "have the dog's eyes rotate to follow it").
 *
 * Pure and DOM-free: the caller supplies the eye's own center and the
 * pointer's position in the SAME coordinate space (viewport px is what
 * V3DogFloater uses), and this returns the pixel offset to translate the
 * pupil by. atan2 gives the direction; the distance is capped at
 * `maxRadius` so a far-off pointer does not walk the pupil out of the eye.
 */

export type PupilOffset = { dx: number; dy: number }

const CENTERED: PupilOffset = { dx: 0, dy: 0 }

/**
 * `pointer` is null when there is no reading yet (before the first
 * pointermove, or `prefers-reduced-motion: reduce` where the caller never
 * starts tracking) — the pupil stays centered, which is the rest position
 * the art was drawn at.
 */
export function pupilOffset(
  eye: { x: number; y: number },
  pointer: { x: number; y: number } | null,
  maxRadius: number,
): PupilOffset {
  if (!pointer || !(maxRadius > 0)) return CENTERED
  const dx = pointer.x - eye.x
  const dy = pointer.y - eye.y
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return CENTERED
  const angle = Math.atan2(dy, dx)
  // Proportional up to the cap: a pointer resting near the eye moves the
  // pupil only that far, a pointer anywhere farther pins it at the edge of
  // its small range facing that direction.
  const r = Math.min(dist, maxRadius)
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r }
}
