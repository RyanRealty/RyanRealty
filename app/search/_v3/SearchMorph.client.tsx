'use client'

/**
 * Official beui-morphing-search FIELD demo: h-12 w-72 trigger grows into the
 * glass results portal. A compact-icon trigger read as a typeahead (Mini 52).
 * Do not pass w-full — that stretches the field into a cream dock bar.
 */
import { MorphingSearch, type MorphingSearchItem } from '@/components/motion/morphing-search'
import { cn } from '@/lib/utils'

export type SearchMorphProps = {
  items: readonly MorphingSearchItem[]
  placeholder: string
  onQueryChange: (query: string) => void
  onSelect: (item: MorphingSearchItem) => void
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function SearchMorph({
  items,
  placeholder,
  onQueryChange,
  onSelect,
  onOpenChange,
  className,
}: SearchMorphProps) {
  return (
    <div className={cn('v3-morph-search v3-morph-search--live', className)}>
      <MorphingSearch
        items={[...items]}
        placeholder={placeholder}
        shortcut="f"
        emptyMessage="No homes match that."
        onQueryChange={onQueryChange}
        onSelect={onSelect}
        onOpenChange={onOpenChange}
      />
    </div>
  )
}
