'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { signOut } from '@/app/actions/auth'
import type { AuthUser } from '@/app/actions/auth'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  Menu02Icon,
  Cancel01Icon,
  ArrowDown01Icon,
  MapsIcon,
} from '@hugeicons/core-free-icons'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/** Main nav: Home, Home Valuation, Buyers dropdown, Sellers dropdown, About dropdown, then Reports/Map */
const NAV_HOME = { href: '/', label: 'Home' } as const
const NAV_HOME_VALUATION = { href: '/home-valuation', label: 'Home Valuation' } as const

const BUYERS_MENU = {
  label: 'Buyers',
  links: [
    { href: '/buy', label: 'Buy With Us' },
    { href: '/listings', label: 'Featured Listings' },
    { href: '/homes-for-sale', label: 'Home Search' },
    { href: '/area-guides', label: 'Area Guides' },
  ],
} as const

const SELLERS_MENU = {
  label: 'Sellers',
  links: [
    { href: '/sell', label: 'Sell With Us' },
    { href: '/sell/plan', label: 'Our Plan' },
    { href: '/home-valuation', label: 'Home Valuation' },
    { href: '/our-homes', label: 'Our Homes' },
  ],
} as const

const ABOUT_MENU = {
  label: 'About',
  links: [
    { href: '/team', label: 'Meet Our Team' },
    { href: '/join', label: 'Join Our Team' },
    { href: '/reviews', label: 'Read Our Reviews' },
    { href: '/blog', label: 'Read Our Blog' },
    { href: '/contact', label: 'Contact' },
  ],
} as const

const NAV_EXTRA = [
  { href: '/reports', label: 'Reports' },
  { href: '/homes-for-sale?view=map', label: 'Map', iconOnly: true },
] as const

const ACCOUNT_LINKS = [
  { href: '/account', label: 'Dashboard' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/saved-searches', label: 'Saved searches' },
  { href: '/account/saved-homes', label: 'Saved homes' },
  { href: '/account/saved-communities', label: 'Saved communities' },
  { href: '/account/buying-preferences', label: 'Buying preferences' },
] as const

export interface HeaderProps {
  user?: AuthUser | null
  brokerageName?: string
  /** White/light logo for the dark header/nav bar. When set, only the logo is shown (no text). */
  headerLogoUrl?: string | null
  /** Optional search URL or use client-side overlay; if not provided, search icon can link to /listings or open a search overlay. */
  onSearchClick?: () => void
}

export default function Header({
  user = null,
  brokerageName = 'Ryan Realty',
  headerLogoUrl = null,
  onSearchClick,
}: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [desktopDropdown, setDesktopDropdown] = useState<'buyers' | 'sellers' | 'about' | null>(null)
  const [mobileExpanded, setMobileExpanded] = useState<'buyers' | 'sellers' | 'about' | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href.split('?')[0])
  }
  const isMenuActive = (links: readonly { href: string }[]) =>
    links.some((l) => isActive(l.href))

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setAccountOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false)
      if (navRef.current && desktopDropdown && !navRef.current.contains(e.target as Node)) setDesktopDropdown(null)
    }
    if (accountOpen || desktopDropdown) document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [accountOpen, desktopDropdown])


  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q') as string
    if (q?.trim()) router.push(`/homes-for-sale?keywords=${encodeURIComponent(q.trim())}`)
    setSearchOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 bg-primary text-white">
      <div className="relative z-10 mx-auto flex h-14 md:h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center text-lg font-semibold tracking-tight text-white sm:text-xl"
          aria-label={headerLogoUrl ? brokerageName : undefined}
        >
          {headerLogoUrl ? (
            <Image
              src={headerLogoUrl}
              alt={`${brokerageName} logo`}
              width={160}
              height={48}
              className="h-10 w-auto max-h-12 object-contain object-left"
              priority
            />
          ) : (
            <span>{brokerageName}</span>
          )}
        </Link>

        <nav
          ref={navRef}
          className="relative hidden flex-nowrap items-center gap-1 lg:flex"
          aria-label="Main navigation"
        >
          <Link
            href={NAV_HOME.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(NAV_HOME.href)
                ? 'bg-card/15 text-white'
                : 'text-muted hover:bg-card/10 hover:text-white'
            }`}
          >
            {NAV_HOME.label}
          </Link>
          <Link
            href={NAV_HOME_VALUATION.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(NAV_HOME_VALUATION.href)
                ? 'bg-card/15 text-white'
                : 'text-muted hover:bg-card/10 hover:text-white'
            }`}
          >
            {NAV_HOME_VALUATION.label}
          </Link>

          {([['buyers', BUYERS_MENU], ['sellers', SELLERS_MENU], ['about', ABOUT_MENU]] as const).map(([key, menu]) => (
            <div key={key} className="relative">
              <Button
                type="button"
                onClick={() => setDesktopDropdown((d) => (d === key ? null : key))}
                className={`flex items-center gap-0.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isMenuActive(menu.links) || desktopDropdown === key
                    ? 'bg-card/15 text-white'
                    : 'text-muted hover:bg-card/10 hover:text-white'
                }`}
                aria-expanded={desktopDropdown === key}
                aria-haspopup="true"
              >
                {menu.label}
                <HugeiconsIcon icon={ArrowDown01Icon} className="ml-0.5 h-4 w-4 shrink-0" aria-hidden />
              </Button>
              {desktopDropdown === key && (
                <div
                  className="absolute left-0 top-full z-50 mt-0.5 min-w-[220px] rounded-lg border border-white/20 bg-primary py-2 shadow-lg"
                  role="menu"
                >
                  <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/70">
                    {menu.label}
                  </p>
                  {menu.links.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-muted hover:bg-card/10 hover:text-white"
                      onClick={() => setDesktopDropdown(null)}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {NAV_EXTRA.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors inline-flex items-center justify-center ${
                isActive(item.href)
                  ? 'bg-card/15 text-white'
                  : 'text-muted hover:bg-card/10 hover:text-white'
              }`}
              aria-label={item.label}
            >
              {'iconOnly' in item && item.iconOnly ? (
                <HugeiconsIcon icon={MapsIcon} className="h-5 w-5" aria-hidden />
              ) : (
                item.label
              )}
            </Link>
          ))}
        </nav>

        <div className="flex min-h-[44px] min-w-[44px] items-center gap-2 sm:min-h-[48px] sm:min-w-[48px]">
          <Button
            type="button"
            onClick={onSearchClick ?? (() => setSearchOpen((o) => !o))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-card/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Search"
            aria-expanded={searchOpen}
          >
            <HugeiconsIcon icon={Search01Icon} className="h-5 w-5" />
          </Button>
          {user ? (
            <div className="relative" ref={accountRef}>
              <Button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-card/10 focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Account menu"
                aria-expanded={accountOpen}
                aria-haspopup="true"
              >
                {user.avatar_url ? (
                  <Image
                    src={user.avatar_url}
                    alt=""
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-white">
                    {(user.email ?? user.user_metadata?.full_name ?? '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </Button>
              {accountOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card py-1 shadow-md"
                  role="menu"
                >
                  {ACCOUNT_LINKS.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-foreground hover:bg-muted"
                      onClick={() => setAccountOpen(false)}
                    >
                      {label}
                    </Link>
                  ))}
                  <form action={signOut} className="border-t border-border">
                    <Button type="submit" role="menuitem" className="w-full px-4 py-2 text-left text-sm font-medium text-foreground hover:bg-muted">
                      Sign out
                    </Button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white"
            >
              Log in
            </Link>
          )}
          <Button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-card/10 md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? (
              <HugeiconsIcon icon={Cancel01Icon} className="h-6 w-6" />
            ) : (
              <HugeiconsIcon icon={Menu02Icon} className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>

      {searchOpen && (
        <div
          className="border-t border-white/20 bg-primary px-4 py-3"
          role="search"
          aria-label="Site search"
        >
          <form onSubmit={handleSearchSubmit} className="mx-auto flex max-w-xl gap-2">
            <Input
              ref={searchInputRef}
              type="search"
              name="q"
              placeholder="Search by city, neighborhood, or address…"
              className="min-w-0 flex-1 rounded-lg border border-white/20 bg-card/10 px-4 py-2 text-muted placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label="Search query"
            />
            <Button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-primary hover:opacity-90"
            >
              Search
            </Button>
            <Button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-card/10"
              aria-label="Close search"
            >
              Cancel
            </Button>
          </form>
        </div>
      )}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-primary lg:hidden"
          role="dialog"
          aria-label="Mobile menu"
          aria-modal="true"
        >
          <div className="flex min-h-screen flex-col pt-14 pb-8 px-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold text-white">Menu</span>
              <Button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-card/10 focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Close menu"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-6 w-6" />
              </Button>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              <Link
                href={NAV_HOME.href}
                className={`rounded-lg px-4 py-3 text-lg font-medium ${
                  isActive(NAV_HOME.href) ? 'bg-card/15 text-white' : 'text-muted hover:bg-card/10'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {NAV_HOME.label}
              </Link>
              <Link
                href={NAV_HOME_VALUATION.href}
                className={`rounded-lg px-4 py-3 text-lg font-medium ${
                  isActive(NAV_HOME_VALUATION.href) ? 'bg-card/15 text-white' : 'text-muted hover:bg-card/10'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {NAV_HOME_VALUATION.label}
              </Link>
              {([['buyers', BUYERS_MENU], ['sellers', SELLERS_MENU], ['about', ABOUT_MENU]] as const).map(([key, menu]) => (
                <div key={key}>
                  <Button
                    type="button"
                    onClick={() => setMobileExpanded((e) => (e === key ? null : key))}
                    className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-lg font-medium text-muted hover:bg-card/10"
                    aria-expanded={mobileExpanded === key}
                  >
                    {menu.label}
                    <HugeiconsIcon icon={ArrowDown01Icon} className={`h-5 w-5 shrink-0 transition-transform ${mobileExpanded === key ? 'rotate-180' : ''}`} />
                  </Button>
                  {mobileExpanded === key && (
                    <div className="ml-4 flex flex-col border-l-2 border-white/20 pl-3">
                      {menu.links.map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          className={`rounded-lg px-3 py-2.5 text-base ${
                            isActive(href) ? 'font-semibold text-white' : 'text-muted/90'
                          }`}
                          onClick={() => setMobileOpen(false)}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {NAV_EXTRA.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-4 py-3 text-lg font-medium inline-flex items-center gap-2 ${
                    isActive(item.href) ? 'bg-card/15 text-white' : 'text-muted hover:bg-card/10'
                  }`}
                  aria-label={item.label}
                  onClick={() => setMobileOpen(false)}
                >
                  {'iconOnly' in item && item.iconOnly ? (
                    <HugeiconsIcon icon={MapsIcon} className="h-6 w-6 shrink-0" aria-hidden />
                  ) : (
                    item.label
                  )}
                </Link>
              ))}
            </nav>
            <div className="mt-8 border-t border-white/20 pt-6">
              {user ? (
                <>
                  <p className="px-4 text-xs font-medium uppercase tracking-wider text-muted/60">Account</p>
                  {ACCOUNT_LINKS.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="block rounded-lg px-4 py-3 text-lg font-medium text-muted hover:bg-card/10"
                      onClick={() => setMobileOpen(false)}
                    >
                      {label}
                    </Link>
                  ))}
                  <form action={signOut} className="mt-2">
                    <Button
                      type="submit"
                      className="w-full rounded-lg px-4 py-3 text-left text-lg font-medium text-muted hover:bg-card/10"
                    >
                      Sign out
                    </Button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  className="inline-block rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
