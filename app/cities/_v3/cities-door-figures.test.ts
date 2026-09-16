import { describe, expect, it } from 'vitest'
import {
  leadTileId,
  luxuryDoorFigure,
  openHouseDoorFigure,
  tileFigure,
} from './cities-door-figures'

describe('door board figures (SITE-92 round 5)', () => {
  it('prints the tile count as the ledger prints it, grouped, with what it counts', () => {
    expect(tileFigure(614)).toEqual({ value: 614, formatted: '614', unit: 'single-family for sale' })
    expect(tileFigure(1493)).toEqual({ value: 1493, formatted: '1,493', unit: 'single-family for sale' })
  })

  it('never invents a figure for an unread count', () => {
    expect(tileFigure(null)).toBeNull()
    expect(tileFigure(undefined)).toBeNull()
    expect(tileFigure(Number.NaN)).toBeNull()
    expect(openHouseDoorFigure(null)).toBeNull()
    expect(luxuryDoorFigure(undefined)).toBeNull()
  })

  it('prints a published zero as a fact about the week, not as an unread count', () => {
    expect(openHouseDoorFigure(0)).toEqual({ value: 0, formatted: '0', unit: 'this week' })
    expect(openHouseDoorFigure(12)).toEqual({ value: 12, formatted: '12', unit: 'this week' })
  })

  it('names the luxury floor the door opens onto', () => {
    expect(luxuryDoorFigure(87)).toEqual({ value: 87, formatted: '87', unit: 'at $1.5M and up' })
  })

  it('leads the board with the largest published figure, ignoring unread tiles', () => {
    expect(
      leadTileId([
        { id: 'redmond', count: 250 },
        { id: 'crooked-river-ranch', count: null },
        { id: 'bend', count: 614 },
        { id: 'sisters', count: 40 },
      ]),
    ).toBe('bend')
    expect(leadTileId([{ id: 'a', count: null }])).toBeNull()
    expect(leadTileId([])).toBeNull()
  })
})
