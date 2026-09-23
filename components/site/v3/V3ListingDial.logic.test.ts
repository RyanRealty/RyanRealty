import { describe, expect, it } from 'vitest'
import {
  DIAL_NO_ASK,
  DIAL_SWIPE_MIN_PX,
  dialKeyTarget,
  dialPanelId,
  dialPosition,
  dialPriceSlot,
  dialRevealOffset,
  dialStep,
  dialSwipeDelta,
  dialTabId,
  dialThumbLabel,
  dialWrap,
} from './V3ListingDial.logic'

describe('dialWrap / dialStep: the dial has no end stop', () => {
  it('folds any index into 0..count-1', () => {
    expect(dialWrap(0, 5)).toBe(0)
    expect(dialWrap(4, 5)).toBe(4)
    expect(dialWrap(5, 5)).toBe(0)
    expect(dialWrap(-1, 5)).toBe(4)
    expect(dialWrap(-6, 5)).toBe(4)
    expect(dialWrap(12, 5)).toBe(2)
  })

  it('has no position without at least one listing', () => {
    expect(dialWrap(3, 0)).toBe(0)
    expect(dialWrap(3, -2)).toBe(0)
    expect(dialWrap(Number.NaN, 4)).toBe(0)
  })

  it('next on the last turns to the first, previous on the first to the last', () => {
    expect(dialStep(11, 1, 12)).toBe(0)
    expect(dialStep(0, -1, 12)).toBe(11)
    expect(dialStep(3, 1, 12)).toBe(4)
  })

  it('a one-listing dial never moves', () => {
    expect(dialStep(0, 1, 1)).toBe(0)
    expect(dialStep(0, -1, 1)).toBe(0)
  })
})

describe('dialKeyTarget', () => {
  it('reads both axes, so the vertical rail and the phone strip answer the same keys', () => {
    expect(dialKeyTarget('ArrowDown', 2, 6)).toBe(3)
    expect(dialKeyTarget('ArrowRight', 2, 6)).toBe(3)
    expect(dialKeyTarget('ArrowUp', 2, 6)).toBe(1)
    expect(dialKeyTarget('ArrowLeft', 2, 6)).toBe(1)
  })

  it('wraps at both ends, as the WAI-ARIA tabs pattern does', () => {
    expect(dialKeyTarget('ArrowDown', 5, 6)).toBe(0)
    expect(dialKeyTarget('ArrowLeft', 0, 6)).toBe(5)
  })

  it('Home and End are absolute', () => {
    expect(dialKeyTarget('Home', 4, 6)).toBe(0)
    expect(dialKeyTarget('End', 1, 6)).toBe(5)
  })

  it('ignores keys that are not the dial’s, and a dial with nothing to turn to', () => {
    expect(dialKeyTarget('Enter', 1, 6)).toBeNull()
    expect(dialKeyTarget('Tab', 1, 6)).toBeNull()
    expect(dialKeyTarget('ArrowDown', 0, 1)).toBeNull()
  })
})

describe('dialPosition: the "03 / 12" readout', () => {
  it('is 1-based and zero-padded like the rails’ readout', () => {
    const pos = dialPosition(2, 12)!
    expect(pos.text).toBe('03 / 12')
    expect(pos.now).toBe('03')
    expect(pos.total).toBe('12')
    expect(pos.shown).toBe(3)
    expect(pos.fraction).toBeCloseTo(3 / 12)
  })

  it('fills the rule completely on the last listing', () => {
    expect(dialPosition(11, 12)!.fraction).toBe(1)
    expect(dialPosition(11, 12)!.text).toBe('12 / 12')
  })

  it('does not pad past two digits', () => {
    expect(dialPosition(99, 120)!.text).toBe('100 / 120')
    expect(dialPosition(0, 120)!.text).toBe('01 / 120')
  })

  it('prints nothing for one listing or none: there is nothing to count through', () => {
    expect(dialPosition(0, 1)).toBeNull()
    expect(dialPosition(0, 0)).toBeNull()
  })

  it('wraps an out-of-range index rather than printing 13 / 12', () => {
    expect(dialPosition(12, 12)!.text).toBe('01 / 12')
  })
})

describe('dialSwipeDelta', () => {
  it('a swipe left is the next home, a swipe right the previous', () => {
    expect(dialSwipeDelta(-120, 8)).toBe(1)
    expect(dialSwipeDelta(120, -8)).toBe(-1)
  })

  it('a tap or a short drag does not turn the dial', () => {
    expect(dialSwipeDelta(0, 0)).toBe(0)
    expect(dialSwipeDelta(-(DIAL_SWIPE_MIN_PX - 1), 0)).toBe(0)
  })

  it('a mostly vertical drag is the page scrolling, not a turn', () => {
    expect(dialSwipeDelta(-60, 70)).toBe(0)
    expect(dialSwipeDelta(-60, 30)).toBe(1)
  })

  it('refuses non-finite input', () => {
    expect(dialSwipeDelta(Number.NaN, 0)).toBe(0)
  })
})

describe('dialThumbLabel: the thumbnail’s accessible name', () => {
  it('is the ask then the street, the order the caption prints them', () => {
    expect(dialThumbLabel('1234 NW Portland Ave', '$649,000')).toBe('$649,000, 1234 NW Portland Ave')
  })

  it('never invents an ask', () => {
    expect(dialThumbLabel('14 Porter Lane', null)).toBe(`${DIAL_NO_ASK}, 14 Porter Lane`)
    expect(DIAL_NO_ASK).toBe('Price not published')
    expect(dialThumbLabel('14 Porter Lane', null)).not.toMatch(/on request/i)
  })
})

describe('ids', () => {
  it('tie each tab to the card it controls', () => {
    expect(dialTabId('homes-sfr', 2)).toBe('homes-sfr-tab-2')
    expect(dialPanelId('homes-sfr', 2)).toBe('homes-sfr-card-2')
  })
})

describe('dialRevealOffset', () => {
  it('leaves the rail where it is when the thumbnail is already whole', () => {
    expect(dialRevealOffset(100, 400, 150, 120)).toBe(100)
  })

  it('centres a thumbnail it has to bring into view', () => {
    expect(dialRevealOffset(0, 400, 900, 120)).toBe(760)
    expect(dialRevealOffset(800, 400, 0, 120)).toBe(0)
  })
})

describe('dialPriceSlot: what the price slot prints', () => {
  it('prints the ask for a sale listing, and the withheld line without one', () => {
    expect(dialPriceSlot({ ask: '$649,000', lease: null })).toEqual({ text: '$649,000', withheld: false })
    expect(dialPriceSlot({ ask: null, lease: null })).toEqual({ text: DIAL_NO_ASK, withheld: true })
  })

  it('prints a lease rate with its unit, never the sale withheld line', () => {
    expect(
      dialPriceSlot({ ask: null, lease: { rate: '$1.40/sq ft/mo', text: '$1.40/sq ft/mo' } }),
    ).toEqual({ text: '$1.40/sq ft/mo', withheld: false })
    expect(
      dialPriceSlot({ ask: null, lease: { rate: null, text: 'Lease rate not published' } }),
    ).toEqual({ text: 'Lease rate not published', withheld: true })
  })
})
