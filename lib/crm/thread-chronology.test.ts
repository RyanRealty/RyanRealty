import { describe, expect, it } from 'vitest'
import { oldestFirst } from './thread-chronology'

describe('oldestFirst', () => {
  it('reverses a newest-first window to oldest → newest', () => {
    expect(oldestFirst([{ id: 3 }, { id: 2 }, { id: 1 }]).map((x) => x.id)).toEqual([1, 2, 3])
  })

  it('does not mutate the input', () => {
    const src = [3, 2, 1]
    expect(oldestFirst(src)).toEqual([1, 2, 3])
    expect(src).toEqual([3, 2, 1])
  })

  it('handles empty and singleton', () => {
    expect(oldestFirst([])).toEqual([])
    expect(oldestFirst(['only'])).toEqual(['only'])
  })
})
