import { cn } from '@/lib/utils'

/**
 * Nested Suspense fallback for streamed person-workspace secondary regions.
 *
 * 11F: on the LOCKED admin v2 language. The placeholder fill is
 * var(--a-border), not var(--a-inset): these blocks stream into THREE different
 * parents — the right rail (var(--a-inset)), a rail card (var(--a-surface)) and
 * a mobile tab (var(--a-bg)) — and an inset block on an inset rail is an
 * invisible loading state.
 */
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
        <div
          key={i}
          className="h-14 w-full animate-pulse rounded-lg"
          style={{ background: 'var(--a-border)' }}
        />
      ))}
    </div>
  )
}
