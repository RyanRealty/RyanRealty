'use client'

/**
 * THE SUPPLY LADDER — every covered city on one months-of-supply scale,
 * against the two thresholds that decide the verdict (SITE-103).
 *
 * WHAT THIS REPLACED AND WHY. Until now this was a second pair of named bars
 * per city: the same graphic as V3MosBars in the fold one section above, seven
 * times over. The 2026-09-16 judge named it twice, and it is the
 * stacked-section tell TASTE.md bans — two sections doing the same drawing is
 * how a page stops having a rhythm. Nothing was lost in the change: every city
 * still prints its months of supply, its for-sale count, and its month of
 * sales, and every row is still a door into that city's own report.
 *
 * WHAT IT DRAWS INSTEAD. One bar per city on ONE shared axis, with the 4-month
 * and 6-month rules drawn once behind all of them. That is the section-0
 * threshold clause (`<= 4 seller's · 4-6 balanced · >= 6 buyer's`,
 * lib/market/classify.ts) made visible: a reader sees which side of the line
 * each town is on, which is the question the ledger above cannot answer with
 * numbers alone. Bend at 3.5 and La Pine at 8.7 are not two lengths, they are
 * two different markets, and the rules are what say so.
 *
 * THE BAR NEVER CONTRADICTS THE DIGITS. The length uses the RAW figure and the
 * label is `formatMonthsOfSupply` of that same raw figure — the one derivation,
 * one display rule this route holds everywhere (invariant 1). Nothing here
 * classifies; the band names come from `marketVerdict` in lib/market/classify.
 */

import Link from 'next/link'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { marketVerdict, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import type { CityMosPair } from './region-sections'
import './region-city-mos.css'

export type RegionCityMosProps = {
  cities: readonly CityMosPair[]
  className?: string
}

/** The axis runs to the slowest town, with headroom, and never below 8 months. */
function axisMax(cities: readonly CityMosPair[]): number {
  const slowest = cities.reduce((m, c) => Math.max(m, c.mosRaw), 0)
  return Math.max(8, Math.ceil((slowest + 0.5) * 2) / 2)
}

export function RegionCityMos({ cities, className }: RegionCityMosProps) {
  const max = useMemo(() => axisMax(cities), [cities])
  const ordered = useMemo(
    () => [...cities].sort((a, b) => a.mosRaw - b.mosRaw),
    [cities],
  )
  if (ordered.length === 0 || !(max > 0)) return null

  const pct = (months: number) => Math.max(1.5, Math.min(100, (months / max) * 100))

  return (
    <div className={cn(V3_ROOT_CLASS, 'region-city-mos', className)}>
      <p className="region-city-mos__plain">
        Months of supply, fastest town first. Under four months the sellers have the
        advantage; over six months the buyers do.
      </p>
      {/* Each band carries a word AND its boundary. The balanced band is two
          months wide, which at 375 is about forty pixels — narrower than the
          word "Balanced" — so the word drops out below 30rem and the numeral
          carries it. A truncated "BA…" is worse than a number. */}
      <div className="region-city-mos__scale" aria-hidden="true">
        <span className="region-city-mos__band region-city-mos__band--sellers" style={{ width: `${pct(4)}%` }}>
          <span className="region-city-mos__bandname">
            <span className="region-city-mos__bandword">Sellers </span>
            <span className="region-city-mos__bandlong">4 or less</span>
            <span className="region-city-mos__bandshort">&le;4</span>
          </span>
        </span>
        <span
          className="region-city-mos__band region-city-mos__band--balanced"
          style={{ width: `${pct(6) - pct(4)}%` }}
        >
          <span className="region-city-mos__bandname">
            <span className="region-city-mos__bandword">Balanced </span>
            <span className="region-city-mos__bandlong">4&ndash;6</span>
            <span className="region-city-mos__bandshort">4&ndash;6</span>
          </span>
        </span>
        <span className="region-city-mos__band region-city-mos__band--buyers">
          <span className="region-city-mos__bandname">
            <span className="region-city-mos__bandword">Buyers </span>
            <span className="region-city-mos__bandlong">6 or more</span>
            <span className="region-city-mos__bandshort">6+</span>
          </span>
        </span>
      </div>
      <ul className="region-city-mos__list">
        {ordered.map((city) => {
          const verdict = marketVerdict(city.mosRaw)
          return (
            <li key={city.slug} className="region-city-mos__item">
              <Link
                href={city.href}
                className="region-city-mos__door"
                aria-label={`${city.name}: ${city.mosText} months of supply, a ${verdict.label}. ${city.homesLabel} for sale, ${city.salesLabel} sold in a month.`}
              >
                <span className="region-city-mos__name">{city.name}</span>
                <span className="region-city-mos__track">
                  <span
                    className="region-city-mos__rule region-city-mos__rule--four"
                    style={{ left: `${pct(4)}%` }}
                    aria-hidden="true"
                  />
                  <span
                    className="region-city-mos__rule region-city-mos__rule--six"
                    style={{ left: `${pct(6)}%` }}
                    aria-hidden="true"
                  />
                  <span
                    className="region-city-mos__fill"
                    data-band={verdict.kind}
                    style={{ width: `${pct(city.mosRaw)}%` }}
                    aria-hidden="true"
                  />
                </span>
                <span className="region-city-mos__mos">{city.mosText} mo</span>
                <span className="region-city-mos__counts">
                  {city.homesLabel} for sale · {city.salesLabel} a month
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="region-city-mos__rule-note">{MOS_THRESHOLD_CLAUSE}</p>
    </div>
  )
}
