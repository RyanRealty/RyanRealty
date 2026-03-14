'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

type ViewMode = 'banner' | 'map'

type Props = {
  heroContent: React.ReactNode
  mapContent: React.ReactNode
}

export default function HomeHeroMapToggle({ heroContent, mapContent }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('banner')
  const [mapCollapsed, setMapCollapsed] = useState(true)

  return (
    <>
      <div className="flex items-center justify-center gap-2 py-2">
        <span className="text-sm font-medium text-muted-foreground">View:</span>
        <Button
          type="button"
          onClick={() => setViewMode('banner')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'banner' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-border'
          }`}
        >
          Banner
        </Button>
        <Button
          type="button"
          onClick={() => setViewMode('map')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'map' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-border'
          }`}
        >
          Map
        </Button>
      </div>

      {viewMode === 'banner' && heroContent}

      {viewMode === 'map' ? (
        <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
          {mapContent}
        </div>
      ) : (
        <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <Button
            type="button"
            onClick={() => setMapCollapsed((c) => !c)}
            className="flex w-full items-center justify-between rounded-t-xl border border-b-0 border-border bg-muted px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted"
            aria-expanded={!mapCollapsed}
          >
            <span>{mapCollapsed ? 'Show map' : 'Hide map'}</span>
            <HugeiconsIcon icon={ArrowDown01Icon} className={`h-5 w-5 text-muted-foreground transition-transform ${mapCollapsed ? '' : 'rotate-180'}`} />
          </Button>
          {!mapCollapsed && (
            <div className="rounded-b-xl border border-border overflow-hidden shadow-sm">
              {mapContent}
            </div>
          )}
        </section>
      )}
    </>
  )
}
