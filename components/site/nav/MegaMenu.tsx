'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { MapPinIcon } from '@heroicons/react/24/outline'
import {
  Eyebrow,
  CTAButton,
  DisplayHeading,
  Price,
  TabularNumber,
} from '@/components/site/primitives'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/tracking'
import type { MenuEntry, NavData, AreaPulseRow } from '@/lib/site-menu'

/**
 * MegaMenu — the EDITORIAL mega-menu (Experience System 2026-06-09 directive).
 *
 * Panels SHOW the data advantage instead of listing links.
 *
 * - Homes: browse links with live drop count badge + editorial biggest-drop strip
 * - Explore (the showpiece): two-column editorial area index with live
 *   median price + active count per row (city data from getMarketPulseCitySnapshots)
 * - Market: link columns + mini live region band (median/active/drops)
 * - Sell: valuation CTA prominent — the money path
 * - Company: three transparent-PNG broker headshots, floating over cream
 * - Learn: clean editorial columns
 *
 * DATA: navData fetched once server-side in SiteHeader (wrapped in try/catch).
 * Every live-data slot falls back gracefully — the header never breaks.
 *
 * TELEMETRY: nav_interact fires on every panel open + every link click.
 * The menu is the top conversion surface — we measure every touch.
 *
 * INTERACTION (hover-intent + keyboard + touch):
 *   - Entering a trigger starts a short OPEN timer (140ms).
 *   - Leaving the trigger or the panel starts a longer CLOSE timer (440ms).
 *   - Entering the open panel cancels the close timer — cursor travels freely.
 *   - Moving between triggers while open switches instantly (no re-delay).
 *   - Click/touch toggles. Escape closes and returns focus.
 *   - prefers-reduced-motion: no CSS transitions.
 */

const OPEN_DELAY_MS = 140
const CLOSE_DELAY_MS = 440

export default function MegaMenu({
  menu,
  navData,
}: {
  menu: MenuEntry[]
  navData: NavData
}) {
  const [active, setActive] = useState<number | null>(null)
  const idPrefix = useId()

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([])

  const clearOpen = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null }
  }, [])
  const clearClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }, [])
  const close = useCallback(() => {
    clearOpen(); clearClose(); setActive(null)
  }, [clearOpen, clearClose])

  useEffect(() => () => { clearOpen(); clearClose() }, [clearOpen, clearClose])

  useEffect(() => {
    if (active === null) return
    function onDocPointerDown(event: MouseEvent) {
      const root = rootRef.current
      if (root && event.target instanceof Node && !root.contains(event.target)) close()
    }
    document.addEventListener('mousedown', onDocPointerDown)
    return () => document.removeEventListener('mousedown', onDocPointerDown)
  }, [active, close])

  function handleTriggerEnter(index: number) {
    clearClose()
    if (active !== null) { clearOpen(); setActive(index); return }
    clearOpen()
    openTimer.current = setTimeout(() => setActive(index), OPEN_DELAY_MS)
  }
  function handleTriggerLeave() {
    clearOpen(); clearClose()
    closeTimer.current = setTimeout(() => setActive(null), CLOSE_DELAY_MS)
  }
  function handleTriggerClick(index: number) {
    clearOpen(); clearClose()
    const next = active === index ? null : index
    setActive(next)
    if (next !== null) {
      trackEvent('nav_interact', { action: 'panel_open', panel: menu[index]?.label ?? '' })
    }
  }
  function handleTriggerKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === 'Escape') {
      if (active !== null) { event.preventDefault(); close() }
      return
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      handleTriggerClick(index)
    }
  }
  function handlePanelEnter() { clearClose() }
  function handlePanelLeave() {
    clearOpen(); clearClose()
    closeTimer.current = setTimeout(() => setActive(null), CLOSE_DELAY_MS)
  }

  function panelId(i: number) { return `${idPrefix}-panel-${i}` }
  function triggerId(i: number) { return `${idPrefix}-trigger-${i}` }

  function handleLinkClick(panel: string, label: string) {
    trackEvent('nav_interact', { action: 'link_click', panel, label })
    close()
  }

  return (
    <div
      ref={rootRef}
      className="hidden md:flex md:items-center"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && active !== null) {
          close()
          triggerRefs.current[active]?.focus()
        }
      }}
    >
      <nav aria-label="Primary" className="flex items-center gap-0.5">
        {menu.map((entry, index) => {
          const isActive = active === index
          return (
            <button
              key={entry.label}
              ref={(node) => { triggerRefs.current[index] = node }}
              id={triggerId(index)}
              type="button"
              aria-haspopup="true"
              aria-expanded={isActive}
              aria-controls={panelId(index)}
              onMouseEnter={() => handleTriggerEnter(index)}
              onMouseLeave={handleTriggerLeave}
              onClick={() => handleTriggerClick(index)}
              onKeyDown={(event) => handleTriggerKeyDown(event, index)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-medium',
                'text-white/85 transition-colors hover:bg-white/10 hover:text-white',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40',
                'motion-reduce:transition-none',
                isActive && 'bg-white/10 text-white',
              )}
            >
              {entry.label}
              <ChevronDownIcon
                aria-hidden
                className={cn(
                  'h-3.5 w-3.5 text-white/55 transition-transform motion-reduce:transition-none',
                  isActive && 'rotate-180 text-white/80',
                )}
              />
            </button>
          )
        })}
      </nav>

      {active !== null && (
        <EditorialPanel
          entry={menu[active] as MenuEntry}
          navData={navData}
          id={panelId(active)}
          labelledBy={triggerId(active)}
          onMouseEnter={handlePanelEnter}
          onMouseLeave={handlePanelLeave}
          onLinkClick={handleLinkClick}
        />
      )}
    </div>
  )
}

// ─── Panel Router ─────────────────────────────────────────────────────────────

function EditorialPanel({
  entry,
  navData,
  id,
  labelledBy,
  onMouseEnter,
  onMouseLeave,
  onLinkClick,
}: {
  entry: MenuEntry
  navData: NavData
  id: string
  labelledBy: string
  onMouseEnter: () => void
  onMouseLeave: () => void
  onLinkClick: (panel: string, label: string) => void
}) {
  const panelLabel = entry.label

  let inner: React.ReactNode
  if (panelLabel === 'Homes') {
    inner = <HomesPanel entry={entry} navData={navData} onLinkClick={onLinkClick} />
  } else if (panelLabel === 'Explore') {
    inner = <AreasPanel entry={entry} navData={navData} onLinkClick={onLinkClick} />
  } else if (panelLabel === 'Market') {
    inner = <MarketPanel entry={entry} navData={navData} onLinkClick={onLinkClick} />
  } else if (panelLabel === 'Sell') {
    inner = <SellPanel entry={entry} onLinkClick={onLinkClick} />
  } else if (panelLabel === 'Company') {
    inner = <CompanyPanel entry={entry} onLinkClick={onLinkClick} />
  } else {
    inner = <DefaultPanel entry={entry} onLinkClick={onLinkClick} />
  }

  return (
    <div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'fixed left-1/2 top-[72px] z-30 w-screen -translate-x-1/2',
        'border-t border-border bg-card text-foreground shadow-lg',
        'duration-200 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none',
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {inner}
      </div>
    </div>
  )
}

// ─── Shared: small editorial link column ─────────────────────────────────────

function LinkColumn({
  heading,
  links,
  panel,
  onLinkClick,
  className,
}: {
  heading: string
  links: { label: string; href: string }[]
  panel: string
  onLinkClick: (panel: string, label: string) => void
  className?: string
}) {
  return (
    <div className={cn('min-w-[144px]', className)}>
      <Eyebrow as="h3" className="mb-2.5 font-semibold text-foreground/60">
        {heading}
      </Eyebrow>
      <ul className="flex flex-col gap-0.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={() => onLinkClick(panel, link.label)}
              className={cn(
                'block py-1.5 text-[15px] text-foreground/90 transition-colors',
                'hover:text-primary hover:underline underline-offset-4',
                'focus-visible:outline-none focus-visible:text-primary focus-visible:underline',
                'motion-reduce:transition-none',
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Homes panel ─────────────────────────────────────────────────────────────
// Left: curated browse links with live drop count. Right: editorial biggest-drop strip.

function HomesPanel({
  entry,
  navData,
  onLinkClick,
}: {
  entry: MenuEntry
  navData: NavData
  onLinkClick: (panel: string, label: string) => void
}) {
  const { topDrop, dropCount } = navData
  const panel = 'Homes'

  const browseCol = entry.columns[0]
  const priceCol = entry.columns[2]
  const lifestyleCol = entry.columns[3]

  return (
    <div className="flex gap-10 lg:gap-14">
      {/* Left: editorial link columns */}
      <div className="flex flex-1 flex-wrap gap-x-8 gap-y-6">
        {browseCol && (
          <div className="min-w-[152px]">
            <Eyebrow as="h3" className="mb-2.5 font-semibold text-foreground/60">
              {browseCol.heading}
            </Eyebrow>
            <ul className="flex flex-col gap-0.5">
              {browseCol.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => onLinkClick(panel, link.label)}
                    className={cn(
                      'flex items-center justify-between gap-2 py-1.5 text-[15px]',
                      'text-foreground/90 transition-colors',
                      'hover:text-primary hover:underline underline-offset-4',
                      'focus-visible:outline-none focus-visible:text-primary focus-visible:underline',
                    )}
                  >
                    <span>{link.label}</span>
                    {/* Live price-drop count badge */}
                    {link.label === 'Price drops' && dropCount > 0 && (
                      <Badge variant="default" className="tabular-nums text-[11px]">
                        {dropCount}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {priceCol && (
          <LinkColumn
            heading={priceCol.heading}
            links={priceCol.links}
            panel={panel}
            onLinkClick={onLinkClick}
          />
        )}

        {lifestyleCol && (
          <LinkColumn
            heading={lifestyleCol.heading}
            links={lifestyleCol.links}
            panel={panel}
            onLinkClick={onLinkClick}
          />
        )}
      </div>

      {/* Right: editorial price-drop strip */}
      <div className="w-72 shrink-0">
        {topDrop ? (
          <Link
            href="/price-drops"
            onClick={() => onLinkClick(panel, 'Top price drop')}
            className="group block rounded-xl overflow-hidden border border-border bg-secondary/30 hover:border-primary/20 transition-colors"
          >
            {/* Hero photo */}
            {topDrop.photoUrl && (
              <div className="relative h-36 overflow-hidden bg-muted">
                <Image
                  src={topDrop.photoUrl}
                  alt={topDrop.address}
                  fill
                  sizes="288px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                />
                {/* Drop badge */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-md bg-primary/90 backdrop-blur-sm px-2 py-1">
                  <span className="text-[11px] font-semibold text-white tabular-nums">
                    -{topDrop.pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
            {/* Caption */}
            <div className="p-4">
              <Eyebrow as="p" className="mb-1.5 text-muted-foreground">
                Biggest drop this week
              </Eyebrow>
              {/* Amboqia price — editorial moment */}
              <DisplayHeading as="p" className="text-3xl text-foreground">
                <Price value={topDrop.listPrice} />
              </DisplayHeading>
              <p className="mt-1 text-sm text-muted-foreground truncate">{topDrop.address}</p>
              {topDrop.neighborhood && (
                <p className="text-[13px] text-muted-foreground/75 truncate">{topDrop.neighborhood}</p>
              )}
              <p className="mt-2.5 text-[13px] font-medium text-primary group-hover:underline underline-offset-4">
                {dropCount > 0 ? `See all ${dropCount} price drops` : 'See all price drops'} →
              </p>
            </div>
          </Link>
        ) : (
          <div className="rounded-xl border border-border bg-secondary/30 p-5">
            <Eyebrow as="p" className="mb-2 text-muted-foreground">Buyers</Eyebrow>
            <p className="font-display text-lg leading-snug text-foreground">
              Be first to new listings
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Get homes that match your search the moment they hit the market.
            </p>
            <CTAButton href="/lp/buyer-listing-alerts" tone="primary" size="sm" className="mt-4 w-full">
              Get listing alerts
            </CTAButton>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Areas panel (the showpiece) ──────────────────────────────────────────────
// Two-column editorial index: name + live median + active count.
// Nobody else does this in their nav — the data advantage made visible.

function AreaRow({
  row,
  panel,
  onLinkClick,
}: {
  row: AreaPulseRow
  panel: string
  onLinkClick: (panel: string, label: string) => void
}) {
  return (
    <li>
      <Link
        href={row.href}
        onClick={() => onLinkClick(panel, row.label)}
        className={cn(
          'flex items-center justify-between gap-3 rounded-md px-2 py-2',
          'text-[14px] text-foreground/90 transition-colors',
          'hover:bg-secondary/60 hover:text-foreground',
          'focus-visible:outline-none focus-visible:bg-secondary/60',
        )}
      >
        <span className="font-medium truncate">{row.label}</span>
        <span className="flex items-center gap-3 shrink-0 tabular-nums text-[13px] text-muted-foreground">
          {row.medianListPrice != null && (
            <span>
              <Price value={row.medianListPrice} compact />
            </span>
          )}
          {row.activeCount != null && (
            <span className="text-muted-foreground/70">
              <TabularNumber value={row.activeCount} /> active
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

// Static fallback rows used when live data is unavailable
const FALLBACK_CITY_ROWS: AreaPulseRow[] = [
  { slug: 'bend', label: 'Bend', href: '/cities/bend', activeCount: null, medianListPrice: null },
  { slug: 'redmond', label: 'Redmond', href: '/cities/redmond', activeCount: null, medianListPrice: null },
  { slug: 'sisters', label: 'Sisters', href: '/cities/sisters', activeCount: null, medianListPrice: null },
  { slug: 'sunriver', label: 'Sunriver', href: '/cities/sunriver', activeCount: null, medianListPrice: null },
  { slug: 'la-pine', label: 'La Pine', href: '/cities/la-pine', activeCount: null, medianListPrice: null },
  { slug: 'prineville', label: 'Prineville', href: '/cities/prineville', activeCount: null, medianListPrice: null },
  { slug: 'terrebonne', label: 'Terrebonne', href: '/cities/terrebonne', activeCount: null, medianListPrice: null },
  { slug: 'powell-butte', label: 'Powell Butte', href: '/cities/powell-butte', activeCount: null, medianListPrice: null },
]

function AreasPanel({
  navData,
  onLinkClick,
}: {
  entry: MenuEntry
  navData: NavData
  onLinkClick: (panel: string, label: string) => void
}) {
  const panel = 'Explore'
  const { cityRows, communityRows } = navData

  const displayCityRows = cityRows.length > 0 ? cityRows : FALLBACK_CITY_ROWS

  const golfCommunities = communityRows.filter((r) =>
    ['tetherow', 'pronghorn', 'broken-top', 'widgi-creek', 'awbrey-glen'].includes(r.slug)
  )
  const resortCommunities = communityRows.filter((r) =>
    ['eagle-crest', 'brasada-ranch', 'black-butte-ranch', 'sunriver', 'caldera-springs', 'crosswater'].includes(r.slug)
  )
  const bendNeighborhoods = communityRows.filter((r) =>
    ['northwest-crossing', 'bend-awbrey-butte', 'bend-old-bend', 'bend-old-mill-district'].includes(r.slug)
  )

  const hasLiveData = cityRows.some((r) => r.activeCount != null || r.medianListPrice != null)

  return (
    <div className="flex gap-8 lg:gap-12">
      {/* Left column: cities editorial index */}
      <div className="min-w-[240px] flex-1 max-w-[280px]">
        <div className="flex items-center justify-between mb-3">
          <Eyebrow as="h3" className="font-semibold text-foreground/60">
            Cities
          </Eyebrow>
          {/* Column headers for the tabular data */}
          {hasLiveData && (
            <span className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground/60 tabular-nums pr-2">
              <span className="w-12 text-right">median</span>
              <span className="w-14 text-right">active</span>
            </span>
          )}
        </div>
        <ul className="space-y-px">
          {displayCityRows.map((row) => (
            <AreaRow key={row.slug} row={row} panel={panel} onLinkClick={onLinkClick} />
          ))}
          <li className="pt-1">
            <Link
              href="/cities"
              onClick={() => onLinkClick(panel, 'See all cities')}
              className="block px-2 py-1.5 text-[13px] font-medium text-primary hover:underline underline-offset-4 transition-colors"
            >
              See all cities →
            </Link>
          </li>
        </ul>
      </div>

      {/* Middle column: communities */}
      <div className="flex flex-col gap-5 min-w-[180px]">
        {golfCommunities.length > 0 && (
          <div>
            <Eyebrow as="h3" className="mb-2.5 font-semibold text-foreground/60">
              Golf communities
            </Eyebrow>
            <ul className="space-y-px">
              {golfCommunities.map((row) => (
                <AreaRow key={row.slug} row={row} panel={panel} onLinkClick={onLinkClick} />
              ))}
            </ul>
          </div>
        )}
        {resortCommunities.length > 0 && (
          <div>
            <Eyebrow as="h3" className="mb-2.5 font-semibold text-foreground/60">
              Resort communities
            </Eyebrow>
            <ul className="space-y-px">
              {resortCommunities.map((row) => (
                <AreaRow key={row.slug} row={row} panel={panel} onLinkClick={onLinkClick} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Right column: Bend neighborhoods + explore CTA */}
      <div className="flex flex-col gap-5 min-w-[160px]">
        {bendNeighborhoods.length > 0 && (
          <div>
            <Eyebrow as="h3" className="mb-2.5 font-semibold text-foreground/60">
              Bend neighborhoods
            </Eyebrow>
            <ul className="space-y-px">
              {bendNeighborhoods.map((row) => (
                <AreaRow key={row.slug} row={row} panel={panel} onLinkClick={onLinkClick} />
              ))}
            </ul>
          </div>
        )}

        {/* Explore CTA card */}
        <div className="rounded-xl border border-border bg-secondary/30 p-4 mt-auto">
          <div className="flex items-start gap-2 mb-2">
            <MapPinIcon className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />
            <p className="text-[13px] font-medium text-foreground">
              Central Oregon, end to end
            </p>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
            Cities, golf resorts, and Bend neighborhoods.
          </p>
          <Link
            href="/communities"
            onClick={() => onLinkClick(panel, 'Browse all communities')}
            className="block text-[13px] font-medium text-primary hover:underline underline-offset-4"
          >
            Browse all communities →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Market panel ─────────────────────────────────────────────────────────────
// Left: market links. Right: mini live region band.

function MarketPanel({
  entry,
  navData,
  onLinkClick,
}: {
  entry: MenuEntry
  navData: NavData
  onLinkClick: (panel: string, label: string) => void
}) {
  const panel = 'Market'
  const { regionActive, regionMedian, dropCount } = navData

  return (
    <div className="flex gap-10 lg:gap-14">
      <div className="flex flex-1 flex-wrap gap-x-8 gap-y-6">
        {entry.columns.map((col) => (
          <LinkColumn
            key={col.heading}
            heading={col.heading}
            links={col.links}
            panel={panel}
            onLinkClick={onLinkClick}
          />
        ))}
      </div>

      <aside className="w-64 shrink-0">
        <div className="rounded-xl border border-border bg-secondary/30 p-5">
          <Eyebrow as="p" className="mb-3 text-muted-foreground">
            Central Oregon right now
          </Eyebrow>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2 border-b border-border pb-3">
              <span className="text-[13px] text-muted-foreground">Median price</span>
              <DisplayHeading as="p" className="text-xl text-foreground">
                <Price value={regionMedian} />
              </DisplayHeading>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <span className="text-[13px] text-muted-foreground">Active homes</span>
              <span className="text-lg font-semibold tabular-nums text-foreground">
                <TabularNumber value={regionActive} />
              </span>
            </div>
            {dropCount > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">Price drops this week</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  <TabularNumber value={dropCount} />
                </span>
              </div>
            )}
          </div>
          <CTAButton
            href="/housing-market"
            tone="primary"
            size="sm"
            className="mt-4 w-full"
            onClick={() => onLinkClick(panel, 'Market overview')}
          >
            Full market overview
          </CTAButton>
        </div>
      </aside>
    </div>
  )
}

// ─── Sell panel ───────────────────────────────────────────────────────────────
// Valuation CTA is the hero moment — the money path.

function SellPanel({
  entry,
  onLinkClick,
}: {
  entry: MenuEntry
  onLinkClick: (panel: string, label: string) => void
}) {
  const panel = 'Sell'

  return (
    <div className="flex gap-10 lg:gap-14">
      <div className="flex flex-1 flex-wrap gap-x-8 gap-y-6">
        {entry.columns.map((col) => (
          <LinkColumn
            key={col.heading}
            heading={col.heading}
            links={col.links}
            panel={panel}
            onLinkClick={onLinkClick}
          />
        ))}
      </div>

      <aside className="w-64 shrink-0">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <Eyebrow as="p" className="mb-2 text-primary/70">
            Sellers
          </Eyebrow>
          <DisplayHeading as="p" className="text-xl leading-snug text-foreground">
            What is your home worth?
          </DisplayHeading>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            Get a free valuation from a local broker, without the high pressure.
          </p>
          <CTAButton
            href="/lp/seller-home-value"
            tone="primary"
            size="sm"
            className="mt-4 w-full"
            onClick={() => onLinkClick(panel, 'Free home valuation')}
          >
            Free home valuation
          </CTAButton>
          <p className="mt-2 text-center text-[12px] text-muted-foreground">
            No obligation. No pressure.
          </p>
        </div>
      </aside>
    </div>
  )
}

// ─── Company panel ────────────────────────────────────────────────────────────
// Broker headshots (transparent PNGs floating over cream) + links.

function CompanyPanel({
  entry,
  onLinkClick,
}: {
  entry: MenuEntry
  onLinkClick: (panel: string, label: string) => void
}) {
  const panel = 'Company'

  const brokers = [
    { name: 'Matt Ryan', role: 'Principal Broker', src: '/images/brokers/ryan-matt.png' },
    { name: 'Rebecca Peterson', role: 'Broker', src: '/images/brokers/peterson-rebecca.png' },
    { name: 'Paul Stevenson', role: 'Broker', src: '/images/brokers/stevenson-paul.png' },
  ]

  return (
    <div className="flex gap-10 lg:gap-14">
      <div className="flex flex-1 flex-wrap gap-x-8 gap-y-6">
        {entry.columns.map((col) => (
          <LinkColumn
            key={col.heading}
            heading={col.heading}
            links={col.links}
            panel={panel}
            onLinkClick={onLinkClick}
          />
        ))}
      </div>

      <aside className="w-72 shrink-0">
        <Eyebrow as="p" className="mb-3 text-muted-foreground">
          The team
        </Eyebrow>
        {/* Transparent headshots floating over the panel background */}
        <div className="flex items-end gap-0">
          {brokers.map((broker) => (
            <Link
              key={broker.name}
              href="/team"
              onClick={() => onLinkClick(panel, broker.name)}
              className="group flex flex-1 flex-col items-center text-center"
            >
              <div className="relative w-20 h-24 overflow-hidden">
                <Image
                  src={broker.src}
                  alt={broker.name}
                  fill
                  sizes="80px"
                  className="object-contain object-bottom"
                />
              </div>
              <p className="mt-1.5 text-[12px] font-semibold text-foreground group-hover:text-primary transition-colors">
                {broker.name.split(' ')[0]}
              </p>
              <p className="text-[11px] text-muted-foreground">{broker.role}</p>
            </Link>
          ))}
        </div>
        <Link
          href="/team"
          onClick={() => onLinkClick(panel, 'Meet the team')}
          className="mt-4 block text-[13px] font-medium text-primary hover:underline underline-offset-4"
        >
          Meet the team →
        </Link>
      </aside>
    </div>
  )
}

// ─── Default panel (Learn + any future parent) ────────────────────────────────

function DefaultPanel({
  entry,
  onLinkClick,
}: {
  entry: MenuEntry
  onLinkClick: (panel: string, label: string) => void
}) {
  const panel = entry.label
  const promo = entry.promo

  return (
    <div className="flex gap-10 lg:gap-14">
      <div className="flex flex-1 flex-wrap gap-x-8 gap-y-6">
        {entry.columns.map((col) => (
          <LinkColumn
            key={col.heading}
            heading={col.heading}
            links={col.links}
            panel={panel}
            onLinkClick={onLinkClick}
          />
        ))}
      </div>

      {promo && (
        <aside className="w-60 shrink-0">
          <div className="rounded-xl border border-border bg-secondary/40 p-5">
            <Eyebrow as="p" className="mb-2 text-muted-foreground">
              {promo.eyebrow}
            </Eyebrow>
            <p className="font-display text-lg leading-snug text-foreground">
              {promo.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {promo.body}
            </p>
            <CTAButton
              href={promo.ctaHref}
              tone="primary"
              size="sm"
              className="mt-4 w-full"
              onClick={() => onLinkClick(panel, promo.ctaLabel)}
            >
              {promo.ctaLabel}
            </CTAButton>
          </div>
        </aside>
      )}
    </div>
  )
}
