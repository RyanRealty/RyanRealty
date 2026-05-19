/**
 * Per-listing landing page at /lp/listings/<mls_slug>/.
 *
 * Tier 4 of the four-tier search-authority stack. Wins the SERP for the
 * address query (Zillow / Realtor.com / Redfin / listing brokerage's own
 * page). Built per the site-listing-page skill (locked 2026-05-18).
 *
 * Two modes:
 *   - Our listing (ListAgentEmail @ ryan-realty.com or ListOfficeName
 *     contains "Ryan Realty"): full broker block, marketing language,
 *     showing CTA routes to the listing agent.
 *   - OPM (everyone else): mandatory IDX attribution at top of page per
 *     Oregon RMLS Internet Display Rules, showing CTA routes to our
 *     buyer's agent. Editorial language only.
 *
 * Both modes share the same template; the differences are in the CTA
 * routing + the attribution component visibility.
 *
 * ISR: revalidate=3600 (1h). Listing data turns over fast.
 *
 * Spec: marketing_brain_skills/producers/site-listing-page/SKILL.md
 */
import 'server-only'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import LandingPageTracker from '@/components/LandingPageTracker'

import {
  getListingByMlsNumber,
  getRecentComps,
  isOurListing,
  resolveParentCommunity,
  type ListingRow,
  type Comp,
} from '@/lib/listing-page/data'
import { mlsNumberFromSlug } from '@/lib/listing-page/slug'

// ISR: pages render on first hit and cache for 1 hour. We do NOT pre-render
// any specific MLS slug at build time (the listings table is 25K+ rows;
// pre-rendering is wasteful), and we do NOT set `force-static` because that
// combined with no generateStaticParams() makes Next.js treat the route as
// having zero known params and 404 every request. Default rendering + a
// `revalidate` + an empty generateStaticParams() is the right config for an
// on-demand catalog of pages.
export const revalidate = 3600 // 1 hour
export const dynamicParams = true

export async function generateStaticParams() {
  return [] // render any [mls_slug] on demand
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const RYAN_PHONE = '541.213.6706'
const RYAN_PHONE_TEL = '+15412136706'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mls_slug: string }>
}): Promise<Metadata> {
  const { mls_slug } = await params
  const mlsNumber = mlsNumberFromSlug(mls_slug)
  if (!mlsNumber) return { title: 'Listing not found | Ryan Realty' }
  const listing = await getListingByMlsNumber(mlsNumber)
  if (!listing) return { title: 'Listing not found | Ryan Realty' }
  const address = `${listing.StreetNumber ?? ''} ${listing.StreetName ?? ''}`.trim()
  const cityState = `${listing.City ?? ''}, ${listing.StateOrProvince ?? 'OR'}`
  const title = `${address || `MLS #${listing.ListNumber}`} · ${cityState} | Ryan Realty`
  const description = listing.PublicRemarks
    ? listing.PublicRemarks.slice(0, 160)
    : `${address || 'Property'} in ${cityState}. ${listing.BedroomsTotal ?? '—'} bed / ${listing.BathroomsTotal ?? '—'} bath / ${listing.TotalLivingAreaSqFt?.toLocaleString() ?? '—'} sqft. Tour with Ryan Realty.`
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/lp/listings/${mls_slug}/` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${siteUrl}/lp/listings/${mls_slug}/`,
      images: listing.PhotoURL ? [listing.PhotoURL] : undefined,
    },
  }
}

function fmtUsd(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null) return '—'
  if (opts.compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return s
  }
}

function pricePerSqft(price: number | null, sqft: number | null): string {
  if (!price || !sqft || sqft <= 0) return '—'
  return `$${Math.round(price / sqft)}`
}

function saleToList(close: number | null, list: number | null): string {
  if (!close || !list || list <= 0) return '—'
  return `${((close / list) * 100).toFixed(1)}%`
}

function statusVariant(status: string | null | undefined): 'active' | 'pending' | 'closed' | 'other' {
  if (!status) return 'other'
  const s = status.toLowerCase()
  if (s.includes('active') && !s.includes('under contract')) return 'active'
  if (s.includes('pending') || s.includes('under contract')) return 'pending'
  if (s === 'closed' || s === 'sold') return 'closed'
  return 'other'
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ mls_slug: string }>
}) {
  const { mls_slug } = await params
  const mlsNumber = mlsNumberFromSlug(mls_slug)
  if (!mlsNumber) notFound()

  const listing = await getListingByMlsNumber(mlsNumber)
  if (!listing) notFound()

  // Non-SFR or commercial → out of scope for v1
  if (listing.PropertyType && listing.PropertyType !== 'A') {
    notFound()
  }

  const ours = isOurListing(listing)
  const status = statusVariant(listing.StandardStatus)
  const parentCommunity = await resolveParentCommunity(listing)
  const comps = await getRecentComps(listing)

  const address = `${listing.StreetNumber ?? ''} ${listing.StreetName ?? ''}`.trim()
  const cityState = `${listing.City ?? 'Bend'}, ${listing.StateOrProvince ?? 'OR'}${
    listing.PostalCode ? ` ${listing.PostalCode}` : ''
  }`
  const displayPrice = status === 'closed' ? listing.ClosePrice : listing.ListPrice

  // Build JSON-LD before render so it goes server-rendered into the HTML.
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: address || `MLS #${listing.ListNumber}`,
    url: `${siteUrl}/lp/listings/${mls_slug}/`,
    image: listing.PhotoURL ?? undefined,
    description: listing.PublicRemarks ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressLocality: listing.City,
      addressRegion: listing.StateOrProvince,
      postalCode: listing.PostalCode,
      addressCountry: 'US',
    },
    offers: {
      '@type': 'Offer',
      price: displayPrice ?? undefined,
      priceCurrency: 'USD',
      availability:
        status === 'active'
          ? 'https://schema.org/InStock'
          : status === 'pending'
            ? 'https://schema.org/PreOrder'
            : 'https://schema.org/SoldOut',
    },
    numberOfBedrooms: listing.BedroomsTotal ?? undefined,
    numberOfBathroomsTotal: listing.BathroomsTotal ?? undefined,
    floorSize:
      listing.TotalLivingAreaSqFt
        ? { '@type': 'QuantitativeValue', value: listing.TotalLivingAreaSqFt, unitText: 'SQFT' }
        : undefined,
    yearBuilt: listing.year_built ?? undefined,
    geo:
      listing.Latitude && listing.Longitude
        ? { '@type': 'GeoCoordinates', latitude: listing.Latitude, longitude: listing.Longitude }
        : undefined,
    realEstateAgent: {
      '@type': 'RealEstateAgent',
      name: listing.ListingAgentFullName ?? undefined,
      worksFor: listing.ListOfficeName
        ? { '@type': 'Organization', name: listing.ListOfficeName }
        : undefined,
    },
  }

  return (
    <main className="listing-lp">
      <LandingPageTracker lpVariant={`listing-${listing.ListNumber}`} />
      <style>{`
        :root { --tw-cream: #faf8f4; --tw-navy: #102742; --tw-muted: #5d6470; }
        .listing-lp { background-color: #faf8f4; color: #102742; font-family: 'Geist', system-ui, sans-serif; }
        .listing-shell { max-width: 1100px; margin: 0 auto; padding: 24px; }
        .listing-section { padding: 32px 0; border-bottom: 1px solid rgba(16,39,66,0.08); }
        .listing-section:last-child { border-bottom: none; }
        .listing-h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 40px; line-height: 1.05; margin: 0 0 10px; letter-spacing: -0.012em; }
        .listing-h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 26px; line-height: 1.15; margin: 0 0 12px; letter-spacing: -0.01em; }
        .listing-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(16,39,66,0.62); margin-bottom: 10px; }
        .listing-prose { font-size: 15.5px; line-height: 1.65; margin: 0 0 14px; }
        .breadcrumb { font-size: 12.5px; color: rgba(16,39,66,0.62); margin-bottom: 16px; }
        .breadcrumb a { color: rgba(16,39,66,0.78); }
        .hero-photo { aspect-ratio: 16/9; background: rgba(16,39,66,0.08); background-size: cover; background-position: center; border-radius: 14px; overflow: hidden; margin-bottom: 16px; position: relative; }
        .hero-status { position: absolute; top: 14px; left: 14px; background: #102742; color: white; padding: 5px 14px; border-radius: 999px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .hero-status.pending { background: #b8860b; }
        .hero-status.closed { background: #5d6470; }
        .idx-strip { background: rgba(16,39,66,0.06); padding: 10px 16px; border-radius: 8px; font-size: 12.5px; color: rgba(16,39,66,0.78); margin-bottom: 14px; }
        .idx-strip strong { color: #102742; }
        .price-row { display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap; }
        .price-value { font-family: 'Playfair Display', Georgia, serif; font-size: 38px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
        .price-meta { font-size: 13.5px; color: rgba(16,39,66,0.62); }
        .fact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-top: 14px; }
        .fact-card { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 8px; padding: 12px 14px; }
        .fact-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(16,39,66,0.62); margin-bottom: 4px; }
        .fact-value { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; line-height: 1; font-variant-numeric: tabular-nums; }
        .fact-value.sm { font-size: 16px; font-family: 'Geist', system-ui, sans-serif; font-weight: 600; }
        .body-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 28px; align-items: start; }
        @media (max-width: 860px) { .body-grid { grid-template-columns: 1fr; } }
        .sidebar-card { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 12px; padding: 22px 24px; }
        .sidebar-card h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; margin: 0 0 10px; }
        .sidebar-card p { font-size: 13.5px; line-height: 1.55; margin: 0 0 12px; color: rgba(16,39,66,0.78); }
        .remarks-card { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 12px; padding: 22px 26px; }
        .remarks-card .source { font-size: 11.5px; color: rgba(16,39,66,0.55); margin-top: 14px; font-style: italic; }
        .comp-table { width: 100%; border-collapse: collapse; }
        .comp-table th, .comp-table td { padding: 10px 14px; text-align: left; font-size: 13.5px; border-bottom: 1px solid rgba(16,39,66,0.08); }
        .comp-table th { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(16,39,66,0.62); background: rgba(16,39,66,0.03); }
        .comp-table .num { font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; }
        .cta-card { background: #102742; color: #faf8f4; padding: 26px; border-radius: 12px; }
        .cta-card h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; margin: 0 0 10px; color: #faf8f4; }
        .cta-card p { font-size: 13.5px; line-height: 1.55; color: rgba(250,248,244,0.86); margin: 0 0 14px; }
        .cta-card .btn { display: inline-block; background: #faf8f4; color: #102742; padding: 11px 18px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; }
        .cta-card .btn + .btn { margin-left: 8px; }
        .archived-banner { background: #5d6470; color: white; padding: 14px 22px; border-radius: 10px; margin-bottom: 18px; font-size: 14px; }
        .archived-banner a { color: white; text-decoration: underline; }
      `}</style>

      <div className="listing-shell">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/">Home</Link> ·{' '}
          <Link href="/lp/bend/">{listing.City ?? 'Bend'}</Link>
          {parentCommunity && (
            <>
              {' · '}<Link href={`/lp/${parentCommunity.slug}/`}>{parentCommunity.name}</Link>
            </>
          )}
          {listing.SubdivisionName && !parentCommunity && (
            <> · {listing.SubdivisionName}</>
          )}
          {' · '}{address || `MLS #${listing.ListNumber}`}
        </div>

        {/* ARCHIVED BANNER (for closed listings) */}
        {status === 'closed' && listing.ClosePrice && (
          <div className="archived-banner">
            <strong>Archived.</strong> This home sold for {fmtUsd(listing.ClosePrice)}. See{' '}
            {parentCommunity ? (
              <Link href={`/lp/${parentCommunity.slug}/`}>current {parentCommunity.name} listings</Link>
            ) : (
              <Link href="/lp/bend/">current Bend listings</Link>
            )}
            .
          </div>
        )}

        {/* HERO PHOTO */}
        <div
          className="hero-photo"
          style={listing.PhotoURL ? { backgroundImage: `url('${listing.PhotoURL}')` } : undefined}
        >
          {status !== 'other' && (
            <span className={`hero-status ${status}`}>
              {status === 'closed' ? 'Sold' : listing.StandardStatus}
            </span>
          )}
        </div>

        {/* IDX ATTRIBUTION — NON-NEGOTIABLE per Oregon RMLS rules */}
        {(listing.ListOfficeName || listing.ListingAgentFullName) && (
          <div className="idx-strip">
            <strong>Listed by</strong>{' '}
            {listing.ListOfficeName ?? '—'}
            {listing.ListingAgentFullName ? ` · ${listing.ListingAgentFullName}` : ''}
            {ours ? '' : '. Tour available with Ryan Realty.'}
          </div>
        )}

        {/* HEADLINE */}
        <h1 className="listing-h1">{address || `MLS #${listing.ListNumber}`}</h1>
        <div style={{ fontSize: 15, color: 'rgba(16,39,66,0.78)', marginBottom: 14 }}>{cityState}</div>

        <div className="price-row">
          <div className="price-value">{fmtUsd(displayPrice)}</div>
          {status === 'active' && listing.OriginalListPrice && listing.OriginalListPrice !== listing.ListPrice && (
            <div className="price-meta">
              Originally listed at {fmtUsd(listing.OriginalListPrice)}
            </div>
          )}
          {status === 'closed' && listing.ListPrice && (
            <div className="price-meta">
              Listed at {fmtUsd(listing.ListPrice)} · sold at {saleToList(listing.ClosePrice, listing.ListPrice)} of list
            </div>
          )}
          {listing.CumulativeDaysOnMarket != null && status !== 'closed' && (
            <div className="price-meta">{listing.CumulativeDaysOnMarket} days on market</div>
          )}
        </div>

        {/* FACT GRID */}
        <div className="fact-grid">
          <div className="fact-card">
            <div className="fact-label">Bedrooms</div>
            <div className="fact-value">{listing.BedroomsTotal ?? '—'}</div>
          </div>
          <div className="fact-card">
            <div className="fact-label">Bathrooms</div>
            <div className="fact-value">{listing.BathroomsTotal ?? '—'}</div>
          </div>
          <div className="fact-card">
            <div className="fact-label">Sqft</div>
            <div className="fact-value">{fmtNum(listing.TotalLivingAreaSqFt)}</div>
          </div>
          <div className="fact-card">
            <div className="fact-label">$/sqft</div>
            <div className="fact-value">{pricePerSqft(displayPrice, listing.TotalLivingAreaSqFt)}</div>
          </div>
          <div className="fact-card">
            <div className="fact-label">Lot (acres)</div>
            <div className="fact-value">{listing.LotSizeAcres ?? '—'}</div>
          </div>
          <div className="fact-card">
            <div className="fact-label">Year built</div>
            <div className="fact-value">{listing.year_built ?? '—'}</div>
          </div>
          <div className="fact-card">
            <div className="fact-label">Garage</div>
            <div className="fact-value">{listing.GarageSpaces ?? '—'}</div>
          </div>
          <div className="fact-card">
            <div className="fact-label">HOA</div>
            <div className="fact-value sm">
              {listing.AssociationFee
                ? `${fmtUsd(listing.AssociationFee)} / ${listing.AssociationFeeFrequency ?? 'mo'}`
                : '—'}
            </div>
          </div>
          <div className="fact-card">
            <div className="fact-label">Annual tax</div>
            <div className="fact-value sm">{fmtUsd(listing.TaxAnnualAmount)}</div>
          </div>
          <div className="fact-card">
            <div className="fact-label">MLS #</div>
            <div className="fact-value sm">{listing.ListNumber ?? '—'}</div>
          </div>
        </div>

        {/* BODY */}
        <div className="body-grid" style={{ marginTop: 28 }}>
          <div>
            {/* PUBLIC REMARKS */}
            {listing.PublicRemarks && (
              <div className="remarks-card" style={{ marginBottom: 22 }}>
                <div className="listing-eyebrow">About this home</div>
                <p className="listing-prose" style={{ marginBottom: 0, whiteSpace: 'pre-line' }}>
                  {listing.PublicRemarks}
                </p>
                <div className="source">
                  Description provided by the listing brokerage{listing.ListOfficeName ? ` (${listing.ListOfficeName})` : ''}.
                </div>
              </div>
            )}

            {/* SCHOOLS */}
            <Card style={{ marginBottom: 22 }}>
              <CardContent style={{ padding: 22 }}>
                <div className="listing-eyebrow">Schools</div>
                <h2 className="listing-h2" style={{ fontSize: 20 }}>Bend-La Pine Schools district.</h2>
                <p className="listing-prose">
                  This {listing.City ?? 'Bend'} address sits inside the{' '}
                  <a
                    href="https://www.bend.k12.or.us/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#102742', textDecoration: 'underline' }}
                  >
                    Bend-La Pine Schools district
                  </a>
                  . Verify the exact elementary, middle, and high school assignment by entering the
                  street address into the district&rsquo;s school locator. We pull the GreatSchools
                  rating + the principal tenure + the current parent-teacher ratio at showing.
                </p>
              </CardContent>
            </Card>

            {/* COMPS */}
            {comps.length > 0 && (
              <Card>
                <CardContent style={{ padding: 0 }}>
                  <div style={{ padding: '20px 22px 12px' }}>
                    <div className="listing-eyebrow">Recent comps</div>
                    <h2 className="listing-h2" style={{ fontSize: 20, marginBottom: 6 }}>
                      Comparable closings, last 12 months.
                    </h2>
                    <p className="listing-prose" style={{ fontSize: 13.5, color: 'rgba(16,39,66,0.62)', marginBottom: 0 }}>
                      Tight criteria first, then progressively widened to surface the closest
                      apples-to-apples set. Sub-plat preferred, then city.
                    </p>
                  </div>
                  <table className="comp-table">
                    <thead>
                      <tr>
                        <th>Closed</th>
                        <th>Street</th>
                        <th>Sub-plat</th>
                        <th>Beds / baths</th>
                        <th className="num">Sqft</th>
                        <th className="num">Close</th>
                        <th className="num">$/sqft</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comps.map((c, i) => (
                        <tr key={c.ListingKey ?? `${i}`}>
                          <td>{fmtDate(c.CloseDate)}</td>
                          <td>{c.StreetNumber ?? '—'} {c.StreetName ?? ''}</td>
                          <td>{c.SubdivisionName ?? '—'}</td>
                          <td>{c.BedroomsTotal ?? '—'} / {c.BathroomsTotal ?? '—'}</td>
                          <td className="num">{fmtNum(c.TotalLivingAreaSqFt)}</td>
                          <td className="num">{fmtUsd(c.ClosePrice)}</td>
                          <td className="num">{pricePerSqft(c.ClosePrice, c.TotalLivingAreaSqFt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>

          {/* SIDEBAR */}
          <aside>
            {/* SHOWING CTA */}
            <div className="cta-card" style={{ marginBottom: 18 }}>
              <h3>{status === 'closed' ? 'Looking at homes like this one?' : 'Tour this home.'}</h3>
              <p>
                {status === 'closed'
                  ? `This home closed at ${fmtUsd(listing.ClosePrice)}. We work with buyers across ${listing.City ?? 'Bend'} ${parentCommunity ? `including ${parentCommunity.name}` : ''} every week.`
                  : ours
                    ? `Listed by Ryan Realty. Schedule a tour direct with the listing agent${listing.ListingAgentFullName ? ` (${listing.ListingAgentFullName})` : ''}.`
                    : `Listed by ${listing.ListOfficeName ?? 'another brokerage'}. We schedule the tour with our buyer's agent so you have representation.`}
              </p>
              <a className="btn" href={`tel:${RYAN_PHONE_TEL}`}>
                Call {RYAN_PHONE}
              </a>
              {parentCommunity && (
                <Link href={`/lp/${parentCommunity.slug}/#buyer`} className="btn" style={{ marginLeft: 8 }}>
                  See buyer track
                </Link>
              )}
            </div>

            {/* PARENT COMMUNITY */}
            {parentCommunity && (
              <div className="sidebar-card" style={{ marginBottom: 18 }}>
                <h3>About {parentCommunity.name}</h3>
                <p>
                  This home sits inside {parentCommunity.name}. See the full community page for HOA
                  tiers, amenities, builder roster, market dynamics, and active inventory across the
                  parent community.
                </p>
                <Link
                  href={`/lp/${parentCommunity.slug}/`}
                  style={{ color: '#102742', fontSize: 13.5, fontWeight: 600, textDecoration: 'underline' }}
                >
                  See all of {parentCommunity.name} →
                </Link>
              </div>
            )}

            {/* VIRTUAL TOUR */}
            {(listing.VirtualTourURLUnbranded || listing.VirtualTourURLBranded) && (
              <div className="sidebar-card" style={{ marginBottom: 18 }}>
                <h3>Virtual tour</h3>
                <p>The listing brokerage has published a virtual tour.</p>
                <a
                  href={listing.VirtualTourURLUnbranded ?? listing.VirtualTourURLBranded ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#102742', fontSize: 13.5, fontWeight: 600, textDecoration: 'underline' }}
                >
                  Open virtual tour →
                </a>
              </div>
            )}

            {/* MAP */}
            {listing.Latitude && listing.Longitude && (
              <div className="sidebar-card">
                <h3>Location</h3>
                <p>
                  {address || `MLS #${listing.ListNumber}`}, {cityState}.
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${cityState}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#102742', fontSize: 13.5, fontWeight: 600, textDecoration: 'underline' }}
                >
                  Open in Google Maps →
                </a>
              </div>
            )}
          </aside>
        </div>

        {/* METHODOLOGY */}
        <section className="listing-section" style={{ marginTop: 8 }}>
          <div className="listing-eyebrow">Methodology + attribution</div>
          <p className="listing-prose" style={{ fontSize: 13, color: 'rgba(16,39,66,0.62)' }}>
            Listing data sourced from the Oregon Datashare RMLS feed. Every figure on this page traces
            to a live row in the <code>listings</code> table at server-render time. ISR refreshes every
            hour. Public remarks are reproduced verbatim from the listing brokerage. Comparable
            closings are filtered to the same sub-plat first, widened progressively to the same city
            if fewer than three comps satisfy the tight criteria. Page last refreshed{' '}
            {fmtDate(listing.ModificationTimestamp)}.
          </p>
          <p className="listing-prose" style={{ fontSize: 11.5, color: 'rgba(16,39,66,0.55)' }}>
            Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity. Listing
            data courtesy of Oregon Datashare RMLS. {ours ? 'This home is listed by Ryan Realty.' : `This home is listed by ${listing.ListOfficeName ?? 'another brokerage'}; Ryan Realty represents buyers.`}
          </p>
        </section>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  )
}
