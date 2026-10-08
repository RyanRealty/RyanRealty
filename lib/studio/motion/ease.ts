/**
 * lib/studio/motion/ease.ts — time, as pure functions.
 *
 * Every frame the motion stage draws is a function of t and nothing else, so a
 * re-render is byte-for-byte the same film and a still pulled at 2.4s shows
 * exactly what the video shows at 2.4s. No requestAnimationFrame, no CSS
 * transitions, no clocks: Node evaluates these curves for frame t and hands
 * the page finished numbers to apply (render.ts), the way
 * scripts/build_3480_reel_v2.mjs stepped its reel.
 */

/**
 * The brand ease-out, cubic-bezier(0.22, 0.61, 0.36, 1): the public site's
 * --v3-ease-out token (components/site/v3/tokens.css), so motion in a film
 * moves the way motion on the site moves.
 */
export const BRAND_EASE_OUT = [0.22, 0.61, 0.36, 1] as const

/**
 * Evaluate a CSS cubic-bezier at progress x in [0, 1]. Newton steps with a
 * bisection fallback, the same approach browsers take, so the curve here and
 * the one a CSS transition would draw agree to well under a pixel.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  let t = x
  for (let i = 0; i < 8; i++) {
    const err = sampleX(t) - x
    if (Math.abs(err) < 1e-7) return sampleY(t)
    const d = slopeX(t)
    if (Math.abs(d) < 1e-7) break
    t -= err / d
  }
  let lo = 0
  let hi = 1
  t = x
  for (let i = 0; i < 40; i++) {
    const value = sampleX(t)
    if (Math.abs(value - x) < 1e-7) break
    if (value < x) lo = t
    else hi = t
    t = (lo + hi) / 2
  }
  return sampleY(t)
}

/** Linear progress of t through [start, start + duration], clamped to [0, 1]. */
export function progress(t: number, start: number, duration: number): number {
  if (duration <= 0) return t >= start ? 1 : 0
  return Math.min(1, Math.max(0, (t - start) / duration))
}

/**
 * How present a cue is at time t: 0 before it enters, eased up to 1 over
 * `enter` seconds, held, then eased back to 0 over the last `exit` seconds.
 * The closing cue passes exit = 0 and stays to the final frame.
 */
export function presence(
  t: number,
  cue: { start: number; end: number },
  enter: number,
  exit: number,
): number {
  if (t < cue.start || t > cue.end) return 0
  const [x1, y1, x2, y2] = BRAND_EASE_OUT
  const rising = cubicBezier(x1, y1, x2, y2, progress(t, cue.start, enter))
  if (exit <= 0) return rising
  const falling = 1 - cubicBezier(x1, y1, x2, y2, progress(t, cue.end - exit, exit))
  return Math.min(rising, falling)
}
