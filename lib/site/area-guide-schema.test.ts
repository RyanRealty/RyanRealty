import { describe, expect, it } from 'vitest'
import { areaGuideLookupSlugs, areaGuideVideoSchema, isoDuration } from './area-guide-schema'
import { buildJsonLd } from './json-ld'

describe('areaGuideLookupSlugs', () => {
  it('keeps the plat slug first and adds the named parent for recording suffixes', () => {
    expect(areaGuideLookupSlugs('coyote-springs-phase-one')).toEqual(['coyote-springs-phase-one', 'coyote-springs'])
    expect(areaGuideLookupSlugs('discovery-west-phase-2a-and-2b')).toEqual(['discovery-west-phase-2a-and-2b', 'discovery-west'])
    expect(areaGuideLookupSlugs('crooked-river-ranch-no-4')).toEqual(['crooked-river-ranch-no-4', 'crooked-river-ranch'])
    expect(areaGuideLookupSlugs('bachelor-sunrise-plld20210914')).toEqual(['bachelor-sunrise-plld20210914', 'bachelor-sunrise'])
    expect(areaGuideLookupSlugs('fairhaven-phase-i')).toEqual(['fairhaven-phase-i', 'fairhaven'])
  })

  it('never climbs past a real name word', () => {
    // A homesites phase is Awbrey Butte Homesites, not Awbrey Butte.
    expect(areaGuideLookupSlugs('awbrey-butte-homesites-phase-eight')).toEqual([
      'awbrey-butte-homesites-phase-eight',
      'awbrey-butte-homesites',
    ])
    expect(areaGuideLookupSlugs('tetherow')).toEqual(['tetherow'])
    expect(areaGuideLookupSlugs('')).toEqual([])
  })
})

describe('isoDuration', () => {
  it('formats seconds as ISO 8601', () => {
    expect(isoDuration(27)).toBe('PT27S')
    expect(isoDuration(83)).toBe('PT1M23S')
    expect(isoDuration(120)).toBe('PT2M')
    expect(isoDuration(0)).toBeUndefined()
    expect(isoDuration(null)).toBeUndefined()
  })
})

describe('areaGuideVideoSchema', () => {
  const yt = {
    id: 'abcDEF12345',
    url: 'https://www.youtube.com/watch?v=abcDEF12345',
    title: 'Tetherow: Bend’s Premier Golf and Luxury Haven!',
    thumbnailUrl: 'https://i.ytimg.com/vi/abcDEF12345/maxresdefault.jpg',
    publishedAt: '2025-05-29',
    durationSeconds: 15,
  }

  it('returns null without a guide', () => {
    expect(areaGuideVideoSchema('Tetherow', '/communities/tetherow', null)).toBeNull()
    expect(areaGuideVideoSchema('Tetherow', '/communities/tetherow', { url: '  ' })).toBeNull()
  })

  it('carries the file as contentUrl and the channel upload as embedUrl', () => {
    const input = areaGuideVideoSchema('Tetherow', '/communities/tetherow', {
      url: 'https://x.supabase.co/storage/v1/object/public/asset-library/videos/tetherow.mp4',
      youtube: yt,
    })
    expect(input).not.toBeNull()
    const ld = buildJsonLd(input!)
    expect(ld['@type']).toBe('VideoObject')
    expect(ld.name).toBe(yt.title)
    expect(ld.embedUrl).toBe('https://www.youtube.com/embed/abcDEF12345')
    expect(ld.contentUrl).toContain('tetherow.mp4')
    expect(ld.thumbnailUrl).toBe(yt.thumbnailUrl)
    expect(ld.uploadDate).toBe('2025-05-29')
    expect(ld.duration).toBe('PT15S')
    expect(String(ld.url)).toMatch(/\/communities\/tetherow$/)
  })

  it('is the file alone when the cut is not on the channel', () => {
    const ld = buildJsonLd(
      areaGuideVideoSchema('River Meadows', '/subdivisions/river-meadows', { url: 'https://x/rm.mp4' })!,
    )
    expect(ld.name).toBe('River Meadows area guide')
    expect(ld.embedUrl).toBeUndefined()
    expect(ld.contentUrl).toBe('https://x/rm.mp4')
  })
})
