/**
 * lib/studio/motion/spring-showcase.ts — the F1 showcase: one dot, four retargets.
 *
 * A navy dot on cream is told to go somewhere new four times in six seconds, and
 * under it the dot's own y(t) is drawn by the same call (spring.ts track) that
 * places the dot, so the picture proves itself: the dot's height and the trace's
 * head are one number read twice. One retarget (the third, at 2.2 s) arrives
 * 0.3 s after the one before it, while the dot is still travelling, so the
 * reversal carries the dot's momentum instead of restarting it: the trace has no
 * corner there.
 *
 * Silent, no text and no figures (the film draws no number at all), navy and
 * cream only. Everything here is a pure function of t: spring-showcase.test.ts
 * holds that, and scripts/studio-showcase-spring.ts renders it to
 * out/studio/reel/spring/ and measures the stills. Not a registry technique:
 * springs are a foundation (technique-master-list.md section 2, F1).
 */
import { track, type SpringKey } from './spring'

export const SPRING_SHOWCASE = {
  width: 1080,
  height: 1920,
  fps: 30,
  seconds: 6,
  /** A soft landing with a visible overshoot (8.4% of the move) and turns wide enough to read as curves. */
  spring: { omega: 6, zeta: 0.62 },
  colors: { navy: '#102742', cream: '#faf8f4' },
  /** The platform safe band: nothing is drawn above y 220 or below y 1540. */
  safe: { top: 220, bottom: 1540 },
  /** The dot's lane: x fixed, y retargeted. */
  stage: { x: 540, top: 220, bottom: 980, dotR: 36, ringR: 46 },
  /** The trace plot under it: time across, the dot's y down. */
  plot: { left: 90, right: 990, top: 1120, bottom: 1480 },
  /** Where the dot rests at t = 0. */
  rest: 840,
  /** The four retargets: from t, the dot's target is y. The third comes while the second is in flight. */
  retargets: [
    { t: 0.6, y: 320 },
    { t: 1.9, y: 780 },
    { t: 2.2, y: 420 },
    { t: 4.0, y: 640 },
  ],
} as const

const C = SPRING_SHOWCASE
const KEYS: SpringKey[] = [[0, C.rest], ...C.retargets.map((r) => [r.t, r.y] as const)]

/** The dot's y at t: the one function the dot and the trace both call. */
export function springShowcaseY(t: number): number {
  return track(t, KEYS, C.spring)
}

/** The frame a retarget lands on (they all fall on whole frames at 30 fps). */
export function retargetFrames(): number[] {
  return C.retargets.map((r) => Math.round(r.t * C.fps))
}

/** Plot x for a time, and plot y for a stage y: the same affine maps the trace and its head both use. */
export const plotX = (t: number): number => C.plot.left + (t / C.seconds) * (C.plot.right - C.plot.left)
export const plotY = (y: number): number => C.plot.top + ((y - C.stage.top) / (C.stage.bottom - C.stage.top)) * (C.plot.bottom - C.plot.top)

/** The target the dot is chasing at t. */
export function springShowcaseTarget(t: number): number {
  let y: number = C.rest
  for (const r of C.retargets) if (t >= r.t) y = r.y
  return y
}

export type SpringShowcaseState = {
  /** The dot's y on the stage, px. */
  dotY: number
  /** The target ring's y: jumps on the frame of each retarget. */
  targetY: number
  /** The trace's head, in plot px: on the trace at the dot's own value. */
  headX: number
  headY: number
  /** Width of the trace revealed so far. */
  reveal: number
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000 + 0

/** Everything the page draws at film time t. */
export function springShowcaseState(t: number): SpringShowcaseState {
  const y = springShowcaseY(t)
  const headX = plotX(Math.min(Math.max(t, 0), C.seconds))
  return {
    dotY: r3(y),
    targetY: springShowcaseTarget(t),
    headX: r3(headX),
    headY: r3(plotY(y)),
    reveal: r3(headX - C.plot.left),
  }
}

/** The trace as plot-space points, sampled every 1/120 s by the same function that places the dot. */
export function springShowcaseTrace(): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  const n = C.seconds * 120
  for (let i = 0; i <= n; i++) {
    const t = i / 120
    pts.push([r3(plotX(t)), r3(plotY(springShowcaseY(t)))])
  }
  return pts
}

/** The targets as a staircase in plot space: what the spring is chasing, drawn faint beside the response. */
function staircase(): string {
  let d = `M${plotX(0)},${plotY(C.rest)}`
  let last: number = C.rest
  for (const r of C.retargets) {
    d += `L${r3(plotX(r.t))},${r3(plotY(last))}L${r3(plotX(r.t))},${r3(plotY(r.y))}`
    last = r.y
  }
  return `${d}L${plotX(C.seconds)},${r3(plotY(last))}`
}

/** The page: static geometry here, one function (`__rrShow`) that applies a state. Navy and cream only. */
export function springShowcaseHtml(): string {
  const { navy, cream } = C.colors
  const mute = (a: number) => `rgba(16,39,66,${a})`
  const trace = springShowcaseTrace()
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`)
    .join('')
  const ticks = C.retargets
    .map((r) => `<line x1="${r3(plotX(r.t))}" x2="${r3(plotX(r.t))}" y1="${C.plot.top - 40}" y2="${C.plot.bottom + 40}" stroke="${mute(0.2)}" stroke-width="2"/>`)
    .join('')
  const start = springShowcaseState(0)
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>spring showcase</title>
<style>
html,body{margin:0;padding:0;background:${cream};width:${C.width}px;height:${C.height}px;overflow:hidden}
svg{display:block}
</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="${C.width}" height="${C.height}" viewBox="0 0 ${C.width} ${C.height}">
<defs><clipPath id="reveal"><rect id="revealRect" x="${C.plot.left}" y="${C.plot.top - 80}" width="${start.reveal}" height="${C.plot.bottom - C.plot.top + 160}"/></clipPath></defs>
<rect width="${C.width}" height="${C.height}" fill="${cream}"/>
<line x1="${C.stage.x}" x2="${C.stage.x}" y1="${C.stage.top}" y2="${C.stage.bottom}" stroke="${mute(0.12)}" stroke-width="3"/>
<line x1="${C.plot.left}" x2="${C.plot.right}" y1="${C.plot.top}" y2="${C.plot.top}" stroke="${mute(0.12)}" stroke-width="2"/>
<line x1="${C.plot.left}" x2="${C.plot.right}" y1="${C.plot.bottom}" y2="${C.plot.bottom}" stroke="${mute(0.12)}" stroke-width="2"/>
${ticks}
<path d="${staircase()}" fill="none" stroke="${mute(0.38)}" stroke-width="3"/>
<path d="${trace}" fill="none" stroke="${navy}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#reveal)"/>
<circle id="ring" cx="${C.stage.x}" cy="${start.targetY}" r="${C.stage.ringR}" fill="none" stroke="${mute(0.5)}" stroke-width="4"/>
<circle id="dot" cx="${C.stage.x}" cy="${start.dotY}" r="${C.stage.dotR}" fill="${navy}"/>
<circle id="head" cx="${start.headX}" cy="${start.headY}" r="14" fill="${navy}"/>
</svg>
<script>
window.__rrShow = function (s) {
  document.getElementById('dot').setAttribute('cy', s.dotY);
  document.getElementById('ring').setAttribute('cy', s.targetY);
  document.getElementById('head').setAttribute('cx', s.headX);
  document.getElementById('head').setAttribute('cy', s.headY);
  document.getElementById('revealRect').setAttribute('width', s.reveal);
};
</script>
</body></html>`
}
