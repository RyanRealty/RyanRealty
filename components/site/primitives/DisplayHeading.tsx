/**
 * DisplayHeading — the Amboqia Boriango display face used for hero H1s,
 * section heroes, pull quotes, and any "stamped" display moment per the
 * locked design system.
 *
 * Loaded via the `--font-display` CSS var (next/font/local in
 * app/layout.tsx maps it to Amboqia Boriango). The `.font-display`
 * utility class in app/globals.css is the canonical attachment.
 *
 * Tracking is locked to -0.01em for hero H1s — tighter than the Geist
 * default so the Amboqia kerning + ligatures read correctly at scale.
 *
 * Polymorphic via `as` prop so callers can pick the right HTML tag
 * (`h1` for the page hero, `h2` for section heroes, etc.) without
 * losing the brand styling.
 *
 * Example:
 *   <DisplayHeading as="h1" className="text-5xl sm:text-6xl">
 *     Find Your Home in Central Oregon
 *   </DisplayHeading>
 */

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props<T extends ElementType = 'h2'> = {
  as?: T
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className'>

export function DisplayHeading<T extends ElementType = 'h2'>({
  as,
  children,
  className,
  ...rest
}: Props<T>) {
  const Tag = (as ?? 'h2') as ElementType
  return (
    <Tag
      className={cn(
        'font-display leading-[1.05] tracking-[-0.01em] text-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
