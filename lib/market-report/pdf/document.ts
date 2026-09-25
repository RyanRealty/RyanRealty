/**
 * The monthly report as one self-contained HTML document, rendered to PDF by
 * lib/pdf/html-to-pdf.ts under THE PAGE CONTRACT (docs/PAGE_CONTRACT.md):
 * bands reserved by @page, running marks in the margin strips, sections that
 * start on fresh paper and flow, nothing clipped.
 *
 * Print register (CLAUDE.md §3): navy on cream, Amboqia on section titles only,
 * Geist for every figure, table and sentence. The brokerage speaks, so Jax
 * signs the back page and no broker headshot appears.
 */
import { BRAND, CONTACT } from '@/lib/brand/contact'
import { formatDate } from '@/lib/format/date'
import { pageContractCss, MARGIN_IN } from '@/lib/pdf/page-contract'
import { MOS_BALANCED_MAX, MOS_SELLER_MAX } from '@/lib/market/classify'
import {
  count,
  days,
  money,
  monthLabel,
  monthName,
  months1,
  pct,
  pctChange,
  quarterLabel,
  ratioPct,
  addMonths,
} from '../format'
import { VERDICT_LABEL, VERDICT_RULE } from '../narrative'
import type { EditionPayload, Kpis, MarketSection, MonthlySeries, Pt, SegmentKey, TableRow, Verdict } from '../types'
import { DTC_EARLIEST } from '../build-edition'
import type { ReportAssets } from './assets'
import { barChart, dotRows, esc, lineChart, monthXTick, quarterXTickSparse, type DotRow } from './charts'

const SEGMENT_TITLE: Record<SegmentKey, string> = {
  sfr: 'Single-family homes on less than one acre',
  detached: 'Single-family homes, any lot size',
  condo_townhome: 'Condos and townhomes',
  acreage: 'Single-family homes on one acre or more',
}

const VERDICT_SHORT: Record<Verdict, string> = {
  seller: "Seller's",
  balanced: 'Balanced',
  buyer: "Buyer's",
}

const MOS_BANDS = [
  { from: 0, to: MOS_SELLER_MAX, label: "Seller's" },
  { from: MOS_SELLER_MAX, to: MOS_BALANCED_MAX, label: 'Balanced' },
  { from: MOS_BALANCED_MAX, to: 60, label: "Buyer's" },
]

const SOURCE = 'Oregon Data Share MLS data; Ryan Realty analysis'

/** Days to pending is recorded from 2006; coverage is judged from there. */
const DTC_FROM = DTC_EARLIEST

function periodWord(k: Kpis): string {
  const endKey = k.period.end.slice(0, 7)
  if (k.period.kind === 'month') return monthName(endKey)
  if (k.period.kind === 'trailing3') {
    const startKey = addMonths(endKey, -2)
    return `${monthName(startKey).slice(0, 3)} to ${monthName(endKey).slice(0, 3)}`
  }
  return '12 months'
}

function yoyCell(p: number | null): string {
  if (p == null) return '<span class="na">–</span>'
  const cls = Math.round(p * 100) < 0 ? 'down' : ''
  return `<span class="${cls}">${pctChange(p)}</span>`
}

function verdictCell(k: Kpis): string {
  return k.verdict ? `<span class="pill">${VERDICT_SHORT[k.verdict]}</span>` : '<span class="na">–</span>'
}

function figure(title: string, claim: string, body: string, source: string, cls = ''): string {
  return `<figure class="fig ${cls}">
  <figcaption><h3>${esc(title)}</h3>${claim ? `<p class="claim">${esc(claim)}</p>` : ''}</figcaption>
  ${body}
  ${source ? `<p class="src">${esc(source)}</p>` : ''}
</figure>`
}

function kpiTiles(k: Kpis, opts: { twelve?: Kpis } = {}): string {
  const tile = (label: string, value: string, sub: string) =>
    `<div class="tile"><span class="tl">${esc(label)}</span><span class="tv">${value}</span><span class="ts">${sub}</span></div>`
  const when = periodWord(k)
  const priorSub = (p: number | null) => (p == null ? '&nbsp;' : `${yoyCell(p)} from a year ago`)
  const salesSub =
    k.salesYoY != null ? `${yoyCell(k.salesYoY)} from a year ago` : k.salesPrior > 0 ? `${count(k.salesPrior)} a year ago` : '&nbsp;'
  const tiles = [
    tile(`Median sale price · ${when}`, esc(money(k.median.v)), priorSub(k.medianYoY)),
    tile(`Homes sold · ${when}`, esc(count(k.sales)), salesSub),
    tile('Median days to pending', esc(k.dtc.v == null ? '–' : String(Math.round(k.dtc.v))), k.dtcPrior.v != null ? `${Math.round(k.dtcPrior.v)} a year ago` : '&nbsp;'),
    tile('For sale at month end', esc(count(k.active)), k.medianActiveList.v != null ? `median ask ${esc(money(k.medianActiveList.v))}` : '&nbsp;'),
    tile('Months of supply', esc(months1(k.mos)), k.verdict ? esc(VERDICT_LABEL[k.verdict]) : '&nbsp;'),
    tile('Sale to list price', esc(ratioPct(k.stl.v)), k.priceCutShare.v != null ? `${esc(pct(k.priceCutShare.v))} had a price cut` : '&nbsp;'),
  ]
  const t = opts.twelve
  const twelve = t
    ? `<p class="twelve">Last 12 months: ${esc(count(t.sales))} sold${
        t.median.v != null
          ? ` at a median of ${esc(money(t.median.v))}${t.medianYoY != null ? ` (${esc(pctChange(t.medianYoY))} from the 12 months before)` : ''}`
          : ''
      }${t.dtc.v != null ? `, ${esc(days(t.dtc.v))} to pending` : ''}.</p>`
    : ''
  return `<div class="tiles">${tiles.join('')}</div>${twelve}`
}

function rangeClaim(points: readonly Pt[], fmt: (v: number) => string, lead: string): string {
  const vals = points.filter((p) => p.v != null) as { k: string; v: number; n: number }[]
  if (vals.length < 2) return ''
  const last = vals[vals.length - 1]!
  let lo = vals[0]!
  let hi = vals[0]!
  for (const p of vals) {
    if (p.v < lo.v) lo = p
    if (p.v > hi.v) hi = p
  }
  return `${lead} ${fmt(last.v)} in ${monthLabel(last.k)}, against a range of ${fmt(lo.v)} to ${fmt(hi.v)} over three years.`
}

function span36(s: MonthlySeries): string {
  const first = s.months[0]!
  const last = s.months[s.months.length - 1]!
  return `${monthLabel(first)} to ${monthLabel(last)}`
}

function monthlyPages(sec: MarketSection): string {
  const s = sec.series!
  const place = sec.geo.label
  const segTitle = SEGMENT_TITLE[sec.segment]
  const src = (what: string) => `${place}, ${segTitle.toLowerCase()} · ${what} · monthly, ${span36(s)} · ${SOURCE}`
  const k = sec.kpis

  const priceChart = figure(
    'Median sale price',
    rangeClaim(s.median, (v) => money(v), `The median home sold for`),
    lineChart({ series: [{ name: 'Median sale price', points: s.median, style: 'subject' }], unit: 'money', xTick: monthXTick, heightIn: 2.05, labelExtremes: true }),
    src('medians shown where a month has 10 or more sales'),
  )
  const lastSales = [...s.sales].reverse().find((p) => p.v != null)
  const salesChart = figure(
    'Homes sold',
    lastSales ? `${count(lastSales.v)} homes sold in ${monthLabel(lastSales.k)}.` : '',
    barChart({ points: s.sales, unit: 'count', xTick: monthXTick, heightIn: 1.75 }),
    src('closed sales by month'),
  )
  const dtcChart = figure(
    'Days to pending',
    rangeClaim(s.dtc, (v) => days(v), 'Homes that sold went under contract in a median of'),
    lineChart({ series: [{ name: 'Median days to pending', points: s.dtc, style: 'subject' }], unit: 'days', xTick: monthXTick, heightIn: 1.75, labelExtremes: true }),
    src('median days from listing to contract, sold homes'),
  )
  const mosChart = figure(
    'Months of supply',
    k.mos != null && k.verdict
      ? `${months1(k.mos)} months of supply at the end of ${monthName(k.period.end.slice(0, 7))}: ${VERDICT_LABEL[k.verdict]} by our measure.`
      : '',
    lineChart({ series: [{ name: 'Months of supply', points: s.mos, style: 'subject' }], unit: 'months', xTick: monthXTick, heightIn: 1.75, bands: MOS_BANDS }),
    src('homes for sale at month end ÷ average monthly sales of the prior six months'),
  )
  const ppsfChart = figure(
    'Median price per square foot',
    rangeClaim(s.ppsf, (v) => `$${Math.round(v)}`, 'Homes sold for a median of'),
    lineChart({ series: [{ name: 'Median price per square foot', points: s.ppsf, style: 'subject' }], unit: 'ppsf', xTick: monthXTick, heightIn: 1.6, labelExtremes: true }),
    src('median of each sale’s price per above-grade square foot'),
  )
  const flowChart = figure(
    'New listings, pendings and sales',
    `${count(k.newListings)} homes came on the market in ${monthName(k.period.end.slice(0, 7))}, ${count(k.pendings)} went under contract and ${count(k.sales)} closed.`,
    lineChart({
      series: [
        { name: 'New listings', points: s.newListings, style: 'subject', nameLabel: true },
        { name: 'Pendings', points: s.pendings, style: 'context', nameLabel: true },
        { name: 'Sales', points: s.sales, style: 'soft', nameLabel: true },
      ],
      unit: 'count',
      xTick: monthXTick,
      heightIn: 1.8,
      labelLast: false,
    }),
    src('new listings exclude relists within 90 days; pendings are listings that went under contract'),
  )
  const finChart = figure(
    'How buyers paid',
    k.cashShare.v != null ? `${pct(k.cashShare.v)} of ${monthName(k.period.end.slice(0, 7))} sales were paid in cash.` : '',
    lineChart({
      series: [
        { name: 'Conventional loan', points: s.conventional, style: 'subject', nameLabel: true },
        { name: 'Cash', points: s.cash, style: 'context', nameLabel: true },
        { name: 'FHA, VA, USDA', points: s.government, style: 'soft', nameLabel: true },
      ],
      unit: 'percent',
      xTick: monthXTick,
      heightIn: 1.6,
      labelLast: false,
    }),
    src('share of sales with financing reported; shown where a month has 30 or more'),
  )
  const stlChart = figure(
    'Sale price to final list price',
    k.stl.v != null ? `The median home sold for ${ratioPct(k.stl.v)} of its final asking price.` : '',
    lineChart({ series: [{ name: 'Median sale to list', points: s.stl, style: 'subject' }], unit: 'percent', xTick: monthXTick, heightIn: 1.35 }),
    src('median ratio of sale price to final list price'),
    'half',
  )
  const cutChart = figure(
    'Sales that had a price cut',
    k.priceCutShare.v != null ? `${pct(k.priceCutShare.v)} of homes sold had cut their price at least once.` : '',
    lineChart({ series: [{ name: 'Share with a price cut', points: s.priceCutShare, style: 'subject' }], unit: 'percent', xTick: monthXTick, heightIn: 1.35 }),
    src('share of sales listed above their final list price; 30+ sales'),
    'half',
  )

  const concession =
    k.concessionShare.v != null
      ? `<p class="note">Seller concessions: ${pct(k.concessionShare.v)} of ${monthName(k.period.end.slice(0, 7))} sales that reported the field had one${
          k.concessionMedian.v != null ? `, a median of ${money(k.concessionMedian.v)} among sales that had one` : ''
        }.</p>`
      : ''

  const bands = sec.bands && sec.bands.length > 0 ? bandPage(sec) : ''

  return `
<section class="sheet-break market">
  <p class="kicker">${esc(segTitle)}</p>
  <h2>${esc(place)}</h2>
  <div class="summary">${sec.summary.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
  ${kpiTiles(k, { twelve: sec.kpis12 })}
  ${priceChart}
  ${salesChart}
</section>
<section class="sheet-break market">
  <p class="kicker">${esc(place)} · speed and supply</p>
  ${dtcChart}
  ${mosChart}
  ${ppsfChart}
</section>
<section class="sheet-break market">
  <p class="kicker">${esc(place)} · demand and negotiation</p>
  ${flowChart}
  ${finChart}
  <div class="pair">${stlChart}${cutChart}</div>
  ${concession}
</section>
${bands}`
}

function bandPage(sec: MarketSection): string {
  const rows = sec.bands!
  const k = sec.kpis
  const endKey = k.period.end.slice(0, 7)
  const maxBar = Math.max(1, ...rows.map((r) => Math.max(r.active, r.sales6 / 6)))
  const body = rows
    .map((r) => {
      const pace = r.sales6 / 6
      const w1 = ((r.active / maxBar) * 100).toFixed(1)
      const w2 = ((pace / maxBar) * 100).toFixed(1)
      return `<tr>
  <th>${esc(r.label)}</th>
  <td class="n">${count(r.salesMonth)}</td>
  <td class="n">${count(r.sales12)}</td>
  <td class="n">${count(r.active)}</td>
  <td class="barcell"><span class="b1" style="width:${w1}%"></span><span class="b2" style="width:${w2}%"></span></td>
  <td class="n">${r.mos == null ? '<span class="na">–</span>' : months1(r.mos)}</td>
  <td>${r.verdict ? `<span class="pill">${VERDICT_SHORT[r.verdict]}</span>` : ''}</td>
</tr>`
    })
    .join('')
  const tiers = (sec.tiers ?? []).filter((t) => t.mos != null)
  const tierRows: DotRow[] = tiers.map((t) => ({
    tick: t.label,
    value: t.mos!,
    label: `${months1(t.mos)} mo`,
    note: ` · ${count(t.active)} for sale`,
  }))
  const tierChart =
    tierRows.length > 0
      ? figure(
          'Months of supply by price',
          sec.summary.find((s) => s.startsWith('By price')) ?? '',
          dotRows(tierRows, { bands: MOS_BANDS.map((b) => ({ ...b, to: Math.min(b.to, 12) })), clampMax: 12, minLabel: '0 months', maxLabel: '12+ months' }),
          `${sec.geo.label}, ${SEGMENT_TITLE[sec.segment].toLowerCase()} · for sale at the end of ${monthLabel(endKey)} ÷ average monthly sales, prior six months · tiers need 30 six-month sales · ${SOURCE}`,
        )
      : ''
  return `
<section class="sheet-break market">
  <p class="kicker">${esc(sec.geo.label)} · by price</p>
  <h3 class="h3big">Sales and homes for sale by price band</h3>
  <p class="claim">Dark bar: homes for sale at the end of ${esc(monthName(endKey))}. Light bar: homes sold in an average month over the last six.</p>
  <table class="t bands">
    <thead><tr><th>Price band</th><th class="n">Sold in ${esc(monthName(endKey).slice(0, 3))}</th><th class="n">Sold, 12 months</th><th class="n">For sale</th><th>For sale vs a month of sales</th><th class="n">Months</th><th>Market</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="src">${esc(`${sec.geo.label}, ${SEGMENT_TITLE[sec.segment].toLowerCase()} · sold by close price, for sale by asking price when listed · a band's months of supply needs 30 sales in six months · ${SOURCE}`)}</p>
  ${tierChart}
</section>`
}

function marketTable(rows: readonly TableRow[], opts: { period?: boolean } = {}): string {
  const body = rows
    .map((r) => {
      const k = r.kpis
      return `<tr>
  <th>${esc(r.geo.label)}</th>
  ${opts.period ? `<td>${esc(periodWord(k))}</td>` : ''}
  <td class="n">${esc(money(k.median.v))}</td>
  <td class="n">${yoyCell(k.medianYoY)}</td>
  <td class="n">${esc(count(k.sales))}</td>
  <td class="n">${k.dtc.v == null ? '<span class="na">–</span>' : Math.round(k.dtc.v)}</td>
  <td class="n">${esc(count(k.active))}</td>
  <td class="n">${k.mos == null ? '<span class="na">–</span>' : months1(k.mos)}</td>
  <td>${verdictCell(k)}</td>
</tr>`
    })
    .join('')
  return `<table class="t">
  <thead><tr><th>Market</th>${opts.period ? '<th>Period</th>' : ''}<th class="n">Median price</th><th class="n">vs a year ago</th><th class="n">Sold</th><th class="n">Days to pending</th><th class="n">For sale</th><th class="n">Months of supply</th><th>Market</th></tr></thead>
  <tbody>${body}</tbody>
</table>`
}

function cover(p: EditionPayload, a: ReportAssets): string {
  const k = p.region.kpis
  const pubLabel = formatDate(p.generatedAt, { month: 'long' })
  return `
<section class="cover">
  <img class="logo" src="${a.logo}" alt="Ryan Realty"/>
  <p class="kicker">Central Oregon Market Report</p>
  <h1>${esc(monthLabel(p.editionMonth))}</h1>
  <p class="lede">Home prices, sales, speed and supply across Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Madras and Central Oregon's resort communities. Compiled ${esc(pubLabel)} from MLS records.</p>
  <img class="hero" src="${a.hero}" alt="The Old Mill District on the Deschutes River in Bend"/>
  <div class="brief">${p.headline.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
  ${kpiTiles(k)}
  <p class="src">Central Oregon, single-family homes on less than one acre, ${esc(monthLabel(p.editionMonth))} · data complete through ${esc(p.dataCompleteThrough)} · ${esc(SOURCE)}</p>
</section>`
}

function overviewPage(p: EditionPayload): string {
  const s = p.region.series!
  return `
<section class="sheet-break">
  <p class="kicker">Market by market</p>
  <h2>Central Oregon at a glance</h2>
  <p class="claim">Bend and Redmond are read by month. The smaller towns sell fewer homes, so they are read over the last three months, which gives each median enough sales to stand on.</p>
  ${marketTable(p.overview, { period: true })}
  <p class="src">${esc(`Single-family homes on less than one acre except Terrebonne, Culver, Powell Butte and Camp Sherman (any lot size). A dash means too few sales to publish: medians need 10, changes and market calls need 30. ${VERDICT_RULE}`)}</p>
  <div class="pair">
    ${figure('Central Oregon median sale price', '', lineChart({ series: [{ name: 'Median', points: s.median, style: 'subject' }], unit: 'money', xTick: monthXTick, heightIn: 1.45 }), `monthly, ${span36(s)}`, 'half')}
    ${figure('Central Oregon homes sold', '', barChart({ points: s.sales, unit: 'count', xTick: monthXTick, heightIn: 1.45 }), `monthly, ${span36(s)}`, 'half')}
  </div>
</section>`
}

function quadrantClaim(p: EditionPayload): string {
  const priced = p.quadrants.filter((r) => r.kpis.median.v != null && r.geo.slug !== 'bend-outside')
  const lead = `Twelve months through ${monthLabel(p.editionMonth)}.`
  if (priced.length < 2) return lead
  const sorted = [...priced].sort((a, b) => b.kpis.median.v! - a.kpis.median.v!)
  const top = sorted[0]!
  const bottom = sorted[sorted.length - 1]!
  return `${lead} ${top.geo.label} had the highest median at ${money(top.kpis.median.v)} and ${bottom.geo.label} the lowest at ${money(bottom.kpis.median.v)}. Filled dots are the last 12 months, hollow dots the 12 before.`
}

function quadrantPage(p: EditionPayload): string {
  if (p.quadrants.length === 0) return ''
  const endKey = p.editionMonth
  const dumb: DotRow[] = p.quadrants
    .filter((r) => r.kpis.median.v != null)
    .map((r) => ({
      tick: r.geo.label,
      value: r.kpis.median.v!,
      label: money(r.kpis.median.v),
      ...(r.kpis.medianPrior.v != null ? { baseValue: r.kpis.medianPrior.v, baseLabel: money(r.kpis.medianPrior.v) } : {}),
    }))
  const districtRows = p.districts
    .map((d) => {
      const k = d.kpis
      const q = p.quadrants.find((x) => x.geo.slug === d.quadrant)?.geo.label.replace(' Bend', '') ?? ''
      return `<tr><th>${esc(d.geo.label)}</th><td>${esc(q)}</td><td class="n">${esc(money(k.median.v))}</td><td class="n">${yoyCell(k.medianYoY)}</td><td class="n">${esc(count(k.sales))}</td><td class="n">${k.dtc.v == null ? '<span class="na">–</span>' : Math.round(k.dtc.v)}</td><td class="n">${esc(count(k.active))}</td></tr>`
    })
    .join('')
  return `
<section class="sheet-break market">
  <p class="kicker">Bend · by quadrant and neighborhood</p>
  <h2>Across Bend</h2>
  <p class="claim">${esc(quadrantClaim(p))}</p>
  ${figure('Median sale price by quadrant, last 12 months vs the 12 before', '', dotRows(dumb, {}), `Bend single-family homes on less than one acre · quadrant from the address (NW, NE, SE, SW), otherwise the city neighborhood district; Rural Bend is outside both · ${SOURCE}`)}
  ${marketTable(p.quadrants)}
  <h3 class="h3big">City of Bend neighborhood districts</h3>
  <table class="t">
    <thead><tr><th>District</th><th>Quadrant</th><th class="n">Median price</th><th class="n">vs a year ago</th><th class="n">Sold</th><th class="n">Days to pending</th><th class="n">For sale</th></tr></thead>
    <tbody>${districtRows}</tbody>
  </table>
  <p class="src">${esc(`Twelve months through ${monthLabel(endKey)}. A home inside a named community (Awbrey Glen, Broken Top, NorthWest Crossing, Tetherow and others) counts in that community, shown on the resort communities page. ${SOURCE}`)}</p>
</section>`
}

function condoPage(p: EditionPayload): string {
  const cs = p.condoSeries
  const chart = cs
    ? `<div class="pair">
    ${figure('Bend condos and townhomes: median sale price', '', lineChart({ series: [{ name: 'Median', points: cs.series.median, style: 'subject' }], unit: 'money', xTick: monthXTick, heightIn: 1.4 }), `monthly, ${span36(cs.series)} · medians need 10 sales`, 'half')}
    ${figure('Bend condos and townhomes: homes sold', '', barChart({ points: cs.series.sales, unit: 'count', xTick: monthXTick, heightIn: 1.4 }), `monthly, ${span36(cs.series)}`, 'half')}
  </div>`
    : ''
  return `
<section class="sheet-break">
  <p class="kicker">Beyond the single-family house</p>
  <h2>Condos and townhomes</h2>
  <p class="claim">Twelve months through ${esc(monthLabel(p.editionMonth))}, with months of supply at the end of ${esc(monthName(p.editionMonth))}.</p>
  ${marketTable(p.condoTownhome)}
  ${chart}
  <h2 class="h2small">Homes on an acre or more</h2>
  <p class="claim">Single-family homes on a lot of one acre or more, twelve months through ${esc(monthLabel(p.editionMonth))}.</p>
  ${marketTable(p.acreage)}
  <p class="src">${esc(`Twelve months through ${monthLabel(p.editionMonth)}. Condos and townhomes by MLS property type; acreage is single-family homes on a lot of one acre or more. ${SOURCE}`)}</p>
</section>`
}

function townsPage(p: EditionPayload): string {
  const rows = p.towns
    .map((t) => {
      const k = t.kpis
      const y = t.kpis12
      return `<tr><th>${esc(t.geo.label)}</th><td class="n">${esc(money(k.median.v))}</td><td class="n">${esc(count(k.sales))}</td><td class="n">${k.dtc.v == null ? '<span class="na">–</span>' : Math.round(k.dtc.v)}</td><td class="n">${esc(money(y.median.v))}</td><td class="n">${yoyCell(y.medianYoY)}</td><td class="n">${esc(count(y.sales))}</td><td class="n">${esc(count(k.active))}</td><td class="n">${k.mos == null ? '<span class="na">–</span>' : months1(k.mos)}</td><td>${verdictCell(k)}</td></tr>`
    })
    .join('')
  const first = p.towns[0]?.kpis
  const window = first ? periodWord(first) : ''
  return `
<section class="sheet-break">
  <p class="kicker">The smaller markets</p>
  <h2>Towns across Central Oregon</h2>
  <p class="claim">The last three months (${esc(window)}) beside the last twelve. Each town follows with twelve years of prices, sales and speed by quarter.</p>
  <table class="t">
    <thead>
      <tr><th></th><th class="n" colspan="3">Last 3 months</th><th class="n" colspan="3">Last 12 months</th><th class="n" colspan="3">Supply</th></tr>
      <tr><th>Town</th><th class="n">Median</th><th class="n">Sold</th><th class="n">Days to pending</th><th class="n">Median</th><th class="n">vs a year ago</th><th class="n">Sold</th><th class="n">For sale</th><th class="n">Months</th><th>Market</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="src">${esc(`Sisters, Sunriver, La Pine, Prineville and Madras: single-family homes on less than one acre. Terrebonne, Culver, Powell Butte and Camp Sherman: single-family homes on any lot, since most homes there sit on acreage. Towns are MLS city names. ${SOURCE}`)}</p>
</section>`
}

/** Share of points that hold a value: how well a quarterly median series stands on its own. */
function coverage(points: readonly Pt[]): number {
  return points.length === 0 ? 0 : points.filter((p) => p.v != null).length / points.length
}

/**
 * One town, sized so two share a page: the story, the tiles, then price, sales
 * and speed side by side. A town too small to hold a median most quarters is
 * read over the 12 months ending each quarter instead, and says so.
 */
function townBlock(t: MarketSection): string {
  const q = t.quarterly!
  const first = q.quarters[0]
  const last = q.quarters[q.quarters.length - 1]
  const range = first && last ? `${quarterLabel(first)} to ${quarterLabel(last)}` : ''
  const priceTrailing = coverage(q.median) < 0.8
  const dtcTrailing = coverage(q.dtc.filter((p) => p.k >= DTC_FROM)) < 0.8
  // Below half coverage even the 12-month read is mostly gaps: say so instead of drawing fragments.
  const thin = (pts: readonly Pt[]) => coverage(pts.filter((p) => p.k >= DTC_FROM)) < 0.5
  const price = priceTrailing ? q.median12 : q.median
  const dtc = dtcTrailing ? q.dtc12 : q.dtc
  const priceThin = coverage(price) < 0.5
  const dtcThin = thin(dtc)
  const lastMed = [...price].reverse().find((p) => p.v != null)
  const h = 1.05
  const reads = [
    priceTrailing ? 'prices are medians over the 12 months ending each quarter' : 'prices are quarterly medians',
    dtcTrailing ? 'days to pending over the 12 months ending each quarter' : null,
  ].filter(Boolean)
  const note = `${t.geo.label}, ${SEGMENT_TITLE[t.segment].toLowerCase()} · quarterly, ${range} · ${reads.join('; ')}; a median needs 10 sales · ${SOURCE}`
  return `
<section class="town">
  <p class="kicker">${esc(SEGMENT_TITLE[t.segment])}</p>
  <h2>${esc(t.geo.label)}</h2>
  ${t.summary[0] ? `<div class="summary"><p>${esc(t.summary[0])}</p></div>` : ''}
  ${kpiTiles(t.kpis, { twelve: t.kpis12 })}
  <div class="trio">
    ${figure(
      priceTrailing ? 'Median sale price, 12 months' : 'Median sale price',
      lastMed && !priceThin ? `${money(lastMed.v)} ${priceTrailing ? 'in the 12 months to' : 'in'} ${quarterLabel(lastMed.k)}.` : '',
      priceThin
        ? `<div class="ch-empty" style="height:${h}in">Too few sales for a median most quarters.</div>`
        : lineChart({ series: [{ name: 'Median', points: price, style: 'subject' }], unit: 'money', xTick: quarterXTickSparse, heightIn: h }),
      '',
      'third',
    )}
    ${figure('Homes sold by quarter', '', barChart({ points: q.sales, unit: 'count', xTick: quarterXTickSparse, heightIn: h }), '', 'third')}
    ${figure(
      dtcTrailing ? 'Days to pending, 12 months' : 'Median days to pending',
      '',
      dtcThin
        ? `<div class="ch-empty" style="height:${h}in">Too few sales for a median most quarters.</div>`
        : lineChart({ series: [{ name: 'Days', points: dtc, style: 'subject' }], unit: 'days', xTick: quarterXTickSparse, heightIn: h }),
      '',
      'third',
    )}
  </div>
  <p class="src">${esc(note)}</p>
</section>`
}

function communitiesPage(p: EditionPayload): string {
  if (p.communities.length === 0) return ''
  const rows = p.communities
    .map((c) => {
      const k = c.kpis
      return `<tr><th>${esc(c.geo.label)}</th><td>${esc(c.near)}</td><td class="n">${esc(money(k.median.v))}</td><td class="n">${yoyCell(k.medianYoY)}</td><td class="n">${esc(count(k.sales))}</td><td class="n">${k.dtc.v == null ? '<span class="na">–</span>' : Math.round(k.dtc.v)}</td><td class="n">${esc(count(k.active))}</td><td class="n">${k.mos == null ? '<span class="na">–</span>' : months1(k.mos)}</td></tr>`
    })
    .join('')
  const dots: DotRow[] = p.communities
    .filter((c) => c.kpis.median.v != null)
    .map((c) => ({ tick: c.geo.label, value: c.kpis.median.v!, label: money(c.kpis.median.v), note: ` · ${count(c.kpis.sales)} sold` }))
  return `
<section class="sheet-break">
  <p class="kicker">Resort and master-planned communities</p>
  <h2>Communities</h2>
  <p class="claim">Twelve months through ${esc(monthLabel(p.editionMonth))}, all single-family homes on any lot. Sunriver appears with the towns.</p>
  <table class="t">
    <thead><tr><th>Community</th><th>Near</th><th class="n">Median price</th><th class="n">vs a year ago</th><th class="n">Sold</th><th class="n">Days to pending</th><th class="n">For sale</th><th class="n">Months of supply</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${dots.length > 1 ? figure('Median sale price, last 12 months', '', dotRows(dots, {}), `Communities by their mapped boundary; a median needs 10 sales in the 12 months · ${SOURCE}`) : ''}
</section>`
}

function methodsPage(p: EditionPayload, a: ReportAssets): string {
  return `
<section class="sheet-break methods">
  <p class="kicker">How this report is built</p>
  <h2>Methods and sources</h2>
  <div class="cols">
    <div>
      <h4>The data</h4>
      <p>Every figure comes from Multiple Listing Service records of closed sales and listings in Central Oregon, received through Oregon Data Share and checked by Ryan Realty's market data system. Figures are computed fresh for each edition and frozen when it publishes. Data complete through ${esc(p.dataCompleteThrough)}.</p>
      <h4>The homes</h4>
      <p>The main series is single-family homes on less than one acre, which keeps rural and acreage properties from pulling on in-town prices. Condos and townhomes, and homes on an acre or more, have their own tables. Manufactured homes, land, farms, multi-family buildings and fractional interests are left out.</p>
      <h4>The places</h4>
      <p>Towns are the MLS city on the listing, the same way our website counts them, so Redmond includes Eagle Crest. Bend quadrants follow the address (NW, NE, SE, SW); an address without one takes the quadrant of its City of Bend neighborhood district. Communities follow their mapped boundaries.</p>
    </div>
    <div>
      <h4>The measures</h4>
      <p><strong>Median sale price:</strong> the middle sale, half above and half below. <strong>Days to pending:</strong> the median days from listing to accepted offer for homes that sold (recorded from 2006). <strong>Months of supply:</strong> homes for sale at month end divided by the average monthly sales of the prior six months. ${esc(VERDICT_RULE)} <strong>Sale to list:</strong> the median ratio of sale price to final asking price.</p>
      <h4>When a number is withheld</h4>
      <p>A median prints only on 10 or more sales. A change from a year ago, a share, a market call and months of supply print only on 30 or more. Below that you will see a dash, not an estimate.</p>
      <h4>Homes for sale in past months</h4>
      <p>Rebuilt from each listing's on-market and contract dates. Where a listing's earlier time on the market is not on record, it counts from its latest listing date, so a past month's count is a floor and can run slightly low, which also nudges months of supply low.</p>
      <h4>The fine print</h4>
      <p>Based on information from Oregon Data Share. All information provided is deemed reliable but is not guaranteed and should be independently verified. Data is subject to change as late sales are recorded. This report is general market information, not an appraisal of any property.</p>
    </div>
  </div>
  <div class="signoff">
    <img class="jax" src="${a.jax}" alt=""/>
    <div>
      <p class="sig">Questions about your home or your neighborhood? We live and work here, and we'll give you a straight answer.</p>
      <p class="contact">${esc(BRAND.name)} · ${esc(BRAND.address.street)}, ${esc(BRAND.address.city)}, ${esc(BRAND.address.region)} ${esc(BRAND.address.postalCode)} · ${esc(CONTACT.phoneDirect)} · ${esc(BRAND.domain)}</p>
      <p class="contact">Every edition since 2006 is free at ${esc(BRAND.domain)}/housing-market/reports/monthly</p>
    </div>
  </div>
</section>`
}

export function reportStylesheet(fontCss: string): string {
  return `
${pageContractCss(MARGIN_IN)}
${fontCss}
:root { --navy:#102742; --cream:#faf8f4; --muted:rgba(16,39,66,0.62); --line:rgba(16,39,66,0.16); --tint:rgba(16,39,66,0.06); --exception:#A8452B; }
* { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
html, body { background:#ffffff; color:var(--navy); font-family:'Geist', system-ui, sans-serif; font-size:9.3pt; line-height:1.42; }
h1, h2 { font-family:'Amboqia Boriango', Georgia, serif; font-weight:400; letter-spacing:-0.01em; margin:0; color:var(--navy); }
h1 { font-size:40pt; line-height:1.05; margin:0.04in 0 0.08in; }
h2 { font-size:25pt; line-height:1.1; margin:0.02in 0 0.08in; }
h2.h2small { font-size:17pt; margin-top:0.22in; }
h3, h4 { font-family:'Geist', system-ui, sans-serif; margin:0; }
h3 { font-size:10.3pt; font-weight:600; }
h3.h3big { font-size:11.5pt; margin:0.14in 0 0.04in; }
h4 { font-size:8.8pt; font-weight:600; margin:0.12in 0 0.03in; }
p { margin:0 0 0.05in; }
.kicker { font-size:7.4pt; letter-spacing:0.14em; text-transform:uppercase; color:var(--muted); margin:0 0 0.02in; font-weight:500; }
.claim { color:var(--muted); font-size:8.8pt; margin:0.02in 0 0.06in; }
.src { color:var(--muted); font-size:6.8pt; line-height:1.35; margin:0.03in 0 0; }
.note { font-size:8.8pt; margin-top:0.08in; }
.summary p { font-size:9.6pt; margin:0 0 0.04in; }
.summary { margin:0.04in 0 0.1in; max-width:6.9in; }
.na { color:var(--muted); }
.down { color:var(--exception); }
.pill { display:inline-block; border:0.6pt solid var(--navy); border-radius:9pt; padding:0 5pt; font-size:7pt; line-height:1.5; white-space:nowrap; }

/* cover */
.cover .logo { width:1.15in; height:auto; display:block; margin:0 0 0.18in; }
.cover .lede { font-size:10pt; color:var(--muted); max-width:6in; }
.cover .hero { display:block; width:100%; height:2.55in; object-fit:cover; object-position:top; margin:0.12in 0 0.14in; }
.cover .brief p { font-size:10pt; margin:0 0 0.05in; max-width:6.9in; }

/* tiles */
.tiles { display:grid; grid-template-columns:repeat(6, 1fr); border-top:0.75pt solid var(--navy); border-bottom:0.6pt solid var(--line); margin:0.08in 0 0.04in; }
.tile { padding:0.06in 0.06in 0.07in 0; display:flex; flex-direction:column; gap:1pt; }
.tile + .tile { padding-left:0.07in; border-left:0.5pt solid var(--line); }
.tl { font-size:6.6pt; letter-spacing:0.06em; text-transform:uppercase; color:var(--muted); line-height:1.25; }
.tv { font-size:15pt; font-weight:600; line-height:1.1; }
.ts { font-size:6.9pt; color:var(--muted); line-height:1.25; }
.twelve { font-size:8.3pt; color:var(--muted); margin:0.03in 0 0.08in; }

/* figures */
.fig { margin:0.12in 0 0.1in; }
.fig figcaption { margin-bottom:0.04in; }
.pair { display:grid; grid-template-columns:1fr 1fr; column-gap:0.3in; }
.pair .fig { margin-top:0.08in; }
.plot { display:grid; grid-template-columns:0.48in 1fr; grid-template-rows:var(--h) auto; column-gap:0.06in; }
.pair .plot { grid-template-columns:0.42in 1fr; }
.plot .yrail { position:relative; height:var(--h); }
.plot .yrail span { position:absolute; right:0; transform:translateY(-50%); font-size:6.8pt; color:var(--muted); white-space:nowrap; }
.plot .box { position:relative; height:var(--h); }
.plot svg { position:absolute; left:0; top:0; width:100%; height:100%; overflow:visible; }
.plot .xrail { position:relative; height:11pt; }
.plot .xrail span { position:absolute; top:2pt; transform:translateX(-50%); font-size:6.8pt; color:var(--muted); white-space:nowrap; }
.plot .xrail span.r { transform:translateX(-100%); }
.plot .xrail span.l { transform:none; }
.plot.named { grid-template-columns:0.48in 1fr 1.25in; }
.pair .plot.named { grid-template-columns:0.42in 1fr 0.95in; }
.plot .nrail { position:relative; height:var(--h); }
.plot .nrail span { position:absolute; left:0.06in; transform:translateY(-50%); font-size:6.9pt; white-space:nowrap; line-height:1.1; }
.plot .nrail span b { font-weight:600; }
.plot .nrail span.context, .plot .nrail span.soft { color:var(--muted); }
svg .grid { stroke:rgba(16,39,66,0.1); stroke-width:0.6px; vector-effect:non-scaling-stroke; }
svg .axis { stroke:rgba(16,39,66,0.4); stroke-width:0.7px; vector-effect:non-scaling-stroke; }
svg .zone.z0 { fill:rgba(16,39,66,0.075); }
svg .zone.z1 { fill:rgba(16,39,66,0.035); }
svg .zone.z2 { fill:rgba(16,39,66,0); }
svg .bar { fill:rgba(16,39,66,0.24); }
svg .bar.hi { fill:#102742; }
.zone-name { position:absolute; transform:translateY(-50%); font-size:6.2pt; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted); }
.dot { position:absolute; width:5pt; height:5pt; margin:-2.5pt 0 0 -2.5pt; border-radius:50%; background:var(--navy); }
.pt-label { position:absolute; transform:translate(4pt, -50%); font-size:7.4pt; font-weight:600; white-space:nowrap; background:rgba(255,255,255,0.85); padding:0 1.5pt; }
.pt-label.r { transform:translate(calc(-100% - 5pt), -50%); }
.pt-label.hi { transform:translate(-50%, calc(-100% - 3pt)); font-weight:500; }
.pt-label.lo { transform:translate(-50%, 3pt); font-weight:500; }
.pt-label.hi.r, .pt-label.lo.r { transform:translate(calc(-100% - 3pt), -50%); }
.bar-label { position:absolute; transform:translate(-50%, calc(-100% - 2pt)); font-size:7pt; color:var(--muted); white-space:nowrap; }
.bar-label.last { color:var(--navy); font-weight:600; }
.ch-empty { display:flex; align-items:center; justify-content:center; border:0.5pt dashed var(--line); color:var(--muted); font-size:8pt; }

/* dot rows */
.dots { margin-top:0.04in; }
.drow { display:grid; grid-template-columns:1.45in 1fr 1.35in; align-items:center; column-gap:0.1in; height:15pt; }
.dtick { font-size:8pt; white-space:nowrap; overflow:visible; }
.dtrack { position:relative; height:100%; border-bottom:0.4pt solid rgba(16,39,66,0.08); }
.dz { position:absolute; top:0; bottom:0; background:rgba(16,39,66,0.05); }
.dz:nth-child(2) { background:rgba(16,39,66,0.025); }
.dz:nth-child(3) { background:transparent; }
.dz em { position:absolute; top:-1pt; left:2pt; font-style:normal; font-size:5.8pt; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); }
.drow + .drow .dz em { display:none; }
.dstem { position:absolute; top:50%; height:0.9pt; background:rgba(16,39,66,0.45); }
.dd { position:absolute; top:50%; width:6pt; height:6pt; margin:-3pt 0 0 -3pt; border-radius:50%; background:var(--navy); }
.dd.base { background:#fff; border:1pt solid var(--navy); }
.dval { font-size:8pt; font-weight:600; white-space:nowrap; }
.dnote { font-weight:400; color:var(--muted); }
.axisrow { height:10pt; }
.axisrow .dtrack { border:none; }
.dmin, .dmax { position:absolute; top:1pt; font-size:6.5pt; color:var(--muted); }
.dmin { left:0; } .dmax { right:0; }

/* tables */
table.t { width:100%; border-collapse:collapse; font-size:8.2pt; margin:0.06in 0 0.04in; font-variant-numeric:tabular-nums; }
table.t thead th { font-weight:500; font-size:6.8pt; letter-spacing:0.05em; text-transform:uppercase; color:var(--muted); text-align:left; padding:0 0.05in 0.04in 0; border-bottom:0.75pt solid var(--navy); vertical-align:bottom; }
table.t tbody th { text-align:left; font-weight:500; padding:0.035in 0.05in 0.035in 0; white-space:nowrap; }
table.t td { padding:0.035in 0.05in 0.035in 0; border-bottom:0.4pt solid var(--line); }
table.t tbody th { border-bottom:0.4pt solid var(--line); }
table.t .n { text-align:right; }
table.t thead th.n { text-align:right; }
table.bands { font-size:7.8pt; }
table.bands tbody th, table.bands td { padding-top:0.018in; padding-bottom:0.018in; }
table.bands td.barcell { width:1.8in; position:relative; padding-right:0.1in; }
table.bands .b1, table.bands .b2 { display:block; height:4.2pt; }
table.bands .b1 { background:var(--navy); margin-bottom:1.2pt; }
table.bands .b2 { background:rgba(16,39,66,0.3); }

/* towns: flow two to a page, never split */
.town { break-inside:avoid; page-break-inside:avoid; padding-top:0.16in; margin-bottom:0.1in; border-top:0.75pt solid var(--line); }
.town h2 { font-size:20pt; }
.town .summary p { font-size:8.9pt; margin:0 0 0.025in; }
.town .summary { margin:0.02in 0 0.06in; }
.trio { display:grid; grid-template-columns:repeat(3, 1fr); column-gap:0.22in; }
.trio .fig { margin:0.06in 0 0.02in; }
.trio .plot { grid-template-columns:0.4in 1fr; }
.trio h3 { font-size:8.8pt; }
.trio .claim { font-size:7.8pt; margin:0 0 0.03in; }

/* methods */
.methods .cols { display:grid; grid-template-columns:1fr 1fr; column-gap:0.35in; }
.methods p { font-size:8.4pt; }
.signoff { display:grid; grid-template-columns:0.95in 1fr; column-gap:0.2in; align-items:center; margin-top:0.25in; border-top:0.75pt solid var(--navy); padding-top:0.14in; }
.signoff .jax { width:0.95in; height:auto; }
.signoff .sig { font-size:10pt; }
.signoff .contact { font-size:8pt; color:var(--muted); }
`
}

export function renderEditionHtml(p: EditionPayload, a: ReportAssets): string {
  const monthly = p.monthly
    .map((sec) => {
      const pages = monthlyPages(sec)
      return sec.geo.slug === 'bend' ? `${pages}${quadrantPage(p)}` : pages
    })
    .join('')
  const towns = p.towns.map((t) => townBlock(t)).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${esc(p.title)}</title>
<style>${reportStylesheet(a.fontCss)}</style>
</head><body>
${cover(p, a)}
${overviewPage(p)}
${monthly}
${townsPage(p)}
${towns}
${communitiesPage(p)}
${condoPage(p)}
${methodsPage(p, a)}
</body></html>`
}
