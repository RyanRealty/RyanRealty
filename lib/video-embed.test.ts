import { describe, it, expect } from 'vitest'
import {
  getVideoEmbedHtml,
  isDirectListingVideoFileUrl,
  normalizeEmbed,
  parseListingVideoEmbedForTile,
  parseVimeoRef,
  preferPlayableCopy,
  toBackgroundEmbed,
  toTileBackgroundVideo,
  vimeoPlayerSrc,
} from './video-embed'

describe('getVideoEmbedHtml', () => {
  it('returns null for empty string', () => {
    expect(getVideoEmbedHtml('')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(getVideoEmbedHtml(null as unknown as string)).toBeNull()
  })

  it('returns null for non-video URL', () => {
    expect(getVideoEmbedHtml('https://example.com/page')).toBeNull()
  })

  describe('YouTube', () => {
    it('embeds standard YouTube watch URL', () => {
      const html = getVideoEmbedHtml('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(html).toContain('youtube.com/embed/dQw4w9WgXcQ')
      expect(html).toContain('<iframe')
      expect(html).toContain('allowfullscreen')
    })

    it('embeds YouTube short URL', () => {
      const html = getVideoEmbedHtml('https://youtu.be/dQw4w9WgXcQ')
      expect(html).toContain('youtube.com/embed/dQw4w9WgXcQ')
    })

    it('includes autoplay and mute by default', () => {
      const html = getVideoEmbedHtml('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(html).toContain('autoplay=1')
      expect(html).toContain('mute=1')
    })

    it('omits autoplay when disabled', () => {
      const html = getVideoEmbedHtml('https://www.youtube.com/watch?v=dQw4w9WgXcQ', false)
      expect(html).not.toContain('autoplay=1')
      expect(html).not.toContain('mute=1')
    })

    it('includes rel=0 to prevent related videos', () => {
      const html = getVideoEmbedHtml('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(html).toContain('rel=0')
    })
  })

  describe('Vimeo', () => {
    it('embeds standard Vimeo URL', () => {
      const html = getVideoEmbedHtml('https://vimeo.com/123456789')
      expect(html).toContain('player.vimeo.com/video/123456789')
      expect(html).toContain('<iframe')
    })

    it('embeds Vimeo video path URL', () => {
      const html = getVideoEmbedHtml('https://vimeo.com/video/123456789')
      expect(html).toContain('player.vimeo.com/video/123456789')
    })

    it('includes autoplay by default for Vimeo', () => {
      const html = getVideoEmbedHtml('https://vimeo.com/123456789')
      expect(html).toContain('autoplay=1')
    })

    it('omits autoplay when disabled for Vimeo', () => {
      const html = getVideoEmbedHtml('https://vimeo.com/123456789', false)
      expect(html).not.toContain('autoplay=1')
    })
  })
})

describe('isDirectListingVideoFileUrl', () => {
  it('accepts mp4 URLs', () => {
    expect(isDirectListingVideoFileUrl('https://cdn.example.com/a.mp4')).toBe(true)
    expect(isDirectListingVideoFileUrl('https://cdn.example.com/v.mov?token=1')).toBe(true)
  })
  it('rejects YouTube pages', () => {
    expect(isDirectListingVideoFileUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
  })
})

describe('parseListingVideoEmbedForTile', () => {
  it('parses YouTube watch and embed URLs', () => {
    const a = parseListingVideoEmbedForTile('https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=1')
    expect(a?.kind).toBe('youtube')
    expect(a?.src).toContain('youtube.com/embed/dQw4w9WgXcQ')
    expect(a?.posterUrl).toContain('dQw4w9WgXcQ')
    const b = parseListingVideoEmbedForTile('https://youtu.be/dQw4w9WgXcQ')
    expect(b?.kind).toBe('youtube')
  })
  it('extracts iframe src from MLS ObjectHtml snippet', () => {
    const html =
      '<div><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560"></iframe></div>'
    const p = parseListingVideoEmbedForTile(html)
    expect(p?.kind).toBe('youtube')
  })
  it('parses Vimeo', () => {
    const p = parseListingVideoEmbedForTile('https://vimeo.com/123456789')
    expect(p?.kind).toBe('vimeo')
    expect(p?.src).toContain('player.vimeo.com/video/123456789')
  })
  it('parses Matterport', () => {
    const p = parseListingVideoEmbedForTile('https://my.matterport.com/show/?m=abc')
    expect(p?.kind).toBe('matterport')
    expect(p?.src).toContain('matterport.com')
  })
})

// Unlisted Vimeo videos play only with their privacy hash (Vimeo answers a
// hashless request with "this video does not exist"). Shapes from the MLS
// feed 2026-09-25: 149 of 436 Vimeo references on live listings carry one,
// 74 in the path and 75 as ?h=.
describe('Vimeo privacy hash', () => {
  const PUBLIC = 'https://vimeo.com/123456789'
  const PATH_HASH = 'https://vimeo.com/714278543/56be80407a?share=copy'
  const QUERY_HASH = 'https://player.vimeo.com/video/974844486?h=d3c5d91bbb&badge=0&autopause=0&app_id=58479'
  const h = (src: string | null | undefined) => (src ? new URL(src).searchParams.get('h') : undefined)

  it('reads the id and hash from each shape', () => {
    expect(parseVimeoRef(PUBLIC)).toEqual({ id: '123456789', hash: null })
    expect(parseVimeoRef(PATH_HASH)).toEqual({ id: '714278543', hash: '56be80407a' })
    expect(parseVimeoRef('https://vimeo.com/714278543/56be80407a')).toEqual({ id: '714278543', hash: '56be80407a' })
    expect(parseVimeoRef(QUERY_HASH)).toEqual({ id: '974844486', hash: 'd3c5d91bbb' })
    expect(parseVimeoRef('https://vimeo.com/video/123456789')).toEqual({ id: '123456789', hash: null })
  })

  it('reads a hash that follows an MLS-encoded &amp;', () => {
    expect(parseVimeoRef('https://player.vimeo.com/video/974844486?badge=0&amp;h=d3c5d91bbb')?.hash).toBe('d3c5d91bbb')
  })

  it('does not take a non-hash path segment or a non-video page for a hash', () => {
    expect(parseVimeoRef('https://vimeo.com/123456789/description')).toEqual({ id: '123456789', hash: null })
    expect(parseVimeoRef('https://vimeo.com/share/b65372c1-46d7-4ad8-8ad8-a9a67ff3d923?share=copy')).toBeNull()
    expect(parseVimeoRef('https://www.youtube.com/watch?v=dQw4w9WgXcQ&h=abcdef1234')).toBeNull()
  })

  it('puts the hash first in the player src, where Vimeo writes it', () => {
    expect(vimeoPlayerSrc({ id: '714278543', hash: '56be80407a' }, { autoplay: '1' })).toBe(
      'https://player.vimeo.com/video/714278543?h=56be80407a&autoplay=1',
    )
    expect(vimeoPlayerSrc({ id: '123456789', hash: null })).toBe('https://player.vimeo.com/video/123456789')
  })

  it('tile parse carries the hash from both shapes and leaves a public video as it was', () => {
    expect(parseListingVideoEmbedForTile(PUBLIC)?.src).toBe('https://player.vimeo.com/video/123456789?autoplay=1&muted=1')
    expect(h(parseListingVideoEmbedForTile(PATH_HASH)?.src)).toBe('56be80407a')
    expect(h(parseListingVideoEmbedForTile(QUERY_HASH)?.src)).toBe('d3c5d91bbb')
  })

  it('normalizeEmbed carries the hash from a URL, a protocol-relative URL and iframe markup', () => {
    expect(h(normalizeEmbed(PUBLIC)?.url)).toBeNull()
    expect(h(normalizeEmbed(PATH_HASH)?.url)).toBe('56be80407a')
    expect(h(normalizeEmbed('//vimeo.com/714278543/56be80407a')?.url)).toBe('56be80407a')
    expect(h(normalizeEmbed(QUERY_HASH)?.url)).toBe('d3c5d91bbb')
    const markup =
      '<iframe src="https://player.vimeo.com/video/974844486?badge=0&amp;h=d3c5d91bbb&amp;app_id=58479" frameborder="0"></iframe>'
    const fromMarkup = normalizeEmbed(markup)
    expect(fromMarkup?.embedType).toBe('iframe')
    expect(h(fromMarkup?.url)).toBe('d3c5d91bbb')
  })

  it('the iframe HTML builder carries the hash, with or without autoplay', () => {
    const src = (html: string | null) => h(html?.match(/src="([^"]+)"/)?.[1].replace(/&amp;/g, '&'))
    expect(getVideoEmbedHtml(PUBLIC)).toContain('src="https://player.vimeo.com/video/123456789?autoplay=1"')
    expect(getVideoEmbedHtml(PUBLIC, false)).toContain('src="https://player.vimeo.com/video/123456789"')
    expect(src(getVideoEmbedHtml(PATH_HASH))).toBe('56be80407a')
    expect(src(getVideoEmbedHtml(QUERY_HASH, false))).toBe('d3c5d91bbb')
  })

  it('the background (card) variant carries the hash from both shapes', () => {
    const fromPlayer = new URL(toBackgroundEmbed(normalizeEmbed(QUERY_HASH)!.url))
    expect(fromPlayer.hostname).toBe('player.vimeo.com')
    expect(fromPlayer.searchParams.get('h')).toBe('d3c5d91bbb')
    expect(fromPlayer.searchParams.get('background')).toBe('1')
    const fromPage = new URL(toBackgroundEmbed(PATH_HASH))
    expect(fromPage.hostname).toBe('player.vimeo.com')
    expect(fromPage.pathname).toBe('/video/714278543')
    expect(fromPage.searchParams.get('h')).toBe('56be80407a')
    expect(fromPage.searchParams.get('muted')).toBe('1')
    const tile = toTileBackgroundVideo({ url: normalizeEmbed(PATH_HASH)!.url, embedType: 'iframe' })
    expect(h(tile?.url)).toBe('56be80407a')
    expect(h(toBackgroundEmbed(normalizeEmbed(PUBLIC)!.url))).toBeNull()
  })

  it('of two copies of one video, the copy with the hash wins', () => {
    const bare = 'https://player.vimeo.com/video/974844486?autoplay=1&muted=1'
    const hashed = normalizeEmbed(QUERY_HASH)!.url
    expect(preferPlayableCopy(bare, hashed)).toBe(hashed)
    expect(preferPlayableCopy(hashed, bare)).toBe(hashed)
    expect(preferPlayableCopy(bare, bare)).toBe(bare)
    expect(preferPlayableCopy('https://my.matterport.com/show/?m=a', 'https://my.matterport.com/show/?m=a&x=1')).toBe(
      'https://my.matterport.com/show/?m=a',
    )
  })
})
