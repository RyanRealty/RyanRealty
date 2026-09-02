/**
 * The live facts the chrome's menus carry (Matt 2026-09-01: "menus, everything
 * upgraded"). A menu that is only a list of links is a table of contents; a
 * menu that says what is true right now is a door.
 *
 * Two layers, on purpose:
 *  - composeChromeLive() is pure: inputs in, the chrome's live model out. Every
 *    figure it formats came from an input, never from here. Tested.
 *  - getChromeLive() reads the inputs through the DAL and the place atlas, under
 *    a timeout and a 15-minute cache, and returns null when a read fails, so a
 *    menu never blocks a page or prints a count it could not read (CLAUDE.md
 *    section 0: a stat that cannot be verified does not ship).
 *
 * Keys are the site-nav group keys the chrome projects (Buy, Areas, Market,
 * Sell), never the locked display words, so a rename in the lock cannot orphan
 * a fact.
 */
import { unstable_cache } from 'next/cache'
import { KB_TOP_NAV } from '@/lib/site-nav'
import { getAllCitySnapshots, getMarketPulse } from '@/lib/data'
import { slugify } from '@/lib/slug'
import { buildPlaceAtlas } from '@/lib/atlas/build-place-atlas'
import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { formatDateTime } from '@/lib/format/date'
import { makeProjection, padBbox, type Bbox } from '@/lib/geo/project-svg'
import type { V3ChromeLive, V3ChromeLiveGroup } from '@/components/site/v3/V3Chrome'

export type ChromeLiveInputs = {
  /** The whole-region population: counts of every type, and the on-market dots. */
  atlas: {
    counts: { forSale: number; pending: number; sold: number }
    dots: readonly { lat: number; lng: number; s: string }[]
    /** When the population was read, formatted: "Sep 2, 2026, 12:07 AM". */
    stamp: string
  } | null
  /**
   * Detached homes for sale per town, keyed by the town's destination href.
   * Read from the same city snapshot the homepage ledger prints, so one page
   * never carries two counts for one town.
   */
  towns: readonly { href: string; count: number | null }[]
  /** The region's detached-home pulse. */
  region: {
    medianListPrice: number | null
    monthsOfSupply: number | null
    medianDaysToPending: number | null
    /** When the pulse row was refreshed, formatted. */
    stamp: string | null
  } | null
}

/** The most dots the menu's field carries; the path stays under 8KB. */
export const FIELD_DOT_CAP = 600
const FIELD_WIDTH = 240

function n(value: number): string {
  return value.toLocaleString('en-US')
}

/** $749,900 → $750K, $1,250,000 → $1.25M. Rounding that never crosses a narrative. */
export function moneyShort(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    const s = m >= 10 ? m.toFixed(1) : m.toFixed(2)
    return `$${s.replace(/\.?0+$/, '')}M`
  }
  return `$${Math.round(value / 1000)}K`
}

function trimmedBbox(points: readonly { lat: number; lng: number }[]): Bbox | null {
  if (points.length < 2) return null
  const lats = points.map((p) => p.lat).sort((a, b) => a - b)
  const lngs = points.map((p) => p.lng).sort((a, b) => a - b)
  const q = (arr: number[], f: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(f * (arr.length - 1))))]!
  const b = { minLat: q(lats, 0.01), maxLat: q(lats, 0.99), minLon: q(lngs, 0.01), maxLon: q(lngs, 0.99) }
  if (b.maxLat <= b.minLat || b.maxLon <= b.minLon) return null
  return b
}

/**
 * The dot field: the on-market listings as one path of zero-length strokes
 * (round caps make each a dot), in a 240-wide box. Strided to the cap so the
 * menu costs kilobytes, not the atlas's megabytes.
 */
export function fieldFromDots(dots: readonly { lat: number; lng: number; s: string }[]): V3ChromeLiveGroup['field'] {
  const on = dots.filter((d) => d.s !== 'sold' && Number.isFinite(d.lat) && Number.isFinite(d.lng))
  const b = trimmedBbox(on)
  if (!b) return undefined
  const proj = makeProjection(padBbox(b, 0.04), FIELD_WIDTH)
  const stride = Math.max(1, Math.ceil(on.length / FIELD_DOT_CAP))
  const parts: string[] = []
  for (let i = 0; i < on.length; i += stride) {
    const [x, y] = proj.toXY(on[i]!.lng, on[i]!.lat)
    if (x < 0 || y < 0 || x > proj.width || y > proj.height) continue
    parts.push(`M${x.toFixed(0)} ${y.toFixed(0)}h0`)
  }
  if (parts.length === 0) return undefined
  return { w: proj.width, h: proj.height, d: parts.join('') }
}

export function composeChromeLive(input: ChromeLiveInputs): V3ChromeLive {
  const out: Record<string, V3ChromeLiveGroup> = {}

  if (input.atlas) {
    const { forSale, pending, sold } = input.atlas.counts
    out.Buy = {
      eyebrow: 'Central Oregon right now',
      facts: [
        { figure: n(forSale), label: forSale === 1 ? 'listing for sale' : 'listings for sale' },
        { figure: n(pending), label: 'pending' },
        { figure: n(sold), label: 'sold in 30 days' },
      ],
      field: fieldFromDots(input.atlas.dots),
      note: `Read ${input.atlas.stamp}`,
    }
  }

  const values: Record<string, string> = {}
  for (const t of input.towns) if (t.count != null) values[t.href] = n(t.count)
  if (Object.keys(values).length > 0) {
    out.Areas = { eyebrow: 'Detached homes for sale', facts: [], values }
  }

  if (input.region) {
    const facts: V3ChromeLiveGroup['facts'][number][] = []
    if (input.region.medianListPrice != null) {
      facts.push({ figure: moneyShort(input.region.medianListPrice), label: 'median list price' })
    }
    if (input.region.monthsOfSupply != null) {
      const verdict = monthsOfSupplyVerdict(input.region.monthsOfSupply)
      facts.push({
        figure: formatMonthsOfSupply(input.region.monthsOfSupply),
        label: verdict ? `months of supply, ${verdict.label.toLowerCase()}` : 'months of supply',
      })
    }
    if (input.region.medianDaysToPending != null) {
      facts.push({ figure: n(input.region.medianDaysToPending), label: 'median days to pending' })
    }
    if (facts.length > 0) {
      out.Market = {
        eyebrow: 'Detached homes right now',
        facts,
        note: input.region.stamp ? `Read ${input.region.stamp}` : undefined,
      }
    }
  }

  const sellFacts: V3ChromeLiveGroup['facts'][number][] = []
  if (input.atlas) sellFacts.push({ figure: n(input.atlas.counts.sold), label: 'sold in the last 30 days' })
  if (input.region?.medianDaysToPending != null) {
    sellFacts.push({ figure: n(input.region.medianDaysToPending), label: 'median days to pending' })
  }
  if (sellFacts.length > 0) {
    out.Sell = {
      eyebrow: 'Sellers right now',
      facts: sellFacts,
      note: input.atlas ? `Read ${input.atlas.stamp}` : undefined,
    }
  }

  return out
}

/** The town destinations the Areas group carries, in its own order. */
export function chromeLiveTowns(): { href: string; slug: string }[] {
  const areas = KB_TOP_NAV.find((g) => g.label === 'Areas')
  if (!areas) return []
  return areas.children
    .map((c) => ({ href: c.href, slug: c.href.replace(/^\/cities\//, '') }))
    .filter((c) => c.slug.length > 0 && !c.slug.includes('/') && c.href.startsWith('/cities/'))
}

const REGION = { geoType: 'region', geoSlug: 'central-oregon' } as const
/** Long enough for a cold atlas walk to finish; the model is cached for 15 minutes after. */
const READ_MS = 8000

type ChromeLiveRead = { live: V3ChromeLive; complete: boolean }

async function readChromeLive(): Promise<ChromeLiveRead> {
  const towns = chromeLiveTowns()
  const [atlas, region, snapshots] = await Promise.all([
    withTimeoutFallback(
      buildPlaceAtlas({ cities: [], label: 'Central Oregon' }).catch(() => null),
      null,
      READ_MS,
      'chrome-live atlas',
    ),
    withTimeoutFallback(getMarketPulse(REGION).catch(() => null), null, READ_MS, 'chrome-live region'),
    withTimeoutFallback(getAllCitySnapshots().catch(() => []), [], READ_MS, 'chrome-live cities'),
  ])
  const countBySlug = new Map<string, number | null>()
  for (const snap of snapshots) countBySlug.set(slugify(snap.geoKey), snap.activeSfrCount)
  const atlasIn = atlas && atlas.complete ? { counts: atlas.counts, dots: atlas.dots, stamp: atlas.stamp } : null
  const live = composeChromeLive({
    atlas: atlasIn,
    towns: towns.map((t) => ({ href: t.href, count: countBySlug.get(t.slug) ?? null })),
    region: region
      ? {
          medianListPrice: region.medianListPrice,
          monthsOfSupply: region.monthsOfSupply,
          medianDaysToPending: region.medianDaysToPending,
          stamp: region.refreshedAt ? formatDateTime(new Date(region.refreshedAt)) : null,
        }
      : null,
  })
  return { live, complete: atlasIn != null && region != null && snapshots.length > 0 }
}

/*
 * One read in flight per process, and a 15-minute memo beside the data cache.
 * The root layout awaits this on EVERY page, and a static build renders
 * hundreds of pages at once: without this, each page render issued its own
 * atlas walk before the first had finished, the reads stacked into rail
 * timeouts (127 in the first deploy), and the 4s cap returned partial models
 * that then got cached. Now a process reads once, only a complete model is
 * stored, and a partial one is served uncached and retried on the next read.
 */
const MEMO_MS = 15 * 60 * 1000
let memo: (ChromeLiveRead & { at: number }) | null = null
let inflight: Promise<ChromeLiveRead> | null = null

async function readChromeLiveOnce(): Promise<ChromeLiveRead> {
  if (memo && memo.complete && Date.now() - memo.at < MEMO_MS) return memo
  if (!inflight) {
    inflight = readChromeLive()
      .then((read) => {
        memo = { ...read, at: Date.now() }
        return read
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

const readChromeLiveCached = unstable_cache(
  async () => {
    const read = await readChromeLiveOnce()
    // Thrown inside the cache so a short model is never stored for 15 minutes.
    if (!read.complete) throw new Error('chrome-live: incomplete read')
    return read.live
  },
  ['chrome-live-v2'],
  { revalidate: 900, tags: ['chrome-live'] },
)

/** The chrome's live model, or null when nothing could be read. Never throws. */
export async function getChromeLive(): Promise<V3ChromeLive | null> {
  try {
    const live = await readChromeLiveCached()
    return Object.keys(live).length > 0 ? live : null
  } catch {
    try {
      const read = memo ?? (await readChromeLiveOnce())
      return Object.keys(read.live).length > 0 ? read.live : null
    } catch {
      return null
    }
  }
}
