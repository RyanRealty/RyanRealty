/**
 * When homes sell fastest: twelve months of days, as a ledger.
 * Same form as new listings. Not a lollipop from zero.
 */
import { escapeHtml } from '@/lib/cma/render-blocks'
import type { CmaSeasonality } from '@/lib/cma/extras'

function shortMonth(name: string): string {
  return name.slice(0, 3)
}

function ledgerTable(
  chunk: CmaSeasonality['byMonth'],
  fastest: Set<string>,
): string {
  const heads =
    `<th class="stub" scope="col"></th>` +
    chunk.map((m) => `<th scope="col">${escapeHtml(shortMonth(m.monthName))}</th>`).join('')
  const days =
    `<th class="stub" scope="row">Days</th>` +
    chunk
      .map((m) => {
        const v = m.medianDaysToPending
        if (v == null || !Number.isFinite(v)) {
          return `<td><div class="n is-zero">—</div></td>`
        }
        const fast = fastest.has(m.monthName)
        return `<td><div class="n${fast ? ' is-fast' : ''}">${Math.round(v)}</div></td>`
      })
      .join('')
  return `<table class="month-ledger" role="img" aria-label="Days from list to under contract">
    <thead><tr>${heads}</tr></thead>
    <tbody>
      <tr>${days}</tr>
    </tbody>
  </table>`
}

export function seasonalityChartSvg(x: CmaSeasonality): string {
  const months = [...x.byMonth].sort((a, b) => a.month - b.month)
  if (months.filter((m) => m.medianDaysToPending != null).length < 6) return ''
  const fastest = new Set(x.fastestMonths)
  const mid = Math.ceil(months.length / 2)
  const chunks = months.length <= 7 ? [months] : [months.slice(0, mid), months.slice(mid)]
  return `<div class="month-ledger-wrap">${chunks.map((c) => ledgerTable(c, fastest)).join('')}</div>
  <p class="small">Days from list to under contract.</p>`
}
