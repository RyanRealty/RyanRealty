'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CTAButton, IconButton, RyanRealtyMark, Eyebrow, Price, TabularNumber } from '@/components/site/primitives'
import { Badge } from '@/components/ui/badge'
import { trackEvent } from '@/lib/tracking'
import type { MenuEntry, NavData } from '@/lib/site-menu'
import { cn } from '@/lib/utils'

/**
 * MobileNav — hamburger + slide-out drawer for sub-md viewports.
 *
 * CLIENT component (Sheet needs client interactivity). Accepts the same
 * navData the desktop mega-menu uses so mobile visitors see the same live
 * area counts and price-drop badge as desktop.
 *
 * Layout: each MENU parent becomes a collapsible Accordion section.
 * Within the Explore section, city rows show live median + active count
 * in small tabular numerals — same editorial language as the desktop panel.
 */

export default function MobileNav({
  menu,
  navData,
}: {
  menu: MenuEntry[]
  navData: NavData
}) {
  const [open, setOpen] = useState(false)

  function close() { setOpen(false) }

  function handleLinkClick(panel: string, label: string) {
    trackEvent('nav_interact', { action: 'link_click', panel, label, source: 'mobile' })
    close()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton
          tone="on-navy-ghost"
          size={36}
          aria-label="Open navigation menu"
          className="md:hidden"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden />
        </IconButton>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-[88%] max-w-[380px] flex-col bg-background p-0"
      >
        {/* Drawer header */}
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <RyanRealtyMark width={140} tone="navy" />
          <button
            type="button"
            onClick={close}
            aria-label="Close navigation menu"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-[10px]',
              'text-foreground transition hover:bg-muted',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30',
            )}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden />
          </button>
        </SheetHeader>

        {/* Scrollable nav body */}
        <nav
          aria-label="Mobile primary"
          className="flex-1 overflow-y-auto px-3 py-2"
        >
          <Accordion type="multiple" className="w-full">
            {menu.map((entry) => (
              <AccordionItem
                key={entry.label}
                value={entry.label}
                className="border-b border-border"
              >
                <AccordionTrigger
                  className={cn(
                    'rounded-md px-3 py-3 text-base font-semibold text-foreground',
                    'hover:bg-muted hover:no-underline',
                    '[&>svg]:text-muted-foreground',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {entry.label}
                    {/* Price-drop badge on the Homes trigger */}
                    {entry.label === 'Homes' && navData.dropCount > 0 && (
                      <Badge variant="default" className="tabular-nums text-[11px]">
                        {navData.dropCount}
                      </Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-1 pt-0">
                  {entry.label === 'Explore' ? (
                    /* Explore: city rows with live counts */
                    <MobileCityIndex navData={navData} onLinkClick={handleLinkClick} />
                  ) : (
                    /* All other sections: standard column layout */
                    entry.columns.map((column) => (
                      <div key={column.heading} className="pb-1">
                        <Eyebrow as="p" className="px-6 pt-2 pb-1 text-muted-foreground">
                          {column.heading}
                        </Eyebrow>
                        <ul className="flex flex-col gap-0.5">
                          {column.links.map((link) => (
                            <li key={link.href}>
                              <Link
                                href={link.href}
                                onClick={() => handleLinkClick(entry.label, link.label)}
                                className={cn(
                                  'block rounded-md px-6 py-2 text-sm text-muted-foreground no-underline',
                                  'transition hover:bg-muted hover:text-foreground',
                                )}
                              >
                                {link.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </nav>

        {/* Pinned CTAs */}
        <div className="flex flex-col gap-2 border-t border-border px-5 py-5">
          <CTAButton
            href="/lp/seller-home-value"
            tone="primary"
            size="md"
            className="w-full"
          >
            List your home
          </CTAButton>
          <CTAButton
            href="/login"
            tone="outline"
            size="md"
            className="w-full"
          >
            Sign in
          </CTAButton>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Mobile city index (editorial rows with live data) ────────────────────────

function MobileCityIndex({
  navData,
  onLinkClick,
}: {
  navData: NavData
  onLinkClick: (panel: string, label: string) => void
}) {
  const { cityRows, communityRows } = navData

  const displayCityRows = cityRows.length > 0 ? cityRows : [
    { slug: 'bend', label: 'Bend', href: '/cities/bend', activeCount: null, medianListPrice: null },
    { slug: 'redmond', label: 'Redmond', href: '/cities/redmond', activeCount: null, medianListPrice: null },
    { slug: 'sisters', label: 'Sisters', href: '/cities/sisters', activeCount: null, medianListPrice: null },
    { slug: 'sunriver', label: 'Sunriver', href: '/cities/sunriver', activeCount: null, medianListPrice: null },
    { slug: 'la-pine', label: 'La Pine', href: '/cities/la-pine', activeCount: null, medianListPrice: null },
    { slug: 'prineville', label: 'Prineville', href: '/cities/prineville', activeCount: null, medianListPrice: null },
  ]

  const communityList = communityRows.length > 0 ? communityRows : [
    { slug: 'tetherow', label: 'Tetherow', href: '/communities/tetherow', activeCount: null, medianListPrice: null },
    { slug: 'pronghorn', label: 'Pronghorn', href: '/communities/pronghorn', activeCount: null, medianListPrice: null },
    { slug: 'eagle-crest', label: 'Eagle Crest', href: '/communities/eagle-crest', activeCount: null, medianListPrice: null },
    { slug: 'black-butte-ranch', label: 'Black Butte Ranch', href: '/communities/black-butte-ranch', activeCount: null, medianListPrice: null },
    { slug: 'brasada-ranch', label: 'Brasada Ranch', href: '/communities/brasada-ranch', activeCount: null, medianListPrice: null },
    { slug: 'northwest-crossing', label: 'NorthWest Crossing', href: '/communities/northwest-crossing', activeCount: null, medianListPrice: null },
  ]

  return (
    <div className="pb-1">
      <Eyebrow as="p" className="px-6 pt-2 pb-1 text-muted-foreground">
        Cities
      </Eyebrow>
      <ul className="flex flex-col">
        {displayCityRows.map((row) => (
          <li key={row.slug}>
            <Link
              href={row.href}
              onClick={() => onLinkClick('Explore', row.label)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md px-6 py-2.5',
                'text-sm text-muted-foreground no-underline',
                'transition hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="font-medium">{row.label}</span>
              {/* Live stats on mobile too — same editorial language */}
              <span className="flex items-center gap-2 tabular-nums text-[12px] text-muted-foreground/70 shrink-0">
                {row.medianListPrice != null && (
                  <Price value={row.medianListPrice} compact />
                )}
                {row.activeCount != null && (
                  <span>
                    <TabularNumber value={row.activeCount} /> active
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Eyebrow as="p" className="px-6 pt-3 pb-1 text-muted-foreground">
        Communities
      </Eyebrow>
      <ul className="flex flex-col gap-0.5">
        {communityList.map((row) => (
          <li key={row.slug}>
            <Link
              href={row.href}
              onClick={() => onLinkClick('Explore', row.label)}
              className={cn(
                'block rounded-md px-6 py-2 text-sm text-muted-foreground no-underline',
                'transition hover:bg-muted hover:text-foreground',
              )}
            >
              {row.label}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/communities"
            onClick={() => onLinkClick('Explore', 'All communities')}
            className={cn(
              'block rounded-md px-6 py-2 text-sm font-medium text-primary no-underline',
              'transition hover:bg-muted',
            )}
          >
            Browse all communities →
          </Link>
        </li>
      </ul>
    </div>
  )
}
