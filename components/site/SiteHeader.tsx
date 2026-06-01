import Link from 'next/link'
import { CTAButton, RyanRealtyMark } from '@/components/site/primitives'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import MobileNav from '@/components/site/MobileNav'
import { PRIMARY_NAV } from '@/lib/site-nav'
import { cn } from '@/lib/utils'

/**
 * SiteHeader — sticky navy mega-menu for desktop (md+), hamburger for mobile.
 *
 * Desktop: uses shadcn NavigationMenu to render dropdown panels for Buy,
 * Communities, Cities, Market, Sell, and Company groups. Each panel lists
 * the full set of child links from lib/site-nav.ts so every section is
 * crawlable by search engines via the rendered anchor tags.
 *
 * Mobile: delegates to MobileNav (Sheet + Accordion).
 *
 * Tokens: bg-primary, text-white, border-border, bg-card — no hex colors.
 */

// Groups rendered as mega-menu dropdowns vs plain links.
// Sell and Company both have sub-pages so they get dropdowns too.
const DROPDOWN_GROUPS = new Set(['Buy', 'Communities', 'Cities', 'Market', 'Sell', 'Company', 'Learn'])

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-primary text-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Wordmark */}
        <Link href="/" aria-label="Ryan Realty home" className="shrink-0">
          <RyanRealtyMark
            variant="horizontal"
            tone="white"
            width={140}
            priority
            className="h-8 w-auto"
          />
        </Link>

        {/* Desktop mega-menu — hidden below md */}
        <nav aria-label="Primary" className="hidden md:flex">
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="gap-0">
              {PRIMARY_NAV.map((group) => {
                if (!DROPDOWN_GROUPS.has(group.label)) {
                  // Plain link for any group with no children
                  return (
                    <NavigationMenuItem key={group.label}>
                      <NavigationMenuLink asChild>
                        <Link
                          href={group.href ?? '#'}
                          className={cn(
                            'inline-flex h-9 items-center justify-center rounded-lg px-3 text-[15px] font-medium',
                            'text-white/85 transition hover:bg-white/10 hover:text-white',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                          )}
                        >
                          {group.label}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  )
                }

                return (
                  <NavigationMenuItem key={group.label}>
                    <NavigationMenuTrigger
                      className={cn(
                        'bg-transparent text-[15px] font-medium text-white/85',
                        'hover:bg-white/10 hover:text-white',
                        'data-open:bg-white/10 data-open:text-white',
                        'data-popup-open:bg-white/10 data-popup-open:text-white',
                        'focus-visible:ring-white/40 h-9 px-3',
                        '[&_svg]:text-white/60',
                      )}
                    >
                      {group.label}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent
                      className={cn(
                        'bg-card text-foreground shadow-lg ring-1 ring-border',
                        // Two-column grid for large child sets, single for small
                        group.children.length > 6
                          ? 'grid grid-cols-2 gap-x-1 w-[380px] p-2'
                          : 'flex flex-col w-[240px] p-2',
                      )}
                    >
                      {group.children.map((link) => (
                        <NavigationMenuLink key={link.href} asChild>
                          <Link
                            href={link.href}
                            className={cn(
                              'flex rounded-md px-3 py-2 text-sm text-foreground transition',
                              'hover:bg-muted hover:text-foreground',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                              // "All X" first item gets slightly stronger weight
                              link.label.startsWith('All ') && 'font-medium',
                            )}
                          >
                            {link.label}
                          </Link>
                        </NavigationMenuLink>
                      ))}
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                )
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </nav>

        {/* CTAs + mobile trigger */}
        <div className="flex items-center gap-2.5">
          <CTAButton
            href="/login"
            tone="on-navy-ghost"
            size="md"
            className="hidden sm:inline-flex"
          >
            Sign in
          </CTAButton>
          <CTAButton
            href="/lp/seller-home-value"
            tone="on-navy"
            size="md"
            className="hidden sm:inline-flex"
          >
            List your home
          </CTAButton>
          {/* Mobile hamburger — visible below md */}
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
