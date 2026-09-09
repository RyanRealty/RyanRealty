import { describe, it, expect } from 'vitest'
import { readRecordedPlatLabel } from './getRecordedPlatLabel'

describe('readRecordedPlatLabel', () => {
  it('returns the county plat label at an exact slug', async () => {
    const r = await readRecordedPlatLabel('conifer-acres', async (s) =>
      s === 'conifer-acres' ? { geo_label: 'Conifer Acres' } : null,
    )
    expect(r).toBe('Conifer Acres')
  })

  it('lowercases and trims the key before looking it up', async () => {
    const seen: string[] = []
    await readRecordedPlatLabel('  Conifer-Acres  ', async (s) => {
      seen.push(s)
      return null
    })
    expect(seen).toEqual(['conifer-acres'])
  })

  it('answers null for a miss — never a near match', async () => {
    expect(await readRecordedPlatLabel('oww', async () => null)).toBeNull()
  })

  it('answers null for an empty slug without reading at all', async () => {
    let reads = 0
    const r = await readRecordedPlatLabel('   ', async () => {
      reads += 1
      return null
    })
    expect(r).toBeNull()
    expect(reads).toBe(0)
  })

  it('treats a blank geo_label as absent', async () => {
    expect(await readRecordedPlatLabel('x', async () => ({ geo_label: '   ' }))).toBeNull()
  })
})
