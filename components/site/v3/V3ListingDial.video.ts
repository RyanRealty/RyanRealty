/**
 * V3ListingDial — the reel's pure half (SITE-194).
 *
 * Matt 2026-09-24: "as we toggle through or navigate those cards, have the
 * primary photo come in first; after a second or two, play the video
 * associated with it if there is one." The timing, the decision of whether
 * a card autoplays at all, the one-reel-on-the-page rule and the endpoint
 * path live here so the unit suite can hold them without a DOM.
 */
import type { DialReel } from '@/lib/listing/publish-dial-reel'

export type { DialReel }

/** The photograph has the card to itself this long before the reel fades in. */
export const DIAL_VIDEO_DWELL_MS = 1500

/** The reel's fade over the photograph: the register's entrance duration (--v3-dur-enter). */
export const DIAL_VIDEO_FADE_MS = 300

export type DialVideoMode = 'auto' | 'control'

/**
 * How a card plays its reel. A reader who asked for less motion, or whose
 * connection asked for less data, is not autoplayed at: the card shows a
 * "Play video" control instead and the reel plays only on their tap.
 */
export function dialVideoMode(env: { reducedMotion: boolean; saveData: boolean }): DialVideoMode {
  return env.reducedMotion || env.saveData ? 'control' : 'auto'
}

/**
 * Whether the dial asks the endpoint at all. `hasVideo` is an optional hint
 * a page may set from data it already holds; only an explicit false skips
 * the request, so a page that says nothing still gets the reel.
 */
export function dialVideoShouldFetch(listing: { hasVideo?: boolean | null }): boolean {
  return listing.hasVideo !== false
}

/**
 * Whether the dwell may start now: the card is on screen, the tab is
 * visible, and the dial is allowed to play. Nothing about the reel is
 * fetched or mounted for a card the reader cannot see.
 */
export function dialVideoMayDwell(state: { onScreen: boolean; pageVisible: boolean; enabled: boolean }): boolean {
  return state.enabled && state.onScreen && state.pageVisible
}

export function dialVideoEndpoint(listingKey: string): string {
  return `/api/listings/${encodeURIComponent(listingKey.trim())}/card-video`
}

/** The endpoint's body, or null for anything that is not a reel. */
export function parseDialVideoBody(body: unknown): DialReel | null {
  if (!body || typeof body !== 'object') return null
  const reel = (body as { reel?: unknown }).reel
  if (!reel || typeof reel !== 'object') return null
  const r = reel as { kind?: unknown; src?: unknown; posterUrl?: unknown }
  if ((r.kind !== 'iframe' && r.kind !== 'video') || typeof r.src !== 'string' || !r.src) return null
  const out: DialReel = { kind: r.kind, src: r.src }
  if (typeof r.posterUrl === 'string' && r.posterUrl) out.posterUrl = r.posterUrl
  return out
}

/**
 * ONE REEL ON THE PAGE. A place page stacks several dials (one per property
 * type) and each has a card on screen at a time; two reels playing at once
 * is noise and twice the bandwidth. The arbiter hands the floor to whichever
 * dial claims it last and tells the previous holder to stop.
 */
export type DialVideoArbiter = {
  claim: (id: string, stop: () => void) => void
  release: (id: string) => void
  holder: () => string | null
}

export function createDialVideoArbiter(): DialVideoArbiter {
  let current: { id: string; stop: () => void } | null = null
  return {
    claim(id, stop) {
      if (current && current.id !== id) current.stop()
      current = { id, stop }
    },
    release(id) {
      if (current?.id === id) current = null
    },
    holder: () => current?.id ?? null,
  }
}

export type DialRailPosition = 'left' | 'right' | 'bottom'

/** The rail's class for a position. The left rail is the default and carries no modifier. */
export function dialRailClass(position: DialRailPosition | undefined): string | null {
  if (position === 'right') return 'v3-dial--rail-right'
  if (position === 'bottom') return 'v3-dial--rail-bottom'
  return null
}

/** Whether the rail lies horizontal: a phone strip, or the bottom position on any screen. */
export function dialRailHorizontal(phone: boolean, position: DialRailPosition | undefined): boolean {
  return phone || position === 'bottom'
}
