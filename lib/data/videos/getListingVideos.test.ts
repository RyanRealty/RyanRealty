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

  it('Matterport 3D tour → iframe (showcase hero, stays on-site)', () => {
    const r = normalizeEmbed('https://my.matterport.com/show/?m=dMW1nw5zYV6&mls=1')
    expect(showcase(r)).toBe(true)
    expect(r?.embedType).toBe('iframe')
  })

  it('Zillow 3D Home (view-imx) tour → iframe (embed, do not bounce to a competitor)', () => {
    const r = normalizeEmbed('https://www.zillow.com/view-imx/4ed84f78-920f-4564-841e-9b9e8bb9d578?setAttribution=mls&wl=true&initialViewType=pano')
    expect(showcase(r)).toBe(true)
    expect(r?.embedType).toBe('iframe')
  })

  it('Google Drive tour file → /preview iframe (agent-uploaded tour video)', () => {
    const r = normalizeEmbed('https://drive.google.com/file/d/1rlWsq0_6JmzEA6FRzIaqw0SantErbMXb/view?usp=share_link')
    expect(showcase(r)).toBe(true)
    expect(r?.embedType).toBe('iframe')
    expect(r?.url).toBe('https://drive.google.com/file/d/1rlWsq0_6JmzEA6FRzIaqw0SantErbMXb/preview')
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
