'use client'

/**
 * Official beui-morphing-search iconOnly demo: 48×48 trigger grows into the
 * glass results portal. Do not pass w-full — that stretches the icon into a
 * cream typeahead bar (Mini demoMatch false).
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
        iconOnly
        emptyMessage="No places match that."
        onQueryChange={onQueryChange}
        onSelect={onSelect}
        onOpenChange={onOpenChange}
        className="size-12"
      />
    </div>
  )
}
