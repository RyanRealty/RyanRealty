import Link from 'next/link'
import { CTAButton, RyanRealtyMark } from '@/components/site/primitives'
import MobileNav from '@/components/site/MobileNav'
import { PRIMARY_NAV } from '@/lib/site-nav'
import {
  CITY_POPULAR_SEARCHES,
  getPopularSearchesForCity,
  getAllCityHomesLink,
} from '@/lib/popular-searches'

/**
 * SiteHeader — sticky navy bar with the design-system nav. NO shadcn.
 *
 * Desktop (md+): top-level links. Most groups with children open a plain CSS
 * hover dropdown (group-hover). The "Homes" group opens a STYLIZED MEGA-MENU —
 * a wide panel broken out by city in columns, with an "All [City] homes" link
 * and that city's top popular searches under each, plus a "Browse" column. The
 * per-city data comes from lib/popular-searches.ts (single source of truth,
 * data-grounded). The pt-2 on each panel is the hover bridge so moving the
 * cursor from the trigger into the panel does not close it.
 *
 * Mobile: MobileNav drawer (accordion) — unchanged, reads the same PRIMARY_NAV.
 *
 * The whole nav structure comes from lib/site-nav.ts (single source of truth),
 * so users AND crawlers reach every section. Enforced by check-nav-reachability.
 */

const DROPDOWN_GROUPS = new Set(['Communities', 'Cities', 'Market', 'Sell', 'Company', 'Learn'])

const chevron = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="opacity-60">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

// The cities surfaced as columns in the mega-menu, in priority order. The first
// six get a column each (top ~6 popular searches); the rest are linked compactly
// in the Browse column so every city hub stays reachable.
const MEGA_COLUMN_CITIES = ['bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'prineville']
const MEGA_OVERFLOW_CITIES = CITY_POPULAR_SEARCHES
  .map((c) => c.citySlug)
  .filter((slug) => !MEGA_COLUMN_CITIES.includes(slug))

function HomesMegaMenu() {
  return (
    <div className="group/nav relative">
      <Link
        href="/homes-for-sale"
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white group-hover/nav:bg-white/10 group-hover/nav:text-white"
      >
        Homes
        {chevron}
      </Link>
      <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-opacity duration-150 group-hover/nav:visible group-hover/nav:opacity-100 group-focus-within/nav:visible group-focus-within/nav:opacity-100">
        <div className="w-[min(92vw,960px)] rounded-xl bg-card p-6 text-foreground shadow-lg ring-1 ring-border">
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
            {MEGA_COLUMN_CITIES.map((citySlug) => {
              const allLink = getAllCityHomesLink(citySlug)
              const popular = getPopularSearchesForCity(citySlug, 6)
              if (!allLink) return null
              return (
                <div key={citySlug} className="min-w-0">
                  <Link
                    href={allLink.href}
                    className="block truncate rounded-md py-1 font-display text-sm font-semibold text-primary transition hover:text-primary/80"
                  >
                    {allLink.label}
                  </Link>
                  <ul className="mt-1.5 space-y-0.5">
                    {popular.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="block truncate rounded-md px-2 py-1 text-sm text-foreground/80 transition hover:bg-muted hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div>
              <p className="font-display text-sm font-semibold text-primary">Browse</p>
              <ul className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
                <li>
                  <Link href="/homes-for-sale" className="block rounded-md px-2 py-1 text-sm text-foreground/80 transition hover:bg-muted hover:text-foreground">
                    All homes for sale
                  </Link>
                </li>
                <li>
                  <Link href="/search" className="block rounded-md px-2 py-1 text-sm text-foreground/80 transition hover:bg-muted hover:text-foreground">
                    Map search
                  </Link>
                </li>
                <li>
                  <Link href="/open-houses" className="block rounded-md px-2 py-1 text-sm text-foreground/80 transition hover:bg-muted hover:text-foreground">
                    Open houses
                  </Link>
                </li>
                <li>
                  <Link href="/compare" className="block rounded-md px-2 py-1 text-sm text-foreground/80 transition hover:bg-muted hover:text-foreground">
                    Compare homes
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-primary">More cities</p>
              <ul className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
                {MEGA_OVERFLOW_CITIES.map((citySlug) => {
                  const allLink = getAllCityHomesLink(citySlug)
                  if (!allLink) return null
                  return (
                    <li key={citySlug}>
                      <Link
                        href={allLink.href}
                        className="block truncate rounded-md px-2 py-1 text-sm text-foreground/80 transition hover:bg-muted hover:text-foreground"
                      >
                        {allLink.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-primary text-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Ryan Realty home" className="shrink-0">
          <RyanRealtyMark variant="horizontal" tone="white" width={140} priority className="h-8 w-auto" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
          {PRIMARY_NAV.map((group) => {
            // The "Homes" group is the stylized mega-menu (special-cased).
            if (group.label === 'Homes') {
              return <HomesMegaMenu key={group.label} />
            }
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
                  {chevron}
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
