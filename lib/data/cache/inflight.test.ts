import { describe, expect, it } from 'vitest'
import { dedupeInflight, withConcurrency } from '@/lib/data/cache/inflight'

describe('dedupeInflight', () => {
  it('returns the same promise for a key until it settles', async () => {
    let starts = 0
    const run = () =>
      dedupeInflight('k', async () => {
        starts += 1
        return 7
      })
    const [a, b] = await Promise.all([run(), run()])
    expect(a).toBe(7)
    expect(b).toBe(7)
    expect(starts).toBe(1)
    await run()
    expect(starts).toBe(2)
  })
})

describe('withConcurrency', () => {
  it('never runs more than the cap at once', async () => {
    const run = withConcurrency(2)
    let active = 0
    let peak = 0
    await Promise.all(
      Array.from({ length: 6 }, () =>
        run(async () => {
          active += 1
          peak = Math.max(peak, active)
          await Promise.resolve()
          active -= 1
        }),
      ),
    )
    expect(peak).toBe(2)
  })
})
