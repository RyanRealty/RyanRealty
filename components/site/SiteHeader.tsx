import Link from 'next/link'
import { CTAButton, RyanRealtyMark } from '@/components/site/primitives'
import MobileNav from '@/components/site/MobileNav'
import MegaMenu from '@/components/site/nav/MegaMenu'
import { MENU } from '@/lib/site-menu'
import type { NavData, AreaPulseRow } from '@/lib/site-menu'

/**
 * SiteHeader — sticky navy bar with an EDITORIAL mega-menu (Experience System
 * directive 2026-06-09: "rework the menu, think further ahead than others").
 *
 * DATA STRATEGY — one try/catch block, no waterfalls:
 *   1. getMarketPulseCitySnapshots (8 cities) — from market_pulse_live,
 *      10-15 min freshness, already cached via unstable_cache in the DAL.
 *   2. getPriceDropDigest (region-wide) — from activity_events, 1-hour
 *      cache, already cached in the DAL.
 *   3. getMarketPulseRegionSnapshot ('central-oregon') — for the Market
 *      panel mini-band (median/active). Already cached in the DAL.
 *
 *   All three run in parallel via Promise.allSettled so a DB hiccup on
 *   one never stalls the others. Any failure silently falls back — the
 *   header renders with static links instead of live numbers.
 *
 *   The header renders on EVERY page. It must never break or slow a page.
 *   Server-side data only. No client waterfalls. No Suspense boundaries.
 *
 * The community rows in NavData are static (no live data yet for
 * subdivision-level pulse) but the type supports it when the cache is
 * extended.
 *
 * Nav structure source of truth: lib/site-nav.ts (PRIMARY_NAV drives the
 * reachability gate). MENU is the editorial display layer over the same routes.
 */

// ─── Static community rows (no live data yet; structure matches AreaPulseRow) ──

const COMMUNITY_ROWS: AreaPulseRow[] = [
  { slug: 'tetherow', label: 'Tetherow', href: '/communities/tetherow', activeCount: null, medianListPrice: null },
  { slug: 'pronghorn', label: 'Pronghorn', href: '/communities/pronghorn', activeCount: null, medianListPrice: null },
  { slug: 'broken-top', label: 'Broken Top', href: '/communities/broken-top', activeCount: null, medianListPrice: null },
  { slug: 'widgi-creek', label: 'Widgi Creek', href: '/communities/widgi-creek', activeCount: null, medianListPrice: null },
  { slug: 'awbrey-glen', label: 'Awbrey Glen', href: '/communities/awbrey-glen', activeCount: null, medianListPrice: null },
  { slug: 'eagle-crest', label: 'Eagle Crest', href: '/communities/eagle-crest', activeCount: null, medianListPrice: null },
  { slug: 'brasada-ranch', label: 'Brasada Ranch', href: '/communities/brasada-ranch', activeCount: null, medianListPrice: null },
  { slug: 'black-butte-ranch', label: 'Black Butte Ranch', href: '/communities/black-butte-ranch', activeCount: null, medianListPrice: null },
  { slug: 'sunriver', label: 'Sunriver', href: '/communities/sunriver', activeCount: null, medianListPrice: null },
  { slug: 'caldera-springs', label: 'Caldera Springs', href: '/communities/caldera-springs', activeCount: null, medianListPrice: null },
  { slug: 'crosswater', label: 'Crosswater', href: '/communities/crosswater', activeCount: null, medianListPrice: null },
  { slug: 'northwest-crossing', label: 'NorthWest Crossing', href: '/communities/northwest-crossing', activeCount: null, medianListPrice: null },
  { slug: 'bend-awbrey-butte', label: 'Awbrey Butte', href: '/communities/bend-awbrey-butte', activeCount: null, medianListPrice: null },
  { slug: 'bend-old-bend', label: 'Old Bend', href: '/communities/bend-old-bend', activeCount: null, medianListPrice: null },
  { slug: 'bend-old-mill-district', label: 'Old Mill District', href: '/communities/bend-old-mill-district', activeCount: null, medianListPrice: null },
]

// City labels used for getMarketPulseCitySnapshots (must match geo_label in DB)
const CITY_LABELS = ['Bend', 'Redmond', 'Sisters', 'Sunriver', 'La Pine', 'Prineville', 'Terrebonne', 'Powell Butte']

// Slug map: geo_label -> /cities/<slug> href
const CITY_SLUG_MAP: Record<string, string> = {
  'Bend': 'bend',
  'Redmond': 'redmond',
  'Sisters': 'sisters',
  'Sunriver': 'sunriver',
  'La Pine': 'la-pine',
  'Prineville': 'prineville',
  'Terrebonne': 'terrebonne',
  'Powell Butte': 'powell-butte',
}

// ─── Safe fallback (nothing live, all static) ─────────────────────────────────

const EMPTY_NAV_DATA: NavData = {
  cityRows: [],
  communityRows: COMMUNITY_ROWS,
  topDrop: null,
  dropCount: 0,
  regionActive: null,
  regionMedian: null,
}

// ─── Server component ─────────────────────────────────────────────────────────

export default async function SiteHeader() {
  const navData = await fetchNavData()

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-primary text-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Ryan Realty home" className="shrink-0">
          <RyanRealtyMark variant="horizontal" tone="white" width={140} priority className="h-8 w-auto" />
        </Link>

        <MegaMenu menu={MENU} navData={navData} />

        <div className="flex items-center gap-2.5">
          <CTAButton href="/login" tone="on-navy-ghost" size="md" className="hidden sm:inline-flex">
            Sign in
          </CTAButton>
          {/* Buyer CTA — drives listing-alerts LP so buyers have a one-click capture
              path alongside the seller CTA. Ghost (secondary); lg+ only so the
              header never crowds — smaller screens reach it via the Homes menu. */}
          <CTAButton href="/lp/buyer-listing-alerts" tone="on-navy-ghost" size="md" className="hidden lg:inline-flex">
            Get listing alerts
          </CTAButton>
          <CTAButton href="/lp/seller-home-value" tone="on-navy" size="md" className="hidden sm:inline-flex">
            List your home
          </CTAButton>
          <MobileNav menu={MENU} navData={navData} />
        </div>
      </div>
    </header>
  )
}

// ─── Data fetch (parallel, fully wrapped — header never breaks) ───────────────

async function fetchNavData(): Promise<NavData> {
  try {
    // Dynamic import keeps the DAL out of the static bundle; the functions
    // are already cached (unstable_cache / makeResilientCached) so repeated
    // calls within a request are instant.
    const {
      getMarketPulseCitySnapshots,
      getMarketPulseRegionSnapshot,
      getPriceDropDigest,
    } = await import('@/lib/data')

    const [cityResult, regionResult, digestResult] = await Promise.allSettled([
      getMarketPulseCitySnapshots(CITY_LABELS),
      getMarketPulseRegionSnapshot('central-oregon'),
      getPriceDropDigest('central-oregon', 7),
    ])

    // ── City rows ──────────────────────────────────────────────────────────
    const citySnapshots =
      cityResult.status === 'fulfilled' ? cityResult.value : []
    const snapshotByLabel = new Map(citySnapshots.map((s) => [s.geo_label, s]))

    const cityRows: AreaPulseRow[] = CITY_LABELS.map((label) => {
      const snap = snapshotByLabel.get(label)
      const slugKey = CITY_SLUG_MAP[label] ?? label.toLowerCase().replace(/\s+/g, '-')
      return {
        slug: slugKey,
        label,
        href: `/cities/${slugKey}`,
        activeCount: snap?.active_count ?? null,
        medianListPrice: snap?.median_list_price ?? null,
      }
    })

    // ── Region pulse (Market panel mini-band) ──────────────────────────────
    const region =
      regionResult.status === 'fulfilled' ? regionResult.value : null

    // ── Price-drop digest (Homes panel strip + badge) ──────────────────────
    const digest =
      digestResult.status === 'fulfilled' ? digestResult.value : null

    // Build the topDrop from the digest's biggestDrop
    let topDrop: NavData['topDrop'] = null
    if (digest?.biggestDrop) {
      const bd = digest.biggestDrop
      // getPriceDropDigest gives us address, amount, pct, neighborhood, listingKey
      // but NOT listPrice or photoUrl — we need getPriceDrops for those.
      // To avoid a second fan-out, we synthesise from what we have: use the
      // listingKey to build the href, and leave photo/price as unknowns until
      // a dedicated nav-digest DAL function is added.
      // For now: show the drop stats without photo (the card degrades gracefully).
      topDrop = {
        address: bd.address,
        amount: bd.amount,
        pct: bd.pct,
        listPrice: 0, // will be overridden below if we get tile data
        photoUrl: null,
        neighborhood: bd.neighborhood,
        href: `/listing/${bd.listingKey}`,
      }

      // Try to enrich with the actual list price + photo via getPriceDrops
      // (already cached at 30-min TTL — same request deduplication as above).
      try {
        const { getPriceDrops } = await import('@/lib/data')
        const { drops } = await getPriceDrops({ limit: 1, days: 7 })
        const best = drops.find((d) => d.listingKey === bd.listingKey) ?? drops[0]
        if (best) {
          topDrop = {
            address: [best.streetNumber, best.streetName].filter(Boolean).join(' ') || bd.address,
            amount: best.lastDropAmount ?? bd.amount,
            pct: best.lastDropPct ?? bd.pct,
            listPrice: best.listPrice,
            photoUrl: best.photoUrl,
            neighborhood: best.boundaryNeighborhood ?? best.subdivisionName ?? bd.neighborhood,
            href: best.addressSlug ? `/listing/${best.listingKey}` : '/price-drops',
          }
        }
      } catch {
        // Enrichment failed — topDrop stays as digest-only (address + pct, no photo)
      }
    }

    return {
      cityRows,
      communityRows: COMMUNITY_ROWS,
      topDrop,
      dropCount: digest?.count ?? 0,
      regionActive: region?.active_count ?? null,
      regionMedian: region?.median_list_price ?? null,
    }
  } catch {
    // Any unhandled failure: render static links, no live data
    return EMPTY_NAV_DATA
  }
}
