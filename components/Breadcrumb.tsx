import Link from 'next/link'

export type BreadcrumbItem = { label: string; href?: string }

type Props = { items: BreadcrumbItem[] }

/**
 * Location-based breadcrumb (Home > Listings > City > Subdivision > Listing).
 * Current page is plain text; earlier levels are links. Uses chevron separator per common practice.
 */
export default function Breadcrumb({ items }: Props) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-600">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-zinc-400 select-none" role="separator">
                ›
              </span>
            )}
            {item.href ? (
              <Link href={item.href} className="hover:text-zinc-900 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-zinc-900" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
