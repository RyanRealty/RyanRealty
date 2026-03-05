'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cityEntityKey } from '@/lib/slug'
import AuthDropdown from './AuthDropdown'
import type { AuthUser } from '@/app/actions/auth'

type NavLink = { href: string; label: string }
type SiteHeaderProps = {
  cities: { City: string; count: number }[]
  totalListings: number
  user?: AuthUser | null
}

export default function SiteHeader({ cities, totalListings, user = null }: SiteHeaderProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks: NavLink[] = [
    { href: '/', label: 'Home' },
    { href: '/listings', label: 'All Listings' },
    { href: '/listings?view=map', label: 'Map' },
    { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href.split('?')[0])
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="shrink-0 text-xl font-semibold tracking-tight text-zinc-900"
        >
          Ryan Realty
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              aria-expanded="false"
              aria-haspopup="true"
              id="browse-menu-trigger"
            >
              Browse by City
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              className="pointer-events-none absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-zinc-200 bg-white py-2 opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
              role="menu"
              aria-labelledby="browse-menu-trigger"
            >
              {cities.length === 0 ? (
                <p className="px-4 py-2 text-sm text-zinc-500">No cities yet</p>
              ) : (
                cities.slice(0, 20).map(({ City, count }) => (
                  <Link
                    key={City}
                    href={`/search/${cityEntityKey(City)}`}
                    className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                    role="menuitem"
                  >
                    {City} <span className="text-zinc-400">({count})</span>
                  </Link>
                ))
              )}
              {cities.length > 20 && (
                <Link
                  href="/listings"
                  className="block border-t border-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  View all {totalListings} listings →
                </Link>
              )}
            </div>
          </div>
          <AuthDropdown user={user ?? null} />
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 md:hidden"
          aria-label="Open menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-t border-zinc-200 bg-white md:hidden" role="dialog" aria-label="Mobile menu">
          <nav className="flex flex-col gap-1 px-4 py-4" aria-label="Main mobile">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-4 py-3 text-sm font-medium ${
                  isActive(href) ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
            <p className="mt-2 px-4 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Browse by city
            </p>
            {cities.length === 0 ? (
              <p className="px-4 py-2 text-sm text-zinc-500">No cities yet</p>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {cities.map(({ City, count }) => (
                  <Link
                    key={City}
                    href={`/search/${cityEntityKey(City)}`}
                    className="block rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    onClick={() => setMobileOpen(false)}
                  >
                    {City} <span className="text-zinc-400">({count})</span>
                  </Link>
                ))}
              </div>
            )}
            {user ? (
              <div className="mt-2 flex flex-col gap-1">
                <Link href="/account" className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Account
                </Link>
                <Link href="/account/profile" className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Profile
                </Link>
                <Link href="/account/saved-searches" className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Saved searches
                </Link>
                <Link href="/account/saved-homes" className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Saved homes
                </Link>
                <Link href="/account/buying-preferences" className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Buying preferences
                </Link>
              </div>
            ) : (
              <p className="mt-2 px-4 text-xs text-zinc-500">Sign in to save searches and homes.</p>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
