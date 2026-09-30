import { describe, expect, it, vi } from 'vitest'
import {
  createDialVideoArbiter,
  DIAL_VIDEO_DWELL_MS,
  dialRailClass,
  dialRailHorizontal,
  dialVideoEndpoint,
  dialVideoMayDwell,
  dialVideoMode,
  dialVideoShouldFetch,
  parseDialVideoBody,
} from './V3ListingDial.video'

describe('the dial reel timing and rules (SITE-194)', () => {
  it('the photograph has the card for about a second and a half', () => {
    expect(DIAL_VIDEO_DWELL_MS).toBeGreaterThanOrEqual(1000)
    expect(DIAL_VIDEO_DWELL_MS).toBeLessThanOrEqual(2000)
  })

  it('reduced motion or Save-Data gets a control, everyone else autoplays', () => {
    expect(dialVideoMode({ reducedMotion: false, saveData: false })).toBe('auto')
    expect(dialVideoMode({ reducedMotion: true, saveData: false })).toBe('control')
    expect(dialVideoMode({ reducedMotion: false, saveData: true })).toBe('control')
  })

  it('only an explicit hasVideo: false skips the request', () => {
    expect(dialVideoShouldFetch({})).toBe(true)
    expect(dialVideoShouldFetch({ hasVideo: true })).toBe(true)
    expect(dialVideoShouldFetch({ hasVideo: null })).toBe(true)
    expect(dialVideoShouldFetch({ hasVideo: false })).toBe(false)
  })

  it('the dwell starts only for a card on screen in a visible tab', () => {
    expect(dialVideoMayDwell({ onScreen: true, pageVisible: true, enabled: true })).toBe(true)
    expect(dialVideoMayDwell({ onScreen: false, pageVisible: true, enabled: true })).toBe(false)
    expect(dialVideoMayDwell({ onScreen: true, pageVisible: false, enabled: true })).toBe(false)
    expect(dialVideoMayDwell({ onScreen: true, pageVisible: true, enabled: false })).toBe(false)
  })

  it('the endpoint is the per-listing card-video route', () => {
    expect(dialVideoEndpoint(' 20240001 ')).toBe('/api/listings/20240001/card-video')
    expect(dialVideoEndpoint('a/b')).toBe('/api/listings/a%2Fb/card-video')
  })

  it('parses the endpoint body and refuses anything that is not a reel', () => {
    expect(parseDialVideoBody({ listingKey: 'k', reel: { kind: 'iframe', src: 'https://x/y' } })).toEqual({
      kind: 'iframe',
      src: 'https://x/y',
    })
    expect(parseDialVideoBody({ reel: { kind: 'video', src: 'https://x/y.mp4', posterUrl: 'https://x/p.jpg' } })).toEqual({
      kind: 'video',
      src: 'https://x/y.mp4',
      posterUrl: 'https://x/p.jpg',
    })
    expect(parseDialVideoBody({ reel: null })).toBeNull()
    expect(parseDialVideoBody({ reel: { kind: 'link', src: 'https://x' } })).toBeNull()
    expect(parseDialVideoBody({ reel: { kind: 'iframe', src: '' } })).toBeNull()
    expect(parseDialVideoBody(null)).toBeNull()
    expect(parseDialVideoBody('nope')).toBeNull()
  })
})

describe('one reel on the page', () => {
  it('a later claim stops the earlier holder; a release clears it', () => {
    const arbiter = createDialVideoArbiter()
    const stopA = vi.fn()
    const stopB = vi.fn()
    arbiter.claim('a', stopA)
    expect(arbiter.holder()).toBe('a')
    arbiter.claim('b', stopB)
    expect(stopA).toHaveBeenCalledTimes(1)
    expect(stopB).not.toHaveBeenCalled()
    expect(arbiter.holder()).toBe('b')
    // The same dial re-claiming (a turn) does not stop itself.
    arbiter.claim('b', stopB)
    expect(stopB).not.toHaveBeenCalled()
    arbiter.release('a') // not the holder: no-op
    expect(arbiter.holder()).toBe('b')
    arbiter.release('b')
    expect(arbiter.holder()).toBeNull()
  })
})

describe('rail position', () => {
  it('left is the default with no modifier; right and bottom carry one', () => {
    expect(dialRailClass(undefined)).toBeNull()
    expect(dialRailClass('left')).toBeNull()
    expect(dialRailClass('right')).toBe('v3-dial--rail-right')
    expect(dialRailClass('bottom')).toBe('v3-dial--rail-bottom')
  })

  it('the rail lies horizontal on a phone and in the bottom position', () => {
    expect(dialRailHorizontal(false, 'left')).toBe(false)
    expect(dialRailHorizontal(false, 'right')).toBe(false)
    expect(dialRailHorizontal(false, 'bottom')).toBe(true)
    expect(dialRailHorizontal(true, undefined)).toBe(true)
  })
})
