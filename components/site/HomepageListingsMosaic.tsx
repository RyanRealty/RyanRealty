// brand-voice:exempt
/**
 * HomepageListingsMosaic — asymmetric editorial listing layout.
 *
 * ONE dominant listing (left, spans 2 rows) + up to 4 supporting listings
 * (right, 2x2 grid). Exactly per the approved homepage-v3 mockup.
 *
 * When fewer than 2 listings are available the section is omitted entirely
 * (honest empty state — no skeleton grid).
 *
 * Price is rendered in Amboqia display. No carousels, no arrows, no dots.
 * Hover: photo scales 1.04, card lifts slightly.
 */

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Container, DisplayHeading, Eyebrow } from '@/components/site/primitives'

function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  const k = Math.round(n / 1000) * 1000
  return `$${k.toLocaleString()}`
}

export type ListingCardShape = {
  listingKey: string
  href: string
  photoUrl: string | null
  price: number | null
  address: string
  cityLine: string
  subdivisionName: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  dom: number | null
  status: string | null
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const label = status.includes('oming') ? 'Coming soon' : 'Active'
  return (
    <span
      className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-[0.08em] text-white px-2 py-0.5 rounded-full backdrop-blur-sm"
      style={{ background: 'rgba(16,39,66,0.75)' }}
    >
      {label}
    </span>
  )
}

function DominantCard({ listing }: { listing: ListingCardShape }) {
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl bg-card',
        'transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg',
        'col-span-1 row-span-2 flex flex-col',
      )}
      style={{ boxShadow: '0 1px 3px 0 rgb(16 39 66 / 0.08)' }}
    >
      <Link href={listing.href} className="flex flex-col h-full">
        <div
          className="relative overflow-hidden bg-muted"
          style={{ height: '420px' }}
        >
          {listing.photoUrl ? (
            <Image
              src={listing.photoUrl}
              alt={listing.address}
              fill
              sizes="(max-width: 768px) 100vw, 55vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              style={{ transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)' }}
            />
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}
          <StatusBadge status={listing.status} />
        </div>
        <div className="p-5 flex-1">
          <div
            className="font-display tabular-nums text-foreground leading-none mb-2"
            style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', letterSpacing: '-0.01em' }}
          >
            {fmtPrice(listing.price)}
          </div>
          <div className="text-sm font-medium text-foreground/70 mb-0.5">{listing.address}</div>
          {listing.subdivisionName ? (
            <div className="text-xs text-foreground/45">{listing.subdivisionName}{listing.cityLine ? `, ${listing.cityLine}` : ''}</div>
          ) : listing.cityLine ? (
            <div className="text-xs text-foreground/45">{listing.cityLine}</div>
          ) : null}
          {(listing.beds != null || listing.baths != null) ? (
            <div className="flex gap-4 mt-3 pt-3 border-t border-border">
              {listing.beds != null ? (
                <span className="text-xs font-medium text-foreground/60">
                  <span className="text-foreground font-semibold">{listing.beds}</span> bd
                </span>
              ) : null}
              {listing.baths != null ? (
                <span className="text-xs font-medium text-foreground/60">
                  <span className="text-foreground font-semibold">{listing.baths}</span> ba
                </span>
              ) : null}
              {listing.sqft != null ? (
                <span className="text-xs font-medium text-foreground/60">
                  <span className="text-foreground font-semibold">{listing.sqft.toLocaleString()}</span> sqft
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  )
}

function SmallCard({ listing }: { listing: ListingCardShape }) {
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl bg-card',
        'transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg',
        'col-span-1',
      )}
      style={{ boxShadow: '0 1px 3px 0 rgb(16 39 66 / 0.08)' }}
    >
      <Link href={listing.href} className="flex flex-col h-full">
        <div className="relative overflow-hidden bg-muted" style={{ height: '200px' }}>
          {listing.photoUrl ? (
            <Image
              src={listing.photoUrl}
              alt={listing.address}
              fill
              sizes="(max-width: 768px) 100vw, 25vw"
              className="object-cover"
              style={{ transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)' }}
            />
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}
          <StatusBadge status={listing.status} />
        </div>
        <div className="p-4">
          <div
            className="font-display tabular-nums text-foreground leading-none mb-1.5"
            style={{ fontSize: '1.35rem', letterSpacing: '-0.01em' }}
          >
            {fmtPrice(listing.price)}
          </div>
          <div className="text-[13px] font-medium text-foreground/70 mb-0.5 truncate">{listing.address}</div>
          {listing.subdivisionName ? (
            <div className="text-xs text-foreground/45 truncate">{listing.subdivisionName}</div>
          ) : listing.cityLine ? (
            <div className="text-xs text-foreground/45">{listing.cityLine}</div>
          ) : null}
          {(listing.beds != null || listing.baths != null) ? (
            <div className="flex gap-3 mt-2.5 pt-2.5 border-t border-border">
              {listing.beds != null ? (
                <span className="text-[12px] font-medium text-foreground/60">
                  <span className="text-foreground font-semibold">{listing.beds}</span> bd
                </span>
              ) : null}
              {listing.baths != null ? (
                <span className="text-[12px] font-medium text-foreground/60">
                  <span className="text-foreground font-semibold">{listing.baths}</span> ba
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  )
}

type Props = {
  listings: ListingCardShape[]
}

export default function HomepageListingsMosaic({ listings }: Props) {
  if (listings.length < 2) return null

  const [dominant, ...supporting] = listings
  const supSlots = supporting.slice(0, 4)

  return (
    <section
      className="bg-background py-16 md:py-20 border-t border-border"
      aria-labelledby="listings-heading"
    >
      <Container>
        <div className="flex items-end justify-between mb-10 gap-6">
          <div>
            <Eyebrow className="mb-3">Active inventory</Eyebrow>
            <DisplayHeading as="h2" id="listings-heading" className="text-foreground">
              Featured Central Oregon homes
            </DisplayHeading>
          </div>
          <a
            href="/homes-for-sale"
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4.5 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-all whitespace-nowrap"
          >
            View all listings
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>

        {/* Magazine mosaic grid */}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: supSlots.length > 0 ? '1.4fr 1fr' : '1fr',
            gridTemplateRows: 'auto auto',
          }}
        >
          {/* Dominant — spans 2 rows */}
          <div style={{ gridRow: supSlots.length > 0 ? '1 / 3' : '1' }}>
            <DominantCard listing={dominant} />
          </div>

          {/* Supporting 2x2 */}
          {supSlots.length > 0 ? (
            <div className="grid grid-cols-1 gap-4" style={{ gridRow: '1 / 3' }}>
              {supSlots.map((listing) => (
                <SmallCard key={listing.listingKey} listing={listing} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Mobile: single column */}
        <style>{`
          @media (max-width: 768px) {
            .listings-mosaic-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </Container>
    </section>
  )
}
