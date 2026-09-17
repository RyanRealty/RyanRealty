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
  const kindLabel = SUGGEST_GROUP_LABELS[item.kind]
  const description =
    item.sublabel && item.sublabel !== kindLabel
      ? `${kindLabel} · ${item.sublabel}`
      : kindLabel
  return {
    id: item.href,
    title: item.label,
    description,
    icon: SUGGEST_KIND_ICONS[item.kind],
    keywords: extras?.keywords,
    onSelect: extras?.onSelect,
  }
}
