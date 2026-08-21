import Link from 'next/link'
import EqualHousing from '@/components/legal/EqualHousing'
import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
import { KB_FOOTER_COLUMNS, LEGAL_LINKS } from '@/lib/site-nav'
import type { CityDFooterLink } from './types'

function column(heading: string) {
  return KB_FOOTER_COLUMNS.find((c) => c.heading === heading)?.links ?? []
}

export function CityDFooter({
  cities,
  communities,
}: {
  cities: CityDFooterLink[]
  communities: CityDFooterLink[]
}) {
  const buy = column('Buy')
  const sell = column('Sell')
  const company = column('About')
  const places = [
    { href: '/cities', label: 'All cities' },
    ...cities,
    { href: '/communities', label: 'All communities' },
    ...communities,
  ].filter((link, i, arr) => arr.findIndex((x) => x.href === link.href) === i)

  return (
    <footer className="city-d-footer">
      <div className="city-d-wrap">
        <div className="city-d-footer-grid">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="city-d-footer-logo" src="/images/brand/logo-white.png" alt="Ryan Realty" />
            <a className="city-d-footer-phone" href={`tel:${CONTACT.phoneDirectTel}`}>
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
        {places.length > 0 ? (
          <nav className="city-d-footer-places" aria-label="Places">
            <h3>Places</h3>
            <div className="city-d-footer-places-links">
              {places.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
        <div className="city-d-footer-legal">
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
