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
import { V3Number } from '@/components/site/v3/V3Number.client'
import { cn } from '@/lib/utils'
import type { HubCityMosPage, HubExtraPage } from './hub-opening'
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

export type HubExtraPagesProps = {
  pages: readonly HubExtraPage[]
  className?: string
}

/**
 * beautifului InsightPager over leftover extra figures (price, types, pace,
 * features). Replaces the closed cream fold. beui-number swaps whole counts.
 */
export function HubExtraPages({ pages, className }: HubExtraPagesProps) {
  const [page, setPage] = useState(0)
  if (pages.length === 0) return null
  const safe = Math.max(0, Math.min(pages.length - 1, page))
  const current = pages[safe]
  if (!current || current.items.length === 0) return null

  return (
    <div className={cn('hub-city-mos hub-extra-pages', className)}>
      {pages.length > 1 ? (
        <InsightPager
          title="Also"
          pages={pages.map((item) => item.label)}
          page={safe}
          onPage={setPage}
        />
      ) : (
        <p className="hub-extra-pages__solo">{current.label}</p>
      )}
      <p className="hub-extra-pages__claim">{current.claim}</p>
      <ul className="hub-extra-pages__items">
        {current.items.map((item) => {
          const face =
            item.count != null ? (
              <V3Number key={`${current.id}-${item.label}-${item.count}`} value={item.count} formatted={item.value} />
            ) : (
              item.value
            )
          const row = (
            <>
              <span className="hub-extra-pages__value">{face}</span>
              <span className="hub-extra-pages__label">{item.label}</span>
            </>
          )
          return (
            <li key={`${current.id}-${item.label}-${item.value}`}>
              {item.href ? (
                <Link href={item.href} className="hub-extra-pages__door">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export type HubOpeningDrawingsProps = {
  cityPages: readonly HubCityMosPage[]
  extraPages: readonly HubExtraPage[]
}

export function HubOpeningDrawings({ cityPages, extraPages }: HubOpeningDrawingsProps) {
  if (cityPages.length === 0 && extraPages.length === 0) return null
  return (
    <div className="hub-opening-draw">
      {cityPages.length > 0 ? <HubCityMosPages pages={cityPages} /> : null}
      {extraPages.length > 0 ? <HubExtraPages pages={extraPages} /> : null}
    </div>
  )
}
