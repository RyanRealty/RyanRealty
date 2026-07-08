import { Skeleton } from '@/components/ui/skeleton'

/**
 * Listing-detail loading state for the canonical /homes-for-sale/<city>/<slug>
 * rewrite target. Without it, tapping a card on search results dead-clicked
 * for 1-3s while the ~500KB page server-rendered (design-audit P1).
 * Shaped like the real page: full-bleed hero, then price/address lines,
 * CTA row, and content columns.
 */
export default function ListingDetailLoading() {
  return (
    <main className="min-h-screen bg-background">
      <Skeleton className="h-[62svh] w-full rounded-none" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-3 h-5 w-80" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Skeleton className="h-12 w-44" />
          <Skeleton className="h-12 w-40" />
          <Skeleton className="h-12 w-24" />
          <Skeleton className="h-12 w-24" />
        </div>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-8 h-64 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    </main>
  )
}
