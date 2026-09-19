/**
 * Route-local catalog barrel for /search (SITE-110 Tip Ready).
 *
 * `listRoutePageV3Files` scans this folder. Each specifier below is the real
 * installed file — house-only import of V3MorphSearch / V3Range is not enough
 * for `taste-receipt --ship`.
 */
export { MorphingSearch } from '@/components/motion/morphing-search'
export { RangeSlider } from '@/components/motion/range-slider'
export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
export { Checkbox } from '@/components/ui/checkbox'
export { Input } from '@/components/ui/input'
export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
