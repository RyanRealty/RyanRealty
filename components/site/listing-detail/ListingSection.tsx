import { cn } from '@/lib/utils'

/**
 * Listing chrome for a leftover section. Same skin listing-detail.css already
 * slaps on listing-detail-main children. Use this when a section sits outside
 * that column. Do not invent a second look.
 */
export function ListingSection({
  id,
  title,
  children,
  className,
}: {
  id?: string
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('listing-panel', className)}>
      <div className="sec-head">
        <h2 className="sec-title">{title}</h2>
      </div>
      {children}
    </section>
  )
}
