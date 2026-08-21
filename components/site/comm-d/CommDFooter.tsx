import Link from 'next/link'
import EqualHousing from '@/components/legal/EqualHousing'
import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
import { FEATURED_COMMUNITY_SLUGS } from '@/lib/communities/featured-slugs'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { KB_FOOTER_COLUMNS, LEGAL_LINKS } from '@/lib/site-nav'

function column(heading: string) {
  return KB_FOOTER_COLUMNS.find((c) => c.heading === heading)?.links ?? []
}

export function CommDFooter({ cityName }: { cityName: string }) {
  const buy = column('Buy')
  const sell = column('Sell')
  const company = column('About')
  const featured = new Set<string>(FEATURED_COMMUNITY_SLUGS)
  const communities = getAllResortCommunities()
    .filter((row) => featured.has(row.slug))
    .map((row) => ({ href: `/communities/${row.slug}`, label: row.label }))

  return (
    <footer className="comm-d-footer">
      <div className="comm-d-wrap">
        <div className="comm-d-footer-grid">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="comm-d-footer-logo" src="/images/brand/logo-white.png" alt="Ryan Realty" />
            <a className="comm-d-footer-phone" href={`tel:${CONTACT.phoneDirectTel}`}>
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
        <nav className="comm-d-footer-places" aria-label={`${cityName} and featured communities`}>
          <h3>Featured communities</h3>
          <div className="comm-d-footer-places-links">
            <Link href="/communities">All communities</Link>
            {communities.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="comm-d-footer-legal">
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
