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
import { CTAButton, IconButton, RyanRealtyMark, Price, TabularNumber } from '@/components/site/primitives'
import { PRIMARY_NAV } from '@/lib/site-nav'
import type { MegaMenuData } from '@/lib/data'
import { cn } from '@/lib/utils'

/**
 * MobileNav — hamburger + slide-out drawer for sub-md viewports.
 *
 * CLIENT component (Sheet needs client interactivity). It receives the mega-menu
 * data as a plain serializable prop from the SERVER SiteHeader — no fetching
 * happens here. Every nav group from lib/site-nav.ts renders as a collapsible
 * Accordion section, each enriched with a compact inline preview (a key stat, a
 * few links, one featured item) drawn from the mega data, on top of the existing
 * child links so every section stays reachable on one thumb at 390px.
 *
 * Every stat is null-guarded — a null stat renders nothing, never a 0.
 *
 * Primitives used:
 *   - IconButton for the hamburger trigger
 *   - RyanRealtyMark wordmark inside the drawer header
 *   - CTAButton for the in-drawer CTAs
 *   - Price / TabularNumber for the inline stat previews
 *   - shadcn Sheet for the drawer chrome
 *   - shadcn Accordion for collapsible group sections
 */

const VERDICT_LABEL: Record<NonNullable<MegaMenuData['market']['marketVerdict']>, string> = {
  sellers: "Seller's market",
  balanced: 'Balanced market',
  buyers: "Buyer's market",
}

/** A compact stat chip row — renders nothing if there is nothing to show. */
function PreviewChips({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5 px-6 pb-2">{children}</div>
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[12px] font-medium tabular-nums text-foreground">
      {children}
    </span>
  )
}

export default function MobileNav({ mega }: { mega: MegaMenuData }) {
  const [open, setOpen] = useState(false)

  function close() {
    setOpen(false)
  }

  /** The compact preview block for one parent label. Null = no preview. */
  function previewFor(label: string): React.ReactNode {
    switch (label) {
      case 'Homes': {
        const total = mega.homes.totalActiveCount
        if (total == null) return null
        return (
          <PreviewChips>
            <Chip>
              <TabularNumber value={total} />
              <span className="ml-1 font-normal text-muted-foreground">active homes</span>
            </Chip>
          </PreviewChips>
        )
      }
      case 'Communities': {
        const featured = mega.communities.communities.find(
          (c) => c.activeCount != null || c.medianListPrice != null,
        )
        if (!featured) return null
        return (
          <PreviewChips>
            <Chip>{featured.name}</Chip>
            {featured.activeCount != null && (
              <Chip>
                <TabularNumber value={featured.activeCount} />
                <span className="ml-1 font-normal text-muted-foreground">active</span>
              </Chip>
            )}
          </PreviewChips>
        )
      }
      case 'Cities': {
        const lead = mega.cities.cities.find((c) => c.medianListPrice != null || c.activeCount != null)
        if (!lead) return null
        return (
          <PreviewChips>
            <Chip>{lead.name}</Chip>
            {lead.medianListPrice != null && (
              <Chip>
                <Price value={lead.medianListPrice} compact />
                <span className="ml-1 font-normal text-muted-foreground">median</span>
              </Chip>
            )}
          </PreviewChips>
        )
      }
      case 'Market': {
        const m = mega.market
        if (m.medianListPrice == null && m.marketVerdict == null && m.monthsOfSupply == null) {
          return null
        }
        return (
          <PreviewChips>
            {m.marketVerdict != null && <Chip>{VERDICT_LABEL[m.marketVerdict]}</Chip>}
            {m.medianListPrice != null && (
              <Chip>
                <Price value={m.medianListPrice} compact />
                <span className="ml-1 font-normal text-muted-foreground">median</span>
              </Chip>
            )}
            {m.monthsOfSupply != null && (
              <Chip>
                <TabularNumber value={m.monthsOfSupply} fractionDigits={1} />
                <span className="ml-1 font-normal text-muted-foreground">mo. supply</span>
              </Chip>
            )}
          </PreviewChips>
        )
      }
      case 'Sell': {
        const s = mega.sell
        if (s.medianListPrice == null && s.marketVerdict == null) return null
        return (
          <PreviewChips>
            {s.marketVerdict != null && <Chip>{VERDICT_LABEL[s.marketVerdict]}</Chip>}
            {s.medianListPrice != null && (
              <Chip>
                <Price value={s.medianListPrice} compact />
                <span className="ml-1 font-normal text-muted-foreground">median</span>
              </Chip>
            )}
          </PreviewChips>
        )
      }
      case 'Learn': {
        const lead = mega.learn.guides[0]
        if (!lead) return null
        return (
          <div className="px-6 pb-2">
            <Link
              href={lead.href}
              onClick={close}
              className="block truncate rounded-md text-[13px] font-medium text-foreground underline-offset-2 transition hover:underline"
            >
              {mega.learn.isLive ? 'Latest: ' : ''}
              {lead.title}
            </Link>
          </div>
        )
      }
      default:
        return null
    }
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
            {PRIMARY_NAV.map((group) => {
              const preview = previewFor(group.label)
              return (
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
                    {preview}
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
              )
            })}
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
