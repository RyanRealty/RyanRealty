/**
 * SITE-121 Tip Ready route imports. House wrappers are not enough —
 * `taste-receipt --ship` requireRouteImport scans this folder.
 */
import { MorphingSearch } from '@/components/motion/morphing-search'
import { RangeSlider } from '@/components/motion/range-slider'
import { Command } from '@/components/ui/command'

export { MorphingSearch, RangeSlider, Command }

export const SEARCH_CATALOG_READY = Boolean(MorphingSearch && RangeSlider && Command)
