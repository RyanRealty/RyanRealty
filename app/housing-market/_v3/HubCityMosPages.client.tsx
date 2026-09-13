'use client'

/**
 * SITE-100 — the hub fold's drawings.
 *
 * The region's own two bars (house-mos, the verdict's evidence) lead. Beside
 * them the city insight: the beautifului InsightCards object (V3Insight) —
 * the installed pager header, one sentence of the city's pace with its counts
 * riding beui-number, the city's median sale price by month as a run the
 * pointer scrubs, and the door to that city's report. Then the leftover
 * figures as a second insight (types and features draw a length behind each
 * figure; the price pair swaps digits). Miss omits at the builder. Navy and
 * cream through v3 tokens only.
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import { V3Button } from '@/components/site/v3/atoms'
import { V3Insight, type V3InsightPage } from '@/components/site/v3/V3Insight.client'
import { V3MosBars } from '@/components/site/v3/V3MosBars'
import { V3Number } from '@/components/site/v3/V3Number.client'
import { cn } from '@/lib/utils'
import type { RegionPlaceMos } from '@/app/housing-market/central-oregon/_v3/region-figures'
import type { HubCityMosPage, HubExtraPage } from './hub-opening'
import './hub-city-mos-pages.css'

export type HubCityMosPagesProps = {
  pages: readonly HubCityMosPage[]
  className?: string
}

/**
 * One sentence per city, the claim the card sits under. The two counts swap
 * digits (beui-number); the ratio and the verdict are the caller's strings,
 * classified from the raw value before it was formatted.
 */
function cityProse(page: HubCityMosPage) {
  const verdict = page.verdictKind === 'unknown' ? '' : `, a ${page.verdictLabel}`
  return (
    <>
      {page.label} has{' '}
      <V3Number key={`${page.id}-homes-${page.homesValue}`} value={page.homesValue} formatted={page.homesLabel} />{' '}
      single-family homes for sale against{' '}
      <V3Number key={`${page.id}-sales-${page.salesValue}`} value={page.salesValue} formatted={page.salesLabel} />{' '}
      sales a month: about {page.mosText} months of supply{verdict}.
    </>
  )
}

export function HubCityMosPages({ pages, className }: HubCityMosPagesProps) {
  if (pages.length === 0) return null
  const insightPages: V3InsightPage[] = pages.map((page) => ({
    id: page.id,
    label: page.label,
    prose: cityProse(page),
    series: page.series,
    door: { label: `${page.label} housing market`, href: page.href },
  }))
  return <V3Insight id="hub-city-insight" title="City" pages={insightPages} className={cn('hub-city-mos', className)} />
}

export type HubExtraPagesProps = {
  pages: readonly HubExtraPage[]
  className?: string
}

/**
 * The leftover extra figures as insight pages. A page whose items share a
 * unit draws a length behind each figure (the builder's `weight`); whole
 * counts and exact dollars swap digits through beui-number.
 */
export function HubExtraPages({ pages, className }: HubExtraPagesProps) {
  if (pages.length === 0) return null
  const insightPages: V3InsightPage[] = pages
    .filter((page) => page.items.length > 0)
    .map((page) => ({
      id: page.id,
      label: page.label,
      prose: page.claim,
      body: (
        <ul className="hub-extra-pages__items">
          {page.items.map((item) => {
            const face =
              item.count != null ? (
                <V3Number key={`${page.id}-${item.label}-${item.count}`} value={item.count} formatted={item.value} />
              ) : (
                item.value
              )
            const row = (
              <>
                <span className="hub-extra-pages__value">{face}</span>
                {item.weight != null ? (
                  <span className="hub-extra-pages__track" aria-hidden="true">
                    <span
                      className="hub-extra-pages__fill"
                      style={{ ['--hub-extra-pct' as string]: `${(item.weight * 100).toFixed(2)}%` }}
                    />
                  </span>
                ) : null}
                <span className="hub-extra-pages__label">{item.label}</span>
              </>
            )
            return (
              <li
                key={`${page.id}-${item.label}-${item.value}`}
                className={cn('hub-extra-pages__item', item.weight != null && 'hub-extra-pages__item--weighed')}
              >
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
      ),
    }))
  if (insightPages.length === 0) return null
  return (
    <V3Insight
      id="hub-extra-insight"
      title="Also"
      pages={insightPages}
      className={cn('hub-city-mos hub-extra-pages', className)}
    />
  )
}

export type HubOpeningDrawingsProps = {
  /**
   * The region's own two bars — the page's answer (house-mos), same builder
   * and same primitive as the region deep dive's fold. Null omits: absent is
   * not zero.
   */
  regionMos?: RegionPlaceMos | null
  cityPages: readonly HubCityMosPage[]
  extraPages: readonly HubExtraPage[]
  /**
   * The door to the page's ONE ask (MarketInquirySheet, id="ask"), so the
   * inquiry is a path from the first viewport. A link to the sheet, not a
   * second form: the single-ask consolidation holds.
   */
  askHref?: string
  askLabel?: string
  /**
   * The long view (a server-rendered V3Chart, house-chart with hover), placed
   * at the top of the aside so it stacks with the leftover insight in one
   * column beside the verdict. Null omits.
   */
  series?: ReactNode
}

/**
 * The fold's drawings. The wrapper and the answer render `display: contents`
 * on the section grid (hub-fold.css), so the region bars land under the
 * verdict and the city insight under them in the answer column, while the
 * aside (the series, the leftover insight, the ask door) is one block in the
 * column beside them. Order on a phone: region bars, city insight, then the
 * aside (series first).
 */
export function HubOpeningDrawings({
  regionMos,
  cityPages,
  extraPages,
  askHref,
  askLabel,
  series,
}: HubOpeningDrawingsProps) {
  if (!regionMos && cityPages.length === 0 && extraPages.length === 0 && !series) return null
  return (
    <div className="hub-opening-draw">
      {regionMos ? (
        <div className="hub-fold-answer">
          <V3MosBars
            id="hub-region-mos"
            className="hub-region-mos"
            caption={regionMos.caption}
            plainLabel={regionMos.plainLabel}
            homesName={regionMos.homesName}
            homesLabel={regionMos.homesLabel}
            homesValue={regionMos.homesValue}
            salesName={regionMos.salesName}
            salesLabel={regionMos.salesLabel}
            salesValue={regionMos.salesValue}
            source={regionMos.source}
            asOf={regionMos.asOf}
            sourceName="Oregon Data Share"
            tooltip={regionMos.tooltip}
          />
        </div>
      ) : null}
      {cityPages.length > 0 ? <HubCityMosPages pages={cityPages} /> : null}
      {series || extraPages.length > 0 || askHref ? (
        <div className="hub-fold-aside">
          {series ? <div className="hub-fold-series">{series}</div> : null}
          {/* The door to the ask sits under the long view, inside the first
              viewport at 1440, before the leftover insight. */}
          {askHref ? (
            <div className="hub-fold-ask">
              <V3Button href={askHref} variant="text">
                {askLabel ?? 'Ask a broker about this market'}
              </V3Button>
            </div>
          ) : null}
          {extraPages.length > 0 ? <HubExtraPages pages={extraPages} /> : null}
        </div>
      ) : null}
    </div>
  )
}
