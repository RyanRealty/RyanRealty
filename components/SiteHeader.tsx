'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import AuthDropdown from './AuthDropdown'
import SmartSearch from './SmartSearch'
import type { AuthUser } from '@/app/actions/auth'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, Cancel01Icon, Menu02Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

type NavLink = { href: string; label: string }
type SiteHeaderProps = {
  totalListings: number
  user?: AuthUser | null
  brokerageName?: string
  brokerageLogoUrl?: string | null
}

export default function SiteHeader({ totalListings, user = null, brokerageName = 'Ryan Realty', brokerageLogoUrl = null }: SiteHeaderProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const navLinks: NavLink[] = [
    { href: '/', label: 'Home' },
    { href: '/feed', label: 'Feed' },
    { href: '/about', label: 'About' },
    { href: '/team', label: 'Team' },
    { href: '/listings', label: 'Listings' },
    { href: '/listings?view=map', label: 'Map' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href.split('?')[0])
  }

  useEffect(() => {
    if (!searchOpen) return
    const el = searchRef.current?.querySelector('input')
    el?.focus()
  }, [searchOpen])

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-xl font-semibold tracking-tight text-foreground"
        >
          {brokerageLogoUrl ? (
            <Image src={brokerageLogoUrl} alt={`${brokerageName} logo`} width={32} height={32} className="rounded object-contain" />
          ) : null}
          <span>{brokerageName}</span>
        </Link>

        {/* Desktop: collapsible search + nav */}
        <div className="hidden flex-1 items-center justify-end gap-6 md:flex">
          <div className="flex items-center gap-2">
            {searchOpen ? (
              <div ref={searchRef} className="w-full min-w-[240px] max-w-md">
                <SmartSearch onClose={() => setSearchOpen(false)} />
              </div>
            ) : null}
            <Button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                searchOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-muted-foreground'
              }`}
              aria-label={searchOpen ? 'Close search' : 'Open search'}
              aria-expanded={searchOpen}
            >
              <HugeiconsIcon icon={Search01Icon} className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex items-center gap-0.5" aria-label="Main navigation">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="ml-1">
              <AuthDropdown user={user ?? null} />
            </div>
          </nav>
        </div>

        {/* Mobile: menu button */}
        <Button
          type="button"
          className="rounded-lg p-2.5 text-muted-foreground hover:bg-muted md:hidden"
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

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-t border-border bg-card md:hidden" role="dialog" aria-label="Mobile menu">
          <div className="px-4 pt-4 pb-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Search</p>
            <SmartSearch onClose={() => setMobileOpen(false)} />
          </div>
          <nav className="flex flex-col gap-0.5 px-4 py-4" aria-label="Main mobile">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-4 py-3 text-sm font-medium ${
                  isActive(href) ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
            {user ? (
              <div className="mt-2 border-t border-border pt-3">
                <p className="mb-2 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Account</p>
                <Link href="/account" className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/account/profile" className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>
                  Profile
                </Link>
                <Link href="/account/saved-searches" className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>
                  Saved searches
                </Link>
                <Link href="/account/saved-homes" className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>
                  Saved homes
                </Link>
                <Link href="/account/saved-communities" className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>
                  Saved communities
                </Link>
                <Link href="/account/buying-preferences" className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>
                  Buying preferences
                </Link>
              </div>
            ) : (
              <p className="mt-3 px-4 text-xs text-muted-foreground">Sign in to save searches and homes.</p>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
