import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  fetchSparkListingByKey,
  fetchSparkListingHistory,
  fetchSparkPriceHistory,
  getAdjacentListingKey,
  type SparkDocument,
  type SparkListingResult,
} from '../../../lib/spark'
import {
  getListingByKey,
  getAdjacentListingKeyFromSupabase,
  getListingHistory,
  getSimilarListingsWithFallback,
  getListingsAtAddress,
} from '../../actions/listings'
import { getBannerUrl } from '../../actions/banners'
import { getSession } from '../../actions/auth'
import { getBuyingPreferences } from '../../actions/buying-preferences'
import { isListingSaved, getSavedListingCount, getSavedListingKeys } from '../../actions/saved-listings'
import { isListingLiked, getLikeCount, getLikedListingKeys } from '../../actions/likes'
import { cityEntityKey, subdivisionEntityKey, listingKeyFromSlug } from '../../../lib/slug'
import { trackListingView } from '../../../lib/followupboss'
import { getFubPersonIdFromCookie } from '../../actions/fub-identity-bridge'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '../../../lib/mortgage'
import SaveListingButton from '../../../components/listing/SaveListingButton'
import LikeButton from '../../../components/listing/LikeButton'
import ListingHero from '../../../components/listing/ListingHero'
import ListingFloorPlans from '../../../components/listing/ListingFloorPlans'
import ListingVideos from '../../../components/listing/ListingVideos'
import ListingDetails from '../../../components/listing/ListingDetails'
import ListingNav from '../../../components/listing/ListingNav'
import ListingSimilarListings from '../../../components/listing/ListingSimilarListings'
import ListingOtherListingsAtAddress from '../../../components/listing/ListingOtherListingsAtAddress'
import ListingDetailMapGoogle from '../../../components/listing/ListingDetailMapGoogle'
import ListingHistory from '../../../components/listing/ListingHistory'
import ListingDocuments from '../../../components/listing/ListingDocuments'
import ListingJsonLd from '../../../components/listing/ListingJsonLd'
import ListingCtaSidebar from '../../../components/listing/ListingCtaSidebar'
import ListingSpecial from '../../../components/listing/ListingSpecial'
import { buildListingHighlights } from '../../../lib/listing-highlights'
import ListingCommunitySection from '../../../components/listing/ListingCommunitySection'
import ListingValuationSection from '../../../components/listing/ListingValuationSection'
import ShareButton from '../../../components/ShareButton'
import TrackListingView from '../../../components/tracking/TrackListingView'
import Breadcrumb from '../../../components/Breadcrumb'
import CollapsibleSection from '../../../components/CollapsibleSection'
import BackToSearchLink from '../../../components/listing/BackToSearchLink'
import { getSubdivisionTabContent } from '../../actions/subdivision-descriptions'

type PageProps = {
  params: Promise<{ listingKey: string }>
  searchParams?: Promise<{ from?: string; return?: string }>
}

export const revalidate = 60

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

function metadataFromFields(f: Record<string, unknown>, listingKey: string) {
  const address = [f.StreetNumber, f.StreetName].filter(Boolean).join(' ')
  const cityState = [f.City, f.StateOrProvince].filter(Boolean).join(', ')
  const title = address || cityState || `MLS# ${f.ListingId ?? listingKey}`
  const price = f.ListPrice != null ? `$${Number(f.ListPrice).toLocaleString()}` : ''
  const beds = (f.BedroomsTotal ?? f.BedsTotal) != null ? `${f.BedroomsTotal ?? f.BedsTotal} bed` : null
  const baths = (f.BathroomsTotal ?? f.BathsTotal) != null ? `${f.BathroomsTotal ?? f.BathsTotal} bath` : null
  const desc = [price, beds, baths, cityState].filter(Boolean).join(' · ')
  return { title: `${title}${cityState ? ` | ${cityState}` : ''}`, description: desc || undefined }
}

function firstPhotoUrl(fields: Record<string, unknown>): string | undefined {
  const photos = fields.Photos as Array<{ Uri1600?: string; Uri1280?: string; Uri1024?: string; Uri800?: string; Primary?: boolean }> | undefined
  if (!Array.isArray(photos) || photos.length === 0) return undefined
  const primary = photos.find((p) => p.Primary) ?? photos[0]
  return primary?.Uri1600 ?? primary?.Uri1280 ?? primary?.Uri1024 ?? primary?.Uri800
}

/** Normalize Photos from Spark or Supabase details (handles casing so hero always gets Uri*, Primary). */
function normalizeListingPhotos(fields: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = fields.Photos ?? fields.photos
  if (!Array.isArray(raw)) return []
  return raw.map((p) => {
    if (typeof p !== 'object' || p === null) return {}
    const o = p as Record<string, unknown>
    return {
      Id: o.Id ?? o.id,
      Primary: o.Primary ?? o.primary,
      Uri300: o.Uri300 ?? o.uri300,
      Uri640: o.Uri640 ?? o.uri640,
      Uri800: o.Uri800 ?? o.uri800,
      Uri1024: o.Uri1024 ?? o.uri1024,
      Uri1280: o.Uri1280 ?? o.uri1280,
      Uri1600: o.Uri1600 ?? o.uri1600,
      Caption: o.Caption ?? o.caption,
      ...o,
    }
  })
}

/** Normalize Videos from Spark or Supabase details (handles casing so hero shows ObjectHtml/Uri). See docs/VIDEO_DATA_FLOW.md for full trace. */
function normalizeListingVideos(fields: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = fields.Videos ?? fields.videos
  if (!Array.isArray(raw)) return []
  return raw.map((v) => {
    if (typeof v !== 'object' || v === null) return {}
    const o = v as Record<string, unknown>
    return {
      Id: o.Id ?? o.id,
      Uri: o.Uri ?? o.uri,
      ObjectHtml: o.ObjectHtml ?? o.object_html ?? o.ObjectHTML,
      Name: o.Name ?? o.name,
      Caption: o.Caption ?? o.caption,
      ...o,
    }
  })
}

/** Normalize VirtualTours from Spark or Supabase details. */
function normalizeListingVirtualTours(fields: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = fields.VirtualTours ?? fields.virtual_tours
  if (!Array.isArray(raw)) return []
  return raw.map((vt) => {
    if (typeof vt !== 'object' || vt === null) return {}
    const o = vt as Record<string, unknown>
    return { Id: o.Id ?? o.id, Uri: o.Uri ?? o.uri, Name: o.Name ?? o.name, ...o }
  })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const row = await getListingByKey(listingKey)
  const resolvedKey = row ? (row.ListNumber ?? row.ListingKey ?? listingKey) : listingKeyFromSlug(listingKey)
  let f = row?.details as Record<string, unknown> | undefined
  if (!f) {
    const token = process.env.SPARK_API_KEY
    if (token?.trim() && resolvedKey) {
      try {
        const res = await fetchSparkListingByKey(token, resolvedKey)
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

export default async function ListingPage({ params, searchParams }: PageProps) {
  const { listingKey } = await params
  const sp = (await searchParams?.catch(() => ({})) ?? {}) as { return?: string }
  const returnUrl = typeof sp.return === 'string' && sp.return.trim() ? sp.return.trim() : null
  const accessToken = process.env.SPARK_API_KEY

  let raw: SparkListingResult | null = null
  let fromSupabase = false

  const row = await getListingByKey(listingKey)
  const resolvedKey = String(
    row ? (row.ListNumber ?? row.ListingKey ?? listingKey) : listingKeyFromSlug(listingKey)
  ).trim()
  if (row?.details && typeof row.details === 'object') {
    raw = {
      Id: row.ListingKey ?? row.ListNumber ?? listingKey,
      ResourceUri: '',
      StandardFields: row.details as Record<string, unknown>,
    }
    fromSupabase = true
  }

  if (!raw && accessToken?.trim() && resolvedKey) {
    try {
      const res = await fetchSparkListingByKey(accessToken, resolvedKey)
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

  const streetNumber = (row?.StreetNumber ?? fields.StreetNumber ?? '')?.toString().trim() || null
  const streetName = (row?.StreetName ?? fields.StreetName ?? '')?.toString().trim() || null
  const addressCity = (row?.City ?? fields.City ?? '')?.toString().trim() || null
  const addressState = (row?.State ?? fields.StateOrProvince ?? '')?.toString().trim() || null
  const postalCode = (row?.PostalCode ?? fields.PostalCode ?? '')?.toString().trim() || null
  const hasAddress = !!(streetNumber || streetName) && !!addressCity

  const [prevKey, nextKey, historyRows, similarListings, listingsAtAddressActive, listingsAtAddressAll] = await Promise.all([
    fromSupabase && modTs
      ? getAdjacentListingKeyFromSupabase(modTs, 'prev')
      : accessToken && orderByDate
        ? getAdjacentListingKey(resolvedKey, orderByDate, 'prev')
        : Promise.resolve(null),
    fromSupabase && modTs
      ? getAdjacentListingKeyFromSupabase(modTs, 'next')
      : accessToken && orderByDate
        ? getAdjacentListingKey(resolvedKey, orderByDate, 'next')
        : Promise.resolve(null),
    getListingHistory(resolvedKey),
    getSimilarListingsWithFallback(subdivisionName || null, addressCity || null, resolvedKey, 4, 8),
    hasAddress
      ? getListingsAtAddress({
          streetNumber,
          streetName,
          city: addressCity,
          state: addressState,
          postalCode,
          excludeListingKey: resolvedKey,
          includeClosed: false,
        })
      : Promise.resolve([]),
    hasAddress
      ? getListingsAtAddress({
          streetNumber,
          streetName,
          city: addressCity,
          state: addressState,
          postalCode,
          excludeListingKey: resolvedKey,
          includeClosed: true,
        })
      : Promise.resolve([]),
  ])
  let historyItems: { Date?: string; Event?: string; Price?: number; PriceChange?: number; Description?: string }[] = historyRows.map((r) => ({
    Date: r.event_date ?? undefined,
    Event: r.event ?? undefined,
    Price: r.price ?? undefined,
    PriceChange: r.price_change ?? undefined,
    Description: r.description ?? undefined,
  }))
  // VOW/Spark fallback: when Supabase has no history, fetch from Spark API (works with VOW subscription)
  if (historyItems.length === 0 && accessToken?.trim()) {
    let sparkItems = (await fetchSparkListingHistory(accessToken, resolvedKey)).items
    if (sparkItems.length === 0) sparkItems = (await fetchSparkPriceHistory(accessToken, resolvedKey)).items
    if (sparkItems.length > 0) {
      const mapped = sparkItems.map((item) => ({
        Date: (item.ModificationTimestamp ?? item.Date) ?? undefined,
        Event: typeof item.Event === 'string' ? item.Event : undefined,
        Price: typeof item.Price === 'number' ? item.Price : typeof item.PriceAtEvent === 'number' ? item.PriceAtEvent : undefined,
        PriceChange: typeof item.PriceChange === 'number' ? item.PriceChange : undefined,
        Description: typeof item.Description === 'string' ? item.Description : undefined,
      }))
      mapped.sort((a, b) => {
        const tA = a.Date ? new Date(a.Date).getTime() : 0
        const tB = b.Date ? new Date(b.Date).getTime() : 0
        return tB - tA
      })
      historyItems = mapped
    }
  }

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
  const lastCrumbName = address || `MLS# ${fields.ListingId ?? resolvedKey}`
  breadcrumbItems.push({ name: lastCrumbName.length > 48 ? lastCrumbName.slice(0, 45) + '…' : lastCrumbName, item: listingUrl })
  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, i) => ({ '@type': 'ListItem' as const, position: i + 1, name: item.name, item: item.item })),
  }

  const [areaBannerUrl, session, prefs, saved, saveCount, liked, likeCount, subdivisionContent] = await Promise.all([
    city
      ? getBannerUrl(
          subdivision ? 'subdivision' : 'city',
          subdivision ? subdivisionEntityKey(city, subdivision) : cityEntityKey(city)
        )
      : Promise.resolve(null),
    getSession(),
    getBuyingPreferences(),
    isListingSaved(resolvedKey),
    getSavedListingCount(resolvedKey),
    isListingLiked(resolvedKey),
    getLikeCount(resolvedKey),
    city && subdivision ? getSubdivisionTabContent(city, subdivision) : Promise.resolve({ about: null, attractions: null, dining: null }),
  ])
  const [savedKeys, likedKeys] = session?.user
    ? await Promise.all([getSavedListingKeys(), getLikedListingKeys()])
    : [[] as string[], [] as string[]]
  const listPrice = fields.ListPrice != null ? Number(fields.ListPrice) : 0
  const displayPrefs = prefs ?? { downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT, interestRate: DEFAULT_DISPLAY_RATE, loanTermYears: DEFAULT_DISPLAY_TERM_YEARS }
  const monthlyPayment = listPrice > 0 ? estimatedMonthlyPayment(listPrice, displayPrefs.downPaymentPercent, displayPrefs.interestRate, displayPrefs.loanTermYears) : null
  const signedIn = !!session?.user
  const calculatorUrl =
    listPrice > 0
      ? `/tools/mortgage-calculator?price=${listPrice}&down=${displayPrefs.downPaymentPercent}&rate=${displayPrefs.interestRate}&term=${displayPrefs.loanTermYears}`
      : undefined
  const areaSearchHref = city ? `${siteUrl}/search/${cityEntityKey(city)}${subdivision ? `/${encodeURIComponent(subdivision)}` : ''}` : null
  const areaLabel = subdivision ? subdivision : city

  /** Key facts with RESO/Spark field fallbacks. Coerce to number only when finite to avoid NaN in DOM. */
  const toNum = (v: unknown): number | null => {
    if (v == null) return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  const sqFt = toNum(fields.BuildingAreaTotal ?? fields.LivingArea)
  const listPriceNum = fields.ListPrice != null ? Number(fields.ListPrice) : 0
  const keyFacts = {
    beds: toNum(fields.BedroomsTotal ?? fields.BedsTotal),
    baths: toNum(fields.BathroomsTotal ?? fields.BathsTotal),
    sqFt,
    lotAcres: toNum(fields.LotSizeAcres),
    yearBuilt: fields.YearBuilt != null ? (typeof fields.YearBuilt === 'number' ? fields.YearBuilt : (Number(fields.YearBuilt) || String(fields.YearBuilt))) : null,
    pricePerSqFt: sqFt != null && sqFt > 0 && listPriceNum > 0 ? Math.round(listPriceNum / sqFt) : null,
  }
  const { highlights: specialHighlights, featureTags: specialTags } = buildListingHighlights(fields as Record<string, unknown>)

  const fubPersonId = session?.user ? undefined : await getFubPersonIdFromCookie()
  if (session?.user?.email || (fubPersonId != null && fubPersonId > 0)) {
    trackListingView({
      user: session?.user ?? undefined,
      fubPersonId: fubPersonId ?? undefined,
      listingUrl,
      property: {
        street: address || undefined,
        city: (fields.City as string) || undefined,
        state: (fields.StateOrProvince as string) || undefined,
        code: (fields.PostalCode as string) || undefined,
        mlsNumber: (fields.ListingId as string) ?? resolvedKey,
        price: fields.ListPrice != null ? Number(fields.ListPrice) : undefined,
        bedrooms: keyFacts.beds ?? undefined,
        bathrooms: keyFacts.baths ?? undefined,
        area: keyFacts.sqFt ?? undefined,
      },
    }).catch(() => {})
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-900">
      <TrackListingView
        listingKey={resolvedKey}
        listingUrl={listingUrl}
        price={fields.ListPrice != null ? Number(fields.ListPrice) : undefined}
        city={fields.City as string}
        state={fields.StateOrProvince as string}
        mlsNumber={(fields.ListingId as string) ?? resolvedKey}
        bedrooms={keyFacts.beds ?? undefined}
        bathrooms={keyFacts.baths ?? undefined}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbList) }} />
      <ListingJsonLd listingKey={resolvedKey} fields={fields} imageUrl={firstPhoto} />

      {/* Hero: video first (if any), then photos — full width at top. Normalize for Supabase details (casing). */}
      <ListingHero
        photos={normalizeListingPhotos(fields) as import('../../../lib/spark').SparkPhoto[]}
        videos={normalizeListingVideos(fields) as import('../../../lib/spark').SparkVideo[]}
      />

      {/* Top bar: back to search (when from search) + All listings + prev/next */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <BackToSearchLink returnUrl={returnUrl ?? undefined} />
            <Link href="/listings" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              All listings
            </Link>
          </div>
          <ListingNav
            listingKey={resolvedKey}
            prevKey={prevKey}
            nextKey={nextKey}
          />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Breadcrumb
          items={breadcrumbItems.map((item, i) => (i < breadcrumbItems.length - 1 ? { label: item.name, href: item.item } : { label: item.name }))}
        />
        <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8">
          <div className="min-w-0">
            {areaSearchHref && !subdivision && (
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
            {/* 2. Address + Status (no price or mortgage in main block per request) */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-500">MLS# {fields.ListingId ?? resolvedKey}</p>
                <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-800 sm:text-2xl">
                  {address || 'Address not specified'}
                </h1>
                {cityStateZip && <p className="mt-0.5 text-zinc-600">{cityStateZip}</p>}
                {fields.StandardStatus && (
                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${
                      String(fields.StandardStatus).toLowerCase().includes('pending')
                        ? 'bg-amber-100 text-amber-800'
                        : String(fields.StandardStatus).toLowerCase().includes('closed')
                          ? 'bg-zinc-200 text-zinc-700'
                          : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {String(fields.StandardStatus).trim() || 'Active'}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {saveCount > 0 && (
                  <span className="text-sm text-zinc-500">{saveCount} {saveCount === 1 ? 'person has' : 'people have'} saved this home</span>
                )}
                {session?.user && (
                  <SaveListingButton
                    listingKey={resolvedKey}
                    saved={saved}
                    userEmail={session.user.email ?? undefined}
                    listingUrl={listingUrl}
                    property={{
                      street: address || undefined,
                      city: (fields.City as string) ?? undefined,
                      state: (fields.StateOrProvince as string) ?? undefined,
                      mlsNumber: (fields.ListingId as string) ?? resolvedKey,
                      price: fields.ListPrice != null ? Number(fields.ListPrice) : undefined,
                      bedrooms: keyFacts.beds ?? undefined,
                      bathrooms: keyFacts.baths ?? undefined,
                    }}
                  />
                )}
                {session?.user && (
                  <LikeButton listingKey={resolvedKey} liked={liked} likeCount={likeCount} variant="default" />
                )}
                <ShareButton
                  title={`${address || cityStateZip || `MLS# ${fields.ListingId ?? resolvedKey}`}${cityStateZip ? ` | ${cityStateZip}` : ''}`}
                  text={[`$${Number(fields.ListPrice ?? 0).toLocaleString()}`, keyFacts.beds != null && `${keyFacts.beds} bed`, keyFacts.baths != null && `${keyFacts.baths} bath`, cityStateZip].filter(Boolean).join(' · ')}
                  url={listingUrl}
                  variant="default"
                />
              </div>
            </div>

            {/* 3. Key facts strip — with icons per audit */}
            {(keyFacts.beds != null || keyFacts.baths != null || keyFacts.sqFt != null || keyFacts.lotAcres != null || keyFacts.yearBuilt != null) && (
              <div className="mb-8 grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-white px-6 py-4 shadow-sm sm:flex sm:flex-wrap sm:gap-6">
                {keyFacts.beds != null && Number.isFinite(keyFacts.beds) && (
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600" aria-hidden>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    </span>
                    <div><p className="text-xs text-zinc-500">Beds</p><p className="font-semibold text-zinc-900">{String(keyFacts.beds)}</p></div>
                  </div>
                )}
                {keyFacts.baths != null && Number.isFinite(keyFacts.baths) && (
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600" aria-hidden>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                    </span>
                    <div><p className="text-xs text-zinc-500">Baths</p><p className="font-semibold text-zinc-900">{String(keyFacts.baths)}</p></div>
                  </div>
                )}
                {keyFacts.sqFt != null && keyFacts.sqFt > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600" aria-hidden>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    </span>
                    <div><p className="text-xs text-zinc-500">Sq Ft</p><p className="font-semibold text-zinc-900">{Number(keyFacts.sqFt).toLocaleString()}</p></div>
                  </div>
                )}
                {keyFacts.lotAcres != null && Number.isFinite(keyFacts.lotAcres) && (
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600" aria-hidden>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0h.5a2.5 2.5 0 002.5-2.5V3.935M12 12a2 2 0 104 0 2 2 0 00-4 0z" /></svg>
                    </span>
                    <div><p className="text-xs text-zinc-500">Lot</p><p className="font-semibold text-zinc-900">{String(keyFacts.lotAcres)} ac</p></div>
                  </div>
                )}
                {keyFacts.yearBuilt != null && (
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600" aria-hidden>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </span>
                    <div><p className="text-xs text-zinc-500">Year Built</p><p className="font-semibold text-zinc-900">{String(keyFacts.yearBuilt)}</p></div>
                  </div>
                )}
              </div>
            )}

            {/* 3b. Estimated Value (CMA) — only when valuation exists and VOW allows display */}
            <ListingValuationSection listingKey={resolvedKey} signedIn={!!session?.user} />

            {/* 4. What Makes This Property Special — per competitive audit */}
            <div className="mb-8">
              <ListingSpecial highlights={specialHighlights} featureTags={specialTags} />
            </div>

            {/* CTAs: visible on mobile/tablet only (desktop has sidebar) */}
            <div className="mb-6 lg:hidden">
              <ListingCtaSidebar
                address={address || 'Address not specified'}
                cityStateZip={cityStateZip ?? undefined}
                listingUrl={listingUrl}
                listPrice={fields.ListPrice != null ? Number(fields.ListPrice) : null}
                listingId={fields.ListingId ?? resolvedKey}
                listingKey={resolvedKey}
                userEmail={session?.user?.email ?? undefined}
                userName={session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name ?? undefined}
                fubPersonId={fubPersonId ?? undefined}
                calculatorUrl={calculatorUrl}
              />
            </div>

            {/* 5. Property Description — full copy before details per audit */}
            {(fields.PublicRemarks ?? fields.PrivateRemarks) && (
              <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-zinc-900">Property description</h2>
                <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-700">{String(fields.PublicRemarks ?? fields.PrivateRemarks).trim()}</p>
              </section>
            )}

            {/* 6. Property Details — MLS fields (description shown above) */}
            <div className="mb-8">
              <ListingDetails listing={raw} showRemarks={false} />
            </div>

            {/* 7. Community Section — one place for subdivision: banner, blurb, listing tiles, link */}
            {subdivision && city && (
              <div className="mb-8">
                <ListingCommunitySection
                  city={city}
                  subdivisionName={subdivision}
                  description={subdivisionContent?.about ?? null}
                  amenitiesLabel={subdivisionContent?.attractions != null ? String(subdivisionContent.attractions).slice(0, 200) + (String(subdivisionContent.attractions).length > 200 ? '…' : '') : null}
                  bannerUrl={areaBannerUrl ?? null}
                  listings={similarListings}
                  signedIn={!!session?.user}
                  userEmail={session?.user?.email ?? undefined}
                  savedKeys={savedKeys}
                  likedKeys={likedKeys}
                />
              </div>
            )}

            {/* 8. Location and Neighborhood */}
        {(fields.Latitude != null && fields.Longitude != null && Number.isFinite(Number(fields.Latitude)) && Number.isFinite(Number(fields.Longitude))) ||
        similarListings.some((l) => l.Latitude != null && l.Longitude != null && Number.isFinite(Number(l.Latitude)) && Number.isFinite(Number(l.Longitude))) ? (
          <CollapsibleSection id="location" title="Location" defaultOpen>
            <ListingDetailMapGoogle
              subjectListing={
                (() => {
                  if (fields.Latitude == null || fields.Longitude == null) return null
                  const lat = Number(fields.Latitude)
                  const lng = Number(fields.Longitude)
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
                  return {
                    latitude: lat,
                    longitude: lng,
                    listingKey: resolvedKey,
                    listPrice: fields.ListPrice,
                  }
                })()
              }
              otherListings={similarListings
                .filter((l) => l.Latitude != null && l.Longitude != null && Number.isFinite(Number(l.Latitude)) && Number.isFinite(Number(l.Longitude)))
                .map((l) => ({
                  latitude: Number(l.Latitude),
                  longitude: Number(l.Longitude),
                  listingKey: (l.ListNumber ?? l.ListingKey ?? '').toString().trim(),
                  listPrice: l.ListPrice,
                }))}
            />
            {similarListings.length > 0 && (
              <p className="mt-2 text-sm text-zinc-500">
                Blue marker is this listing; others are for sale in the same community. Click a price to view that listing.
              </p>
            )}
          </CollapsibleSection>
        ) : null}

            {/* 9. Monthly Cost Estimator — per audit, no login required */}
            <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm" aria-labelledby="monthly-cost-heading">
              <h2 id="monthly-cost-heading" className="mb-3 text-lg font-semibold text-zinc-900">Monthly cost</h2>
              {listPrice > 0 && (
                <>
                  <p className="text-2xl font-semibold text-zinc-900">
                    {monthlyPayment != null && monthlyPayment > 0 ? `Est. ${formatMonthlyPayment(monthlyPayment)}/mo` : '—'}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">Principal & interest. Use the calculator for down payment and rate.</p>
                  <Link
                    href={calculatorUrl ?? '/tools/mortgage-calculator'}
                    className="mt-3 inline-block font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    Mortgage calculator →
                  </Link>
                </>
              )}
              {listPrice <= 0 && <p className="text-zinc-500">List price not set.</p>}
            </section>

            {/* 10. Market Context — price/sf, DOM, days on market, price history */}
            <CollapsibleSection id="market-context" title="Market context" defaultOpen={historyItems.length > 0}>
              <div className="space-y-4">
                {keyFacts.pricePerSqFt != null && (
                  <p className="text-zinc-700">Price per sq ft: <span className="font-semibold">${keyFacts.pricePerSqFt.toLocaleString()}</span></p>
                )}
                {(fields.OnMarketDate ?? fields.ListDate) && (() => {
                  const listDate = fields.OnMarketDate ?? fields.ListDate
                  const listMs = new Date(listDate as string).getTime()
                  const endMs = fields.CloseDate ? new Date(fields.CloseDate as string).getTime() : Date.now()
                  const daysOnMarket = Number.isFinite(listMs) && Number.isFinite(endMs) && endMs >= listMs
                    ? Math.max(0, Math.floor((endMs - listMs) / (24 * 60 * 60 * 1000)))
                    : null
                  return (
                    <>
                      <p className="text-zinc-700">
                        On market: <span className="font-semibold">{new Date(listDate as string).toLocaleDateString()}</span>
                      </p>
                      {daysOnMarket != null && (
                        <p className="text-zinc-700">
                          Days on market: <span className="font-semibold">{daysOnMarket}</span>
                        </p>
                      )}
                    </>
                  )
                })()}
                <ListingHistory items={historyItems} />
              </div>
            </CollapsibleSection>

            {/* 11. Similar Listings — only when no subdivision (with subdivision, tiles are in Community section) */}
            {!subdivision && (
              <CollapsibleSection id="similar" title="Similar listings" defaultOpen badge={similarListings.length || null}>
                {similarListings.length > 0 ? (
                  <ListingSimilarListings
                    subdivisionName={subdivisionName || 'Area'}
                    listings={similarListings}
                    signedIn={!!session?.user}
                    userEmail={session?.user?.email ?? undefined}
                    savedKeys={savedKeys}
                    likedKeys={likedKeys}
                  />
                ) : (
                  <p className="text-zinc-500">No similar listings available right now.</p>
                )}
              </CollapsibleSection>
            )}

            {/* Floor plans */}
        {(fields.FloorPlans?.length ?? 0) > 0 && (
          <CollapsibleSection id="floor-plans" title="Floor plans" defaultOpen badge={(fields.FloorPlans?.length ?? 0)}>
            <ListingFloorPlans floorPlans={fields.FloorPlans ?? []} />
          </CollapsibleSection>
        )}

        {/* Videos & virtual tours */}
        {(normalizeListingVideos(fields).length > 0 || normalizeListingVirtualTours(fields).length > 0) && (
          <CollapsibleSection id="videos" title="Videos & virtual tours" defaultOpen>
            <ListingVideos
              videos={normalizeListingVideos(fields) as import('../../../lib/spark').SparkVideo[]}
              virtualTours={normalizeListingVirtualTours(fields) as import('../../../lib/spark').SparkVirtualTour[]}
            />
          </CollapsibleSection>
        )}

        {/* Other listings at this address (active + optional past) */}
        {listingsAtAddressActive.length > 0 || listingsAtAddressAll.length > 0 ? (
          <CollapsibleSection id="same-address" title="Other listings at this address" defaultOpen>
            <ListingOtherListingsAtAddress
              addressLabel={address || cityStateZip || 'This address'}
              activeListings={listingsAtAddressActive}
              allListings={listingsAtAddressAll}
            />
          </CollapsibleSection>
        ) : null}

        {/* Documents */}
        {(fields.Documents as SparkDocument[] | undefined)?.length ? (
          <CollapsibleSection id="documents" title="Documents" defaultOpen badge={(fields.Documents as SparkDocument[]).length}>
            <ListingDocuments documents={(fields.Documents as SparkDocument[]) ?? []} />
          </CollapsibleSection>
        ) : null}

          </div>

          {/* Sticky CTA sidebar (desktop): Schedule a showing + Contact agent */}
          <div className="hidden lg:block">
            <ListingCtaSidebar
              address={address || 'Address not specified'}
              cityStateZip={cityStateZip ?? undefined}
              listingUrl={listingUrl}
              listPrice={fields.ListPrice != null ? Number(fields.ListPrice) : null}
              listingId={fields.ListingId ?? resolvedKey}
              listingKey={resolvedKey}
              userEmail={session?.user?.email ?? undefined}
              userName={session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name ?? undefined}
              fubPersonId={fubPersonId ?? undefined}
              calculatorUrl={calculatorUrl}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
