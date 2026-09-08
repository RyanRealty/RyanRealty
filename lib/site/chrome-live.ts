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
 * Keys are the site-nav group keys the chrome projects (Areas, Market, Sell),
 * never the locked display words, so a rename in the lock cannot orphan a fact.
 *
 * There is no Buy group any more. "Central Oregon right now" moved out of the
 * Homes dropdown and onto the homepage under the hero search (site queue
 * SITE-12, app/_v3/home-pulse.ts + components/site/v3/V3Pulse.tsx), because a
 * figure published in two places drifts in one of them.
 */
import { unstable_cache } from 'next/cache'
import { KB_TOP_NAV } from '@/lib/site-nav'
import { getAllCitySnapshots, getMarketPulse } from '@/lib/data'
import { slugify } from '@/lib/slug'
import { buildPlaceAtlas } from '@/lib/atlas/build-place-atlas'
import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { formatDateTime } from '@/lib/format/date'
import type { V3ChromeLive, V3ChromeLiveGroup } from '@/components/site/v3/V3Chrome'

export type ChromeLiveInputs = {
  /**
   * The whole-region population. Only the sold count and the moment of the read
   * are used now — the Sell group's "sold in the last 30 days" — because the
   * on-market counts and the dot field left for the homepage band.
   */
  atlas: {
    counts: { forSale: number; pending: number; sold: number }
    /** When the population was read, formatted: "Sep 2, 2026, 12:07 AM". */
    stamp: string
  } | null
  /**
   * Active listing counts per town, keyed by the town's destination href.
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

export function composeChromeLive(input: ChromeLiveInputs): V3ChromeLive {
  const out: Record<string, V3ChromeLiveGroup> = {}

  // NO Buy GROUP. "Central Oregon right now" — the region's for-sale,
  // under-contract and sold counts, and the dot field — moved out of the Homes
  // dropdown and onto the homepage under the hero search (site queue SITE-12,
  // app/_v3/home-pulse.ts). A figure published in two places drifts in one of
  // them, so the menu no longer carries it. `input.atlas` stays: the Sell group
  // still reads the sold count and the stamp from the same population.

  const values: Record<string, string> = {}
  for (const t of input.towns) if (t.count != null) values[t.href] = n(t.count)
  if (Object.keys(values).length > 0) {
    // Places mega: city counts beside links; no DETACHED HOMES FOR SALE kicker (Matt 2026-09-07).
    out.Areas = { eyebrow: '', facts: [], values }
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
      // The region's figures render on every page, including /housing-market/bend,
      // whose own body publishes Bend's figures. Without the geography in the
      // eyebrow the two read as one place (2026-09-07: an AI answer-share check
      // read the region's $750K / 5.0 months beside Bend's $950K / 3.9 as a
      // contradiction). The eyebrow names the population; the test pins it.
      out.Market = {
        eyebrow: 'Central Oregon detached homes right now',
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
      eyebrow: 'Central Oregon sellers right now',
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
  const atlasIn = atlas && atlas.complete ? { counts: atlas.counts, stamp: atlas.stamp } : null
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
  // v3: the Buy group left for the homepage band (SITE-12). The key moves with
  // the SHAPE — Next's data cache outlives a deploy, so a stale entry under the
  // old key would keep serving the strip from a menu that no longer builds it.
  ['chrome-live-v3'],
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
