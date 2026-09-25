import { describe, expect, it } from 'vitest'
import { askAgainstRangeSentence, askGapClass, askStoryReading } from '@/lib/cma/ask-story'
import { failedAskBelowRangeNote } from '@/lib/cma/expired-audit'
import { composeFirstContactNumbers, lastAskVersusHeroBand } from '@/lib/cma/first-contact'

const FACTS = {
  valueLow: 734_000,
  valueHigh: 878_000,
  recommendedList: 734_000,
  lastListPrice: 725_000,
  closedSalesCount: 6,
  subdivision: 'Nugget',
  salesScope: 'subdivision' as const,
  city: 'Bend',
}

describe('ask wording from one computed position', () => {
  it('Nugget shape: rec above the failed ask never says price was not what held it back', () => {
    expect(lastAskVersusHeroBand(725_000, 734_000, 878_000)).toBe('below')
    expect(askGapClass(725_000, 734_000, 878_000)).toBe('below')
    const note = failedAskBelowRangeNote(725_000)
    expect(note).not.toMatch(/Price was not what held it back/)
    expect(note).not.toMatch(/under what the sales support/)
    const email = composeFirstContactNumbers('expired', FACTS)
    expect(email).toContain('below what those sales support')
    expect(email).not.toContain('Price was not what held it back.')
    expect(email).toContain('We would recommend listing at $734,000.')
  })

  it('Slate shape: cannot say inside the range and under the sales in the same letter', () => {
    const ask = 610_000
    const low = 594_000
    const high = 623_000
    expect(lastAskVersusHeroBand(ask, low, high)).toBe('inside')
    expect(askAgainstRangeSentence(ask, low, high)).toBe('You were asking inside the range homes like yours sold in.')
    const story = askStoryReading({
      ask,
      rangeLow: low,
      rangeHigh: high,
      days: 90,
      city: 'Bend',
      marketMedianDom: 21,
    })
    expect(story).toContain('inside the range')
    expect(story).not.toContain('under what the sales support')
    expect(failedAskBelowRangeNote(ask)).not.toMatch(/under what the sales support/)
    expect(`${story} ${failedAskBelowRangeNote(ask)}`).not.toMatch(
      /inside the range[\s\S]*under what the sales support|under what the sales support[\s\S]*inside the range/,
    )
  })

  it('Marshmallow shape: ask inside the band and rec below the ask is one story', () => {
    const ask = 1_025_000
    const low = 900_000
    const high = 1_100_000
    const rec = 975_000
    expect(lastAskVersusHeroBand(ask, low, high)).toBe('inside')
    expect(askGapClass(ask, low, high)).toBe('inside')
    const email = composeFirstContactNumbers('expired', {
      valueLow: low,
      valueHigh: high,
      recommendedList: rec,
      lastListPrice: ask,
      closedSalesCount: 5,
      subdivision: 'Lodges at Bachelor Village',
      salesScope: 'subdivision',
      city: 'Bend',
    })
    expect(email).toContain('inside what those sales support')
    expect(email).toContain('We would recommend listing at $975,000.')
    expect(email).not.toContain('sales alone would support')
    expect(email.match(/recommend listing at \$[\d,]+/g)?.length).toBe(1)
  })
})
