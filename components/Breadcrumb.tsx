import Link from 'next/link'

export type BreadcrumbItem = { label: string; href?: string }

type Props = { items: BreadcrumbItem[] }

export default function Breadcrumb({ items }: Props) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-600">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-zinc-400">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-zinc-900 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-zinc-900">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
