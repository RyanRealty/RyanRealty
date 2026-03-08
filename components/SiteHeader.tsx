'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import AuthDropdown from './AuthDropdown'
import SmartSearch from './SmartSearch'
import type { AuthUser } from '@/app/actions/auth'

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
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900"
        >
          {brokerageLogoUrl ? (
            <Image src={brokerageLogoUrl} alt="" width={32} height={32} className="rounded object-contain" />
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
            <button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                searchOpen ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
              }`}
              aria-label={searchOpen ? 'Close search' : 'Open search'}
              aria-expanded={searchOpen}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
          <nav className="flex items-center gap-0.5" aria-label="Main navigation">
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
            <div className="ml-1">
              <AuthDropdown user={user ?? null} />
            </div>
          </nav>
        </div>

        {/* Mobile: menu button */}
        <button
          type="button"
          className="rounded-lg p-2.5 text-zinc-600 hover:bg-zinc-100 md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
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
          <div className="px-4 pt-4 pb-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">Search</p>
            <SmartSearch onClose={() => setMobileOpen(false)} />
          </div>
          <nav className="flex flex-col gap-0.5 px-4 py-4" aria-label="Main mobile">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-4 py-3 text-sm font-medium ${
                  isActive(href) ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700 hover:bg-zinc-50'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
            {user ? (
              <div className="mt-2 border-t border-zinc-100 pt-3">
                <p className="mb-2 px-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Account</p>
                <Link href="/account" className="block rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/account/profile" className="block rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Profile
                </Link>
                <Link href="/account/saved-searches" className="block rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Saved searches
                </Link>
                <Link href="/account/saved-homes" className="block rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Saved homes
                </Link>
                <Link href="/account/saved-communities" className="block rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Saved communities
                </Link>
                <Link href="/account/buying-preferences" className="block rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                  Buying preferences
                </Link>
              </div>
            ) : (
              <p className="mt-3 px-4 text-xs text-zinc-500">Sign in to save searches and homes.</p>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
