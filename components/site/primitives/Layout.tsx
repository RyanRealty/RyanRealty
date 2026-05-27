/**
 * Layout primitives — Container / Section / Stack / Grid.
 *
 * Container: max-width 1280px (the locked --container CSS var) centered
 * with horizontal padding that tightens on narrow viewports. Matches
 * the .container utility in design_system/ryan-realty/ui_kits.
 *
 * Section: vertical-padding wrapper for one screen block. The padding
 * scale ('default' = py-14, 'tight' = py-10, 'loose' = py-20) matches
 * the homepage mockup's rhythm.
 *
 * Stack: vertical flex container with a gap token. Replaces ad-hoc
 * `space-y-*` Tailwind on every section.
 *
 * Grid: responsive auto-fitting grid for stat cards / tile rails. The
 * `cols` prop accepts 1 / 2 / 3 / 4 (rendered with locked breakpoints).
 *
 * All four are server-renderable with no client state.
 */

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ─── Container ────────────────────────────────────────────────────────

type ContainerProps = {
  children: ReactNode
  className?: string
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────

type SectionPadding = 'tight' | 'default' | 'loose'
type SectionTone = 'default' | 'muted' | 'navy'

type SectionProps<T extends ElementType = 'section'> = {
  as?: T
  children: ReactNode
  /** Vertical padding scale. */
  padding?: SectionPadding
  /** Background tone — default white, muted=cream stone, navy=brand navy. */
  tone?: SectionTone
  /** When true, render the border-top divider used between vertical blocks. */
  divider?: boolean
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className'>

const paddingClass = {
  tight: 'py-10',
  default: 'py-14',
  loose: 'py-20',
} as const

const toneClass = {
  default: 'bg-background',
  muted: 'bg-muted',
  navy: 'bg-primary text-white',
} as const

export function Section<T extends ElementType = 'section'>({
  as,
  children,
  padding = 'default',
  tone = 'default',
  divider = false,
  className,
  ...rest
}: SectionProps<T>) {
  const Tag = (as ?? 'section') as ElementType
  return (
    <Tag
      className={cn(
        paddingClass[padding],
        toneClass[tone],
        divider && 'border-t border-border',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

// ─── Stack ────────────────────────────────────────────────────────────

type StackGap = 'tight' | 'default' | 'loose' | 'xloose'

type StackProps = {
  children: ReactNode
  gap?: StackGap
  className?: string
}

const stackGapClass = {
  tight: 'gap-2',
  default: 'gap-4',
  loose: 'gap-6',
  xloose: 'gap-10',
} as const

export function Stack({ children, gap = 'default', className }: StackProps) {
  // items-start by default: Stack is for vertical rhythm of left-aligned
  // content, not space-filling layouts. Default flex column align-items is
  // 'stretch', which would force an <img> or w-fit child to fill the cross
  // axis. Consumers that need a stretch column pass className="items-stretch".
  return (
    <div className={cn('flex flex-col items-start', stackGapClass[gap], className)}>
      {children}
    </div>
  )
}

// ─── Grid ─────────────────────────────────────────────────────────────

type GridCols = 1 | 2 | 3 | 4

type GridProps = {
  children: ReactNode
  /** Max columns at the largest breakpoint. Responsive collapses follow
   *  locked spec: 4 → 2 at md, 1 at sm; 3 → 1 at sm; 2 → 1 at sm. */
  cols: GridCols
  gap?: 'tight' | 'default' | 'loose'
  className?: string
}

const gridGapClass = {
  tight: 'gap-3',
  default: 'gap-4',
  loose: 'gap-6',
} as const

const gridColsClass: Record<GridCols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

export function Grid({ children, cols, gap = 'default', className }: GridProps) {
  return (
    <div
      className={cn(
        'grid',
        gridColsClass[cols],
        gridGapClass[gap],
        className,
      )}
    >
      {children}
    </div>
  )
}
