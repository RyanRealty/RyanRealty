import { describe, it, expect } from 'vitest'
import {
  getVideoEmbedHtml,
  isDirectListingVideoFileUrl,
  parseListingVideoEmbedForTile,
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
