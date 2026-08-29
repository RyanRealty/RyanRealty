import { describe, expect, it } from 'vitest'
import {
  subdivisionFaceClosedSalesCaption,
  subdivisionFaceClosedTotalsSentence,
  subdivisionFaceFieldCaption,
  subdivisionFaceFieldTrace,
  subdivisionFaceHeadline,
  subdivisionFaceSchoolAssignment,
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

  it('names active, historical, and closed as three live counts', () => {
    expect(
      subdivisionFaceSchoolAssignment({
        schoolName: 'Tumalo Community School',
        modalCount: 183,
        totalCount: 189,
        sinceYear: 2021,
      }),
    ).toBe(
      'Tumalo Community School, the assignment on 183 of the 189 historical listings here since 2021 that carry one, a historical set, not the homes for sale now and not the closed sales.',
    )
    expect(
      subdivisionFaceClosedTotalsSentence({
        closedCount: 114,
        placeName: 'Ridge At Eagle Crest',
        sinceYear: 2021,
      }),
    ).toBe(
      '114 sold single-family homes have closed in Ridge At Eagle Crest since 2021, not the homes for sale now.',
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
