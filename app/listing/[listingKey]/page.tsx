import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  fetchSparkListingByKey,
  getAdjacentListingKey,
  type SparkDocument,
  type SparkListingResult,
} from '../../../lib/spark'
import {
  getListingByKey,
  getAdjacentListingKeyFromSupabase,
  getListingHistory,
  getOtherListingsInSubdivision,
} from '../../actions/listings'
import { getBannerUrl } from '../../actions/banners'
import { getSession } from '../../actions/auth'
import { getBuyingPreferences } from '../../actions/buying-preferences'
import { isListingSaved } from '../../actions/saved-listings'
import { cityEntityKey, subdivisionEntityKey } from '../../../lib/slug'
import { trackListingView } from '../../../lib/followupboss'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '../../../lib/mortgage'
import SaveListingButton from '../../../components/listing/SaveListingButton'
import ListingGallery from '../../../components/listing/ListingGallery'
import ListingFloorPlans from '../../../components/listing/ListingFloorPlans'
import ListingVideos from '../../../components/listing/ListingVideos'
import ListingDetails from '../../../components/listing/ListingDetails'
import ListingNav from '../../../components/listing/ListingNav'
import ListingSimilarListings from '../../../components/listing/ListingSimilarListings'
import ListingDetailMap from '../../../components/listing/ListingDetailMap'
import ListingHistory from '../../../components/listing/ListingHistory'
import ListingDocuments from '../../../components/listing/ListingDocuments'
import ListingJsonLd from '../../../components/listing/ListingJsonLd'
import ListingCtaSidebar from '../../../components/listing/ListingCtaSidebar'
import ShareButton from '../../../components/ShareButton'
import Breadcrumb from '../../../components/Breadcrumb'

type PageProps = { params: Promise<{ listingKey: string }> }

export const revalidate = 60

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

function metadataFromFields(f: Record<string, unknown>, listingKey: string) {
  const address = [f.StreetNumber, f.StreetName].filter(Boolean).join(' ')
  const cityState = [f.City, f.StateOrProvince].filter(Boolean).join(', ')
  const title = address || cityState || `MLS# ${f.ListingId ?? listingKey}`
  const price = f.ListPrice != null ? `$${Number(f.ListPrice).toLocaleString()}` : ''
  const desc = [price, f.BedsTotal != null && `${f.BedsTotal} bed`, f.BathsTotal != null && `${f.BathsTotal} bath`, cityState].filter(Boolean).join(' · ')
  return { title: `${title}${cityState ? ` | ${cityState}` : ''}`, description: desc || undefined }
}

function firstPhotoUrl(fields: Record<string, unknown>): string | undefined {
  const photos = fields.Photos as Array<{ Uri1600?: string; Uri1280?: string; Uri1024?: string; Uri800?: string; Primary?: boolean }> | undefined
  if (!Array.isArray(photos) || photos.length === 0) return undefined
  const primary = photos.find((p) => p.Primary) ?? photos[0]
  return primary?.Uri1600 ?? primary?.Uri1280 ?? primary?.Uri1024 ?? primary?.Uri800
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const row = await getListingByKey(listingKey)
  let f = row?.details as Record<string, unknown> | undefined
  if (!f) {
    const token = process.env.SPARK_API_KEY
    if (token?.trim()) {
      try {
        const res = await fetchSparkListingByKey(token, listingKey)
        const raw = (res.D as any)?.Results?.[0] ?? res.D
        f = raw?.StandardFields ?? {}
      } catch {
        return { title: 'Listing' }
      }
    } else {
      return { title: 'Listing' }
    }
  }
  const { title, description } = metadataFromFields(f!, listingKey)
  const listingUrl = `${siteUrl}/listing/${encodeURIComponent(listingKey)}`
  const imageUrl = firstPhotoUrl(f!)
  return {
    title,
    description,
    alternates: { canonical: listingUrl },
    openGraph: {
      title,
      description,
      url: listingUrl,
      type: 'website',
      ...(imageUrl && { images: [{ url: imageUrl, width: 1200, height: 800, alt: title }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  }
}

export default async function ListingPage({ params }: PageProps) {
  const { listingKey } = await params
  const accessToken = process.env.SPARK_API_KEY

  let raw: SparkListingResult | null = null
  let fromSupabase = false

  const row = await getListingByKey(listingKey)
  if (row?.details && typeof row.details === 'object') {
    raw = {
      Id: row.ListingKey ?? row.ListNumber ?? listingKey,
      ResourceUri: '',
      StandardFields: row.details as Record<string, unknown>,
    }
    fromSupabase = true
  }

  if (!raw && accessToken?.trim()) {
    try {
      const res = await fetchSparkListingByKey(accessToken, listingKey)
      const D = res.D as Record<string, unknown> | undefined
      const results = D?.Results as SparkListingResult[] | undefined
      if (Array.isArray(results) && results.length > 0) raw = results[0]
      else if (D && (D.Id || D.StandardFields)) raw = D as SparkListingResult
    } catch {
      raw = null
    }
  }

  if (!raw) notFound()

  const fields = raw.StandardFields ?? {}
  const modTs = (fields.ModificationTimestamp as string) ?? row?.ModificationTimestamp ?? ''
  /** Use OnMarketDate for Spark adjacent listing so we get full historical data; fallback to ListDate then ModificationTimestamp. */
  const orderByDate = (fields.OnMarketDate as string) ?? (fields.ListDate as string) ?? modTs
  const subdivisionName = ((fields.SubdivisionName as string) ?? '').trim()

  const [prevKey, nextKey, historyRows, similarListings] = await Promise.all([
    fromSupabase && modTs
      ? getAdjacentListingKeyFromSupabase(modTs, 'prev')
      : accessToken && orderByDate
        ? getAdjacentListingKey(listingKey, orderByDate, 'prev')
        : Promise.resolve(null),
    fromSupabase && modTs
      ? getAdjacentListingKeyFromSupabase(modTs, 'next')
      : accessToken && orderByDate
        ? getAdjacentListingKey(listingKey, orderByDate, 'next')
        : Promise.resolve(null),
    getListingHistory(listingKey),
    subdivisionName ? getOtherListingsInSubdivision(subdivisionName, listingKey) : Promise.resolve([]),
  ])
  const historyItems = historyRows.map((r) => ({
    Date: r.event_date ?? undefined,
    Event: r.event ?? undefined,
    Price: r.price ?? undefined,
    PriceChange: r.price_change ?? undefined,
    Description: r.description ?? undefined,
  }))

  const address = [
    fields.StreetNumber,
    fields.StreetDirPrefix,
    fields.StreetName,
    fields.StreetSuffix,
    fields.StreetDirSuffix,
  ]
    .filter(Boolean)
    .join(' ')
  const cityStateZip = [fields.City, fields.StateOrProvince, fields.PostalCode].filter(Boolean).join(', ')

  const listingUrl = `${siteUrl}/listing/${encodeURIComponent(listingKey)}`
  const firstPhoto = firstPhotoUrl(fields)
  const city = (fields.City as string) ?? ''
  const subdivision = ((fields.SubdivisionName as string) ?? '').trim()

  const breadcrumbItems: { name: string; item: string }[] = [
    { name: 'Ryan Realty', item: siteUrl },
    { name: 'Homes for Sale', item: `${siteUrl}/listings` },
  ]
  if (city) breadcrumbItems.push({ name: city, item: `${siteUrl}/search/${cityEntityKey(city)}` })
  if (subdivision) breadcrumbItems.push({ name: subdivision, item: `${siteUrl}/search/${cityEntityKey(city)}/${encodeURIComponent(subdivision)}` })
  breadcrumbItems.push({ name: address || `MLS# ${fields.ListingId ?? listingKey}`, item: listingUrl })
  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, i) => ({ '@type': 'ListItem' as const, position: i + 1, name: item.name, item: item.item })),
  }

  const [areaBannerUrl, session, prefs, saved] = await Promise.all([
    city
      ? getBannerUrl(
          subdivision ? 'subdivision' : 'city',
          subdivision ? subdivisionEntityKey(city, subdivision) : cityEntityKey(city)
        )
      : Promise.resolve(null),
    getSession(),
    getBuyingPreferences(),
    isListingSaved(listingKey),
  ])
  const listPrice = fields.ListPrice != null ? Number(fields.ListPrice) : 0
  const displayPrefs = prefs ?? { downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT, interestRate: DEFAULT_DISPLAY_RATE, loanTermYears: DEFAULT_DISPLAY_TERM_YEARS }
  const monthlyPayment = listPrice > 0 ? estimatedMonthlyPayment(listPrice, displayPrefs.downPaymentPercent, displayPrefs.interestRate, displayPrefs.loanTermYears) : null
  const signedIn = !!session?.user
  const areaSearchHref = city ? `${siteUrl}/search/${cityEntityKey(city)}${subdivision ? `/${encodeURIComponent(subdivision)}` : ''}` : null
  const areaLabel = subdivision ? subdivision : city

  if (session?.user?.email) {
    trackListingView({
      user: session.user,
      listingUrl,
      property: {
        street: address || undefined,
        city: (fields.City as string) || undefined,
        state: (fields.StateOrProvince as string) || undefined,
        code: (fields.PostalCode as string) || undefined,
        mlsNumber: (fields.ListingId as string) ?? listingKey,
        price: fields.ListPrice != null ? Number(fields.ListPrice) : undefined,
        bedrooms: fields.BedsTotal != null ? Number(fields.BedsTotal) : undefined,
        bathrooms: fields.BathsTotal != null ? Number(fields.BathsTotal) : undefined,
        area: fields.BuildingAreaTotal != null ? Number(fields.BuildingAreaTotal) : undefined,
      },
    }).catch(() => {})
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbList) }} />
      <ListingJsonLd listingKey={listingKey} fields={fields} imageUrl={firstPhoto} />
      {/* Top bar: back + prev/next */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/listings"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            ← All listings
          </Link>
          <ListingNav
            listingKey={listingKey}
            prevKey={prevKey}
            nextKey={nextKey}
          />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8">
          <div className="min-w-0">
            <Breadcrumb
              items={breadcrumbItems.map((item, i) => (i < breadcrumbItems.length - 1 ? { label: item.name, href: item.item } : { label: item.name }))}
            />
            {areaSearchHref && (
              <Link
                href={areaSearchHref}
                className="mb-6 flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow"
              >
                {areaBannerUrl ? (
                  <img
                    src={areaBannerUrl}
                    alt=""
                    className="h-20 w-40 shrink-0 object-cover sm:h-24 sm:w-52"
                    width={208}
                    height={96}
                  />
                ) : (
                  <div className="flex h-20 w-40 shrink-0 items-center justify-center bg-zinc-100 text-zinc-400 sm:h-24 sm:w-52" />
                )}
                <div className="flex flex-1 items-center px-4">
                  <span className="font-medium text-zinc-700">Explore homes in {areaLabel}</span>
                  <span className="ml-2 text-zinc-400">→</span>
                </div>
              </Link>
            )}
            {/* Title row */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-500">
                  MLS# {fields.ListingId ?? listingKey}
                  {fields.StandardStatus && ` · ${fields.StandardStatus}`}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {address || 'Address not specified'}
                </h1>
                {cityStateZip && (
                  <p className="mt-1 text-zinc-600">{cityStateZip}</p>
                )}
                <p className="mt-2 text-2xl font-semibold text-zinc-900">
                  ${Number(fields.ListPrice ?? 0).toLocaleString()}
                </p>
                {monthlyPayment != null && monthlyPayment > 0 && (
                  <p className="mt-1 text-sm text-zinc-600">
                    {signedIn ? (
                      <Link href="/account/buying-preferences" className="hover:text-zinc-900 underline-offset-2 hover:underline">
                        Est. {formatMonthlyPayment(monthlyPayment)}/mo <span className="text-zinc-400">(P&amp;I — update preferences)</span>
                      </Link>
                    ) : (
                      <Link href="/account/buying-preferences" className="hover:text-zinc-900 underline-offset-2 hover:underline">
                        Est. ~{formatMonthlyPayment(monthlyPayment)}/mo — Get accurate pricing
                      </Link>
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {session?.user && (
                  <SaveListingButton listingKey={listingKey} saved={saved} />
                )}
                <ShareButton
                title={`${address || cityStateZip || `MLS# ${fields.ListingId ?? listingKey}`}${cityStateZip ? ` | ${cityStateZip}` : ''}`}
                text={[`$${Number(fields.ListPrice ?? 0).toLocaleString()}`, fields.BedsTotal != null && `${fields.BedsTotal} bed`, fields.BathsTotal != null && `${fields.BathsTotal} bath`, cityStateZip].filter(Boolean).join(' · ')}
                url={listingUrl}
                variant="default"
              />
              </div>
            </div>

            {/* CTAs: visible on mobile/tablet only (desktop has sidebar) */}
            <div className="mb-6 lg:hidden">
              <ListingCtaSidebar
                address={address || 'Address not specified'}
                cityStateZip={cityStateZip ?? undefined}
                listingUrl={listingUrl}
                listPrice={fields.ListPrice != null ? Number(fields.ListPrice) : null}
                listingId={fields.ListingId ?? listingKey}
              />
            </div>

            {/* Gallery */}
        <section className="mb-10">
          <ListingGallery photos={fields.Photos ?? []} />
        </section>

        {/* Map: subject listing + other listings in community */}
        {(fields.Latitude != null && fields.Longitude != null && Number.isFinite(Number(fields.Latitude)) && Number.isFinite(Number(fields.Longitude))) ||
        similarListings.some((l) => l.Latitude != null && l.Longitude != null && Number.isFinite(Number(l.Latitude)) && Number.isFinite(Number(l.Longitude))) ? (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">Location</h2>
            <ListingDetailMap
              subjectListing={
                (() => {
                  if (fields.Latitude == null || fields.Longitude == null) return null
                  const lat = Number(fields.Latitude)
                  const lng = Number(fields.Longitude)
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
                  return {
                    latitude: lat,
                    longitude: lng,
                    listingKey,
                    listPrice: fields.ListPrice,
                  }
                })()
              }
              otherListings={similarListings
                .filter((l) => l.Latitude != null && l.Longitude != null && Number.isFinite(Number(l.Latitude)) && Number.isFinite(Number(l.Longitude)))
                .map((l) => ({
                  latitude: Number(l.Latitude),
                  longitude: Number(l.Longitude),
                  listingKey: l.ListingKey,
                  listPrice: l.ListPrice,
                }))}
            />
            {similarListings.length > 0 && (
              <p className="mt-2 text-sm text-zinc-500">
                Blue marker is this listing; others are for sale in the same community. Click a price to view that listing.
              </p>
            )}
          </section>
        ) : null}

        {/* Key facts bar */}
        <div className="mb-10 flex flex-wrap gap-6 rounded-xl border border-zinc-200 bg-white px-6 py-4">
          {fields.BedsTotal != null && (
            <div>
              <span className="text-sm text-zinc-500">Beds</span>
              <p className="font-semibold">{fields.BedsTotal}</p>
            </div>
          )}
          {fields.BathsTotal != null && (
            <div>
              <span className="text-sm text-zinc-500">Baths</span>
              <p className="font-semibold">{fields.BathsTotal}</p>
            </div>
          )}
          {fields.BuildingAreaTotal != null && (
            <div>
              <span className="text-sm text-zinc-500">Sq Ft</span>
              <p className="font-semibold">{fields.BuildingAreaTotal.toLocaleString()}</p>
            </div>
          )}
          {fields.LotSizeAcres != null && (
            <div>
              <span className="text-sm text-zinc-500">Acres</span>
              <p className="font-semibold">{fields.LotSizeAcres}</p>
            </div>
          )}
          {fields.YearBuilt != null && (
            <div>
              <span className="text-sm text-zinc-500">Year Built</span>
              <p className="font-semibold">{fields.YearBuilt}</p>
            </div>
          )}
        </div>

        {/* Floor plans */}
        {(fields.FloorPlans?.length ?? 0) > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">Floor plans</h2>
            <ListingFloorPlans floorPlans={fields.FloorPlans ?? []} />
          </section>
        )}

        {/* Videos & virtual tours */}
        <section className="mb-10">
          <ListingVideos
            videos={fields.Videos ?? []}
            virtualTours={fields.VirtualTours ?? []}
          />
        </section>

        {/* Other homes in this community */}
        {similarListings.length > 0 && (
          <section className="mb-10">
            <ListingSimilarListings
              subdivisionName={subdivisionName}
              listings={similarListings}
            />
          </section>
        )}

        {/* Documents */}
        <ListingDocuments documents={(fields.Documents as SparkDocument[] | undefined) ?? []} />

        {/* Listing history (from Supabase; run admin history sync to backfill) */}
        <section className="mb-10">
          <ListingHistory items={historyItems} />
        </section>

        {/* Full details */}
        <section>
          <ListingDetails listing={raw} />
        </section>
          </div>

          {/* Sticky CTA sidebar (desktop): Schedule a showing + Contact agent */}
          <div className="hidden lg:block">
            <ListingCtaSidebar
              address={address || 'Address not specified'}
              cityStateZip={cityStateZip ?? undefined}
              listingUrl={listingUrl}
              listPrice={fields.ListPrice != null ? Number(fields.ListPrice) : null}
              listingId={fields.ListingId ?? listingKey}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
