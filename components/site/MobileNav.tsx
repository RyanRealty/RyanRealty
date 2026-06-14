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
import { CTAButton, IconButton, RyanRealtyMark, Eyebrow } from '@/components/site/primitives'
import { Badge } from '@/components/ui/badge'
import { trackEvent } from '@/lib/tracking'
import type { MenuEntry, NavData } from '@/lib/site-menu'
import { cn } from '@/lib/utils'

/**
 * MobileNav — hamburger + slide-out drawer for sub-md viewports.
 *
 * CLIENT component (Sheet needs client interactivity). Accepts the same
 * navData the desktop mega-menu uses so mobile visitors see the same live
 * price-drop badge as desktop.
 *
 * Layout: each MENU parent becomes a collapsible Accordion section.
 * The merged Homes section renders all columns (browse, cities, communities,
 * price, lifestyle) through the standard column layout — no special-case.
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
                  {/* Standard column layout for all sections */}
                  {entry.columns.map((column) => (
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
                                'flex items-center justify-between gap-2 rounded-md px-6 py-2 text-sm text-muted-foreground no-underline',
                                'transition hover:bg-muted hover:text-foreground',
                              )}
                            >
                              <span>{link.label}</span>
                              {/* Live price-drop badge on the "Price drops" link */}
                              {link.label === 'Price drops' && navData.dropCount > 0 && (
                                <Badge variant="default" className="tabular-nums text-[11px]">
                                  {navData.dropCount}
                                </Badge>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
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
            className="w-full whitespace-nowrap"
          >
            What's my home worth?
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
