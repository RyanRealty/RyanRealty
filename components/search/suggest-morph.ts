import type { MorphingSearchItem } from '@/components/motion/morphing-search'
import {
  SUGGEST_GROUP_LABELS,
  SUGGEST_KIND_ICONS,
  type SuggestItem,
} from '@/components/search/SearchSuggest'

export function suggestToMorphItem(
  item: SuggestItem,
  extras?: { keywords?: string[]; onSelect?: () => void },
): MorphingSearchItem {
  return {
    id: item.href,
    title: item.label,
    description: item.sublabel ?? SUGGEST_GROUP_LABELS[item.kind],
    group: SUGGEST_GROUP_LABELS[item.kind],
    icon: SUGGEST_KIND_ICONS[item.kind],
    keywords: extras?.keywords,
    onSelect: extras?.onSelect,
  }
}
