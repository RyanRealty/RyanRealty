import { describe, expect, it } from 'vitest'
import { CLOSES_BY_PLACE_ROWS, closesByPlace } from './closes-by-place'

type Dot = { s: string; t: string }
const shapes = [
  { id: 'bend', name: 'Bend', area: 100 },
  { id: 'redmond', name: 'Redmond', area: 40 },
  { id: 'sisters', name: 'Sisters', area: 10 },
  { id: 'broken-top', name: 'Broken Top', area: 2 },
]
const smallestOf = (ids: readonly string[]) =>
  ids.reduce((best, id) => ((shapes.find((s) => s.id === id)?.area ?? Infinity) < (shapes.find((s) => s.id === best)?.area ?? Infinity) ? id : best), ids[0]!)
const isClosing = (s: string) => s === 'sold' || s === 'closed'

describe('closesByPlace', () => {
  it('counts each close once, in the smallest place that holds it, fullest first', () => {
    const dots: Dot[] = [
      { s: 'sold', t: 'house' }, // bend
      { s: 'sold', t: 'house' }, // bend + broken-top → broken-top
      { s: 'sold', t: 'house' }, // redmond
      { s: 'sold', t: 'house' }, // redmond
      { s: 'active', t: 'house' }, // not a close
      { s: 'pending', t: 'house' }, // not a close
      { s: 'sold', t: 'house' }, // outside every outline
    ]
    const membership = [['bend'], ['bend', 'broken-top'], ['redmond'], ['redmond'], ['bend'], ['bend'], []]
    const out = closesByPlace({ dots, membership, shapes, isOn: () => true, isClosing, ownerOf: smallestOf })
    expect(out.rows.map((r) => [r.shape.id, r.n])).toEqual([
      ['redmond', 2],
      ['bend', 1],
      ['broken-top', 1],
    ])
    expect(out.counted).toBe(4)
    expect(out.outside).toBe(1)
    expect(out.placesMore).toBe(0)
  })

  it('ties break by name and the reader filter applies to closes too', () => {
    const dots: Dot[] = [
      { s: 'sold', t: 'house' },
      { s: 'sold', t: 'land' },
      { s: 'sold', t: 'house' },
    ]
    const membership = [['sisters'], ['bend'], ['bend']]
    const out = closesByPlace({ dots, membership, shapes, isOn: (d) => d.t === 'house', isClosing, ownerOf: smallestOf })
    expect(out.rows.map((r) => [r.shape.id, r.n])).toEqual([
      ['bend', 1],
      ['sisters', 1],
    ])
    expect(out.counted).toBe(2)
  })

  it('caps the rows and says how many places the cap left off', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `Place ${String(i).padStart(2, '0')}`, area: 1 }))
    const dots: Dot[] = many.map(() => ({ s: 'closed', t: 'house' }))
    const membership = many.map((p) => [p.id])
    const out = closesByPlace({ dots, membership, shapes: many, isOn: () => true, isClosing, ownerOf: smallestOf })
    expect(out.rows).toHaveLength(CLOSES_BY_PLACE_ROWS)
    expect(out.placesMore).toBe(12 - CLOSES_BY_PLACE_ROWS)
    expect(out.counted).toBe(12)
  })

  it('returns no rows when nothing closed', () => {
    const out = closesByPlace({
      dots: [{ s: 'active', t: 'house' }] as Dot[],
      membership: [['bend']],
      shapes,
      isOn: () => true,
      isClosing,
      ownerOf: smallestOf,
    })
    expect(out.rows).toEqual([])
    expect(out.counted).toBe(0)
    expect(out.outside).toBe(0)
  })
})
