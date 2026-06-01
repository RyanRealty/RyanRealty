import { describe, it, expect } from 'vitest'
import { normalizeEmbed } from './getListingVideos'

/**
 * GATE: a listing's tour video must be SHOWCASE-eligible — i.e. resolve to an
 * embeddable `iframe` or `video-tag`, which ListingHero promotes to the autoplay
 * hero. Only genuinely frame-blocked / non-video sources fall back to a watch
 * 'link'. Matt directive: "listing pages must use the video like a showcase
 * listing" — this locks the classification so it can't silently regress.
 */
describe('normalizeEmbed — showcase-video eligibility', () => {
  const showcase = (r: ReturnType<typeof normalizeEmbed>) =>
    r != null && (r.embedType === 'iframe' || r.embedType === 'video-tag')

  it('YouTube → iframe (showcase hero)', () => {
    const r = normalizeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(showcase(r)).toBe(true)
    expect(r?.embedType).toBe('iframe')
  })

  it('Vimeo player → iframe (showcase hero)', () => {
    const r = normalizeEmbed('https://player.vimeo.com/video/123456789')
    expect(r?.embedType).toBe('iframe')
  })

  it('Aryeo → iframe (showcase hero)', () => {
    const r = normalizeEmbed('https://listings.aryeo.com/videos/abc/play')
    expect(r?.embedType).toBe('iframe')
  })

  it('Cloudflare Stream → iframe (showcase hero)', () => {
    const r = normalizeEmbed('https://customer-x.cloudflarestream.com/abc/iframe')
    expect(r?.embedType).toBe('iframe')
  })

  it('direct .mp4 → video-tag (showcase hero)', () => {
    const r = normalizeEmbed('https://cdn.example.com/tour/house.mp4')
    expect(r?.embedType).toBe('video-tag')
  })

  it('Dropbox VIDEO FILE → inline video-tag (showcase hero), not a watch link', () => {
    const r = normalizeEmbed('https://www.dropbox.com/scl/fi/abc/tour.mp4?rlkey=xyz&dl=0')
    expect(showcase(r)).toBe(true)
    expect(r?.embedType).toBe('video-tag')
    expect(r?.url).toContain('dl.dropboxusercontent.com')
    expect(r?.url).not.toContain('dl=0')
    expect(r?.url).toContain('rlkey=xyz') // preserve the share key
  })

  it('Dropbox FOLDER / non-video → watch link (cannot be a hero)', () => {
    const r = normalizeEmbed('https://www.dropbox.com/scl/fo/abc/gallery?rlkey=xyz&dl=0')
    expect(r?.embedType).toBe('link')
  })

  it('MapRight parcel map → dropped (not a walkthrough video)', () => {
    expect(normalizeEmbed('https://app.mapright.com/maps/abc')).toBeNull()
    expect(normalizeEmbed('https://anything.com/x', 'MapRight')).toBeNull()
  })

  it('null / non-http → dropped', () => {
    expect(normalizeEmbed(null)).toBeNull()
    expect(normalizeEmbed('not-a-url')).toBeNull()
  })
})
