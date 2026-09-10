/**
 * Sliding-indicator tabs. Adapted from beUI tabs + shared-layout-bg:
 * cream track, navy pill that glides, no glass, no purple. Tokens only.
 *
 * The homepage Buy | Sell switch keeps native radios OUTSIDE this list so both
 * panels stay in the server HTML and the switch works with scripting off. This
 * primitive owns the visual control (list + indicator); the page CSS sets
 * `--v3-tabs-index` from the checked radio.
 */
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Tabs.css'

export type V3TabsProps = {
  /** Accessible name for the control group. */
  label: string
  /** How many tabs — drives the indicator width. */
  count: number
  /**
   * Which tab is selected (0-based). Omit when a parent stylesheet drives
   * `--v3-tabs-index` from native radios (homepage Buy | Sell, no-JS).
   */
  index?: number
  children: ReactNode
  className?: string
}

export function V3Tabs({ label, count, index, children, className }: V3TabsProps) {
  const safeCount = Math.max(1, Math.floor(count))
  const style = {
    '--v3-tabs-count': String(safeCount),
    ...(index != null
      ? {
          '--v3-tabs-index': String(
            Math.min(Math.max(0, Math.floor(index)), safeCount - 1),
          ),
        }
      : {}),
  } as CSSProperties
  return (
    <div
      className={cn(V3_ROOT_CLASS, 'v3-tabs', className)}
      role="group"
      aria-label={label}
      style={style}
    >
      <div className="v3-tabs__list">
        <span className="v3-tabs__indicator" aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}
