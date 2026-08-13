import { Skeleton } from '@/components/ui/skeleton'

/**
 * Listing-detail loading skeleton. Cream surface via the background token,
 * a top spacer that clears the fixed public header, then hero + two-column
 * silhouette so the layout does not jump when the page hydrates.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
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
