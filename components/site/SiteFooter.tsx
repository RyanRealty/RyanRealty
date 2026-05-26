import Link from 'next/link'
import Image from 'next/image'

/**
 * Site v2 footer — navy bg, 4-column grid (brand+partners / Search / Market / Company),
 * legal line beneath. Mirrors design_system/ryan-realty/ui_kits/website/index.html §footer.
 */

type FooterColumn = {
  heading: string
  links: ReadonlyArray<{ href: string; label: string }>
}

const COLUMNS: ReadonlyArray<FooterColumn> = [
  {
    heading: 'Search',
    links: [
      { href: '/homes-for-sale', label: 'Homes for sale' },
      { href: '/open-houses', label: 'Open houses' },
      { href: '/communities', label: 'By community' },
      { href: '/search', label: 'Map search' },
    ],
  },
  {
    heading: 'Market',
    links: [
      { href: '/housing-market', label: 'Housing market hub' },
      { href: '/reports/explore', label: 'Monthly reports' },
      { href: '/sold', label: 'Sold data' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/team', label: 'Meet the team' },
      { href: '/sell', label: 'Sell your home' },
      { href: '/contact', label: 'Contact' },
      { href: '/about', label: 'About' },
    ],
  },
] as const

export default function SiteFooter() {
  return (
    <footer className="bg-primary text-white/85">
      <div className="mx-auto max-w-7xl px-6 pt-14 pb-8">
        <div className="grid gap-10 grid-cols-1 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          {/* Brand column */}
          <div>
            <Image
              src="/logo-header-white.png"
              alt="Ryan Realty"
              width={200}
              height={40}
              className="mb-3.5"
              style={{ width: 'auto', height: '2.25rem' }}
            />
            <p className="text-[13px] leading-[1.6] text-white/72 max-w-[40ch]">
              Your local team for Central Oregon real estate. Bend, Redmond, Sisters,
              Sunriver, and surrounding communities.
            </p>
            <div className="flex items-center gap-4 mt-3.5 opacity-75">
              <Image
                src="/images/oregon-data-share-logo.svg"
                alt="Oregon Data Share"
                width={120}
                height={28}
                className="h-7 w-auto brightness-0 invert"
              />
              <Image
                src="/images/morgan-data-shuttle-logo.svg"
                alt="Morgan Data Shuttle"
                width={120}
                height={28}
                className="h-7 w-auto brightness-0 invert"
              />
            </div>
            <div className="mt-5 text-[13px] text-white/72 space-y-1 tabular-nums">
              <p>
                <a href="tel:5412136706" className="hover:text-white">541.213.6706</a>
                <span className="text-white/40"> · </span>
                <a href="https://ryan-realty.com" className="hover:text-white">ryan-realty.com</a>
              </p>
              <p>BEND · OREGON</p>
            </div>
          </div>

          {/* Nav columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white mb-3.5">
                {col.heading}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/72 hover:text-white transition"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-5 border-t border-white/15 text-xs leading-[1.6] text-white/55">
          Listings data provided by Oregon Data Share and Morgan Data Shuttle.
          Information deemed reliable but not guaranteed. All listings courtesy of
          participating MLS members. © {new Date().getFullYear()} Ryan Realty LLC ·
          Bend, Oregon · Licensed in the State of Oregon · Principal Broker license{' '}
          <span className="tabular-nums">201206613</span>. Equal Housing Opportunity.
        </div>
      </div>
    </footer>
  )
}
