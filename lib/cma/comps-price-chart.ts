/**
 * House-specific price chart: each adjusted sale as a bar, the recommended
 * list highlighted. Same plot + navy/cream SVG as every other CMA chart.
 * Numbers come from the pricing engine; this file does not invent a price.
 */

import { PRINT_NAVY_CREAM, renderPrintStripSvg } from '@/lib/charts/print-svg'
import { formatPriceExact } from '@/lib/format/money'

function shortUsd(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 || n % 1_000_000 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

export function compsPriceChartSvg(input: {
  comps: readonly { address: string; adjustedPrice: number }[]
  recommended: number
}): string {
  if (!Number.isFinite(input.recommended) || input.recommended <= 0) return ''
  const sales = input.comps.filter((c) => Number.isFinite(c.adjustedPrice) && c.adjustedPrice > 0)
  if (sales.length === 0) return ''
  return renderPrintStripSvg({
    marks: [
      ...sales.map((c) => ({
        value: c.adjustedPrice,
        tick: '',
        label: shortUsd(c.adjustedPrice),
        filled: false,
      })),
      {
        value: input.recommended,
        tick: 'List',
        label: shortUsd(input.recommended),
        filled: true,
      },
    ],
    caption: `Adjusted comparable sales against the ${formatPriceExact(input.recommended)} recommended list`,
    colors: PRINT_NAVY_CREAM,
  })
}
