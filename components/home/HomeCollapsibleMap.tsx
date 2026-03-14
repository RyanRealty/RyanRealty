'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

type Props = {
  mapContent: React.ReactNode
  cityName: string
  totalInCity: number
  /** e.g. /homes-for-sale/bend */
  searchHref: string
}

export default function HomeCollapsibleMap({ mapContent, cityName, totalInCity, searchHref }: Props) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6" aria-label="Explore on map">
      <Button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3.5 text-left text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
        aria-expanded={!collapsed}
      >
        <span>Explore on map</span>
        <HugeiconsIcon icon={ArrowDown01Icon} className={`h-5 w-5 text-muted-foreground transition-transform ${collapsed ? '' : 'rotate-180'}`} aria-hidden />
      </Button>
      {!collapsed && (
        <div className="mt-0 rounded-b-xl border border-t-0 border-border overflow-hidden shadow-md">
          {mapContent}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border bg-muted px-4 py-3">
            <Link
              href={searchHref}
              className="text-sm font-medium text-foreground hover:text-foreground"
            >
              View all {totalInCity} in {cityName} →
            </Link>
            <Link
              href="/listings?view=map"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Full map view →
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
