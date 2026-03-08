'use client'

import { useState } from 'react'
import Link from 'next/link'

type Props = {
  mapContent: React.ReactNode
  cityName: string
  totalInCity: number
  /** e.g. /search/bend */
  searchHref: string
}

export default function HomeCollapsibleMap({ mapContent, cityName, totalInCity, searchHref }: Props) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6" aria-label="Explore on map">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-left text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 transition-colors"
        aria-expanded={!collapsed}
      >
        <span>Explore on map</span>
        <svg
          className={`h-5 w-5 text-zinc-500 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!collapsed && (
        <div className="mt-0 rounded-b-xl border border-t-0 border-zinc-200 overflow-hidden shadow-lg">
          {mapContent}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
            <Link
              href={searchHref}
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              View all {totalInCity} in {cityName} →
            </Link>
            <Link
              href="/listings?view=map"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Full map view →
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
