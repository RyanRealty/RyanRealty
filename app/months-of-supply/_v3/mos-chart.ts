/**
 * Two-bar MOS drawing for /months-of-supply.
 *
 * DATA_GRAPHICS / TASTE: homes for sale vs a month of sales. One series, navy
 * on cream, bars from zero. The MOS digits live in the claim, not as a 3.9
 * hero tile. Callers pass leftover active and the rearranged monthly pace
 * already on the page. Nothing here fetches or invents a count.
 */

import { MOS_PLAIN_LABEL } from '@/lib/market/classify'
import { v3Text, type V3ChartProps } from '@/components/site/v3'

function formatHomes(n: number): string {
  return n.toLocaleString('en-US')
}

function formatMonthlyPace(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function buildMosSupplyChart(input: {
  homesForSale: number
  monthOfSales: number
  mosText: string
}): V3ChartProps | undefined {
  const { homesForSale, monthOfSales, mosText } = input
  if (!(homesForSale > 0) || !(monthOfSales > 0) || !mosText.trim()) return undefined

  const homesLabel = formatHomes(homesForSale)
  const salesLabel = formatMonthlyPace(monthOfSales)
  const caption = `${MOS_PLAIN_LABEL.charAt(0).toUpperCase()}${MOS_PLAIN_LABEL.slice(1)}`
  return {
    caption: v3Text(caption),
    kind: 'range',
    claim: v3Text(
      `${homesLabel} homes for sale vs ${salesLabel} sales a month. ${mosText} months of homes on the market.`,
    ),
    rows: [
      { tick: v3Text('Homes for sale'), value: homesForSale, label: v3Text(homesLabel) },
      { tick: v3Text('A month of sales'), value: monthOfSales, label: v3Text(salesLabel) },
    ],
  }
}
