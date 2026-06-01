import Link from 'next/link'
import { CTAButton, RyanRealtyMark } from '@/components/site/primitives'
import MobileNav from '@/components/site/MobileNav'
import { PRIMARY_NAV } from '@/lib/site-nav'

/**
 * SiteHeader — sticky navy bar with the design-system nav. NO shadcn.
 *
 * Desktop (md+): top-level links; groups with children open a plain CSS
 * hover dropdown (group-hover) — wide, full-width labels (no truncation),
 * design tokens only. The pt-2 on the panel is the hover bridge so moving the
 * cursor from the trigger into the panel does not close it.
 *
 * Mobile: MobileNav drawer.
 *
 * The whole nav structure comes from lib/site-nav.ts (single source of truth),
 * so users AND crawlers reach every section. Enforced by check-nav-reachability.
 */

const DROPDOWN_GROUPS = new Set(['Buy', 'Communities', 'Cities', 'Market', 'Sell', 'Company', 'Learn'])

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-primary text-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Ryan Realty home" className="shrink-0">
          <RyanRealtyMark variant="horizontal" tone="white" width={140} priority className="h-8 w-auto" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
          {PRIMARY_NAV.map((group) => {
            const hasMenu = DROPDOWN_GROUPS.has(group.label) && group.children.length > 0
            if (!hasMenu) {
              return (
                <Link
                  key={group.label}
                  href={group.href ?? '#'}
                  className="rounded-lg px-3 py-2 text-[15px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  {group.label}
                </Link>
              )
            }
            const wide = group.children.length > 6
            return (
              <div key={group.label} className="group/nav relative">
                <Link
                  href={group.href ?? '#'}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white group-hover/nav:bg-white/10 group-hover/nav:text-white"
                >
                  {group.label}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="opacity-60">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </Link>
                <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity duration-150 group-hover/nav:visible group-hover/nav:opacity-100">
                  <div
                    className={
                      wide
                        ? 'grid w-[520px] grid-cols-2 gap-1 rounded-xl bg-card p-3 text-foreground shadow-lg ring-1 ring-border'
                        : 'flex w-[260px] flex-col gap-0.5 rounded-xl bg-card p-3 text-foreground shadow-lg ring-1 ring-border'
                    }
                  >
                    {group.children.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={
                          'block whitespace-nowrap rounded-md px-3 py-2 text-sm text-foreground/90 transition hover:bg-muted hover:text-foreground' +
                          (link.label.startsWith('All ') ? ' font-semibold text-primary' : '')
                        }
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <CTAButton href="/login" tone="on-navy-ghost" size="md" className="hidden sm:inline-flex">
            Sign in
          </CTAButton>
          <CTAButton href="/lp/seller-home-value" tone="on-navy" size="md" className="hidden sm:inline-flex">
            List your home
          </CTAButton>
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
