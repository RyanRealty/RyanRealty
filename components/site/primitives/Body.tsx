/**
 * Body — paragraph + lede + caption text primitives in Geist, matching
 * the locked type ladder.
 *
 * `<Body>` is the default 15px / 1.6 line-height paragraph used in
 * section subtitles, descriptive prose, hero ledes, etc.
 *
 * Variants:
 *   - default (15px / 1.6) — section subtitle, paragraph copy
 *   - large   (17px / 1.55) — hero lede, intro paragraph
 *   - small   (13px / 1.55) — secondary metadata, in-card notes
 *
 * Tone is muted by default (text-muted-foreground) since body copy on
 * the locked design lives next to a bold black heading. Pass
 * `tone="primary"` for high-contrast body copy on photo-overlaid heros.
 *
 * Examples:
 *   <Body>Refreshed every 15 min from Oregon Data Share.</Body>
 *   <Body size="large" tone="primary">
 *     Search homes for sale across Bend, Redmond, Sisters, Sunriver.
 *   </Body>
 */

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props<T extends ElementType = 'p'> = {
  as?: T
  children: ReactNode
  size?: 'small' | 'default' | 'large'
  tone?: 'muted' | 'primary' | 'on-photo'
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className'>

const sizeClass = {
  small: 'text-[13px] leading-[1.55]',
  default: 'text-[15px] leading-[1.6]',
  large: 'text-[17px] leading-[1.55]',
} as const

const toneClass = {
  muted: 'text-muted-foreground',
  primary: 'text-foreground',
  // For hero overlays on photos — locked to white per the design system.
  'on-photo': 'text-white/95',
} as const

export function Body<T extends ElementType = 'p'>({
  as,
  children,
  size = 'default',
  tone = 'muted',
  className,
  ...rest
}: Props<T>) {
  const Tag = (as ?? 'p') as ElementType
  return (
    <Tag
      className={cn(sizeClass[size], toneClass[tone], className)}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/**
 * Caption — 12px small text, used for stat-card labels, micro-print,
 * "Source:" attribution lines, and the tabular-stat sub-label slot.
 *
 * Tone defaults to muted; pass `tone="primary"` for high-contrast.
 *
 * Always renders as a `<p>`. For inline captions (within a flex row of
 * other inline elements), wrap a `<span>` directly with the same Tailwind
 * classes — the polymorphic complexity isn't worth it for this primitive.
 */
type CaptionProps = {
  children: ReactNode
  tone?: 'muted' | 'primary' | 'on-photo'
  className?: string
}

export function Caption({ children, tone = 'muted', className }: CaptionProps) {
  return (
    <p
      className={cn(
        'text-[12px] leading-[1.5]',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </p>
  )
}
