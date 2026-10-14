/**
 * lib/studio/motion/spring.ts — closed-form springs, as pure functions of time.
 *
 * Foundation F1 of the motion technique list (.claude/skills/motion-design/
 * references/technique-master-list.md). A value that chases a target with a
 * damped spring is a function of t and nothing else: no integrator, no state
 * carried from the last frame, so a re-render is byte-for-byte the same film
 * and a still pulled at 2.4 s shows what the video shows at 2.4 s
 * (motion-design contract 1). The spring is linear, so a value that retargets
 * while it is still moving is the sum of one step response per retarget: the
 * motion carries its velocity through the seam on its own, which is the thing a
 * bezier segment cannot do.
 *
 * Public API (frozen; build on it, do not widen it without Matt's say):
 *
 *   type SpringCfg  = { omega, zeta }            omega in rad/s, zeta the damping ratio
 *   type TrackCfg   = SpringCfg & { clamp?, snap? }
 *   type SpringKey  = readonly [t, v]            "from time t, the target is v"
 *
 *   step(tau, omega, zeta)       unit step response, 0 at tau <= 0, then toward 1.
 *                                 Under-damped (zeta < 1), critical (zeta = 1, within
 *                                 1e-9) and over-damped (zeta > 1) are all closed form.
 *   stepRate(tau, omega, zeta)   its slope in 1/s (tau <= 0 gives 0).
 *   critical(omega)              { omega, zeta: 1 }: the fastest spring that never
 *                                 overshoots a single step. Settles to 1% in about
 *                                 6.64 / omega seconds.
 *   track(t, keys, cfg)          the value at t. keys[0] is the rest value (its time
 *                                 is only a sort position); every later key retargets:
 *                                 value = v0 + sum over i of (v_i - v_i-1) * step(t - t_i).
 *                                 Keys are sorted by time, stable, so two keys at one
 *                                 time keep their order (the end card's drop is
 *                                 [[start, -120], [start, 0]]). Throws on no keys, a
 *                                 non-finite number, or a bad cfg.
 *   crossing(cfg, fraction)      seconds after a step from rest at which it FIRST
 *                                 reaches `fraction` of the move; null when it never
 *                                 does (a critical or over-damped spring never reaches
 *                                 1; an under-damped one never passes its first peak).
 *                                 crossing(cfg, 0.5) is a pop's frame, crossing(cfg, 1)
 *                                 is the first contact with the target (the clamped
 *                                 landing), crossing(cfg, 0.97) a near-critical landing.
 *                                 sound.ts reads cue times off these, never a typed
 *                                 timestamp.
 *   settleTime(cfg, eps = 0.01)  seconds after which a step stays within eps of its
 *                                 target for good (Infinity when zeta = 0). The hold
 *                                 that follows a landing starts here (RULEBOOK 2b).
 *
 * track options:
 *   clamp: true   a hard landing: the first time the value reaches the key it is chasing it
 *                 stops dead on it and rests there until the next key (a number or a box
 *                 that must not pass what it lands against). Until contact the spring is
 *                 exactly what it was, so the approach is unchanged; after contact the
 *                 value is the target to the bit, and the next retarget starts from rest
 *                 on it, so nothing pops. A spring that never reaches its target (critical,
 *                 over-damped) is untouched. Contact is where crossing(cfg, 1) says.
 *   snap: 0.01    rest exactly on the target once the motion is within this fraction
 *                 of the latest move (distance and speed/omega together, so a zero
 *                 crossing mid-swing is never mistaken for rest). A settled key counts
 *                 as at rest at the next retarget, so nothing pops. Off by default: the
 *                 default is exact physics, which is what the locked end card is held to.
 *
 * Retargeting in flight (a number that is still landing when the next arrives) is
 * the normal case and needs nothing special: add the key.
 */

export type SpringCfg = { omega: number; zeta: number }
export type TrackCfg = SpringCfg & {
  /** A hard landing: stop dead on the target the first time it is reached. */
  clamp?: boolean
  /** Rest on the target within this fraction of the latest move. Omit for exact physics. */
  snap?: number
}
export type SpringKey = readonly [t: number, v: number]

/** Damping ratios this close to 1 take the critical branch (continuous to 1e-9 across it). */
const CRITICAL_BAND = 1e-9

function check(omega: number, zeta: number): void {
  if (!(omega > 0) || !Number.isFinite(omega)) throw new Error(`spring omega must be a positive number of rad/s, got ${omega}`)
  if (!(zeta >= 0) || !Number.isFinite(zeta)) throw new Error(`spring zeta must be zero or more, got ${zeta}`)
}

/**
 * What is left of a unit step tau seconds after it (1 - step). The exponential
 * form for the over-damped case, because cosh and sinh overflow long before the
 * product with the decay would.
 */
function residual(tau: number, omega: number, zeta: number): number {
  if (tau <= 0) return 1
  const a = zeta * omega
  if (Math.abs(zeta - 1) < CRITICAL_BAND) return Math.exp(-omega * tau) * (1 + omega * tau)
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    return Math.exp(-a * tau) * (Math.cos(wd * tau) + (a / wd) * Math.sin(wd * tau))
  }
  const r = omega * Math.sqrt(zeta * zeta - 1)
  return ((a + r) / (2 * r)) * Math.exp(-(a - r) * tau) - ((a - r) / (2 * r)) * Math.exp(-(a + r) * tau)
}

/** The unit step response of a damped spring tau seconds after the step, from rest. */
export function step(tau: number, omega: number, zeta: number): number {
  check(omega, zeta)
  if (!(tau > 0)) return 0
  return 1 - residual(tau, omega, zeta)
}

/** d(step)/d(tau), in 1/s. */
export function stepRate(tau: number, omega: number, zeta: number): number {
  check(omega, zeta)
  if (!(tau > 0)) return 0
  const a = zeta * omega
  if (Math.abs(zeta - 1) < CRITICAL_BAND) return omega * omega * tau * Math.exp(-omega * tau)
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    return ((omega * omega) / wd) * Math.exp(-a * tau) * Math.sin(wd * tau)
  }
  const r = omega * Math.sqrt(zeta * zeta - 1)
  return ((omega * omega) / (2 * r)) * (Math.exp(-(a - r) * tau) - Math.exp(-(a + r) * tau))
}

/** The critically damped spring of natural frequency omega: the fastest one that never overshoots. */
export function critical(omega: number): SpringCfg {
  check(omega, 1)
  return { omega, zeta: 1 }
}

/** The point where `holds` last is true on [lo, hi], given it is true at lo and false at hi and flips once. */
function bisect(holds: (x: number) => boolean, lo: number, hi: number): number {
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (holds(mid)) lo = mid
    else hi = mid
  }
  return hi
}

/**
 * Seconds after a step from rest at which it first reaches `fraction` of the
 * move; null when it never does. Over 1 is an overshoot crossing: 1.02 is
 * "2% past", reached only by an under-damped spring whose first peak gets there.
 */
export function crossing(cfg: SpringCfg, fraction: number): number | null {
  const { omega, zeta } = cfg
  check(omega, zeta)
  if (!Number.isFinite(fraction)) throw new Error(`crossing fraction must be a number, got ${fraction}`)
  if (fraction <= 0) return 0
  let hi: number
  if (zeta < 1 - CRITICAL_BAND) {
    // Rising until its first peak at pi / wd, where it stands 1 + exp(-pi zeta / sqrt(1 - zeta^2)).
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    const peak = 1 + Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta))
    if (fraction > peak) return null
    hi = Math.PI / wd
  } else {
    if (fraction >= 1) return null
    hi = 1 / omega
    for (let i = 0; i < 200 && step(hi, omega, zeta) < fraction; i++) hi *= 2
  }
  return bisect((x) => step(x, omega, zeta) < fraction, 0, hi)
}

/**
 * Seconds after a step from rest after which it stays within `eps` of its
 * target. Exact, not an envelope bound: an under-damped step's extremes sit at
 * k pi / wd with magnitude exp(-zeta omega k pi / wd), so the last excursion
 * past eps is found between two of them.
 */
export function settleTime(cfg: SpringCfg, eps = 0.01): number {
  const { omega, zeta } = cfg
  check(omega, zeta)
  if (!(eps > 0)) throw new Error(`settleTime eps must be above 0, got ${eps}`)
  if (eps >= 1) return 0
  if (zeta === 0) return Number.POSITIVE_INFINITY
  const exceeds = (x: number) => Math.abs(residual(x, omega, zeta)) > eps
  if (zeta < 1 - CRITICAL_BAND) {
    const a = zeta * omega
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    const span = Math.PI / wd
    // The last extreme still past eps (k = 0 is the step itself, at magnitude 1).
    let k = Math.max(0, Math.ceil((Math.log(1 / eps) * wd) / (a * Math.PI)) - 1)
    while (Math.exp(-a * (k + 1) * span) > eps) k++
    while (k > 0 && Math.exp(-a * k * span) <= eps) k--
    return bisect(exceeds, k * span, (k + 1) * span)
  }
  let hi = 1 / omega
  for (let i = 0; i < 200 && exceeds(hi); i++) hi *= 2
  return bisect(exceeds, 0, hi)
}

/** Keys as a fresh array sorted by time (stable), after checking every number. */
function sortedKeys(keys: readonly SpringKey[]): SpringKey[] {
  if (keys.length === 0) throw new Error('track needs at least one key')
  for (const [t, v] of keys) {
    if (!Number.isFinite(t) || !Number.isFinite(v)) throw new Error(`track keys must be finite numbers, got [${t}, ${v}]`)
  }
  return [...keys].sort((a, b) => a[0] - b[0])
}

/**
 * The value at t of a spring chasing a target that is keys[0][1] until the next
 * key, then each later key's value from its own time on. See the file header.
 */
export function track(t: number, keys: readonly SpringKey[], cfg: TrackCfg): number {
  const { omega, zeta } = cfg
  check(omega, zeta)
  if (!Number.isFinite(t)) throw new Error(`track needs a finite t, got ${t}`)
  const ks = sortedKeys(keys)
  const n = ks.length
  if (n === 1) return ks[0][1]
  const snap = cfg.snap != null && cfg.snap > 0 ? cfg.snap : 0

  // The key whose target is live at t: the last one at or before it.
  let active = 0
  while (active + 1 < n && ks[active + 1][0] <= t) active++

  /** Value and rate at `at` of the chain started at rest on key `base`'s target. */
  const chain = (at: number, base: number): { value: number; rate: number } => {
    let value = ks[base][1]
    let rate = 0
    for (let i = base + 1; i < n; i++) {
      const tau = at - ks[i][0]
      if (tau <= 0) break
      const move = ks[i][1] - ks[i - 1][1]
      value += move * step(tau, omega, zeta)
      rate += move * stepRate(tau, omega, zeta)
    }
    return { value, rate }
  }

  // Snap tolerance per key: the fraction of that key's own move, or the last
  // real move when a key repeats its target.
  const tol: number[] = [0]
  for (let i = 1; i < n; i++) {
    const move = Math.abs(ks[i][1] - ks[i - 1][1])
    tol.push(move > 0 ? snap * move : tol[i - 1])
  }
  /** At rest on key s's target at `at`: within tolerance in distance and speed/omega together. */
  const atRest = (at: number, base: number, s: number): boolean => {
    if (!(tol[s] > 0)) return false
    const { value, rate } = chain(at, base)
    return Math.hypot(value - ks[s][1], rate / omega) <= tol[s]
  }

  // A key whose motion had stopped (rested within the snap tolerance, or landed on a clamp) before the
  // next key arrived starts that next move from rest, so the output never jumps at a retarget.
  const scan = Math.PI / (8 * omega)
  /**
   * The value has reached key s's target by `until`: it started the segment on one side of it and is now
   * on it or past it. Sampled 16 times an undamped period (a swing past the target lasts at least 8
   * samples), and at `until` itself, so it never un-lands.
   */
  const landed = (s: number, base: number, until: number): boolean => {
    const t0 = ks[s][0]
    const target = ks[s][1]
    const from = chain(t0, base).value
    if (from === target) return true
    const side = Math.sign(target - from)
    // A spring that has not touched its target in 4000 samples (an hour of film at 16 rad/s) is settled onto it.
    const last = Math.min(until, t0 + 4000 * scan)
    for (let at = t0 + scan; at < last; at += scan) if (side * (chain(at, base).value - target) >= 0) return true
    return side * (chain(until, base).value - target) >= 0
  }
  let base = 0
  if (snap || cfg.clamp) {
    for (let s = 1; s < active; s++) {
      const end = ks[s + 1][0]
      if ((snap && atRest(end, base, s)) || (cfg.clamp && landed(s, base, end))) base = s
    }
  }

  const target = ks[active][1]
  if (active === 0) return target
  if (snap && atRest(t, base, active)) return target
  if (cfg.clamp && landed(active, base, t)) return target
  return chain(t, base).value
}
