import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))

import { withCycleLock } from './file-comms-write'

const tick = () => new Promise((r) => setTimeout(r, 5))

describe('withCycleLock', () => {
  it('runs filings on one cycle one at a time, in order', async () => {
    const log: string[] = []
    const job = (name: string) => async () => {
      log.push(`${name} start`)
      await tick()
      log.push(`${name} end`)
      return name
    }
    const out = await Promise.all([withCycleLock('c1', job('a')), withCycleLock('c1', job('b')), withCycleLock('c1', job('c'))])
    expect(out).toEqual(['a', 'b', 'c'])
    expect(log).toEqual(['a start', 'a end', 'b start', 'b end', 'c start', 'c end'])
  })

  it('lets different cycles file at the same time', async () => {
    const log: string[] = []
    const job = (name: string) => async () => {
      log.push(`${name} start`)
      await tick()
      log.push(`${name} end`)
    }
    await Promise.all([withCycleLock('c1', job('a')), withCycleLock('c2', job('b'))])
    expect(log.slice(0, 2).sort()).toEqual(['a start', 'b start'])
  })

  it('a failed filing does not block the next one', async () => {
    const failing = withCycleLock('c3', async () => {
      throw new Error('boom')
    })
    const next = withCycleLock('c3', async () => 'ok')
    await expect(failing).rejects.toThrow('boom')
    await expect(next).resolves.toBe('ok')
  })
})
