import Link from 'next/link'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { cn } from '@/lib/utils'

/**
 * Site v2 breadcrumb nav — accessible ordered list with chevron separators,
 * last item marked aria-current="page". Pairs with a schema.org BreadcrumbList
 * JSON-LD block (toggle via `includeJsonLd`, default on) so search engines
 * pick up the trail without each page hand-writing the schema.
 *
 * Per plan §9 Layer 3 + CLAUDE.md Brand Voice (sentence case for body crumbs,
 * tabular numerals not relevant — text-only).
 *
 * Tones:
 *   on-light — default light-bg pages
 *   on-navy  — navy-bg surfaces (the under-hero crumb strip)
 *
 * Example:
 *   <BreadcrumbNav items={[
 *     { label: 'Home', href: '/' },
 *     { label: 'Cities', href: '/cities' },
 *     { label: 'Bend' },
 *   ]} />
 */

export type BreadcrumbNavItem = {
  label: string
  /** Omit `href` to render the current page (last item). */
  href?: string
}

type BreadcrumbTone = 'on-light' | 'on-navy'

type Props = {
  items: ReadonlyArray<BreadcrumbNavItem>
  tone?: BreadcrumbTone
  /** Render the matching schema.org BreadcrumbList JSON-LD. Default true. */
  includeJsonLd?: boolean
  className?: string
}

const toneClass: Record<BreadcrumbTone, {
  list: string
  link: string
  current: string
  separator: string
}> = {
  'on-light': {
    list: 'text-muted-foreground',
    link: 'text-muted-foreground transition-colors hover:text-foreground hover:underline',
    current: 'text-foreground font-normal',
    separator: 'text-muted-foreground/60',
  },
  'on-navy': {
    list: 'text-white/72',
    link: 'text-white/72 transition-colors hover:text-white hover:underline',
    current: 'text-white font-normal',
    separator: 'text-white/55',
  },
}

export function BreadcrumbNav({
  items,
  tone = 'on-light',
  includeJsonLd = true,
  className,
}: Props) {
  if (items.length === 0) return null
  const c = toneClass[tone]

  const jsonLdItems = items
    .filter((item) => item.href)
    .map((item) => ({ name: item.label, url: item.href as string }))

  return (
    <>
      {includeJsonLd && jsonLdItems.length > 0 ? (
        <MetadataBlock schema={{ type: 'breadcrumb', items: jsonLdItems }} />
      ) : null}
      <nav aria-label="Breadcrumb" className={cn('text-sm', className)}>
        <ol className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-1', c.list)}>
          {items.map((item, i) => {
            const isLast = i === items.length - 1
            return (
              <li key={`${i}-${item.label}`} className="inline-flex items-center gap-1.5">
                {i > 0 ? (
                  <span aria-hidden className={cn('select-none', c.separator)}>
                    ›
                  </span>
                ) : null}
                {item.href && !isLast ? (
                  <Link href={item.href} className={c.link}>
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={isLast ? 'page' : undefined} className={c.current}>
                    {item.label}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
