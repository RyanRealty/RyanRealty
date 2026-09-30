import { describe, expect, it } from 'vitest'
import { createPassMemo, divToContainer, divToContainerFromRefs } from './overlay-pass'

describe('divToContainerFromRefs', () => {
  it('recovers a pan (pure translation) from two points', () => {
    const t = divToContainerFromRefs({ x: 100, y: 200 }, { x: 140, y: 170 }, { x: 400, y: -50 }, { x: 440, y: -80 })
    expect(t).toEqual({ sx: 1, sy: 1, tx: 40, ty: -30 })
    expect(divToContainer(t, { x: -12, y: 7 })).toEqual({ x: 28, y: -23 })
  })

  it('recovers a mid-zoom scale as well as the offset', () => {
    // container = 2 * div + (10, -4)
    const f = (p: { x: number; y: number }) => ({ x: 2 * p.x + 10, y: 2 * p.y - 4 })
    const a = { x: 30, y: 60 }
    const b = { x: 330, y: -240 }
    const t = divToContainerFromRefs(a, f(a), b, f(b))
    for (const p of [{ x: 0, y: 0 }, { x: 512.5, y: 17.25 }, { x: -90, y: 400 }]) {
      const got = divToContainer(t, p)
      expect(got.x).toBeCloseTo(f(p).x, 9)
      expect(got.y).toBeCloseTo(f(p).y, 9)
    }
  })

  it('falls back to a translation on an axis the references do not span', () => {
    const t = divToContainerFromRefs({ x: 5, y: 5 }, { x: 25, y: 15 }, { x: 5.2, y: 305 }, { x: 25.2, y: 315 })
    expect(t.sx).toBe(1)
    expect(t.tx).toBe(20)
    expect(t.sy).toBeCloseTo(1, 9)
    expect(divToContainer(t, { x: 100, y: 100 })).toEqual({ x: 120, y: 110 })
  })
})

describe('createPassMemo', () => {
  it('computes once per key within a pass and again in the next pass', async () => {
    const memo = createPassMemo<object, number>()
    const key = {}
    let calls = 0
    const compute = () => ++calls
    expect(memo(key, compute)).toBe(1)
    expect(memo(key, compute)).toBe(1)
    expect(memo({}, compute)).toBe(2)
    await Promise.resolve()
    expect(memo(key, compute)).toBe(3)
  })

  it('does not cache a null result', () => {
    const memo = createPassMemo<object, number>()
    const key = {}
    let calls = 0
    expect(memo(key, () => (++calls, null))).toBeNull()
    expect(memo(key, () => ++calls)).toBe(2)
  })
})
