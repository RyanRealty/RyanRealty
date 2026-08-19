import { describe, expect, it } from 'vitest'
import { publishListingRemarks } from './publish-listing-remarks'

const EMPIRE_REMARKS =
  'A single-level home with warm Northwest\r\n\r\nConveniently located near shopping and parks.'

describe('publishListingRemarks', () => {
  it('joins a mid-sentence blank-line split from MLS remarks', () => {
    expect(publishListingRemarks(EMPIRE_REMARKS)).toEqual([
      'A single-level home with warm Northwest Conveniently located near shopping and parks.',
    ])
  })

  it('keeps real paragraph breaks after a completed sentence', () => {
    expect(
      publishListingRemarks('The kitchen is new.\n\nThe backyard faces west.'),
    ).toEqual(['The kitchen is new.', 'The backyard faces west.'])
  })

  it('returns an empty list for blank remarks', () => {
    expect(publishListingRemarks(null)).toEqual([])
    expect(publishListingRemarks('   ')).toEqual([])
  })

  it('does not invent words when joining', () => {
    const [paragraph] = publishListingRemarks('warm Northwest\n\nConveniently located.')
    expect(paragraph).toBe('warm Northwest Conveniently located.')
    expect(paragraph).not.toMatch(/style|living|charm/i)
  })
})
