import { describe, expect, it } from 'vitest'
import { publishPlaceSplitScope } from './publish-place-split-scope'

describe('publishPlaceSplitScope (SITE-116 round 3)', () => {
  it('names the alias set, every property type, and the frame', () => {
    const line = publishPlaceSplitScope({
      placeName: 'Tetherow',
      matchNames: ['Tetherow', 'Triple', 'Tetherow Resort'],
      count: 26,
    })
    expect(line).toBe(
      '26 active listings the MLS files under Tetherow, Triple or Tetherow Resort — every property type, houses to lots — inside this map frame. ' +
        'Move the map and the count follows the frame; the key on the map above counts inside the recorded boundary instead.',
    )
  })

  it('falls back to the place name with no aliases and singularizes one', () => {
    expect(publishPlaceSplitScope({ placeName: 'Broken Top', matchNames: [], count: 1 })).toMatch(
      /^1 active listing the MLS files under Broken Top — /,
    )
  })

  it('says nearest when the search was capped', () => {
    expect(publishPlaceSplitScope({ placeName: 'Bend', matchNames: ['Bend'], count: 500, capped: true })).toMatch(
      /^The nearest 500 active listings/,
    )
  })

  it('prints nothing for zero or a missing count (§0: the list owns its empty state)', () => {
    expect(publishPlaceSplitScope({ placeName: 'X', matchNames: [], count: 0 })).toBeNull()
    expect(publishPlaceSplitScope({ placeName: 'X', matchNames: [], count: Number.NaN })).toBeNull()
  })
})
