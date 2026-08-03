/**
 * Deterministic Broker Price Opinion renderer — a concise, print-ready
 * broker-facing document (1 to 2 letter pages) in the brand's navy/cream
 * editorial register (Amboqia display, Geist body). Self-contained: inline CSS,
 * absolute asset URLs, no client scripts.
 *
 * Every figure printed here is computed by the same build from live Supabase
 * rows (CLAUDE.md section 0). Copy is deterministic template text vetted against
 * the brand-voice banned list. The final block carries the Oregon disclosure
 * that a broker price opinion is not an appraisal (ORS 696.010 / 696.290).
 */

import { pageContractCss } from '@/lib/pdf/page-contract'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import type {
  CmaAdjustedComp,
  CmaBroker,
  CmaMarketContext,
  BpoListingHistory,
  BpoOpinion,
  BpoOfferStrategy,
  CmaSubject,
} from '@/lib/bpo/types'
import type { CmaSiteData } from '@/lib/cma/county'
import type { DevelopmentOpportunities } from '@/lib/cma/development'
import type { RentalPotential } from '@/lib/cma/rental-potential'
import {
  propertyIntelligenceBlock,
  developmentItemsBlock,
  verifyResourcesBlock,
  zoningExplainerBlock,
  buyerOptionsBlock,
  hoaBlock,
  rentalTenuresBlock,
  rentalIncomeBlock,
  marketingHighlightsBlock,
  collectHighlights,
} from '@/lib/cma/render-blocks'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const usd = formatPriceExact

/** Comment markers wrapping the internal Offer strategy block. Client-safe
 *  views (the public /bpo route + client sends) strip everything between them
 *  so the negotiation strategy never leaves the brokerage. */
export const OFFER_MARK_START = '<!--BPO:OFFER:START-->'
export const OFFER_MARK_END = '<!--BPO:OFFER:END-->'

/** Remove the internal Offer strategy section from a rendered BPO document. */
export function stripOfferStrategy(html: string): string {
  const start = html.indexOf(OFFER_MARK_START)
  const end = html.indexOf(OFFER_MARK_END)
  if (start === -1 || end === -1 || end < start) return html
  return html.slice(0, start) + html.slice(end + OFFER_MARK_END.length)
}

/**
 * Fail-closed guard for any client-safe serve or send. stripOfferStrategy is a
 * best-effort marker strip that returns the FULL html when the markers are
 * absent or truncated. This asserts the result no longer carries the internal
 * offer strategy, so a missing marker throws (and the caller serves a safe
 * error) instead of leaking the negotiation strategy to a client.
 */
export function assertClientSafe(html: string): void {
  if (
    html.includes(OFFER_MARK_START) ||
    html.includes(OFFER_MARK_END) ||
    /class="offer"/.test(html)
  ) {
    throw new Error('Client-safe strip failed: the internal offer strategy is still present')
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function absUrl(u: string | null): string | null {
  if (!u) return null
  if (/^https?:\/\//.test(u)) return u
  return `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`
}

function fmtShort(iso: string | null): string {
  if (!iso) return '—'
  const s = formatDate(iso, { month: 'short', day: undefined, year: 'numeric' })
  return s || '—'
}

const OUTCOME_LABEL: Record<string, string> = {
  sold: 'Sold',
  active: 'Active',
  pending: 'Pending',
  canceled: 'Canceled',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
  other: 'Off-market',
}

export interface RenderBpoArgs {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  history: BpoListingHistory
  opinion: BpoOpinion
  offer: BpoOfferStrategy
  broker: CmaBroker
  rationale: string
  purpose: string | null
  generatedAtIso: string
  site?: CmaSiteData | null
  development?: DevelopmentOpportunities | null
  rental?: RentalPotential | null
}

function stylesheet(): string {
  return `
  ${pageContractCss()}

  @font-face {
    font-family: 'Amboqia Boriango';
    src: url('${SITE_URL}/fonts/Amboqia_Boriango.otf') format('opentype');
    font-weight: 400; font-style: normal; font-display: swap;
  }
  :root {
    --navy: #102742;
    --cream: #faf8f4;
    --line: rgba(16,39,66,0.16);
    --fill: rgba(16,39,66,0.05);
    --muted: rgba(16,39,66,0.60);
    --strong-neg: #8a2f2f;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #e8e3d8; color: var(--navy);
    font-family: 'Geist', system-ui, -apple-system, sans-serif; font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased; }
  /* The reserved bands come from @page in the contract above, NOT from padding
     here. This rule used to set padding 0.7in 0.75in, and that is the whole
     bug: CSS padding on a box that fragments across sheets is applied once at
     the top of the box and once at the bottom, so the FIRST sheet had a top
     margin, the LAST had a bottom margin, and every interior sheet had neither.
     Measured on a 5-sheet BPO: body text 1.5pt from the paper edge on sheets 3,
     4 and 5. Every BPO longer than two sheets printed that way. */
  .page { max-width: 100%; background: var(--cream); position: relative; }
  /* Page 1 (summary) prints on its own sheet. Page 2 (detail) flows naturally
     across as many sheets as it needs, breaking only between whole blocks. */
  .page:first-child { page-break-after: always; break-after: page; }
  .offer, .opinion, .kpis, .facts, table, tr, .sig, ul.signals li, ul.terms li,
  h2.sec, .disclosure { break-inside: avoid; }
  /* Screen only: the on-page preview shows sheets on a desk. Print takes its
     box from @page, so this must never set a height the printer will honour. */
  @media screen {
    .page { width: 8.5in; min-height: 10.5in; margin: 0.4in auto; padding: 0.7in 0.75in; }
  }
  .amboqia { font-family: 'Amboqia Boriango', 'Geist', serif; font-weight: 400; }
  .eyebrow { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
  h1.addr { font-size: 30px; line-height: 1.05; margin: 6px 0 2px; letter-spacing: -0.01em; }
  .sub { font-size: 12px; color: var(--muted); margin: 0; }
  .rule { height: 2px; background: var(--navy); margin: 14px 0; }
  .hairline { height: 1px; background: var(--line); margin: 14px 0; }

  .opinion { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px;
    padding: 18px 20px; background: var(--navy); color: var(--cream); border-radius: 12px; }
  .opinion .big { font-size: 42px; line-height: 1; letter-spacing: -0.02em; }
  .opinion .lbl { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.72; margin-bottom: 4px; }
  .opinion .range { font-size: 14px; opacity: 0.9; margin-top: 6px; }
  .badge { display: inline-block; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(250,248,244,0.5); }

  .facts { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 16px 0; }
  .fact { background: var(--fill); border-radius: 8px; padding: 9px 10px; }
  .fact .v { font-size: 15px; font-weight: 600; }
  .fact .k { font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-top: 2px; }

  h2.sec { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
    margin: 20px 0 8px; }
  h3.subhead { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--navy);
    font-weight: 600; margin: 14px 0 6px; break-after: avoid; }
  ul.note-list { list-style: none; padding: 0; margin: 6px 0 0; }
  ul.note-list li { font-size: 11.5px; line-height: 1.5; padding: 5px 0 5px 15px; position: relative;
    border-bottom: 1px solid var(--line); break-inside: avoid; }
  ul.note-list li::before { content: '·'; position: absolute; left: 3px; top: 4px; color: var(--navy); font-weight: 700; }
  ul.note-list li strong { font-weight: 600; }
  .small { font-size: 10.5px; color: var(--muted); line-height: 1.5; }
  a { color: var(--navy); }
  /* Shared capability blocks (lib/cma/render-blocks.ts) — same markup as the
     CMA so one property reads identically across both documents. */
  .hl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 10px; }
  .hl { border: 1px solid var(--line); border-left: 3px solid var(--navy); border-radius: 8px;
    padding: 10px 12px; break-inside: avoid; }
  .hl .hl-head { font-size: 12px; font-weight: 600; line-height: 1.3; }
  .hl .hl-basis { margin-top: 4px; font-size: 9.5px; line-height: 1.45; color: var(--muted); }
  .verdict { display: inline-block; margin-left: 6px; vertical-align: 1px; background: var(--navy);
    color: var(--cream); font-size: 7.5px; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; padding: 2px 8px; border-radius: 999px; }
  .verdict.is-no { background: transparent; color: var(--muted); border: 1px solid var(--line); }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0 6px; }
  .chips span { font-size: 9px; line-height: 1.2; background: var(--fill); border-radius: 4px; padding: 3px 7px; }
  .zone-line { font-size: 14px; margin: 0 0 6px; }
  .src { font-size: 9px; color: var(--muted); margin: 3px 0 10px; line-height: 1.4; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  table.kv th { width: 40%; text-align: left; white-space: normal; font-weight: 500; }
  table.kv td { text-align: left; white-space: normal; }
  table.kv.is-wide th { width: 26%; }
  table.kv.is-wide td.v { width: 22%; font-weight: 600; color: var(--navy); }
  table.kv.is-wide td.b, table.kv.is-wide th.b { color: var(--muted); font-size: 9.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { text-align: right; padding: 6px 7px; border-bottom: 1px solid var(--line); white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; white-space: normal; }
  th { font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
  tr.current td { background: rgba(16,39,66,0.07); font-weight: 600; }
  td.neg { color: var(--strong-neg); }

  ul.signals { list-style: none; padding: 0; margin: 8px 0 0; }
  ul.signals li { font-size: 12px; line-height: 1.5; padding: 7px 0 7px 16px; position: relative; border-bottom: 1px solid var(--line); }
  ul.signals li::before { content: ''; position: absolute; left: 0; top: 13px; width: 6px; height: 6px; border-radius: 50%; background: var(--navy); }
  ul.signals li.strong::before { background: var(--strong-neg); }
  ul.signals li.info::before { background: var(--muted); }

  .rationale p { font-size: 12.5px; line-height: 1.62; margin: 0 0 10px; }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0 4px; }
  .kpi { background: var(--fill); border-radius: 8px; padding: 10px 12px; }
  .kpi .v { font-size: 17px; font-weight: 600; }
  .kpi .k { font-size: 9.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-top: 3px; }

  .offer { border: 1.5px solid var(--navy); border-radius: 12px; padding: 16px 18px; margin: 4px 0 6px; }
  .offer-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .offer h2 { font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; margin: 0; }
  .posture { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 9px;
    border-radius: 999px; background: var(--navy); color: var(--cream); }
  .posture.balanced { background: rgba(16,39,66,0.55); }
  .posture.seller { background: rgba(16,39,66,0.30); color: var(--navy); }
  .offer .headline { font-size: 14px; font-weight: 600; margin: 10px 0 12px; line-height: 1.35; }
  ul.terms { list-style: none; padding: 0; margin: 10px 0 0; }
  ul.terms li { font-size: 12px; line-height: 1.5; padding: 5px 0 5px 15px; position: relative; }
  ul.terms li::before { content: '→'; position: absolute; left: 0; top: 5px; color: var(--muted); }

  .sig { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
  .sig img { width: 54px; height: 54px; border-radius: 50%; object-fit: cover; background: var(--fill); }
  .sig .name { font-size: 14px; font-weight: 600; }
  .sig .meta { font-size: 11px; color: var(--muted); }
  .disclosure { font-size: 9.5px; line-height: 1.5; color: var(--muted); margin-top: 14px; }
  `
}

function factsBlock(subject: CmaSubject, history: BpoListingHistory): string {
  const items: Array<[string, string]> = [
    ['Beds', subject.beds != null ? String(subject.beds) : '—'],
    ['Baths', subject.baths != null ? String(subject.baths) : '—'],
    ['Sq ft', subject.sqft != null ? subject.sqft.toLocaleString('en-US') : '—'],
    ['Lot', subject.lotAcres != null ? `${subject.lotAcres} ac` : '—'],
    ['Built', subject.yearBuilt != null ? String(subject.yearBuilt) : '—'],
    ['Status', history.currentIsActive ? 'Active' : (subject.standardStatus ?? '—')],
  ]
  return `<div class="facts">${items
    .map(([k, v]) => `<div class="fact"><div class="v">${escapeHtml(v)}</div><div class="k">${escapeHtml(k)}</div></div>`)
    .join('')}</div>`
}

function historyRows(history: BpoListingHistory): string {
  if (history.cycles.length === 0) {
    return `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:14px;">No prior MLS listing history.</td></tr>`
  }
  return history.cycles
    .map((c) => {
      const isCurrent = history.currentCycle?.listingKey != null && c.listingKey === history.currentCycle.listingKey
      const list = c.finalListPrice != null ? usd(c.finalListPrice) : '—'
      const orig =
        c.originalListPrice != null && c.originalListPrice !== c.finalListPrice ? ` (from ${usd(c.originalListPrice)})` : ''
      const result = c.closePrice ? usd(c.closePrice) : OUTCOME_LABEL[c.outcome] ?? c.outcome
      const cuts = c.priceCutCount && c.priceCutCount > 0 ? String(c.priceCutCount) : '—'
      return `<tr class="${isCurrent ? 'current' : ''}">
        <td>${fmtShort(c.listDate)}${isCurrent ? ' · now' : c.offMarketDate ? ` to ${fmtShort(c.offMarketDate)}` : ''}</td>
        <td>${escapeHtml(OUTCOME_LABEL[c.outcome] ?? c.outcome)}</td>
        <td>${escapeHtml(list)}${escapeHtml(orig)}</td>
        <td>${escapeHtml(result)}</td>
        <td>${c.daysOnMarket != null ? c.daysOnMarket : '—'}</td>
        <td>${cuts}</td>
      </tr>`
    })
    .join('')
}

function compRows(comps: CmaAdjustedComp[]): string {
  return comps
    .map(
      (c) => `<tr>
      <td>${escapeHtml(c.address)}</td>
      <td>${usd(c.closePrice)}</td>
      <td>${fmtShort(c.closeDate)}</td>
      <td>${c.sqft.toLocaleString('en-US')}</td>
      <td>$${Math.round(c.closePrice / c.sqft)}</td>
      <td>${c.domTotal != null ? c.domTotal : '—'}</td>
      <td>${usd(c.adjustedPrice)}</td>
    </tr>`,
    )
    .join('')
}

function offerBlock(offer: BpoOfferStrategy): string {
  const figs: Array<[string, string]> =
    offer.mode === 'buyer'
      ? [
          ['Opening offer', offer.openingOffer != null ? usd(offer.openingOffer) : '—'],
          ['Target', offer.targetOffer != null ? usd(offer.targetOffer) : '—'],
          ['Ceiling', offer.ceiling != null ? usd(offer.ceiling) : '—'],
        ]
      : [
          ['Recommended list', offer.recommendedList != null ? usd(offer.recommendedList) : '—'],
          ['Expected offers from', offer.expectedOfferLow != null ? usd(offer.expectedOfferLow) : '—'],
          ['Up to', offer.expectedOfferHigh != null ? usd(offer.expectedOfferHigh) : '—'],
        ]
  const postureClass = offer.posture === 'balanced' ? 'balanced' : offer.posture === 'seller-favored' ? 'seller' : ''
  const postureLabel = offer.posture === 'buyer-favored' ? 'Buyer-favored' : offer.posture === 'seller-favored' ? 'Seller-favored' : 'Balanced'
  return `<div class="offer">
    <div class="offer-top">
      <h2 class="amboqia">Offer strategy</h2>
      <span class="posture ${postureClass}">${escapeHtml(postureLabel)}</span>
    </div>
    <div class="headline">${escapeHtml(offer.headline)}</div>
    <div class="kpis" style="grid-template-columns: repeat(3, 1fr);">
      ${figs.map(([k, v]) => `<div class="kpi"><div class="v">${escapeHtml(v)}</div><div class="k">${escapeHtml(k)}</div></div>`).join('')}
    </div>
    ${offer.leverage.length ? `<ul class="signals">${offer.leverage.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : ''}
    <ul class="terms">${offer.terms.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
  </div>`
}

function signalsList(history: BpoListingHistory): string {
  if (history.signals.length === 0) return ''
  return `<ul class="signals">${history.signals
    .map((s) => `<li class="${s.severity === 'strong' ? 'strong' : s.severity === 'info' ? 'info' : ''}">${escapeHtml(s.text)}</li>`)
    .join('')}</ul>`
}

export function renderBpoHtml(args: RenderBpoArgs): { html: string; pageCount: number } {
  const { subject, comps, market, history, opinion, offer, broker, rationale, purpose, generatedAtIso, site, development, rental } = args
  const intelligence = propertyIntelligenceBlock(site)
  const devItems = developmentItemsBlock(development)
  const devResources = verifyResourcesBlock(development, rental)
  const zoning = zoningExplainerBlock(development)
  const buyerOptions = buyerOptionsBlock(development)
  const hoa = hoaBlock(development)
  const rentalTenures = rental ? rentalTenuresBlock(rental.tenures) : ''
  const rentalIncome = rental ? rentalIncomeBlock(rental.income) : ''
  const highlights = marketingHighlightsBlock(collectHighlights(development, rental))
  const addr = `${subject.streetAddress}, ${subject.city}, ${subject.state} ${subject.postalCode ?? ''}`.trim()
  const vsList =
    opinion.vsCurrentListPct != null
      ? `${opinion.vsCurrentListPct > 0 ? '↑' : opinion.vsCurrentListPct < 0 ? '↓' : ''} ${Math.abs(opinion.vsCurrentListPct)}% vs list`
      : ''
  const photo = absUrl(broker.photoUrl) ?? `${SITE_URL}/images/brokers/ryan-matt.png`
  const rationaleHtml = rationale
    .split('\n\n')
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('')

  const kpis: Array<[string, string]> = market
    ? [
        ['Median sale', market.medianSalePrice != null ? usd(market.medianSalePrice) : '—'],
        ['Median days', market.medianDom != null ? `${Math.round(market.medianDom)}` : '—'],
        ['Months supply', market.monthsOfSupply != null ? String(market.monthsOfSupply) : '—'],
        ['YoY price', market.yoyMedianPriceDeltaPct != null ? `${market.yoyMedianPriceDeltaPct >= 0 ? '↑' : '↓'} ${Math.abs(market.yoyMedianPriceDeltaPct).toFixed(1)}%` : '—'],
      ]
    : []

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Broker Price Opinion · ${escapeHtml(subject.streetAddress)}</title>
<style>${stylesheet()}</style></head>
<body>
  <div class="page">
    <div class="eyebrow">Broker Price Opinion${purpose ? ` · ${escapeHtml(purpose)}` : ''}</div>
    <h1 class="addr amboqia">${escapeHtml(subject.streetAddress)}</h1>
    <p class="sub">${escapeHtml(addr)}${subject.subdivision ? ` · ${escapeHtml(subject.subdivision)}` : ''} · Prepared ${escapeHtml(fmtShort(generatedAtIso))} by ${escapeHtml(broker.displayName)}</p>
    <div class="rule"></div>

    <div class="opinion">
      <div>
        <div class="lbl">Opinion of value</div>
        <div class="big amboqia">${usd(opinion.opinionValue)}</div>
        <div class="range">Supported range ${usd(opinion.valueLow)} to ${usd(opinion.valueHigh)}${vsList ? ` · ${escapeHtml(vsList)}` : ''}</div>
      </div>
      <div style="text-align:right;">
        <span class="badge">${escapeHtml(opinion.confidence)} confidence</span>
      </div>
    </div>

    ${factsBlock(subject, history)}

    <h2 class="sec">Listing history</h2>
    <table>
      <thead><tr><th>Listed</th><th>Result</th><th>List price</th><th>Sold / status</th><th>DOM</th><th>Cuts</th></tr></thead>
      <tbody>${historyRows(history)}</tbody>
    </table>
    ${signalsList(history)}

    ${intelligence ? `<div class="rule"></div>${intelligence}` : ''}

    ${highlights ? `<div class="rule"></div><h2 class="sec">What we lead with</h2>${highlights}` : ''}
    ${zoning ? `<div class="rule"></div><h2 class="sec">Zoning, in plain language</h2>${zoning}` : ''}
    ${devItems ? `<div class="rule"></div><h2 class="sec">What you can build here</h2>${devItems}` : ''}
    ${buyerOptions ? `<h2 class="sec">What a buyer could do with it</h2>${buyerOptions}` : ''}
    ${rentalTenures ? `<h2 class="sec">Renting it out</h2>${rentalTenures}` : ''}
    ${rentalIncome ? `<h3 class="subhead">What it could bring in</h3>${rentalIncome}${rental?.economicsNote ? `<p class="sub">${escapeHtml(rental.economicsNote)}</p>` : ''}` : ''}
    ${hoa ? `<h2 class="sec">HOA and CC&amp;Rs</h2>${hoa}` : ''}
    ${devResources ? `<h2 class="sec">Verify it yourself</h2>${devResources}` : ''}
  </div>

  <div class="page">
    <div class="eyebrow">Broker Price Opinion · ${escapeHtml(subject.streetAddress)}</div>
    ${OFFER_MARK_START}${offerBlock(offer)}${OFFER_MARK_END}
    <h2 class="sec" style="margin-top:12px;">Comparable sales</h2>
    <table>
      <thead><tr><th>Address</th><th>Sold</th><th>Date</th><th>Sq ft</th><th>$/sf</th><th>DOM</th><th>Adjusted</th></tr></thead>
      <tbody>${compRows(comps)}</tbody>
    </table>
    <p class="sub" style="margin-top:8px;">Adjusted = closed price corrected for time since sale and size difference against the subject. Beds, baths, lot, and condition differences are noted, not dollar-adjusted, because a defensible paired-sales value cannot be drawn for them from the data.</p>

    ${market ? `<h2 class="sec">${escapeHtml(market.geoLabel)} market</h2><div class="kpis">${kpis.map(([k, v]) => `<div class="kpi"><div class="v">${escapeHtml(v)}</div><div class="k">${escapeHtml(k)}</div></div>`).join('')}</div>` : ''}

    <h2 class="sec">How we reached this opinion</h2>
    <div class="rationale">${rationaleHtml}</div>

    <div class="hairline"></div>
    <div class="sig">
      <img src="${escapeHtml(photo)}" alt="${escapeHtml(broker.displayName)}" />
      <div>
        <div class="name">${escapeHtml(broker.displayName)}</div>
        <div class="meta">${escapeHtml(broker.title)}${broker.licenseNumber ? ` · Oregon license ${escapeHtml(broker.licenseNumber)}` : ''}</div>
        <div class="meta">Ryan Realty · ryan-realty.com</div>
      </div>
    </div>
    <p class="disclosure">
      This is a broker price opinion prepared by an active Oregon real estate licensee. It is an opinion of value based on comparable sales, current market conditions, and the property's Multiple Listing Service history as of ${escapeHtml(fmtShort(generatedAtIso))}. It is not an appraisal and was not prepared by a state-licensed or certified appraiser under ORS chapter 674. Under ORS 696.010 and 696.290 a licensed broker may prepare a competitive or comparative market analysis and opinion of value. Values are estimates, not guarantees of sale price. Figures trace to the Central Oregon MLS and the brokerage market data caches.
    </p>
  </div>
</body></html>`

  return { html, pageCount: 2 }
}
