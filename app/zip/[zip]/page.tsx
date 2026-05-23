import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ListingTile from '@/components/ListingTile'
import HomeValuationCta from '@/components/HomeValuationCta'
import { getListingsWithAdvanced } from '@/app/actions/listings'

type Params = { zip: string }

/**
 * Canonical ZIP codes Ryan Realty actively serves (SITE_SPEC line 115).
 * Anything outside this list falls through to notFound() so we never SSG
 * an empty page for a random ZIP. dynamicParams=false keeps the route
 * strict — only the canonical 10 will resolve.
 */
const CANONICAL_ZIPS = new Set([
  '97701', // Bend
  '97702', // Bend
  '97703', // Bend
  '97756', // Redmond
  '97759', // Sisters
  '97739', // La Pine
  '97707', // Sunriver
  '97741', // Madras
  '97754', // Prineville
  '97760', // Terrebonne
])

export const dynamicParams = false
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ zip: string }>> {
  return Array.from(CANONICAL_ZIPS).map((zip) => ({ zip }))
}

function normalizeZip(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 5)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function formatPriceShort(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  // Brand-voice rounding: nearest thousand.
  const rounded = Math.round(n / 1000) * 1000
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(rounded)
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { zip: rawZip } = await params
  const zip = normalizeZip(rawZip)
  if (!zip || !CANONICAL_ZIPS.has(zip)) return { title: 'ZIP not found' }
  const title = `Homes for Sale in ${zip} | Ryan Realty`
  const description = `Browse active listings in ZIP code ${zip}, Central Oregon. Median price, active inventory, and real-time updates from the MLS.`
  return {
    title,
    description,
    alternates: { canonical: `/zip/${zip}` },
    openGraph: {
      title,
      description,
      url: `/zip/${zip}`,
      type: 'website',
      images: ['/api/og?type=default'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/api/og?type=default'],
    },
  }
}

export default async function ZipPage({ params }: { params: Promise<Params> }) {
  const { zip: rawZip } = await params
  const zip = normalizeZip(rawZip)
  // notFound() for anything outside the canonical list (SITE_SPEC line 115).
  if (!zip || !CANONICAL_ZIPS.has(zip)) notFound()

  const { listings } = await getListingsWithAdvanced({
    postalCode: zip,
    limit: 48,
    offset: 0,
    sort: 'newest',
  })
  const prices = (listings as Array<{ ListPrice?: number | null }>)
    .map((l) => (typeof l.ListPrice === 'number' && Number.isFinite(l.ListPrice) ? l.ListPrice : null))
    .filter((n): n is number => n != null)
  const medianPrice = median(prices)

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}` },
      { '@type': 'ListItem', position: 2, name: 'Search', item: `${baseUrl}/search` },
      { '@type': 'ListItem', position: 3, name: zip, item: `${baseUrl}/zip/${zip}` },
    ],
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/search" className="hover:text-foreground">Search</Link>
        <span className="mx-2">/</span>
        <span>{zip}</span>
      </nav>
      <h1 className="text-3xl font-semibold text-foreground">Homes for sale in {zip}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">{listings.length}</span> active listings
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          Median price <span className="font-semibold text-foreground">{formatPriceShort(medianPrice)}</span>
        </span>
      </div>
      {listings.length === 0 ? (
        <p className="mt-8 text-muted-foreground">No active listings were found for ZIP {zip}. Check back soon as inventory turns over weekly.</p>
      ) : (
        <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing, index) => {
            const listingKey = (listing.ListNumber ?? listing.ListingKey ?? `listing-${index}`).toString().trim()
            return <ListingTile key={listingKey} listing={listing} listingKey={listingKey} signedIn={false} />
          })}
        </section>
      )}
      <section className="mt-10">
        <HomeValuationCta />
      </section>
    </main>
  )
}
