'use client'

/**
 * Official beui-morphing-search FIELD interaction (layoutId grow, dialog,
 * backdrop-blur). Results are Ryan Realty places and listings — never the
 * beui demo-app catalog. Keep the grown panel short so it stays in the dock.
 */
import { MorphingSearch, type MorphingSearchItem } from '@/components/motion/morphing-search'
import { cn } from '@/lib/utils'

export type SearchMorphProps = {
  items: readonly MorphingSearchItem[]
  placeholder: string
  onQueryChange: (query: string) => void
  onSelect: (item: MorphingSearchItem) => void
  onOpenChange?: (open: boolean) => void
  open?: boolean
  className?: string
}

export function SearchMorph({
  items,
  placeholder,
  onQueryChange,
  onSelect,
  onOpenChange,
  open,
  className,
}: SearchMorphProps) {
  return (
    <div className={cn('v3-morph-search v3-morph-search--live', className)}>
      <MorphingSearch
        items={[...items]}
        placeholder={placeholder}
        shortcut="f"
        emptyMessage="No places or homes match that."
        open={open}
        onQueryChange={onQueryChange}
        onSelect={onSelect}
        onOpenChange={onOpenChange}
        resultsMaxHeight={220}
        triggerAriaLabel="Search command"
      />
    </div>
  )
}
