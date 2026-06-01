import Link from 'next/link'
import { CTAButton, RyanRealtyMark } from '@/components/site/primitives'
import MobileNav from '@/components/site/MobileNav'

/**
 * Site v2 header — sticky navy bar, white wordmark, 5 nav links, Sign in
 * + List your home CTAs on the desktop side; hamburger + drawer on
 * sub-md (via MobileNav).
 *
 * Mirrors design_system/ryan-realty/ui_kits/website/index.html §header.
 *
 * Refactored 2026-05-27 to use the new Wave 2 Layer 1 primitives:
 *   - RyanRealtyMark replaces raw <Image src="/logo-header-white.png" />
 *   - CTAButton replaces the bespoke <Link> + className soup for the two CTAs
 *   - MobileNav (sibling client component) handles sub-md
 */

const NAV_LINKS = [
  { href: '/homes-for-sale', label: 'Search' },
  { href: '/communities', label: 'Communities' },
  { href: '/housing-market', label: 'Market' },
  { href: '/team', label: 'Meet the Team' },
  { href: '/sell', label: 'Sell' },
] as const

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-primary text-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Ryan Realty home" className="shrink-0">
          <RyanRealtyMark
            variant="horizontal"
            tone="white"
            width={140}
            priority
            className="h-8 w-auto"
          />
        </Link>

        {/* D74 — nav text upsized from text-sm (14px) to text-[15px]
            so the menu reads at the same weight as the CTAs on
            desktop. Mirrored in the design_system mockup CSS so the
            parity gate stays honest. */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[15px] font-medium text-white/85 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

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
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
