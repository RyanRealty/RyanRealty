/**
 * Beautiful UI loading job: a reserved photo plane until the mosaic paints.
 * Elapsed load, not a decorative spinner. Tokens only — navy wash on cream.
 */
import { cn } from '@/lib/utils'

export function PhotoSkeleton({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <span
      className={cn('listing-mosaic__skeleton', className)}
      role="status"
      aria-label={label}
      data-elapsed="true"
    />
  )
}
