import Link from 'next/link'
import Image from 'next/image'
import { Separator } from '@/components/ui/separator'
import EqualHousing from '@/components/legal/EqualHousing'
import MLSAttribution from '@/components/legal/MLSAttribution'
import FooterCtaButtons from '@/components/layout/FooterCtaButtons'
import { listingsBrowsePath } from '@/lib/slug'

const FALLBACK_NAME = process.env.NEXT_PUBLIC_SITE_OWNER_NAME ?? 'Ryan Realty'
const FALLBACK_EMAIL = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL
const FALLBACK_PHONE = process.env.NEXT_PUBLIC_SITE_PHONE
const FALLBACK_ADDRESS = process.env.NEXT_PUBLIC_SITE_ADDRESS

const SOCIAL_FACEBOOK = process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL
const SOCIAL_INSTAGRAM = process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL
const SOCIAL_LINKEDIN = process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL
const OREGON_REA_LOOKUP_URL =
  'https://www.oregon.gov/rea/licensing/pages/current-licensees.aspx'

/**
 * Ryan Realty LLC principal-broker license number. OREA records:
 *   Matt Ryan (PB)     201206613
 *   Ryan Realty LLC    201253677 (business name)
 * The PB number is the consumer-facing license per brand-voice spec
 * (every public page must display it in the legal footer).
 */
const PRINCIPAL_BROKER_LICENSE = '201206613'

/**
 * Format a US phone number into the brand-voice dotted style: 541.213.6706.
 * Accepts any input shape (5412136706, 541-213-6706, (541) 213-6706, +1...)
 * and reformats to dotted. Returns the input unchanged if it doesn't have
 * exactly 10 digits (e.g. international or partial).
 */
function formatPhoneAsDotted(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // Strip leading 1 if present (US country code)
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (local.length !== 10) return raw
  return `${local.slice(0, 3)}.${local.slice(3, 6)}.${local.slice(6)}`
}

const BUY_LINKS = [
  { href: '/buy', label: 'Buy With Us' },
  { href: listingsBrowsePath(), label: 'Home Search' },
  { href: '/area-guides', label: 'Area Guides' },
] as const

const SELL_LINKS = [
  { href: '/sell', label: 'Sell With Us' },
  { href: '/sell/plan', label: 'Our Plan' },
  { href: '/sell/valuation', label: 'Home Valuation' },
  { href: '/our-homes', label: 'Our Homes' },
] as const

const COMPANY_LINKS = [
  { href: '/team', label: 'Meet Our Team' },
  { href: '/join', label: 'Join Our Team' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/blog', label: 'Blog' },
] as const

const RESOURCES_LINKS = [
  { href: '/reports', label: 'Market Reports' },
  { href: '/open-houses', label: 'Open Houses' },
  { href: '/communities', label: 'Communities' },
  { href: '/cities', label: 'Cities' },
  { href: '/contact', label: 'Contact' },
] as const

const CITY_LINKS = [
  { href: '/cities/bend', label: 'Bend' },
  { href: '/cities/redmond', label: 'Redmond' },
  { href: '/cities/sisters', label: 'Sisters' },
  { href: '/cities/sunriver', label: 'Sunriver' },
] as const

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/fair-housing', label: 'Fair Housing' },
  { href: '/dmca', label: 'DMCA' },
  { href: '/accessibility', label: 'Accessibility' },
] as const

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: readonly { href: string; label: string }[]
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {links.map(({ href, label }, index) => (
          <li key={`${href}-${label}-${index}`}>
            <Link
              href={href}
              className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface FooterProps {
  brokerageName?: string
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
  const hasContact = address || phone || email
  const hasSocial = !!(SOCIAL_FACEBOOK || SOCIAL_INSTAGRAM || SOCIAL_LINKEDIN)

  return (
    <footer className="bg-primary text-primary-foreground/70">
      <div className="border-b border-primary-foreground/10 bg-primary/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-primary-foreground/90">
            Ready to buy or sell in Central Oregon? Get a clear plan and direct guidance from Ryan Realty.
          </p>
          <FooterCtaButtons />
        </div>
      </div>
      {brokerageLogoUrl ? (
        <div className="border-b border-primary-foreground/10 bg-card/5">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
            <Link href="/" className="inline-block" aria-label={name}>
              <Image
                src={brokerageLogoUrl}
                alt=""
                width={140}
                height={42}
                className="h-9 w-auto object-contain object-left"
              />
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <FooterColumn title="Buy" links={BUY_LINKS} />
          <FooterColumn title="Sell" links={SELL_LINKS} />
          <div className="space-y-8 sm:col-span-2 lg:col-span-1">
            <FooterColumn title="Company" links={COMPANY_LINKS} />
            <FooterColumn title="Resources" links={RESOURCES_LINKS} />
          </div>
          <div className="space-y-6">
            <FooterColumn title="Popular cities" links={CITY_LINKS} />
            {hasContact && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                  Contact
                </h3>
                <address className="mt-3 not-italic text-sm text-primary-foreground/70">
                  {address ? <p className="mb-1">{address}</p> : null}
                  {phone ? (
                    <p>
                      <a
                        href={`tel:${phone.replace(/\D/g, '')}`}
                        className="hover:text-primary-foreground transition-colors"
                      >
                        {/* Dotted format per brand voice spec: 541.213.6706 */}
                        {formatPhoneAsDotted(phone)}
                      </a>
                    </p>
                  ) : null}
                  {email ? (
                    <p className="mt-1">
                      <a
                        href={`mailto:${email}`}
                        className="hover:text-primary-foreground transition-colors"
                      >
                        {email}
                      </a>
                    </p>
                  ) : null}
                </address>
              </div>
            )}
            {hasSocial && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                  Follow us
                </h3>
                <div className="mt-3 flex gap-2">
                  {SOCIAL_FACEBOOK && (
                    <a
                      href={SOCIAL_FACEBOOK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-foreground/10 text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
                      aria-label="Facebook"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                      </svg>
                    </a>
                  )}
                  {SOCIAL_INSTAGRAM && (
                    <a
                      href={SOCIAL_INSTAGRAM}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-foreground/10 text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
                      aria-label="Instagram"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                      </svg>
                    </a>
                  )}
                  {SOCIAL_LINKEDIN && (
                    <a
                      href={SOCIAL_LINKEDIN}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-foreground/10 text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
                      aria-label="LinkedIn"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator className="my-10 bg-primary-foreground/20" />

        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <EqualHousing className="text-primary-foreground/70" />
            <MLSAttribution compact />
          </div>
          <div className="flex flex-col items-center gap-4 sm:items-end">
            <p className="text-sm text-primary-foreground/90" suppressHydrationWarning>
              © {currentYear} {name}. All rights reserved.
            </p>
            <p className="text-xs text-primary-foreground/70">
              Oregon principal-broker license #{PRINCIPAL_BROKER_LICENSE} · Equal Housing Opportunity
            </p>
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 sm:justify-end" aria-label="Legal and policies">
              {LEGAL_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  {label}
                </Link>
              ))}
              <a
                href={OREGON_REA_LOOKUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              >
                Oregon license lookup
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
