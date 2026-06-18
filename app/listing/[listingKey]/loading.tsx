import { Skeleton } from '@/components/ui/skeleton'

/**
 * Listing-detail loading skeleton — matches the KB shell of the resolved page:
 * cream (`bg-[#faf8f4]`) surface, a top spacer that clears the fixed KB top bar,
 * then the hero + breadcrumb + two-column (main + sticky sidebar) silhouette so
 * the layout doesn't jump when the real page hydrates.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#faf8f4]">
      {/* Clears the fixed KB top bar (see app/listing/[listingKey]/page.tsx). */}
      <div aria-hidden="true" className="h-16" />
      <div className="px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-64 mb-3" />
        <Skeleton className="h-[52vh] w-full rounded-xl" />
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-12 w-72 mb-4" />
        <Skeleton className="h-6 w-64 mb-8" />
        <div className="grid gap-10 lg:grid-cols-[1.6fr_360px]">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
