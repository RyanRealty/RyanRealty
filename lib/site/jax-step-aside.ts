/**
 * Jax steps aside from a listing photograph (2026-10-01).
 *
 * The site's Jax button (V3DogFloater) is fixed at the right edge, halfway down
 * the screen. On a phone the listing dial's photograph runs the width of the
 * screen, so as the page scrolls the disc came to rest over the photograph's
 * corner (seen at 375 on /commercial-space-for-lease). The dial already keeps
 * its own controls out of his lane (dialEndClearance); a photograph cannot
 * give up its width at 375, so Jax moves instead: while his disc would cover a
 * marked photograph (`data-jax-clear`), he stands just past its nearer edge,
 * above or below, by the shortest move that keeps him on screen and off every
 * other marked photograph. When no such place exists he stays where he is.
 *
 * Pure: rectangles in, a vertical offset (px, down positive) out.
 */

export type JaxRect = { top: number; bottom: number; left: number; right: number }

/** Clear air between the disc and the photograph's edge. */
export const JAX_STEP_GAP_PX = 8
/** Jax never stands closer than this to the screen's top or bottom. */
export const JAX_SCREEN_MARGIN_PX = 72

function overlaps(a: JaxRect, b: JaxRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function shifted(rect: JaxRect, dy: number): JaxRect {
  return { ...rect, top: rect.top + dy, bottom: rect.bottom + dy }
}

/**
 * The vertical offset that takes the disc (at its own resting place, `disc`)
 * off every photograph in `photos`, or 0 when it covers none or has nowhere
 * to go.
 */
export function jaxStepAside(
  disc: JaxRect,
  photos: readonly JaxRect[],
  viewportHeight: number,
  gap: number = JAX_STEP_GAP_PX,
  margin: number = JAX_SCREEN_MARGIN_PX,
): number {
  const lane = photos.filter((p) => p.right > disc.left && p.left < disc.right && p.bottom > p.top)
  if (!lane.some((p) => overlaps(disc, p))) return 0
  const candidates = lane.flatMap((p) => [p.bottom + gap - disc.top, p.top - gap - disc.bottom])
  const fits = candidates
    .filter((dy) => {
      const at = shifted(disc, dy)
      if (at.top < margin || at.bottom > viewportHeight - margin) return false
      return !lane.some((p) => overlaps(at, p))
    })
    .sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)
  return fits.length > 0 ? Math.round(fits[0]!) : 0
}
