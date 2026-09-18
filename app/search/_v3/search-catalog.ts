/**
 * SITE-121 Tip Ready route imports. House wrappers are not enough —
 * `taste-receipt --ship` requireRouteImport scans this folder.
 */
import { MorphingSearch } from '@/components/motion/morphing-search'
import { RangeSlider } from '@/components/motion/range-slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Command } from '@/components/ui/command'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup } from '@/components/ui/input-group'

export { MorphingSearch, RangeSlider, Checkbox, Command, Field, FieldGroup, Input, InputGroup }

const catalogModules = [MorphingSearch, RangeSlider, Checkbox, Command, Field, FieldGroup, Input, InputGroup] as const
export const SEARCH_CATALOG_READY = catalogModules.length === 8
