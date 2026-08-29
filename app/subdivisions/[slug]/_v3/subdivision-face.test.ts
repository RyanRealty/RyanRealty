import { describe, expect, it } from 'vitest'
import {
  subdivisionFaceClosedSalesCaption,
  subdivisionFaceFieldCaption,
  subdivisionFaceFieldTrace,
  subdivisionFaceHeadline,
} from './subdivision-face'

describe('subdivision face', () => {
  it('keeps the find-a-home H1 and the live-home caption', () => {
    expect(subdivisionFaceHeadline('Ridge At Eagle Crest')).toBe(
      'Homes for sale in Ridge At Eagle Crest',
    )
    expect(
      subdivisionFaceFieldCaption({ placeName: 'Ridge At Eagle Crest', count: 15 }),
    ).toBe('15 homes for sale in Ridge At Eagle Crest')
    expect(subdivisionFaceClosedSalesCaption('Ridge At Eagle Crest')).toBe(
      'Closed single-family sales, Ridge At Eagle Crest.',
    )
  })

  it('never says plat on the face', () => {
    const trace = subdivisionFaceFieldTrace('Ridge At Eagle Crest', 'Redmond', true)
    expect(trace).toMatch(/subdivision/)
    expect(trace).toMatch(/this same set|Map and list are the same set/)
    expect(trace).not.toMatch(/\bplat\b/i)
    expect(trace).not.toMatch(/leftover/i)
  })
})
