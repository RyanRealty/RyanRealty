import { describe, it, expect } from 'vitest'
import { groupDoors } from './V3Answers'

/**
 * Fixtures use REAL site paths. ci:internal-links reads every hard-coded
 * internal link in the repo, test files included, so `/a` and `/b` are six new
 * broken links rather than six placeholders.
 */
const SEARCH = '/homes-for-sale'
const REPORT = '/housing-market'
const DOCS = '/subdivisions'
const CONTACT = '/contact'

describe('groupDoors', () => {
  it('leaves an ungrouped set as one unlabelled block — the old flat list', () => {
    const doors = [
      { label: 'Homes for sale', href: SEARCH },
      { label: 'Market', href: REPORT },
    ]
    expect(groupDoors(doors)).toEqual([{ label: null, doors }])
  })

  it('orders groups by where each first appears, not alphabetically', () => {
    const out = groupDoors([
      { label: 'Search', href: SEARCH, group: 'Tetherow' },
      { label: 'CC&Rs', href: DOCS, group: 'Recorded documents' },
      { label: 'Report', href: REPORT, group: 'Tetherow' },
      { label: 'Talk to a broker', href: CONTACT },
    ])
    expect(out.map((g) => g.label)).toEqual(['Tetherow', 'Recorded documents', null])
    // A group collects every door that names it, wherever it sits in the array.
    expect(out[0]!.doors.map((d) => d.href)).toEqual([SEARCH, REPORT])
    // The ungrouped remainder sorts last, under no label.
    expect(out[2]!.doors.map((d) => d.href)).toEqual([CONTACT])
  })

  it('treats a blank group as no group', () => {
    const doors = [{ label: 'Homes for sale', href: SEARCH, group: '   ' }]
    expect(groupDoors(doors)).toEqual([{ label: null, doors }])
  })

  it('keeps every door — grouping never drops one', () => {
    // 41 is the count /communities/tetherow actually ships.
    const doors = Array.from({ length: 41 }, (_, i) => ({
      label: `Door ${i}`,
      href: `${SEARCH}?page=${i}`,
      group: i % 4 === 0 ? undefined : `Group ${i % 4}`,
    }))
    const out = groupDoors(doors)
    expect(out.flatMap((g) => g.doors)).toHaveLength(41)
    expect(out.map((g) => g.label)).toEqual(['Group 1', 'Group 2', 'Group 3', null])
  })
})
