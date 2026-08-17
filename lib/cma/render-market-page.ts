/**
 * CMA market board. RPR's comprehensive packet led with a status table and
 * then eight ZIP charts. We keep the table, scoped to this market, and draw
 * a trend only when six priced months exist.
 */

import { dateLong, dec, escapeHtml, int, usd } from '@/lib/cma/render-blocks'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'
import type { CmaAdjustedComp, CmaMarketContext, CmaMarketTrendPoint, CmaSubject } from '@/lib/cma/types'

const esc = escapeHtml

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

function cell(v: string): string {
  return `<td class="v">${v}</td>`
}

function trendChart(points: CmaMarketTrendPoint[]): string {
  const priced = [...points]
    .filter((p) => p.medianSalePrice != null && p.medianSalePrice > 0)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  if (priced.length < 6) return ''
  const W = 720
  const H = 200
  const plotTop = 22
  const plotBottom = 160
  const vals = priced.map((p) => p.medianSalePrice!)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(max - min, 1)
  const barW = Math.min(44, (W - 24) / priced.length - 8)
  const gap = (W - priced.length * barW) / (priced.length + 1)
  const bars = priced
    .map((p, i) => {
      const cx = gap + i * (barW + gap)
      const h = Math.max(8, ((plotBottom - plotTop) * (p.medianSalePrice! - min)) / span)
      const y = plotBottom - h
      const d = new Date(p.periodStart)
      const label = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
      return `<text x="${cx + barW / 2}" y="${plotBottom + 16}" text-anchor="middle" font-size="11" fill="#102742" opacity="0.75">${label}</text>
      <rect x="${cx}" y="${y}" width="${barW}" height="${h}" rx="4" fill="#102742"/>`
    })
    .join('\n')
  return `
  <h3 class="subhead">Median close by month</h3>
  <p>Completed months with a median close. A month with too few sales is omitted.</p>
  <div class="trend-chart">${''}<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Median close by month" class="trend-svg">
    <line x1="0" y1="${plotBottom}" x2="${W}" y2="${plotBottom}" stroke="#102742" stroke-opacity="0.25" stroke-width="1"/>
    ${bars}
  </svg></div>
  <p class="small">Range ${usd(min)} to ${usd(max)}.</p>`
}

export function marketPage(input: {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
}): CmaPageDef | null {
  const m = input.market
  if (!m) return null
  const closes = input.comps.map((c) => c.closePrice).filter((n) => n > 0)
  const ppsf = input.comps
    .filter((c) => c.closePrice > 0 && c.sqft > 0)
    .map((c) => c.closePrice / c.sqft)
  const doms = input.comps.map((c) => c.domTotal).filter((n): n is number => n != null && n >= 0)
  const saleToList = m.saleToListRatio != null ? dec(m.saleToListRatio <= 2 ? m.saleToListRatio * 100 : m.saleToListRatio, 1) : null
  const verdictLabel =
    m.marketVerdict === 'seller'
      ? "Seller's market"
      : m.marketVerdict === 'buyer'
        ? "Buyer's market"
        : m.marketVerdict === 'balanced'
          ? 'Balanced market'
          : 'Not enough data'

  const rows = [
    {
      label: 'Homes',
      sales: int(input.comps.length),
      market: int(m.soldCount365),
      pending: m.pendingCount != null ? int(m.pendingCount) : '',
      active: m.activeCount != null ? int(m.activeCount) : '',
    },
    {
      label: 'Median price',
      sales: median(closes) != null ? usd(Math.round(median(closes)!)) : '',
      market: m.medianSalePrice != null ? usd(m.medianSalePrice) : '',
      pending: '',
      active: m.medianListPrice != null ? usd(m.medianListPrice) : '',
    },
    {
      label: 'Low / high',
      sales: closes.length ? `${usd(Math.min(...closes))} / ${usd(Math.max(...closes))}` : '',
      market: '',
      pending: '',
      active: '',
    },
    {
      label: 'Median $ / sqft',
      sales: median(ppsf) != null ? usd(Math.round(median(ppsf)!)) : '',
      market: m.medianPpsf != null ? usd(Math.round(m.medianPpsf)) : '',
      pending: '',
      active: '',
    },
    {
      label: 'Median days',
      sales: median(doms) != null ? `${int(Math.round(median(doms)!))} days` : '',
      market: m.medianDom != null ? `${int(m.medianDom)} days` : '',
      pending: '',
      active: '',
    },
  ]

  return {
    meta: `${esc(input.subject.streetAddress)} · Market Context`,
    toc: `${m.geoLabel} market conditions`,
    body: `
  <h2 class="section">The ${esc(m.geoLabel)} market</h2>
  <p>These sales priced this home. This market is every closed single-family sale in ${esc(m.geoLabel)} from ${dateLong(m.periodStart)} to ${dateLong(m.periodEnd)}. Under contract and for sale now are live as of ${dateLong(m.pulseUpdatedAt ?? m.computedAt)}.</p>
  <table class="kv is-wide compare-board">
    <thead><tr><th></th><th class="v">These sales</th><th class="v">This market</th><th class="v">Under contract</th><th class="v">For sale now</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (r) => `<tr><td>${esc(r.label)}</td>${cell(r.sales)}${cell(r.market)}${cell(r.pending)}${cell(r.active)}</tr>`,
        )
        .join('')}
    </tbody>
  </table>
  <div class="stat-strip is-4">
    ${m.monthsOfSupply != null ? `<div class="stat"><div class="lbl">Months of supply</div><div class="val">${dec(m.monthsOfSupply, 1)}</div></div>` : ''}
    ${saleToList != null ? `<div class="stat"><div class="lbl">Sale to list</div><div class="val">${saleToList}%</div></div>` : ''}
    ${m.yoyMedianPriceDeltaPct != null ? `<div class="stat"><div class="lbl">YoY median</div><div class="val">${dec(m.yoyMedianPriceDeltaPct, 1)}%</div></div>` : ''}
    <div class="stat"><div class="lbl">Verdict</div><div class="val">${esc(verdictLabel)}</div></div>
  </div>
  <h3 class="subhead">${esc(verdictLabel)}</h3>
  <p>${
    m.monthsOfSupply != null
      ? `${esc(m.geoLabel)} is carrying ${dec(m.monthsOfSupply, 1)} months of supply, with ${int(m.activeCount)} active single-family listings against the recent pace of closed sales. Four months or less is a seller's market, 4 to 6 is balanced, and 6 or more is a buyer's market.`
      : 'Live inventory was unavailable at build time, so no supply verdict is stated.'
  }</p>
  <p>${
    m.yoyMedianPriceDeltaPct != null
      ? `The median closed price is ${m.yoyMedianPriceDeltaPct >= 0 ? 'up' : 'down'} ${dec(Math.abs(m.yoyMedianPriceDeltaPct), 1)}% year over year. That rate is the time adjustment on every sale in the grid.`
      : 'No verified year-over-year trend was available for this market, so no time adjustment was applied.'
  }</p>
  ${trendChart(m.trend ?? [])}
  ${yearMartBlock(m)}
  <div class="trace">
    <div class="t-hd">Source</div>
    Oregon Data Share MLS market statistics for ${esc(m.geoLabel)}, ${dateLong(m.periodStart)} to ${dateLong(m.periodEnd)}, pulled ${dateLong(m.computedAt ?? m.pulseUpdatedAt)}.
  </div>`,
  }
}

function yearMartBlock(m: CmaMarketContext): string {
  const y = m.yearMart
  if (!y || y.source !== 'mart' || y.soldCount <= 0 || y.totalVolume <= 0) return ''
  const geo = y.geoType === 'city' ? y.geoLabel : 'Central Oregon'
  return `
  <h3 class="subhead">${esc(geo)} closed sales, ${esc(String(y.year))}</h3>
  <p>${esc(geo)} closed ${usd(Math.round(y.totalVolume))} across ${int(y.soldCount)} sales (${esc(y.typeLabel)}). The table above is the last 12 months of single-family sales.</p>
  <div class="trace">
    <div class="t-hd">Source</div>
    Closed ${esc(y.typeLabel)} in ${esc(geo)} for ${esc(String(y.year))}, pulled ${dateLong(y.computedAt)}.
  </div>`
}
