import Link from 'next/link'
import EqualHousing from '@/components/legal/EqualHousing'
import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
import { KB_FOOTER_COLUMNS, LEGAL_LINKS } from '@/lib/site-nav'
import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/neighborhood-public-inventory'

function column(heading: string) {
  return KB_FOOTER_COLUMNS.find((c) => c.heading === heading)?.links ?? []
}

export function HoodDFooter({
  cityName,
  citySlug,
}: {
  cityName: string
  citySlug: string
}) {
  const buy = column('Buy')
  const sell = column('Sell')
  const company = column('About')
  const districts =
    citySlug === 'bend'
      ? BEND_NEIGHBORHOOD_DISTRICTS.map((d) => ({
          href: `/cities/bend/${d.slug}`,
          label: d.label,
        }))
      : []

  return (
    <footer className="hood-d-footer">
      <div className="hood-d-wrap">
        <div className="hood-d-footer-grid">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hood-d-footer-logo" src="/images/brand/logo-white.png" alt="Ryan Realty" />
            <a className="hood-d-footer-phone" href={`tel:${CONTACT.phoneDirectTel}`}>
              {CONTACT.phoneDirect}
            </a>
          </div>
          <nav aria-label="Buy">
            <h3>Buy</h3>
            {buy.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Sell">
            <h3>Sell</h3>
            {sell.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Company">
            <h3>Company</h3>
            {company.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        {districts.length > 0 ? (
          <nav className="hood-d-footer-places" aria-label={`${cityName} districts`}>
            <h3>{cityName} districts</h3>
            <div className="hood-d-footer-places-links">
              {districts.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
        <div className="hood-d-footer-legal">
          <p>
            &copy; 2026 {BRAND.legalName} · Principal Broker Matt Ryan · Oregon Real Estate License{' '}
            <span className="tabular-nums">{BROKERS.matt.license}</span>
          </p>
          <p>
            <EqualHousing />
          </p>
          <p>
            {LEGAL_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </p>
          <p>
            Listings data provided by Oregon Data Share and Morgan Data Shuttle. Information deemed
            reliable but not guaranteed.
          </p>
        </div>
      </div>
    </footer>
  )
}
