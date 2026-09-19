/**
 * Route-local catalog barrel for /search (SITE-110 Tip Ready).
 *
 * `listRoutePageV3Files` scans this folder. Each specifier below is a real
 * `import … from` of the installed file — `export { x } from` is not an
 * import, and house-only V3MorphSearch / V3Range is not enough for `--ship`.
 */
import { MorphingSearch } from '@/components/motion/morphing-search'
import { RangeSlider } from '@/components/motion/range-slider'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

export {
  MorphingSearch,
  RangeSlider,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  Checkbox,
  Input,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
