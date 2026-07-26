import { Skeleton } from '@/components/ui/skeleton'

/** Streamed fallback while the person-workspace secondary regions load. */
export function PersonWorkspaceSkeleton() {
  return (
    <div aria-busy className="space-y-4">
      <div className="-mx-4 -mt-5 space-y-3 px-4 md:hidden">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
      <div className="hidden h-[calc(100dvh-3.5rem)] grid-cols-[minmax(230px,24%)_1fr_minmax(290px,28%)] overflow-hidden md:grid">
        <div className="space-y-3 border-r border-border px-3 py-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <div className="space-y-3 border-r border-border px-3 py-3">
          <Skeleton className="h-10 w-56" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <div className="space-y-3 px-3 py-3">
          <Skeleton className="h-28 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
