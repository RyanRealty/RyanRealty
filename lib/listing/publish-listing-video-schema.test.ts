import { describe, expect, it } from 'vitest'
import { buildJsonLd } from '@/lib/site/json-ld'
import {
  latestMediaHistoryDates,
  listingVideosFromDetails,
  mlsMediaUploadDate,
} from '@/lib/listing/listing-video-assembly'
import { listingVideoPlayer, publishListingVideoSchemas } from './publish-listing-video-schema'

const NOW = new Date('2026-10-14T18:00:00Z')
const EPOCH = '1970-01-01T00:00:00Z'
const LEAD = 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/lead-o.jpg'
const vimeoIframe = (id: string) => `<iframe src="https://player.vimeo.com/video/${id}?h=abcdef1234" width="640"></iframe>`

describe('mlsMediaUploadDate', () => {
  it('takes a real MLS timestamp as ISO', () => {
    expect(mlsMediaUploadDate('2025-06-27T16:30:40Z', NOW)).toBe('2025-06-27T16:30:40.000Z')
  })
  it('refuses the feed epoch sentinel, anything before 2000, garbage and the future', () => {
    expect(mlsMediaUploadDate(EPOCH, NOW)).toBeUndefined()
    expect(mlsMediaUploadDate('1999-12-31T23:59:59Z', NOW)).toBeUndefined()
    expect(mlsMediaUploadDate('not a date', NOW)).toBeUndefined()
    expect(mlsMediaUploadDate('2026-10-20T00:00:00Z', NOW)).toBeUndefined()
    expect(mlsMediaUploadDate(null, NOW)).toBeUndefined()
  })
})

describe('listing video dates', () => {
  it('carries each Videos[] record ModificationTimestamp as uploadDate', () => {
    const videos = listingVideosFromDetails(
      { Videos: [{ ObjectHtml: vimeoIframe('111'), ModificationTimestamp: '2023-03-10T19:25:49Z' }] },
      NOW,
    )
    expect(videos).toHaveLength(1)
    expect(videos[0].uploadDate).toBe('2023-03-10T19:25:49.000Z')
  })

  it('dates a single sentinel-stamped record from the latest history event of its kind', () => {
    const history = latestMediaHistoryDates(
      [
        { event: 'Video', event_date: '2025-03-01T17:01:46Z' },
        { event: 'Video', event_date: '2025-06-27T16:30:40Z' },
        { event: 'VirtualTour', event_date: '2025-06-27T16:30:58Z' },
        { event: 'Photo', event_date: '2026-01-01T00:00:00Z' },
      ],
      NOW,
    )
    expect(history).toEqual({ video: '2025-06-27T16:30:40.000Z', tour: '2025-06-27T16:30:58.000Z' })
    const videos = listingVideosFromDetails(
      { Videos: [{ ObjectHtml: vimeoIframe('222'), ModificationTimestamp: EPOCH }] },
      NOW,
      history,
    )
    expect(videos[0].uploadDate).toBe('2025-06-27T16:30:40.000Z')
  })

  it('leaves two sentinel-stamped records of one kind undated (the event names no record)', () => {
    const videos = listingVideosFromDetails(
      {
        Videos: [
          { ObjectHtml: vimeoIframe('333'), ModificationTimestamp: EPOCH },
          { ObjectHtml: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ModificationTimestamp: EPOCH },
        ],
      },
      NOW,
      { video: '2025-06-27T16:30:40.000Z' },
    )
    expect(videos).toHaveLength(2)
    expect(videos.every((v) => v.uploadDate === undefined)).toBe(true)
  })

  it('a dated tour copy lends its date to the same media already listed without one', () => {
    const videos = listingVideosFromDetails(
      {
        VirtualTourURLUnbranded: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        VirtualTours: [{ Uri: 'https://youtu.be/dQw4w9WgXcQ', ModificationTimestamp: '2024-05-01T10:00:00Z' }],
      },
      NOW,
    )
    expect(videos).toHaveLength(1)
    expect(videos[0].uploadDate).toBe('2024-05-01T10:00:00.000Z')
  })
})

describe('publishListingVideoSchemas', () => {
  const base = {
    name: 'Video tour of 16631 Serpentine Drive, La Pine, OR',
    description: 'Video tour of 16631 Serpentine Drive, La Pine, OR, from the MLS listing.',
    pageUrl: '/homes-for-sale/la-pine/16631-serpentine-220196555',
    leadPhotoUrl: LEAD,
  }

  it('YouTube: embed URL and the provider still, no file and no Ryan Realty publisher', () => {
    const videos = listingVideosFromDetails(
      { Videos: [{ ObjectHtml: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ModificationTimestamp: '2024-01-02T03:04:05Z' }] },
      NOW,
    )
    const [schema] = publishListingVideoSchemas({ ...base, videos })
    const ld = buildJsonLd(schema)
    expect(ld['@type']).toBe('VideoObject')
    expect(ld.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(ld.thumbnailUrl).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    expect(ld.uploadDate).toBe('2024-01-02T03:04:05.000Z')
    expect(ld.contentUrl).toBeUndefined()
    expect(ld.publisher).toBeUndefined()
    expect(ld.name).toBe(base.name)
  })

  it('Vimeo: the player with its privacy hash, the MLS lead photo as still', () => {
    const videos = listingVideosFromDetails(
      { Videos: [{ ObjectHtml: vimeoIframe('1096799515'), ModificationTimestamp: '2025-06-27T16:30:40Z' }] },
      NOW,
    )
    const [schema] = publishListingVideoSchemas({ ...base, videos })
    expect(schema).toMatchObject({
      embedUrl: 'https://player.vimeo.com/video/1096799515?h=abcdef1234',
      thumbnailUrl: LEAD,
      uploadDate: '2025-06-27T16:30:40.000Z',
    })
    expect(publishListingVideoSchemas({ ...base, videos, leadPhotoUrl: null })).toEqual([])
  })

  it('a SafeLinks-wrapped Vimeo link becomes the Vimeo player, with no trace of the wrapper', () => {
    const wrapped =
      'https://nam11.safelinks.protection.outlook.com/?url=https%3A%2F%2Fvimeo.com%2F1096799515&data=05%7C02%7Cbroker%40example.com%7Cx&sdata=y&reserved=0'
    const videos = listingVideosFromDetails({ Videos: [{ ObjectHtml: wrapped, ModificationTimestamp: '2025-06-27T16:30:40Z' }] }, NOW)
    expect(videos[0].embedType).toBe('iframe')
    const [schema] = publishListingVideoSchemas({ ...base, videos })
    expect(JSON.stringify(buildJsonLd(schema))).not.toMatch(/safelinks|example\.com|%40|sdata/)
    expect(schema).toMatchObject({ embedUrl: 'https://player.vimeo.com/video/1096799515' })
  })

  it('emits nothing for an undated video or a provider whose player it cannot derive', () => {
    const undated = listingVideosFromDetails({ Videos: [{ ObjectHtml: vimeoIframe('9'), ModificationTimestamp: EPOCH }] }, NOW)
    expect(publishListingVideoSchemas({ ...base, videos: undated })).toEqual([])
    const momenzo = listingVideosFromDetails(
      { Videos: [{ ObjectHtml: 'https://momenzo.app.link/e/abc123', ModificationTimestamp: '2025-01-01T00:00:00Z' }] },
      NOW,
    )
    expect(momenzo).toHaveLength(1)
    expect(publishListingVideoSchemas({ ...base, videos: momenzo })).toEqual([])
    expect(listingVideoPlayer('https://my.matterport.com/show/?m=abc')).toBeNull()
  })

  it('de-duplicates one video and caps the list', () => {
    const videos = listingVideosFromDetails(
      {
        Videos: [
          { ObjectHtml: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', ModificationTimestamp: '2025-01-01T00:00:00Z' },
          { ObjectHtml: 'https://youtu.be/bbbbbbbbbbb', ModificationTimestamp: '2025-01-02T00:00:00Z' },
          { ObjectHtml: 'https://www.youtube.com/embed/ccccccccccc', ModificationTimestamp: '2025-01-03T00:00:00Z' },
        ],
      },
      NOW,
    )
    const schemas = publishListingVideoSchemas({ ...base, videos, max: 2 })
    expect(schemas.map((s) => s.name)).toEqual([base.name, `${base.name}, video 2`])
  })
})
