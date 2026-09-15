'use client'

/**
 * beui-morphing-search as the live dock field. No V3MorphSearch wrapper —
 * that house shell kept a cream input on search-open (demoMatch false).
 */
import { MorphingSearch, type MorphingSearchItem } from '@/components/motion/morphing-search'
import { cn } from '@/lib/utils'

export type SearchMorphProps = {
  items: readonly MorphingSearchItem[]
  placeholder: string
  onQueryChange: (query: string) => void
  onSelect: (item: MorphingSearchItem) => void
  className?: string
}

export function SearchMorph({
  items,
  placeholder,
  onQueryChange,
  onSelect,
  className,
}: SearchMorphProps) {
  return (
    <div className={cn('v3-morph-search v3-morph-search--live w-full min-w-0', className)}>
      <MorphingSearch
        items={[...items]}
        placeholder={placeholder}
        shortcut="f"
        emptyMessage="No places match that."
        onQueryChange={onQueryChange}
        onSelect={onSelect}
        className="w-full max-w-full"
      />
    </div>
  )
}
