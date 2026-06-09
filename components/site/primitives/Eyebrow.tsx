import { cn } from '@/lib/utils'

/**
 * Eyebrow — the small all-caps brand-primary label that sits above every
 * section heading on the locked design system (rule "eyebrow → H2 →
 * subtitle → head-action").
 *
 * Spec (matches the .rr-eyebrow utility in app/globals.css):
 *   - 11px / 600 weight / 0.12em letter spacing / uppercase
 *   - color: var(--primary) (navy #102742)
 *   - display: inline-block
 *
 * Renders as <span> by default; pass `as="div"` or any HTML tag if a
 * different element is needed for accessibility tree context.
 *
 * Example:
 *   <Eyebrow>Market snapshot · May 2026</Eyebrow>
 *   then a section H2 below it for the heading itself.
 */

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

type Props<T extends ElementType = 'span'> = {
  as?: T
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className'>

export function Eyebrow<T extends ElementType = 'span'>({
  as,
  children,
  className,
  ...rest
}: Props<T>) {
  const Tag = (as ?? 'span') as ElementType
  return (
    <Tag
      className={cn(
        'inline-block text-[11px] font-semibold uppercase tracking-[0.12em] text-primary',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
