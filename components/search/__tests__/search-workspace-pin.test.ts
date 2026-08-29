import { describe, expect, it } from 'vitest'
import { SEARCH_CHROME_PX, shouldPinSearchWorkspace } from '@/components/search/search-workspace-pin'

describe('shouldPinSearchWorkspace', () => {
  it('stays in flow while the H1 still holds the workspace below chrome', () => {
    expect(shouldPinSearchWorkspace(120, 800, SEARCH_CHROME_PX)).toBe(false)
  })

  it('pins once the reserved block reaches chrome and still overlaps it', () => {
    expect(shouldPinSearchWorkspace(56, 800, SEARCH_CHROME_PX)).toBe(true)
    expect(shouldPinSearchWorkspace(0, 800, SEARCH_CHROME_PX)).toBe(true)
    expect(shouldPinSearchWorkspace(-100, 800, SEARCH_CHROME_PX)).toBe(true)
  })

  it('releases after the reserved block has scrolled past chrome', () => {
    expect(shouldPinSearchWorkspace(-744, 800, SEARCH_CHROME_PX)).toBe(false)
    expect(shouldPinSearchWorkspace(-800, 800, SEARCH_CHROME_PX)).toBe(false)
  })
})
