import Link from 'next/link'
import Image from 'next/image'
import EqualHousing from '@/components/legal/EqualHousing'
import MLSAttribution from '@/components/legal/MLSAttribution'

const FALLBACK_NAME = process.env.NEXT_PUBLIC_SITE_OWNER_NAME ?? 'Ryan Realty'
const FALLBACK_EMAIL = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL
const FALLBACK_PHONE = process.env.NEXT_PUBLIC_SITE_PHONE
const FALLBACK_ADDRESS = process.env.NEXT_PUBLIC_SITE_ADDRESS

/** Social URLs from ryanrealty.com / ryan-realty.com; set in env to match live site. */
const SOCIAL_FACEBOOK = process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL
const SOCIAL_INSTAGRAM = process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL
const SOCIAL_LINKEDIN = process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL

const FOOTER_BUYERS = [
  { href: '/buy', label: 'Buy With Us' },
  { href: '/listings', label: 'Featured Listings' },
  { href: '/homes-for-sale', label: 'Home Search' },
  { href: '/area-guides', label: 'Area Guides' },
] as const

const FOOTER_SELLERS = [
  { href: '/sell', label: 'Sell With Us' },
  { href: '/sell/plan', label: 'Our Plan' },
  { href: '/sell/valuation', label: 'Home Valuation' },
  { href: '/our-homes', label: 'Our Homes' },
] as const

const FOOTER_ABOUT = [
  { href: '/team', label: 'Meet Our Team' },
  { href: '/join', label: 'Join Our Team' },
  { href: '/reviews', label: 'Read Our Reviews' },
  { href: '/blog', label: 'Read Our Blog' },
] as const

const FOOTER_EXTRA = [
  { href: '/contact', label: 'Contact' },
  { href: '/reports', label: 'Market Reports' },
  { href: '/open-houses', label: 'Open Houses' },
  { href: '/communities', label: 'Communities' },
  { href: '/cities', label: 'Cities' },
] as const

const CITY_LINKS = [
  { href: '/cities/bend', label: 'Bend' },
  { href: '/cities/redmond', label: 'Redmond' },
  { href: '/cities/sisters', label: 'Sisters' },
  { href: '/cities/sunriver', label: 'Sunriver' },
] as const

export interface FooterProps {
  brokerageName?: string
  /** Blue/color logo for the footer on white background. When set, shown in a white bar above the navy footer. */
  brokerageLogoUrl?: string | null
  brokerageEmail?: string | null
  brokeragePhone?: string | null
  brokerageAddress?: string | null
}

export default function Footer({
  brokerageName,
  brokerageLogoUrl,
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
    <footer>
      <div className={brokerageLogoUrl ? "bg-card border-b border-border" : "hidden"} suppressHydrationWarning>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {brokerageLogoUrl && (
            <Link href="/" className="inline-block" aria-label={name}>
              <Image
                src={brokerageLogoUrl}
                alt={`${name} logo`}
                width={140}
                height={42}
                className="h-9 w-auto object-contain object-left"
              />
            </Link>
          )}
        </div>
      </div>
      <div className="bg-primary text-muted">
        <div className="mx-auto max-w-7xl grid gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Buyers
            </h3>
            <ul className="mt-4 space-y-2">
              {FOOTER_BUYERS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Sellers
            </h3>
            <ul className="mt-4 space-y-2">
              {FOOTER_SELLERS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
              About
            </h3>
            <ul className="mt-4 space-y-2">
              {FOOTER_ABOUT.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Explore
            </h3>
            <ul className="mt-4 space-y-2">
              {FOOTER_EXTRA.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted hover:text-white">
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
              {CITY_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted hover:text-white">
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
            <address className="mt-4 not-italic text-sm text-muted">
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
          {(SOCIAL_FACEBOOK || SOCIAL_INSTAGRAM || SOCIAL_LINKEDIN) && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Follow us
            </h3>
            <div className="mt-4 flex gap-3">
              {SOCIAL_FACEBOOK && (
                <a
                  href={SOCIAL_FACEBOOK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-card/10 text-muted hover:bg-card/20 hover:text-white"
                  aria-label="Facebook"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                </a>
              )}
              {SOCIAL_INSTAGRAM && (
                <a
                  href={SOCIAL_INSTAGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-card/10 text-muted hover:bg-card/20 hover:text-white"
                  aria-label="Instagram"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </a>
              )}
              {SOCIAL_LINKEDIN && (
                <a
                  href={SOCIAL_LINKEDIN}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-card/10 text-muted hover:bg-card/20 hover:text-white"
                  aria-label="LinkedIn"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              )}
            </div>
          </div>
          )}
        </div>
        <div className="mt-12 border-t border-white/20 pt-8">
          <div className="flex flex-col items-center gap-4 text-center sm:items-center sm:text-center">
            <EqualHousing className="text-muted" />
            <MLSAttribution compact />
          </div>
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="text-sm text-white/80" suppressHydrationWarning>
              © {currentYear} {name}. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <Link href="/privacy" className="text-sm text-muted hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-muted hover:text-white">
                Terms
              </Link>
              <Link href="/fair-housing" className="text-sm text-muted hover:text-white">
                Fair Housing
              </Link>
              <Link href="/dmca" className="text-sm text-muted hover:text-white">
                DMCA
              </Link>
              <Link href="/accessibility" className="text-sm text-muted hover:text-white">
                Accessibility
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
