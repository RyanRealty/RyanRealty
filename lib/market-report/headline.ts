/**
 * The one-line read of a city the report tracks monthly (Bend, Redmond), as
 * the edition's cover prints it and the monthly email repeats it. One function
 * so the two can never word it differently. Null when the month's median is
 * withheld (under its floor): the line is left out, never filled.
 */
import { count, days, money, pctChange } from './format'
import type { MarketSection } from './types'

export function citySentence(section: MarketSection): string | null {
  const k = section.kpis
  if (k.median.v == null) return null
  const change = k.medianYoY != null ? ` (${pctChange(k.medianYoY)} from a year earlier)` : ''
  const speed = k.dtc.v != null ? `, and the typical home went under contract in ${days(k.dtc.v)}` : ''
  return `${section.geo.label}: ${count(k.sales)} sales at a median of ${money(k.median.v)}${change}${speed}.`
}
