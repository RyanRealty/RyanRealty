/**
 * MiddleDot — the locked brand separator (U+00B7 · "middle dot").
 *
 * Used everywhere the brand voice rules call for a separator between
 * pieces of data on the same line — "Bend · OR · 97703",
 * "Refreshed every 15 min · Source: Oregon Data Share",
 * "BEND · OREGON".
 *
 * Renders as a non-selectable, aria-hidden visual glyph with horizontal
 * margin so callers can compose freely without thinking about spacing.
 *
 * Examples:
 *   <span>Bend<MiddleDot />Oregon<MiddleDot />97703</span>
 *   <h2>Market snapshot<MiddleDot />May 2026</h2>
 */

import { cn } from '@/lib/utils'

type Props = {
  /** When true, render no horizontal margin. Default false. */
  tight?: boolean
  className?: string
}

export function MiddleDot({ tight = false, className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        tight ? 'mx-0' : 'mx-2',
        'select-none text-current/70',
        className,
      )}
    >
      ·
    </span>
  )
}
