import Link from 'next/link'

export type BreadcrumbItem = { label: string; href?: string }

type Props = { items: BreadcrumbItem[]; variant?: 'default' | 'onDark' }

/**
 * Location-based breadcrumb (Home > Listings > City > Subdivision > Listing).
 * Current page is plain text; earlier levels are links. Uses chevron separator per common practice.
 * variant="onDark" for use on the dark (navy) crumb bar (white text).
 */
export default function Breadcrumb({ items, variant = 'default' }: Props) {
  if (items.length === 0) return null
  const isOnDark = variant === 'onDark'
  const linkClass = isOnDark
    ? 'text-white hover:text-white/90 hover:underline'
    : 'hover:text-foreground hover:underline'
  const currentClass = isOnDark ? 'font-medium text-white' : 'font-medium text-foreground'
  const sepClass = isOnDark ? 'text-white/80 select-none' : 'text-muted-foreground select-none'
  const olClass = isOnDark
    ? 'flex flex-wrap items-center gap-x-1.5 gap-y-1 text-base text-white'
    : 'flex flex-wrap items-center gap-x-1.5 gap-y-1 text-base text-muted-foreground'
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className={olClass}>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className={sepClass} role="separator">
                ›
              </span>
            )}
            {item.href ? (
              <Link href={item.href} className={linkClass}>
                {item.label}
              </Link>
            ) : (
              <span className={currentClass} aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
