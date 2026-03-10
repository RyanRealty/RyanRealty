import Link from 'next/link'

const FALLBACK_NAME = process.env.NEXT_PUBLIC_SITE_OWNER_NAME ?? 'Ryan Realty'
const FALLBACK_EMAIL = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL
const FALLBACK_PHONE = process.env.NEXT_PUBLIC_SITE_PHONE
const FALLBACK_ADDRESS = process.env.NEXT_PUBLIC_SITE_ADDRESS

const NAV_LINKS = [
  { href: '/listings', label: 'Buy' },
  { href: '/sell', label: 'Sell' },
  { href: '/communities', label: 'Communities' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/listings?view=map', label: 'Map' },
  { href: '/reports', label: 'Market Reports' },
] as const

const COMMUNITY_LINKS = [
  { href: '/search/bend', label: 'Bend' },
  { href: '/search/redmond', label: 'Redmond' },
  { href: '/search/sisters', label: 'Sisters' },
  { href: '/search/sunriver', label: 'Sunriver' },
] as const

export interface FooterProps {
  brokerageName?: string
  brokerageEmail?: string | null
  brokeragePhone?: string | null
  brokerageAddress?: string | null
}

export default function Footer({
  brokerageName,
  brokerageEmail,
  brokeragePhone,
  brokerageAddress,
}: FooterProps = {}) {
  const currentYear = new Date().getFullYear()
  const name = brokerageName ?? FALLBACK_NAME
  const email = brokerageEmail ?? FALLBACK_EMAIL
  const phone = brokeragePhone ?? FALLBACK_PHONE
  const address = brokerageAddress ?? FALLBACK_ADDRESS

  return (
    <footer className="bg-[var(--brand-navy)] text-[var(--brand-cream)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Navigation
            </h3>
            <ul className="mt-4 space-y-2">
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-[var(--brand-cream)] hover:text-white"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Communities
            </h3>
            <ul className="mt-4 space-y-2">
              {COMMUNITY_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-[var(--brand-cream)] hover:text-white"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Contact
            </h3>
            <address className="mt-4 not-italic text-sm text-[var(--brand-cream)]">
              {address && <p className="mb-1">{address}</p>}
              {phone && (
                <p>
                  <a href={`tel:${phone.replace(/\D/g, '')}`} className="hover:text-white">
                    {phone}
                  </a>
                </p>
              )}
              {email && (
                <p className="mt-1">
                  <a href={`mailto:${email}`} className="hover:text-white">
                    {email}
                  </a>
                </p>
              )}
            </address>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Follow us
            </h3>
            <div className="mt-4 flex gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-[var(--brand-cream)] hover:bg-white/20 hover:text-white"
                aria-label="Facebook"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-[var(--brand-cream)] hover:bg-white/20 hover:text-white"
                aria-label="Instagram"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-[var(--brand-cream)] hover:bg-white/20 hover:text-white"
                aria-label="LinkedIn"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/20 pt-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="text-sm text-white/80">
              © {currentYear} {name}. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <span className="text-sm text-white/80" title="Equal Housing Opportunity">
                Equal Housing Opportunity
              </span>
              <span className="text-sm text-white/60">MLS listings</span>
              <Link href="/privacy" className="text-sm text-[var(--brand-cream)] hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-[var(--brand-cream)] hover:text-white">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
