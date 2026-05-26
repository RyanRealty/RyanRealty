import Link from 'next/link'
import Image from 'next/image'

/**
 * Site v2 header — sticky navy bar, white wordmark, 5 nav links, Sign in + List your home.
 * Mirrors design_system/ryan-realty/ui_kits/website/index.html §header.
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
    <header className="sticky top-0 z-40 bg-primary text-white border-b border-white/10">
      <div className="mx-auto max-w-7xl px-6 flex items-center justify-between h-[72px] gap-6">
        <Link href="/" aria-label="Ryan Realty home" className="shrink-0">
          <Image
            src="/logo-header-white.png"
            alt="Ryan Realty"
            width={200}
            height={40}
            className="h-8 w-auto"
            style={{ width: 'auto', height: '2rem' }}
            priority
          />
        </Link>

        <nav aria-label="Primary" className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/85 hover:text-white transition"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href="/account/sign-in"
            className="hidden sm:inline-flex items-center rounded-[10px] border border-white/35 px-[18px] py-[9px] text-sm font-semibold text-white hover:bg-white/10 transition active:translate-y-px"
          >
            Sign in
          </Link>
          <Link
            href="/lp/seller-home-value"
            className="inline-flex items-center rounded-[10px] bg-white px-[18px] py-[9px] text-sm font-semibold text-primary hover:bg-[#f0eee8] transition active:translate-y-px"
          >
            List your home
          </Link>
        </div>
      </div>
    </header>
  )
}
