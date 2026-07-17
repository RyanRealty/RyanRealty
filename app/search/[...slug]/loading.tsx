import { Skeleton } from '@/components/ui/skeleton'

export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero skeleton */}
      <div className="relative h-[280px] w-full bg-primary/80">
        <div className="absolute inset-0 flex items-end">
          <div className="w-full px-4 pb-6 sm:px-6">
            <Skeleton className="mb-2 h-4 w-48 bg-primary-foreground/20" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-4 h-4 w-96" />
        <Skeleton className="mb-6 h-4 w-48" />

        {/* Market snapshot skeleton */}
        <div className="mb-8 rounded-lg border border-border p-4">
          <Skeleton className="mb-3 h-5 w-40" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Activity feed skeleton */}
        <Skeleton className="mb-3 h-6 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>

        {/* Listings grid skeleton */}
        <div className="mt-12">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
