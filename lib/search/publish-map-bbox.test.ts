import { describe, expect, it } from 'vitest'
import {
  applyMapBboxToParams,
  bboxFromSearchParam,
  decodeMapBbox,
  encodeMapBbox,
  nextSearchUrlWithBbox,
} from './publish-map-bbox'

const bend = {
  west: -121.42,
  south: 43.92,
  east: -121.15,
  north: 44.25,
}

describe('publish-map-bbox', () => {
  it('round-trips west,south,east,north', () => {
    expect(decodeMapBbox(encodeMapBbox(bend))).toEqual({
      west: -121.42,
      south: 43.92,
      east: -121.15,
      north: 44.25,
    })
  })

  it('rejects inverted or out-of-range extents', () => {
    expect(decodeMapBbox('-121,44,-122,43')).toBeNull()
    expect(decodeMapBbox('200,0,201,1')).toBeNull()
    expect(decodeMapBbox('not-a-bbox')).toBeNull()
    expect(decodeMapBbox('')).toBeNull()
  })

  it('reads the first bbox value from a search param', () => {
    expect(bboxFromSearchParam(encodeMapBbox(bend))?.west).toBe(-121.42)
    expect(bboxFromSearchParam([encodeMapBbox(bend), 'ignored'])?.north).toBe(44.25)
    expect(bboxFromSearchParam(undefined)).toBeNull()
  })

  it('does not rewrite an identical bbox param', () => {
    const params = new URLSearchParams()
    expect(applyMapBboxToParams(params, bend)).toBe(true)
    expect(params.get('bbox')).toBe(encodeMapBbox(bend))
    expect(applyMapBboxToParams(params, bend)).toBe(false)
  })

  it('keeps the other search params when writing the camera', () => {
    const next = nextSearchUrlWithBbox('/homes-for-sale', 'view=split', bend)
    expect(next).toContain('view=split')
    expect(next).toContain('bbox=')
    expect(bboxFromSearchParam(new URL(next!, 'https://ryanrealty.test').searchParams.get('bbox'))).toEqual({
      west: -121.42,
      south: 43.92,
      east: -121.15,
      north: 44.25,
    })
    expect(nextSearchUrlWithBbox('/homes-for-sale', `view=map&bbox=${encodeMapBbox(bend)}`, bend)).toBeNull()
  })
})
