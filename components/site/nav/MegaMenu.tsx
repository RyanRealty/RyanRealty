'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
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
import type { MenuEntry, NavData } from '@/lib/site-menu'

/**
 * MegaMenu — the EDITORIAL mega-menu (Experience System 2026-06-09 directive).
 *
 * Top-level nav: Homes · Sell · Market · Guides · About
 *
 * - Homes: merged browse/cities/communities/price/lifestyle columns with live
 *   drop count badge + editorial biggest-drop strip on the right
 * - Market: link columns + mini live region band (median/active/drops)
 * - Sell: valuation CTA prominent — the money path
 * - About: three transparent-PNG broker headshots, floating over cream
 * - Guides: clean editorial columns
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
  } else if (panelLabel === 'Market') {
    inner = <MarketPanel entry={entry} navData={navData} onLinkClick={onLinkClick} />
  } else if (panelLabel === 'Sell') {
    inner = <SellPanel entry={entry} onLinkClick={onLinkClick} />
  } else if (panelLabel === 'About') {
    inner = <AboutPanel entry={entry} onLinkClick={onLinkClick} />
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
  dropCount,
}: {
  heading: string
  links: { label: string; href: string }[]
  panel: string
  onLinkClick: (panel: string, label: string) => void
  className?: string
  /** When provided, attaches a live badge to the "Price drops" link. */
  dropCount?: number
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
                'flex items-center justify-between gap-2 py-1.5 text-[15px] text-foreground/90 transition-colors',
                'hover:text-primary hover:underline underline-offset-4',
                'focus-visible:outline-none focus-visible:text-primary focus-visible:underline',
                'motion-reduce:transition-none',
              )}
            >
              <span>{link.label}</span>
              {/* Live price-drop count badge on the "Price drops" link */}
              {link.label === 'Price drops' && dropCount != null && dropCount > 0 && (
                <Badge variant="default" className="tabular-nums text-[11px]">
                  {dropCount}
                </Badge>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Homes panel ──────────────────────────────────────────────────────────────
// Merged Homes + Explore. All 5 link columns rendered left-to-right, then
// the live price-drop strip on the right.

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

  return (
    <div className="flex gap-10 lg:gap-14">
      {/* Left: all editorial link columns */}
      <div className="flex flex-1 flex-wrap gap-x-8 gap-y-6">
        {entry.columns.map((col) => (
          <LinkColumn
            key={col.heading}
            heading={col.heading}
            links={col.links}
            panel={panel}
            onLinkClick={onLinkClick}
            dropCount={dropCount}
          />
        ))}
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

// ─── About panel ──────────────────────────────────────────────────────────────
// Broker headshots (transparent PNGs floating over cream) + links.

function AboutPanel({
  entry,
  onLinkClick,
}: {
  entry: MenuEntry
  onLinkClick: (panel: string, label: string) => void
}) {
  const panel = 'About'

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

// ─── Default panel (Guides + any future parent) ───────────────────────────────

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
