'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { AuthUser } from '@/app/actions/auth'

const NAV_LINKS = [
  { href: '/listings', label: 'Buy' },
  { href: '/sell', label: 'Sell' },
  { href: '/communities', label: 'Communities' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
] as const

export interface HeaderProps {
  user?: AuthUser | null
  brokerageName?: string
  brokerageLogoUrl?: string | null
  /** Optional search URL or use client-side overlay; if not provided, search icon can link to /listings or open a search overlay. */
  onSearchClick?: () => void
}

export default function Header({
  user = null,
  brokerageName = 'Ryan Realty',
  brokerageLogoUrl = null,
  onSearchClick,
}: HeaderProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href.split('?')[0])
  }

  return (
    <header
      className="sticky top-0 z-50 bg-[var(--brand-navy)] text-[var(--brand-cream)]"
      style={{ minHeight: '56px' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 md:min-h-[64px]" style={{ minHeight: '56px' }}>
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight text-white sm:text-xl"
        >
          {brokerageLogoUrl ? (
            <Image
              src={brokerageLogoUrl}
              alt=""
              width={32}
              height={32}
              className="rounded object-contain"
            />
          ) : (
            <span className="h-8 w-8 rounded bg-[var(--accent)]/20" aria-hidden />
          )}
          <span>{brokerageName}</span>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Main navigation"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'bg-white/15 text-white'
                  : 'text-[var(--brand-cream)] hover:bg-white/10 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex min-h-[44px] min-w-[44px] items-center gap-2 sm:min-h-[48px] sm:min-w-[48px]">
          <button
            type="button"
            onClick={onSearchClick ?? (() => window.location.assign('/listings'))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--brand-cream)] hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            aria-label="Search"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
          {user ? (
            <Link
              href="/account"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              aria-label="Account"
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
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-navy)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white"
            >
              Log in
            </Link>
          )}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--brand-cream)] hover:bg-white/10 md:hidden"
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
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[var(--brand-navy)] md:hidden"
          role="dialog"
          aria-label="Mobile menu"
        >
          <div className="flex min-h-screen flex-col pt-20 pb-8 px-6">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-4 py-3 text-lg font-medium ${
                    isActive(href) ? 'bg-white/15 text-white' : 'text-[var(--brand-cream)] hover:bg-white/10'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 border-t border-white/20 pt-6">
              {user ? (
                <Link
                  href="/account"
                  className="block rounded-lg px-4 py-3 text-lg font-medium text-[var(--brand-cream)] hover:bg-white/10"
                  onClick={() => setMobileOpen(false)}
                >
                  My account
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-block rounded-lg bg-[var(--accent)] px-6 py-3 text-lg font-semibold text-[var(--brand-navy)]"
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
