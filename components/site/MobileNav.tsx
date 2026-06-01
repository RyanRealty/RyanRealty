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
import { CTAButton, IconButton, RyanRealtyMark } from '@/components/site/primitives'
import { PRIMARY_NAV } from '@/lib/site-nav'
import { cn } from '@/lib/utils'

/**
 * MobileNav — hamburger + slide-out drawer for sub-md viewports.
 *
 * Every nav group from lib/site-nav.ts is rendered as a collapsible
 * Accordion section so users can reach any part of the site on one thumb.
 * CTAs (List your home / Sign in) are pinned at the bottom of the drawer.
 *
 * Primitives used:
 *   - IconButton for the hamburger trigger
 *   - RyanRealtyMark wordmark inside the drawer header
 *   - CTAButton for the in-drawer CTAs
 *   - shadcn Sheet for the drawer chrome
 *   - shadcn Accordion for collapsible group sections
 */

export default function MobileNav() {
  const [open, setOpen] = useState(false)

  function close() {
    setOpen(false)
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
            {PRIMARY_NAV.map((group) => (
              <AccordionItem
                key={group.label}
                value={group.label}
                className="border-b border-border"
              >
                <AccordionTrigger
                  className={cn(
                    'rounded-md px-3 py-3 text-base font-semibold text-foreground',
                    'hover:bg-muted hover:no-underline',
                    '[&>svg]:text-muted-foreground',
                  )}
                >
                  {group.label}
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-1 pt-0">
                  <ul className="flex flex-col gap-0.5">
                    {group.children.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={close}
                          className={cn(
                            'block rounded-md px-6 py-2 text-sm text-muted-foreground',
                            'transition hover:bg-muted hover:text-foreground',
                            link.label.startsWith('All ') && 'font-medium text-foreground',
                          )}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
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
