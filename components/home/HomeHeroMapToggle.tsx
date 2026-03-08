'use client'

import { useState } from 'react'

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
        <span className="text-sm font-medium text-zinc-500">View:</span>
        <button
          type="button"
          onClick={() => setViewMode('banner')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'banner' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Banner
        </button>
        <button
          type="button"
          onClick={() => setViewMode('map')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'map' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Map
        </button>
      </div>

      {viewMode === 'banner' && heroContent}

      {viewMode === 'map' ? (
        <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
          {mapContent}
        </div>
      ) : (
        <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMapCollapsed((c) => !c)}
            className="flex w-full items-center justify-between rounded-t-xl border border-b-0 border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            aria-expanded={!mapCollapsed}
          >
            <span>{mapCollapsed ? 'Show map' : 'Hide map'}</span>
            <svg
              className={`h-5 w-5 text-zinc-500 transition-transform ${mapCollapsed ? '' : 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!mapCollapsed && (
            <div className="rounded-b-xl border border-zinc-200 overflow-hidden shadow-sm">
              {mapContent}
            </div>
          )}
        </section>
      )}
    </>
  )
}
