import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAtlasTiles = vi.fn()

vi.mock('@/lib/data', () => ({ getAtlasTiles: (args: unknown) => getAtlasTiles(args) }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

const NOW = Date.parse('2026-09-02T12:00:00Z')

function tile(key: string) {
  return { listingKey: key, lat: 44, lng: -121, status: 'Active' }
}

describe('readAtlasTiles', () => {
  beforeEach(() => {
    vi.resetModules()
    getAtlasTiles.mockReset()
  })

  it('a scope read by many pages at once hits the source once', async () => {
    const { readAtlasTiles } = await import('./build-place-atlas')
    let resolve!: (value: unknown) => void
    getAtlasTiles.mockImplementation(() => new Promise((r) => { resolve = r }))

    const all = Promise.all(Array.from({ length: 60 }, () => readAtlasTiles(['Redmond'], NOW)))
    // Every caller is now awaiting the same read.
    expect(getAtlasTiles).toHaveBeenCalledTimes(1)
    resolve([tile('a'), tile('b')])
    const results = await all

    expect(getAtlasTiles).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(60)
    for (const r of results) {
      expect(r.complete).toBe(true)
      expect(r.tiles).toHaveLength(2)
    }
  })

  it('different scopes do not share a read', async () => {
    const { readAtlasTiles } = await import('./build-place-atlas')
    getAtlasTiles.mockResolvedValue([tile('a')])
    await Promise.all([readAtlasTiles(['Redmond'], NOW), readAtlasTiles(['Bend'], NOW), readAtlasTiles([], NOW)])
    expect(getAtlasTiles).toHaveBeenCalledTimes(3)
  })

  it('the same scope named differently shares one read', async () => {
    const { readAtlasTiles } = await import('./build-place-atlas')
    getAtlasTiles.mockImplementation(() => Promise.resolve([tile('a')]))
    await Promise.all([readAtlasTiles([' redmond '], NOW), readAtlasTiles(['Redmond'], NOW)])
    expect(getAtlasTiles).toHaveBeenCalledTimes(1)
  })

  it('a later read runs again: the entry is dropped when the read settles', async () => {
    const { readAtlasTiles } = await import('./build-place-atlas')
    getAtlasTiles.mockResolvedValue([tile('a')])
    await readAtlasTiles(['Redmond'], NOW)
    await readAtlasTiles(['Redmond'], NOW)
    expect(getAtlasTiles).toHaveBeenCalledTimes(2)
  })

  it('a failed read is reported short, and does not poison the next one', async () => {
    const { readAtlasTiles } = await import('./build-place-atlas')
    getAtlasTiles.mockRejectedValueOnce(new Error('read failed'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const first = await readAtlasTiles(['Redmond'], NOW)
    expect(first.complete).toBe(false)
    expect(first.tiles).toEqual([])

    getAtlasTiles.mockResolvedValue([tile('a')])
    const second = await readAtlasTiles(['Redmond'], NOW)
    expect(second.complete).toBe(true)
    expect(second.tiles).toHaveLength(1)
    spy.mockRestore()
  })

  it('every caller of a failed read is told it is short', async () => {
    const { readAtlasTiles } = await import('./build-place-atlas')
    getAtlasTiles.mockRejectedValue(new Error('read failed'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const results = await Promise.all([readAtlasTiles(['Bend'], NOW), readAtlasTiles(['Bend'], NOW)])
    for (const r of results) expect(r.complete).toBe(false)
    expect(getAtlasTiles).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
