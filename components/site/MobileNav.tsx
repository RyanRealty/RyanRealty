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
import { CTAButton, IconButton, RyanRealtyMark } from '@/components/site/primitives'

/**
 * MobileNav — hamburger + slide-out drawer for sub-md viewports.
 *
 * Pairs with the desktop nav inside SiteHeader. The hamburger is the
 * only visible piece below md; above md the desktop nav handles
 * everything. The drawer carries the same 5 nav links + the same
 * Sign in / List your home CTAs, sized for one-thumb operation.
 *
 * Wired to the canonical primitives:
 *   - IconButton for the hamburger trigger
 *   - RyanRealtyMark wordmark inside the drawer header
 *   - CTAButton for the in-drawer Sign in / List your home actions
 *   - shadcn Sheet for the drawer chrome
 */

const NAV_LINKS = [
  { href: '/homes-for-sale', label: 'Search' },
  { href: '/communities', label: 'Communities' },
  { href: '/housing-market', label: 'Market' },
  { href: '/team', label: 'Meet the Team' },
  { href: '/sell', label: 'Sell' },
] as const

export default function MobileNav() {
  const [open, setOpen] = useState(false)
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
        className="w-[88%] max-w-[360px] bg-background p-0"
      >
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <RyanRealtyMark width={140} tone="navy" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden />
          </button>
        </SheetHeader>
        <nav aria-label="Mobile primary" className="flex flex-col gap-1 px-3 py-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-3 text-base font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-border px-5 py-5">
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
