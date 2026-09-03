/**
 * The refusals, not the drawing.
 *
 * Everything measured here is a rule that decides whether a FIGURE prints. The
 * drawing is not gated on a tag — a course with no par tags still draws — so
 * these tests are all about the second half of CLAUDE.md §0: a number that does
 * not reconcile with a named source does not ship. Each case below is one that
 * has actually shipped wrong at least once.
 */
import { describe, expect, it } from 'vitest'
import { courseFacts, courseNines, holeNotes, type CourseMapData, type CourseHole } from './course-map'

const line = (n: number): [number, number][] => [
  [-121.3 + n * 0.001, 44.0],
  [-121.3 + n * 0.001, 44.003],
]

function hole(ref: number, over: Partial<CourseHole> = {}): CourseHole {
  return { ref: String(ref), par: 4, yards: 400, handicap: ref, line: line(ref), ...over }
}

function course(over: Partial<CourseMapData> = {}): CourseMapData {
  return {
    slug: 'test',
    name: 'Test Course',
    published: { par: 72, yards: 7200, holes: 18, designer: 'Someone' },
    parReconciles: true,
    yardsReconcile: true,
    turfAcres: 50,
    holes: Array.from({ length: 18 }, (_, i) => hole(i + 1)),
    shapes: [],
    ...over,
  }
}

describe('stroke index', () => {
  it('prints when the handicaps are a complete permutation of 1..18', () => {
    const notes = holeNotes(course())
    expect(notes.every((n) => n.handicap != null)).toBe(true)
  })

  it('prints on NO hole when one index is duplicated', () => {
    // Eagle Crest Resort shipped index 6 on holes 10 and 11. A stroke index is a
    // ranking of the whole card, so a repeat means the set is wrong, not that
    // one hole is wrong — the whole set is withheld.
    const holes = Array.from({ length: 18 }, (_, i) => hole(i + 1))
    holes[10] = hole(11, { handicap: 6 })
    const notes = holeNotes(course({ holes }))
    expect(notes.some((n) => n.handicap != null)).toBe(false)
  })

  it('prints on NO hole when one hole has no index', () => {
    const holes = Array.from({ length: 18 }, (_, i) => hole(i + 1))
    holes[3] = hole(4, { handicap: null })
    expect(holeNotes(course({ holes })).some((n) => n.handicap != null)).toBe(false)
  })

  it('prints on NO hole when an index falls outside 1..N', () => {
    const holes = Array.from({ length: 18 }, (_, i) => hole(i + 1))
    holes[0] = hole(1, { handicap: 19 })
    expect(holeNotes(course({ holes })).some((n) => n.handicap != null)).toBe(false)
  })
})

describe('par and yardage reconcile against the published card', () => {
  it('withholds per-hole par when the holes do not sum to the published par', () => {
    // Brasada's OSM par tags sum to 73 on a par-72 course.
    const notes = holeNotes(course({ parReconciles: false }))
    expect(notes.every((n) => n.par == null)).toBe(true)
  })

  it('withholds per-hole yardage when the routings do not reconcile', () => {
    // Broken Top's routings measure 6,337 yards against a 7,161-yard card.
    const notes = holeNotes(course({ yardsReconcile: false }))
    expect(notes.every((n) => n.yards == null)).toBe(true)
  })

  it('withholds the shape of the card when par does not reconcile', () => {
    const data = course({ parReconciles: false })
    const facts = courseFacts(data, holeNotes(data))
    expect(facts.find((f) => f.label === 'Shape of the card')).toBeUndefined()
  })
})

describe('the scorecard rail', () => {
  it('gives every published hole a column, mapped or not', () => {
    // Before this, hole 3 sat in column 2 on a course missing hole 2, so every
    // number after the gap named the wrong hole.
    const holes = [hole(1), hole(3), hole(4)]
    const [out] = courseNines(holeNotes(course({ holes })), 18)
    expect(out?.cells.map((c) => c.ref)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(out?.cells[1]?.note).toBeNull()
    expect(out?.cells[2]?.note?.ref).toBe('3')
  })

  it('totals a nine only when every hole in it carries the figure', () => {
    const holes = Array.from({ length: 18 }, (_, i) => hole(i + 1))
    const [out, back] = courseNines(holeNotes(course({ holes })), 18)
    expect(out?.par).toBe(36)
    expect(back?.par).toBe(36)

    const short = courseNines(holeNotes(course({ holes: [hole(1), hole(2)] })), 18)
    expect(short[0]?.par).toBeNull()
    expect(short[0]?.measuredYards).toBeNull()
  })

  it('splits at nine and only emits a back nine when there is one', () => {
    const nine = courseNines(holeNotes(course({ holes: [hole(1)] })), 9)
    expect(nine).toHaveLength(1)
    expect(nine[0]?.label).toBe('Out')
  })
})

describe('course facts', () => {
  it('counts bunkers across the whole course, not one hole', () => {
    const shapes = [
      { k: 'bunker', h: '1', r: line(1) },
      { k: 'bunker', h: '2', r: line(2) },
      { k: 'green', h: '1', r: line(1) },
    ]
    const data = course({ shapes })
    expect(courseFacts(data, holeNotes(data)).find((f) => f.label === 'Bunkers')?.value).toBe('2')
  })

  it('omits the longest hole when yardage did not reconcile', () => {
    const data = course({ yardsReconcile: false })
    const facts = courseFacts(data, holeNotes(data))
    expect(facts.find((f) => f.label === 'Longest hole')).toBeUndefined()
  })
})
