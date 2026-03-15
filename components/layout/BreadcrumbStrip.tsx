import Breadcrumb, { type BreadcrumbItem } from '@/components/Breadcrumb'

type Props = { items: BreadcrumbItem[] }

/**
 * Breadcrumb in a consistent strip just below the hero on city, community, neighborhood, listing, search.
 * Same location and styling everywhere; no duplicate breadcrumbs.
 */
export default function BreadcrumbStrip({ items }: Props) {
  if (items.length === 0) return null
  return (
    <div className="border-b border-primary/20 bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <Breadcrumb items={items} variant="onDark" />
      </div>
    </div>
  )
}
