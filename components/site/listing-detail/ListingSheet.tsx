import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import '@/components/site/v3/V3Sheet.css'

/**
 * The one listing Sheet. Stage opens the page; this is the working surface
 * for facts, the gallery, location, and the rest of the jobs. Same v3-sheet
 * language as the barrel — page measure, not a second card.
 */
export function ListingSheet({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn(V3_ROOT_CLASS, 'v3-sheet', 'v3-sheet--page', className)} aria-label="This home">
      {children}
    </section>
  )
}
