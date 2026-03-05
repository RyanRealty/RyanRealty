'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { ListingCardRow } from '../app/actions/listings'
import { toggleSavedListing } from '../app/actions/saved-listings'

const NEW_LISTING_DAYS = 14
const PRICE_CHANGE_DAYS = 30

function isNewListing(modTs: string | null | undefined): boolean {
  if (!modTs) return false
  const d = new Date(modTs)
  if (isNaN(d.getTime())) return false
  const days = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000)
  return days <= NEW_LISTING_DAYS
}

type Props = {
  listing: ListingCardRow
  priority?: boolean
  /** Set when listing has a recent price change in listing_history (for badge) */
  hasRecentPriceChange?: boolean
  /** When set, show save heart (signed-in user). true = saved, false = not saved */
  saved?: boolean
  /** Est. monthly P&I (from preferences or default). When set, overlay is shown and clickable. */
  monthlyPayment?: string
  /** If true, overlay links to buying preferences; if false, overlay links to same with CTA "Get accurate pricing" */
  signedIn?: boolean
}

function statusLabel(status: string | null | undefined): string {
  if (!status || !String(status).trim()) return 'Active'
  const s = String(status).trim()
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function statusBadgeColor(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase()
  if (s.includes('pending')) return 'bg-amber-500'
  if (s.includes('closed')) return 'bg-zinc-500'
  if (s.includes('active') || s.includes('for sale')) return 'bg-emerald-600'
  return 'bg-zinc-600'
}

const BUYING_PREFS_URL = '/account/buying-preferences'

export default function ListingCard({ listing, priority = false, hasRecentPriceChange = false, saved, monthlyPayment, signedIn = false }: Props) {
  const router = useRouter()
  const { ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, PhotoURL, ModificationTimestamp, StandardStatus } = listing
  const address = [StreetNumber, StreetName].filter(Boolean).join(' ')
  const imgSrc = PhotoURL ?? null
  const linkKey = ListingKey ?? ListNumber ?? ''
  const showNew = isNewListing(ModificationTimestamp ?? undefined)
  const status = statusLabel(StandardStatus)
  const showSaveButton = typeof saved === 'boolean'

  const price = Number(ListPrice ?? 0)
  const calculatorUrl = price > 0 ? `/tools/mortgage-calculator?price=${price}` : '/tools/mortgage-calculator'

  async function handleToggleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!linkKey) return
    await toggleSavedListing(linkKey)
    router.refresh()
  }

  function handleBuyingPrefsClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    router.push(BUYING_PREFS_URL)
  }

  function handleCardClick(e: React.MouseEvent) {
    if (!linkKey) return
    const target = e.target as HTMLElement
    if (target.closest('a') || target.closest('button')) return
    e.preventDefault()
    router.push(`/listing/${encodeURIComponent(String(linkKey))}`)
  }

  const listingHref = linkKey ? `/listing/${encodeURIComponent(String(linkKey))}` : null

  return (
    <div className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md">
      <div
        role={listingHref ? 'link' : undefined}
        aria-label={listingHref ? 'View listing' : undefined}
        onClick={listingHref ? handleCardClick : undefined}
        className={listingHref ? 'block cursor-pointer' : 'block'}
      >
      <div className="relative aspect-[4/3] bg-zinc-100">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt=""
            fill
            className="object-cover transition group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">No photo</div>
        )}
        <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-1 text-sm font-semibold text-zinc-900 shadow-sm">
          ${Number(ListPrice ?? 0).toLocaleString()}
        </span>
        {monthlyPayment && (
          <button
            type="button"
            onClick={handleBuyingPrefsClick}
            className="absolute bottom-3 left-3 right-3 z-10 block rounded-lg bg-black/70 px-2 py-1.5 text-center text-sm font-medium text-white shadow-sm hover:bg-black/80"
          >
            {signedIn ? (
              <>Est. {monthlyPayment}/mo</>
            ) : (
              <>Est. ~{monthlyPayment}/mo — Get accurate pricing</>
            )}
          </button>
        )}
        <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1.5">
          {showSaveButton && (
            <button
              type="button"
              onClick={handleToggleSave}
              className="rounded-full bg-white/95 p-1.5 shadow-sm hover:bg-white"
              aria-label={saved ? 'Remove from saved homes' : 'Save to saved homes'}
            >
              {saved ? (
                <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
              ) : (
                <svg className="h-5 w-5 text-zinc-400 hover:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              )}
            </button>
          )}
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold text-white shadow-sm ${statusBadgeColor(StandardStatus)}`}>
            {status}
          </span>
          {showNew && (
            <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">New</span>
          )}
          {hasRecentPriceChange && (
            <span className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">Price reduced</span>
          )}
        </div>
      </div>
      <div className="p-4">
        {(BedroomsTotal != null || BathroomsTotal != null) && (
          <p className="text-sm font-medium text-zinc-600">
            {[BedroomsTotal != null && `${BedroomsTotal} bed`, BathroomsTotal != null && `${BathroomsTotal} bath`].filter(Boolean).join(' · ')}
          </p>
        )}
        {address && <p className="mt-1 truncate font-medium text-zinc-900">{address}</p>}
        {City && <p className="text-sm text-zinc-500">{City}</p>}
      </div>
      </div>
      {price > 0 && (
        <div className="border-t border-zinc-100 px-4 py-2">
          <Link
            href={calculatorUrl}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Est. monthly payment →
          </Link>
        </div>
      )}
    </div>
  )
}
