/**
 * Morphing search shell. Adapted from beUI morphing-search: one cream surface
 * grows to hold results. Navy edge, no glass, no portal overlay. The caller
 * owns the real <input> / form so no-JS submits still work.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3MorphSearch.css'

export type V3MorphSearchProps = {
  /** Whether the results surface is expanded. */
  open?: boolean
  /** The field + submit row. */
  children: ReactNode
  /** Results panel (suggest list). Mounted always when provided; CSS morphs it. */
  results?: ReactNode
  className?: string
}

export function V3MorphSearch({ open = false, children, results, className }: V3MorphSearchProps) {
  return (
    <div className={cn(V3_ROOT_CLASS, 'v3-morph-search', open && 'v3-morph-search--open', className)}>
      <div className="v3-morph-search__shell">
        <div className="v3-morph-search__row">{children}</div>
        {results != null ? (
          <div className="v3-morph-search__results" aria-hidden={!open}>
            <div className="v3-morph-search__results-inner">{results}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
