'use client'

/**
 * Region-local city MOS cells (SITE-88 / house-mos). Two named bars per city —
 * homes for sale vs a month of sales — not a 3.7 mo meter tile. Shared scale
 * across the list so Bend and La Pine compare honestly.
 */

import Link from 'next/link'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { V3Number } from '@/components/site/v3/V3Number.client'
import type { CityMosPair } from './region-sections'
import './region-city-mos.css'

export type RegionCityMosProps = {
  cities: readonly CityMosPair[]
  className?: string
}

export function RegionCityMos({ cities, className }: RegionCityMosProps) {
  const max = useMemo(
    () => cities.reduce((m, c) => Math.max(m, c.homes, c.sales), 0),
    [cities],
  )
  if (cities.length === 0 || !(max > 0)) return null

  return (
    <div className={cn(V3_ROOT_CLASS, 'region-city-mos', className)}>
      <p className="region-city-mos__plain">Homes for sale vs a month of sales</p>
      <ul className="region-city-mos__list">
        {cities.map((city) => {
          const homesPct = Math.max(2, (city.homes / max) * 100)
          const salesPct = Math.max(2, (city.sales / max) * 100)
          return (
            <li key={city.slug} className="region-city-mos__item">
              <Link href={city.href} className="region-city-mos__door">
                <span className="region-city-mos__name">
                  {city.name}
                  <span className="region-city-mos__mos">{city.mosText} mo</span>
                </span>
                <span className="region-city-mos__bars" aria-hidden="true">
                  <span className="region-city-mos__barrow">
                    <span className="region-city-mos__barlabel">For sale</span>
                    <span className="region-city-mos__track">
                      <span
                        className="region-city-mos__fill region-city-mos__fill--homes"
                        style={{ width: `${homesPct.toFixed(2)}%` }}
                      />
                    </span>
                    <span className="region-city-mos__value">
                      <V3Number value={city.homes} formatted={city.homesLabel} />
                    </span>
                  </span>
                  <span className="region-city-mos__barrow">
                    <span className="region-city-mos__barlabel">A month</span>
                    <span className="region-city-mos__track">
                      <span
                        className="region-city-mos__fill region-city-mos__fill--sales"
                        style={{ width: `${salesPct.toFixed(2)}%` }}
                      />
                    </span>
                    <span className="region-city-mos__value">{city.salesLabel}</span>
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
