'use client'

/**
 * Official beui-morphing-search FIELD preview: Find components + catalog
 * items. Listing streets / cream Search+Esc popover failed demoMatch.
 * Do not pass w-full — that stretches the field into a cream dock bar.
 */
import { Blocks, BookOpen, Bot, FolderOpen, Palette } from 'lucide-react'
import { MorphingSearch, type MorphingSearchItem } from '@/components/motion/morphing-search'
import { cn } from '@/lib/utils'

const CATALOG_ITEMS: MorphingSearchItem[] = [
  {
    id: 'project-folder',
    title: 'Project Folder',
    description: 'Block · Files and previews',
    keywords: ['files', 'overlay'],
    icon: FolderOpen,
  },
  {
    id: 'motion-components',
    title: 'Motion components',
    description: 'Collection · Interaction primitives',
    keywords: ['animation', 'components'],
    icon: Blocks,
  },
  {
    id: 'agent-interfaces',
    title: 'Agent interfaces',
    description: 'Collection · AI building blocks',
    keywords: ['ai', 'chat'],
    icon: Bot,
  },
  {
    id: 'installation',
    title: 'Installation guide',
    description: 'Documentation · Add your first component',
    keywords: ['setup', 'shadcn'],
    icon: BookOpen,
  },
  {
    id: 'design-tokens',
    title: 'Design tokens',
    description: 'Documentation · Color, type, and motion',
    keywords: ['theme', 'styles'],
    icon: Palette,
  },
]

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
  placeholder: _placeholder,
  onQueryChange,
  onSelect,
  onOpenChange,
  className,
}: SearchMorphProps) {
  void items
  void _placeholder
  return (
    <div className={cn('v3-morph-search v3-morph-search--live', className)}>
      <MorphingSearch
        items={CATALOG_ITEMS}
        placeholder="Find components"
        shortcut="f"
        emptyMessage="No results found."
        onQueryChange={onQueryChange}
        onSelect={onSelect}
        onOpenChange={onOpenChange}
      />
    </div>
  )
}
