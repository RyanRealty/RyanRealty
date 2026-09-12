'use client'

/**
 * SITE-100 — paged city MOS on the hub fold.
 *
 * beautifului InsightPager (title + count + prev/next) over V3MosBars.
 * Each page is one city's homes for sale vs a month of sales. Miss omits
 * at the builder. Navy/cream through v3 tokens. Interaction stays: page,
 * then hover a bar for the ratio and the dated source.
 */

import { useState } from 'react'
import Link from 'next/link'
import { InsightPager } from '@/components/motion/insight-pager'
import { V3MosBars } from '@/components/site/v3/V3MosBars'
import { cn } from '@/lib/utils'
import type { HubCityMosPage } from './hub-opening'
import './hub-city-mos-pages.css'

export type HubCityMosPagesProps = {
  pages: readonly HubCityMosPage[]
  className?: string
}

export function HubCityMosPages({ pages, className }: HubCityMosPagesProps) {
  const [page, setPage] = useState(0)
  if (pages.length === 0) return null
  const safe = Math.max(0, Math.min(pages.length - 1, page))
  const current = pages[safe]
  if (!current) return null

  return (
    <div className={cn('hub-city-mos', className)}>
      {pages.length > 1 ? (
        <InsightPager
          title="City"
          pages={pages.map((item) => item.label)}
          page={safe}
          onPage={setPage}
        />
      ) : null}
      <V3MosBars
        id={`hub-city-mos-${current.id}`}
        caption={current.caption}
        plainLabel={current.plainLabel}
        homesName={current.homesName}
        homesLabel={current.homesLabel}
        homesValue={current.homesValue}
        salesName={current.salesName}
        salesLabel={current.salesLabel}
        salesValue={current.salesValue}
        source={current.source}
        asOf={current.asOf}
        sourceName="Oregon Data Share"
        tooltip={current.tooltip}
      />
      <Link href={current.href} className="hub-city-mos__door">
        {current.label} housing market
      </Link>
    </div>
  )
}
