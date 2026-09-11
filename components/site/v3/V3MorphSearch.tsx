'use client'

/**
 * Morphing search. Wraps the installed beUI morphing-search
 * (`components/motion/morphing-search.tsx`): one surface grows to hold
 * results. Navy edge, no glass, no catalog purple. The native field in
 * `children` stays in the form for no-JS submits (`scripting: none`).
 */
import { useEffect, useState, type ReactNode } from 'react'
import {
  MorphingSearch,
  type MorphingSearchItem,
} from '@/components/motion/morphing-search'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3MorphSearch.css'

export type V3MorphSearchItem = MorphingSearchItem

export type V3MorphSearchProps = {
  /** Controlled open. Omit it so MorphingSearch owns the morph (the demo). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placeholder?: string
  /** Catalog items. When set, the installed MorphingSearch is the JS control. */
  items?: readonly MorphingSearchItem[]
  onQueryChange?: (query: string) => void
  onSelect?: (item: MorphingSearchItem) => void
  /** The field + submit row. Stays in the DOM for no-JS. */
  children: ReactNode
  /** Legacy results slot (unused when `items` is set). */
  results?: ReactNode
  className?: string
}

export function V3MorphSearch({
  open,
  onOpenChange,
  placeholder = 'Search',
  items,
  onQueryChange,
  onSelect,
  children,
  results,
  className,
}: V3MorphSearchProps) {
  const catalogItems = items ? [...items] : []
  const useCatalog = catalogItems.length > 0 || onQueryChange != null || onSelect != null
  const [live, setLive] = useState(false)
  useEffect(() => {
    if (useCatalog) setLive(true)
  }, [useCatalog])

  return (
    <div
      className={cn(
        V3_ROOT_CLASS,
        'v3-morph-search',
        open && 'v3-morph-search--open',
        useCatalog && 'v3-morph-search--catalog',
        live && 'v3-morph-search--live',
        className,
      )}
    >
      {useCatalog ? (
        <div className="v3-morph-search__beui">
          <MorphingSearch
            items={catalogItems}
            placeholder={placeholder}
            {...(open !== undefined ? { open, onOpenChange } : { onOpenChange })}
            onQueryChange={onQueryChange}
            onSelect={onSelect}
            shortcut="f"
            emptyMessage="No places match that."
            className="v3-morph-search__catalog"
          />
        </div>
      ) : null}
      <div className="v3-morph-search__native" aria-hidden={live || undefined} inert={live || undefined}>
        <div className="v3-morph-search__shell">
          <div className="v3-morph-search__row">{children}</div>
          {results != null ? (
            <div className="v3-morph-search__results" aria-hidden={!open}>
              <div className="v3-morph-search__results-inner">{results}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
