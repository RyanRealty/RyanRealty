import { describe, expect, it } from 'vitest'
import { ENDCARD, endcardState, endcardTimes } from './endcard'
import { crossing, critical, settleTime, step, stepRate, track, type SpringKey, type TrackCfg } from './spring'

const CASES: Array<[number, number]> = [
  [16, 0.2],
  [16, 0.62],
  [10, 0.9],
  [12, 1],
  [9, 1.5],
  [7, 4],
]

/**
 * The spring as a differential equation, integrated with RK4 from time 0:
 * x'' = -2 zeta omega x' - omega^2 (x - target), starting at rest on keys[0]. The
 * target is piecewise constant, so the integration is split at every key time and
 * each piece steps on its own constant target. The closed form has to agree with
 * this to the digits RK4 can give.
 */
function integrate(keys: readonly SpringKey[], omega: number, zeta: number, until: number, dt = 2e-5): number {
  const ks = [...keys].sort((a, b) => a[0] - b[0])
  const edges = [...new Set([0, ...ks.map((k) => k[0]).filter((t) => t > 0 && t < until), until])].sort((a, b) => a - b)
  let x = ks[0][1]
  let v = 0
  for (let e = 0; e + 1 < edges.length; e++) {
    let c = ks[0][1]
    for (const [kt, kv] of ks) if (kt <= edges[e]) c = kv
    const n = Math.max(1, Math.ceil((edges[e + 1] - edges[e]) / dt))
    const h = (edges[e + 1] - edges[e]) / n
    const f = (px: number, pv: number): [number, number] => [pv, -2 * zeta * omega * pv - omega * omega * (px - c)]
    for (let i = 0; i < n; i++) {
      const [k1x, k1v] = f(x, v)
      const [k2x, k2v] = f(x + (h / 2) * k1x, v + (h / 2) * k1v)
      const [k3x, k3v] = f(x + (h / 2) * k2x, v + (h / 2) * k2v)
      const [k4x, k4v] = f(x + h * k3x, v + h * k3v)
      x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x)
      v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)
    }
  }
  return x
}

describe('step', () => {
  it('is 0 at and before the step, then rises toward 1 for every damping', () => {
    for (const [omega, zeta] of CASES) {
      expect(step(0, omega, zeta)).toBe(0)
      expect(step(-3, omega, zeta)).toBe(0)
      expect(step(0.05, omega, zeta)).toBeGreaterThan(0)
      expect(step(60, omega, zeta)).toBeCloseTo(1, 6)
    }
  })

  it('is the solution of the spring equation: under, critical and over damped', () => {
    for (const [omega, zeta] of CASES) {
      for (const until of [0.1, 0.31, 0.8]) {
        expect(step(until, omega, zeta)).toBeCloseTo(integrate([[0, 0], [0, 1]], omega, zeta, until), 6)
      }
    }
  })

  it('overshoots by exp(-pi zeta / sqrt(1 - zeta^2)) at its first peak, and a critical spring never does', () => {
    const [omega, zeta] = [16, 0.62]
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    expect(step(Math.PI / wd, omega, zeta)).toBeCloseTo(1 + Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)), 12)
    let top = 0
    for (let i = 1; i <= 4000; i++) top = Math.max(top, step(i / 500, 12, 1))
    expect(top).toBeLessThanOrEqual(1)
  })

  it('is continuous through critical damping, so a tuned zeta never jumps a branch', () => {
    for (const tau of [0.01, 0.2, 0.7, 2]) {
      const at = step(tau, 11, 1)
      expect(step(tau, 11, 1 - 1e-6)).toBeCloseTo(at, 5)
      expect(step(tau, 11, 1 + 1e-6)).toBeCloseTo(at, 5)
    }
  })

  it('survives a long wait on an over-damped spring (no cosh overflow)', () => {
    expect(step(400, 16, 3)).toBe(1)
    expect(Number.isNaN(step(400, 16, 3))).toBe(false)
  })

  it('refuses a spring that is not one', () => {
    expect(() => step(1, 0, 0.5)).toThrow(/omega/)
    expect(() => step(1, 10, -0.1)).toThrow(/zeta/)
    expect(() => step(1, Number.NaN, 0.5)).toThrow(/omega/)
  })
})

describe('stepRate', () => {
  it('is the slope of step, in 1/s, for every damping', () => {
    for (const [omega, zeta] of CASES) {
      for (const tau of [0.03, 0.2, 0.55]) {
        const h = 1e-6
        const slope = (step(tau + h, omega, zeta) - step(tau - h, omega, zeta)) / (2 * h)
        expect(stepRate(tau, omega, zeta)).toBeCloseTo(slope, 4)
      }
    }
    expect(stepRate(0, 16, 0.5)).toBe(0)
  })
})

describe('critical', () => {
  it('is zeta 1 and settles to 1% in about 6.64 / omega', () => {
    expect(critical(9)).toEqual({ omega: 9, zeta: 1 })
    for (const omega of [4, 9, 25]) expect(settleTime(critical(omega), 0.01) * omega).toBeCloseTo(6.6384, 3)
  })
})

describe('crossing', () => {
  it('is the first time a step stands at the fraction (the pop at 50%, a landing at 97%)', () => {
    for (const [omega, zeta] of CASES) {
      for (const fraction of [0.5, 0.97]) {
        const tau = crossing({ omega, zeta }, fraction)!
        expect(step(tau, omega, zeta)).toBeCloseTo(fraction, 9)
        // Nothing earlier reaches it.
        for (let i = 0; i < 200; i++) expect(step((tau * i) / 200, omega, zeta)).toBeLessThan(fraction + 1e-12)
      }
    }
  })

  it('contact with the target (fraction 1) is the first crossing of an under-damped spring, before its peak', () => {
    const cfg = { omega: 16, zeta: 0.62 }
    const wd = cfg.omega * Math.sqrt(1 - cfg.zeta * cfg.zeta)
    const contact = crossing(cfg, 1)!
    expect(contact).toBeGreaterThan(0)
    expect(contact).toBeLessThan(Math.PI / wd)
    expect(step(contact, cfg.omega, cfg.zeta)).toBeCloseTo(1, 9)
  })

  it('reaches an overshoot fraction only if its first peak does; critical and over-damped never reach 1', () => {
    const cfg = { omega: 16, zeta: 0.62 }
    const peak = 1 + Math.exp((-Math.PI * 0.62) / Math.sqrt(1 - 0.62 * 0.62))
    expect(crossing(cfg, peak - 0.001)).not.toBeNull()
    expect(crossing(cfg, peak + 0.001)).toBeNull()
    expect(crossing(critical(12), 1)).toBeNull()
    expect(crossing({ omega: 9, zeta: 2 }, 1)).toBeNull()
    expect(crossing(critical(12), 0.97)).not.toBeNull()
    expect(crossing(cfg, 0)).toBe(0)
  })

  it('a 97% landing on a critical spring is where 1 - e^-x (1 + x) = 0.97, x = omega tau = 5.356', () => {
    const x = crossing(critical(10), 0.97)! * 10
    expect(x).toBeCloseTo(5.356, 3)
    expect(1 - Math.exp(-x) * (1 + x)).toBeCloseTo(0.97, 12)
  })
})

describe('settleTime', () => {
  it('is the last time a step is outside eps, and not a moment later', () => {
    for (const [omega, zeta] of CASES) {
      for (const eps of [0.1, 0.01, 0.001]) {
        const settle = settleTime({ omega, zeta }, eps)
        // Within eps from then on (checked out to five times as long).
        for (let i = 0; i <= 5000; i++) {
          const tau = settle + (i / 5000) * settle * 4
          expect(Math.abs(1 - step(tau, omega, zeta))).toBeLessThanOrEqual(eps + 1e-12)
        }
        // And outside eps just before it.
        expect(Math.abs(1 - step(settle - 1e-6, omega, zeta))).toBeGreaterThan(eps - 1e-6)
      }
    }
  })

  it('has no rest when there is no damping, and none to wait for when eps covers the whole move', () => {
    expect(settleTime({ omega: 10, zeta: 0 })).toBe(Number.POSITIVE_INFINITY)
    expect(settleTime({ omega: 10, zeta: 0.5 }, 1)).toBe(0)
    expect(() => settleTime({ omega: 10, zeta: 0.5 }, 0)).toThrow(/eps/)
  })
})

describe('track', () => {
  const cfg = { omega: 14, zeta: 0.55 }
  const keys: SpringKey[] = [
    [0, 100],
    [0.5, 700],
    [1.6, 250],
    [2.1, 520],
    [3.4, 90],
  ]

  it('is the first value before the first retarget, and a lone key is a constant', () => {
    expect(track(-1, keys, cfg)).toBe(100)
    expect(track(0, keys, cfg)).toBe(100)
    expect(track(0.5, keys, cfg)).toBe(100)
    expect(track(9, [[2, 7]], cfg)).toBe(7)
  })

  it('is the sum of the step responses, and settles on the last key', () => {
    const t = 2.7
    const want =
      100 +
      600 * step(t - 0.5, cfg.omega, cfg.zeta) +
      -450 * step(t - 1.6, cfg.omega, cfg.zeta) +
      270 * step(t - 2.1, cfg.omega, cfg.zeta)
    expect(track(t, keys, cfg)).toBeCloseTo(want, 9)
    expect(track(12, keys, cfg)).toBeCloseTo(90, 6)
  })

  it('is what the spring equation does when its target is moved in flight (superposition, proved against RK4)', () => {
    for (const [omega, zeta] of [
      [14, 0.55],
      [12, 1],
      [9, 1.6],
    ] as const) {
      for (const t of [0.7, 1.7, 2.3, 3.0, 3.9]) {
        expect(track(t, keys, { omega, zeta })).toBeCloseTo(integrate(keys, omega, zeta, t), 4)
      }
    }
  })

  it('keeps its velocity through a retarget: no kink in the value at the key (C1 at every key)', () => {
    const slope = (t: number) => (track(t + 1e-6, keys, cfg) - track(t - 1e-6, keys, cfg)) / 2e-6
    for (const [kt] of keys.slice(1)) {
      expect(Math.abs(track(kt + 1e-9, keys, cfg) - track(kt - 1e-9, keys, cfg))).toBeLessThan(1e-4)
      // Slopes either side of the seam agree to well under a pixel per second (a reset velocity would jump by hundreds).
      expect(Math.abs(slope(kt + 2e-6) - slope(kt - 2e-6))).toBeLessThan(1)
    }
  })

  it('sorts keys by time, stably: two keys at one time keep their order', () => {
    expect(track(1, [...keys].reverse(), cfg)).toBe(track(1, keys, cfg))
    // The end card's drop: rest at -120, retargeted to 0 at the same instant.
    const drop: SpringKey[] = [[5, -120], [5, 0]]
    expect(track(4, drop, cfg)).toBe(-120)
    expect(track(5, drop, cfg)).toBe(-120)
    expect(track(5.2, drop, cfg)).toBeCloseTo(-120 + 120 * step(0.2, cfg.omega, cfg.zeta), 12)
  })

  it('refuses nothing to track, a number that is not one, and a bad spring', () => {
    expect(() => track(0, [], cfg)).toThrow(/at least one/)
    expect(() => track(0, [[0, Number.NaN]], cfg)).toThrow(/finite/)
    expect(() => track(Number.NaN, keys, cfg)).toThrow(/finite/)
    expect(() => track(0, keys, { omega: -1, zeta: 1 })).toThrow(/omega/)
  })

  it('is a pure function: the same t gives the same bits, in any order of asking', () => {
    const ts = [0.2, 3.3, 1.1, 0.9, 2.6, 3.3]
    const first = ts.map((t) => track(t, keys, cfg))
    const again = [...ts].reverse().map((t) => track(t, keys, cfg)).reverse()
    expect(again).toEqual(first)
  })

  describe('clamp', () => {
    const under: TrackCfg = { omega: 16, zeta: 0.3, clamp: true }
    const raw: TrackCfg = { omega: 16, zeta: 0.3 }

    it('is a hard landing: the plain spring up to first contact, then exactly the target for good', () => {
      const ks: SpringKey[] = [[1, 0], [1, 100]]
      const contact = crossing(raw, 1)!
      for (let i = 0; i <= 400; i++) {
        const t = 1 + i / 100
        const v = track(t, ks, under)
        expect(v).toBeLessThanOrEqual(100)
        if (t - 1 < contact) expect(v).toBe(track(t, ks, raw))
        else expect(v).toBe(100)
      }
      // The plain spring does overshoot (to about 137), so the clamp is doing the work.
      expect(track(1 + Math.PI / (16 * Math.sqrt(1 - 0.09)), ks, raw)).toBeGreaterThan(110)
      // A move downward is floored at its target and stops on it.
      for (let i = 0; i <= 400; i++) expect(track(i / 100, [[0, 100], [0, 20]], under)).toBeGreaterThanOrEqual(20)
      expect(track(3, [[0, 100], [0, 20]], under)).toBe(20)
    })

    it('leaves a spring that never reaches its target alone (critical and over-damped have nothing to clamp)', () => {
      for (const zeta of [1, 2]) {
        const a: TrackCfg = { omega: 12, zeta }
        for (const t of [0.05, 0.3, 0.9, 2]) expect(track(t, [[0, 0], [0, 100]], { ...a, clamp: true })).toBe(track(t, [[0, 0], [0, 100]], a))
      }
    })

    it('carries momentum into a retarget in flight, and lands on the new target from wherever it is', () => {
      const ks: SpringKey[] = [[0, 0], [0, 100], [0.1, 40]]
      // At 0.1 s the value is still rising (about 78). Retargeted to 40 it keeps its upward velocity for a
      // moment, then comes down and stops dead on 40 the first time it gets there.
      expect(track(0.1, ks, under)).toBeCloseTo(77.8, 0)
      expect(track(0.12, ks, under)).toBeGreaterThan(track(0.1, ks, under))
      for (let i = 0; i <= 400; i++) expect(track(0.1 + i / 100, ks, under)).toBeGreaterThanOrEqual(40)
      expect(track(4, ks, under)).toBe(40)
      // No jump at the seam.
      expect(Math.abs(track(0.1 + 1e-9, ks, under) - track(0.1 - 1e-9, ks, under))).toBeLessThan(1e-4)
    })

    it('a retarget after a landing starts from rest on it: the overshoot the landing cut does not come back', () => {
      // Landed at about 0.12 s, still ringing underneath (13 off) when the next key arrives at 0.4 s.
      const ks: SpringKey[] = [[0, 0], [0, 100], [0.4, 30]]
      expect(Math.abs(track(0.4, ks, raw) - 100)).toBeGreaterThan(10)
      expect(track(0.4 - 1e-9, ks, under)).toBe(100)
      expect(Math.abs(track(0.4 + 1e-9, ks, under) - 100)).toBeLessThan(1e-4)
      expect(track(0.52, ks, under)).toBeCloseTo(100 - 70 * step(0.12, 16, 0.3), 12)
    })

    it('a key that repeats the target it has already landed on does not shake it loose', () => {
      const ks: SpringKey[] = [[0, 0], [0, 100], [0.3, 100]]
      expect(Math.abs(track(0.3, ks, raw) - 100)).toBeGreaterThan(5)
      for (let i = 0; i <= 270; i++) expect(track(0.3 + i / 100, ks, under)).toBe(100)
    })

    it('is a pure function: asking for a late time first, or twice, changes nothing', () => {
      const ks: SpringKey[] = [[0, 0], [0, 100], [0.1, 40], [0.6, 70]]
      const at = (t: number) => track(t, ks, { ...under, snap: 0.01 })
      const late = at(2.2)
      const early = at(0.2)
      expect(at(2.2)).toBe(late)
      expect(at(0.2)).toBe(early)
    })
  })

  describe('snap', () => {
    const cfgSnap: TrackCfg = { omega: 16, zeta: 0.3, snap: 0.01 }

    it('rests exactly on the target once the motion is within 1% of the move, and stays there', () => {
      const ks: SpringKey[] = [[0, 0], [0, 100]]
      const rest = track(10, ks, cfgSnap)
      expect(rest).toBe(100)
      let snappedAt: number | null = null
      for (let i = 0; i <= 3000; i++) {
        const t = i / 1000
        const v = track(t, ks, cfgSnap)
        if (snappedAt === null && v === 100 && t > 0.2) snappedAt = t
        if (snappedAt !== null) expect(v).toBe(100)
      }
      expect(snappedAt).not.toBeNull()
      // Well after first contact: a zero crossing in mid-swing is not rest.
      expect(snappedAt!).toBeGreaterThan(crossing(cfgSnap, 1)! * 3)
    })

    it('never jumps more than the tolerance when it snaps', () => {
      const ks: SpringKey[] = [[0, 0], [0, 100]]
      let worst = 0
      for (let i = 1; i <= 300000; i++) {
        const t = i * 1e-5
        worst = Math.max(worst, Math.abs(track(t, ks, cfgSnap) - track(t - 1e-5, ks, cfgSnap)))
      }
      // The natural motion over 10 microseconds is under 0.01; the snap itself is bounded by 1% of 100.
      expect(worst).toBeLessThan(1.0 + 0.01)
    })

    it('a key that has come to rest starts the next move from rest, with no pop at the retarget', () => {
      const ks: SpringKey[] = [[0, 0], [0.1, 100], [4, 30]]
      expect(track(4 - 1e-9, ks, cfgSnap)).toBe(100)
      expect(track(4 + 1e-9, ks, cfgSnap)).toBeCloseTo(100, 6)
      expect(track(4.5, ks, cfgSnap)).toBeCloseTo(100 - 70 * step(0.5, 16, 0.3), 12)
    })

    it('does not snap a move that has not settled when the next key arrives, so the carried motion survives', () => {
      const ks: SpringKey[] = [[0, 0], [0, 100], [0.15, 40]]
      const plain = track(0.4, ks, { omega: 16, zeta: 0.3 })
      expect(track(0.4, ks, cfgSnap)).toBe(plain)
    })
  })
})

describe('the locked end card still drops its logo on the spring it always did', () => {
  // The private spring() endcard.ts carried before F1, kept here as the reference.
  const legacy = (tau: number, drop: number, omega: number, zeta: number): number => {
    if (tau <= 0) return -drop
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * omega * tau)
    return -drop * decay * (Math.cos(wd * tau) + ((zeta * omega) / wd) * Math.sin(wd * tau))
  }

  it('matches the old closed form to rounding error, and the card draws the same rounded pixel', () => {
    const G = ENDCARD.logo
    const T = endcardTimes()
    let worst = 0
    for (let i = -60; i <= 900; i++) {
      const t = i / 240
      const now = track(t, [[T.start, -G.dropPx], [T.start, 0]], { omega: G.omega, zeta: G.zeta })
      worst = Math.max(worst, Math.abs(now - legacy(t - T.start, G.dropPx, G.omega, G.zeta)))
    }
    expect(worst).toBeLessThan(1e-12)
    // Before the settle time nothing else moves the logo, so the state is the spring rounded to 0.01.
    for (let i = 0; i < 18; i++) {
      const t = i / 30
      const want = Math.round(legacy(t - T.start, G.dropPx, G.omega, G.zeta) * 100) / 100 + 0
      expect(endcardState(t).logo.y).toBe(want)
    }
  })
})
