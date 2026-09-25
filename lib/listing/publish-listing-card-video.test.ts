import { describe, expect, it } from 'vitest'
import type { VideoEmbed } from '@/lib/data/types/video'
import {
  listingCardVideoCanUnmute,
  listingCardVideoKind,
  listingCardVideoSrc,
  parseListingCardVideo,
  publishListingCardVideo,
} from './publish-listing-card-video'

const embed = (over: Partial<VideoEmbed> & Pick<VideoEmbed, 'url'>): VideoEmbed => ({
  source: 'mls-other',
  embedType: 'iframe',
  professional: true,
  ...over,
})

// Shapes normalizeEmbed hands the DAL, from rows on the feed 2026-09-24.
const zillowPano = embed({
  url: 'https://www.zillow.com/view-imx/0a707e24-7f1e-4ac7-b0a1-4cd7b5b2d782?setAttribution=mls&wl=true&initialViewType=pano',
})
const matterport = embed({ url: 'https://my.matterport.com/show/?m=UudGrvdrYZD', source: 'mls-matterport' })
const youtube = embed({
  source: 'mls-youtube',
  url: 'https://www.youtube.com/embed/SoDsYKD4zpg?rel=0&autoplay=1&mute=1&playsinline=1',
  posterUrl: 'https://img.youtube.com/vi/SoDsYKD4zpg/hqdefault.jpg',
})
const vimeoUnlisted = embed({ source: 'mls-vimeo', url: 'https://player.vimeo.com/video/908396663?h=832cb5cb15' })
const stream = embed({ source: 'mls-cloudflare-stream', url: 'https://iframe.videodelivery.net/22c4b96e786c680fe39be2ff927698e9' })
const mp4 = embed({
  source: 'mls-direct-mp4',
  embedType: 'video-tag',
  url: 'https://walkerandhomes.com/api/media/cmq5s36ym00nnni15l7sfx22p/videos/cmqs3kzgw07pdpx15ngg3onlo/share.mp4',
})
const aryeo = embed({ source: 'mls-aryeo', url: 'https://framed-visuals.aryeo.com/videos/019fb94d-50de-73e8-9cb5-015d98411a31' })

describe('publishListingCardVideo: the card plays the reel the listing page leads with', () => {
  it('never plays a 3D tour, a Matterport or a Zillow pano', () => {
    expect(publishListingCardVideo([zillowPano])).toBeNull()
    expect(publishListingCardVideo([matterport])).toBeNull()
    expect(publishListingCardVideo([{ ...vimeoUnlisted, isVirtualTour: false }, zillowPano])?.kind).toBe('vimeo')
  })

  it('skips the tour and takes the walkthrough behind it, as the listing page does', () => {
    expect(publishListingCardVideo([zillowPano, mp4])).toEqual({
      kind: 'file',
      embedType: 'video-tag',
      url: mp4.url,
      posterUrl: null,
    })
  })

  it('stays on the photograph when the page reel carries its own player chrome (Aryeo), rather than reaching for another video', () => {
    expect(publishListingCardVideo([aryeo, youtube])).toBeNull()
  })

  it('names the silent player for each host', () => {
    expect(publishListingCardVideo([youtube])).toEqual({
      kind: 'youtube',
      embedType: 'iframe',
      url: youtube.url,
      posterUrl: youtube.posterUrl,
    })
    expect(publishListingCardVideo([vimeoUnlisted])?.kind).toBe('vimeo')
    expect(publishListingCardVideo([stream])?.kind).toBe('stream')
    expect(publishListingCardVideo([])).toBeNull()
  })

  it('refuses a watch link and a non-http url', () => {
    expect(listingCardVideoKind({ embedType: 'link', url: 'https://www.dropbox.com/sh/abc' })).toBeNull()
    expect(listingCardVideoKind({ embedType: 'video-tag', url: 'javascript:alert(1)' })).toBeNull()
    expect(listingCardVideoKind({ embedType: 'iframe', url: 'https://drive.google.com/file/d/abc/preview' })).toBeNull()
  })
})

describe('parseListingCardVideo: the route answer, read back without trusting it', () => {
  it('round-trips what the publisher produced', () => {
    const reel = publishListingCardVideo([vimeoUnlisted])!
    expect(parseListingCardVideo(JSON.parse(JSON.stringify(reel)))).toEqual(reel)
  })

  it('refuses a body whose kind does not match its URL, or that is not a reel at all', () => {
    expect(parseListingCardVideo({ kind: 'file', embedType: 'iframe', url: vimeoUnlisted.url })).toBeNull()
    expect(parseListingCardVideo({ kind: 'youtube', embedType: 'iframe', url: 'https://evil.example.com/embed/x' })).toBeNull()
    expect(parseListingCardVideo(null)).toBeNull()
    expect(parseListingCardVideo('https://x.mp4')).toBeNull()
  })
})

describe('listingCardVideoSrc: muted, inline, looping, no controls', () => {
  it('builds the youtube-nocookie background player with the JS API on for the page origin', () => {
    const src = listingCardVideoSrc({ kind: 'youtube', url: youtube.url }, 'https://ryan-realty.com')!
    const u = new URL(src)
    expect(u.origin).toBe('https://www.youtube-nocookie.com')
    expect(u.pathname).toBe('/embed/SoDsYKD4zpg')
    for (const [k, v] of [
      ['autoplay', '1'],
      ['mute', '1'],
      ['playsinline', '1'],
      ['controls', '0'],
      ['loop', '1'],
      ['playlist', 'SoDsYKD4zpg'],
      ['rel', '0'],
      ['modestbranding', '1'],
      ['enablejsapi', '1'],
      ['origin', 'https://ryan-realty.com'],
    ]) {
      expect(u.searchParams.get(k)).toBe(v)
    }
  })

  it('reads a Shorts or watch URL to the same player', () => {
    expect(listingCardVideoSrc({ kind: 'youtube', url: 'https://youtube.com/shorts/C7nT8X5nzL4?feature=share' })).toContain(
      '/embed/C7nT8X5nzL4?',
    )
    expect(listingCardVideoSrc({ kind: 'youtube', url: 'https://www.youtube.com/watch?v=Jya0GvQoEuE' })).toContain(
      '/embed/Jya0GvQoEuE?',
    )
  })

  it('keeps the Vimeo privacy hash an unlisted reel needs, in background mode', () => {
    const u = new URL(listingCardVideoSrc({ kind: 'vimeo', url: vimeoUnlisted.url })!)
    expect(u.hostname).toBe('player.vimeo.com')
    expect(u.pathname).toBe('/video/908396663')
    expect(u.searchParams.get('h')).toBe('832cb5cb15')
    expect(u.searchParams.get('background')).toBe('1')
    expect(u.searchParams.get('muted')).toBe('1')
    expect(u.searchParams.get('loop')).toBe('1')
  })

  it('turns the Stream player chrome off', () => {
    const u = new URL(listingCardVideoSrc({ kind: 'stream', url: stream.url })!)
    expect(u.searchParams.get('controls')).toBe('false')
    expect(u.searchParams.get('muted')).toBe('true')
    expect(u.searchParams.get('autoplay')).toBe('true')
    expect(u.searchParams.get('loop')).toBe('true')
    expect(u.searchParams.get('letterboxColor')).toBe('transparent')
  })

  it('hands a file straight to <video>', () => {
    expect(listingCardVideoSrc({ kind: 'file', url: mp4.url })).toBe(mp4.url)
  })

  it('offers sound only where the listing page does: a native <video>', () => {
    expect(listingCardVideoCanUnmute({ kind: 'file', embedType: 'video-tag', url: mp4.url })).toBe(true)
    expect(listingCardVideoCanUnmute({ kind: 'youtube', embedType: 'iframe', url: youtube.url })).toBe(false)
  })
})
