import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Nested Suspense fallback for streamed person-workspace secondary regions. */
export function PersonRegionSkeleton({
  rows = 3,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div aria-busy className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}
