/**
 * H1 / H2 / H3 — non-display headings in Geist for general UI.
 *
 * Use DisplayHeading (Amboqia) for hero moments. Use these Geist
 * headings for everything else on the page — section titles inside
 * cards, sub-section headings, dialog titles, etc.
 *
 * Per the locked brand voice rules:
 *   - Sentence case for body headings. Title Case only for the hero H1
 *     (which uses DisplayHeading anyway).
 *   - Locked tracking matches the homepage mockup's section H2s
 *     (text-3xl, tracking-[-0.01em]).
 *
 * Polymorphic via `as` prop — pass `as="div"` to render the heading
 * style on a non-heading tag when the accessibility tree already has
 * the right structure elsewhere.
 *
 * Examples:
 *   <H1>Central Oregon homes for sale</H1>
 *   <H2>Browse by price range</H2>
 *   <H3>Recent activity in Bend</H3>
 */

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props<T extends ElementType> = {
  as?: T
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className'>

export function H1<T extends ElementType = 'h1'>({
  as,
  children,
  className,
  ...rest
}: Props<T>) {
  const Tag = (as ?? 'h1') as ElementType
  return (
    <Tag
      className={cn(
        'text-[34px] font-display leading-tight tracking-[-0.015em] text-foreground sm:text-[40px]',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function H2<T extends ElementType = 'h2'>({
  as,
  children,
  className,
  ...rest
}: Props<T>) {
  const Tag = (as ?? 'h2') as ElementType
  return (
    <Tag
      className={cn(
        'text-[30px] font-display leading-tight tracking-[-0.01em] text-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function H3<T extends ElementType = 'h3'>({
  as,
  children,
  className,
  ...rest
}: Props<T>) {
  const Tag = (as ?? 'h3') as ElementType
  return (
    <Tag
      className={cn(
        'text-[22px] font-bold leading-snug tracking-[-0.01em] text-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
