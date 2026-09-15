'use client'

/**
 * house-atlas on the search split. The living map is V3Atlas, not Google tiles.
 */
import {
  V3Atlas,
  V3_ROOT_CLASS,
  v3Text,
  type AtlasDot,
  type AtlasEvent,
  type AtlasRegion,
  type AtlasType,
} from '@/components/site/v3'
import { cn } from '@/lib/utils'

export type SearchAtlasProps = {
  headline: string
  claimText: string
  dots: readonly AtlasDot[]
  regions: readonly AtlasRegion[]
  types: readonly AtlasType[]
  events?: readonly AtlasEvent[]
  source: string
  stamp?: string
  incomplete?: boolean
  className?: string
}

export function SearchAtlas({
  headline,
  claimText,
  dots,
  regions,
  types,
  events,
  source,
  stamp,
  incomplete,
  className,
}: SearchAtlasProps) {
  return (
    <div className={cn(V3_ROOT_CLASS, 'srch-atlas h-full min-h-0 w-full', className)}>
      <V3Atlas
        id="atlas"
        headingLevel={2}
        headline={v3Text(headline)}
        headlineTone="eyebrow"
        claimText={claimText}
        claimTone="inventory"
        keyPlacement="head"
        sourceName="Oregon Data Share"
        dots={dots}
        regions={regions}
        types={types}
        events={events}
        source={source}
        stamp={stamp}
        incomplete={incomplete}
        quiet
        markScale="ask"
      />
    </div>
  )
}
