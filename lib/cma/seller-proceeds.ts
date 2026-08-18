/**
 * Seller net sheet for every CMA. Print is a static estimate. The web
 * view lets the owner change every line. Mortgage payoff is an
 * assumption unless the owner types the lender figure.
 */

import {
  BUYER_BROKER_ASSUMPTION_PCT,
  STANDARD_LISTING_FEE_PCT,
} from '@/lib/cma/expired-audit'
import { CLERK_RESEARCH_ROOM, type MortgageAssumption } from '@/lib/cma/mortgage-assumption'
import type { ParcelRecord } from '@/lib/cma/parcel-record'
import { escapeHtml, usd, usdSigned } from '@/lib/cma/render-blocks'
import type { CmaPricing } from '@/lib/cma/types'

const esc = escapeHtml
const RECORDING_MISC = 350

export type SellerProceedsInputs = {
  salePrice: number
  listingFeePct: number
  buyerBrokerPct: number
  concessions: number
  titleEscrow: number
  recording: number
  mortgagePayoff: number
}

export type SellerProceeds = {
  inputs: SellerProceedsInputs
  listingFee: number
  buyerBroker: number
  totalCosts: number
  estimatedNet: number
  purchasePrice: number | null
  purchaseDate: string | null
  equityBeforeLoan: number | null
  mortgage: MortgageAssumption | null
  assumptions: string[]
}

export function titleEscrowEstimate(salePrice: number): number {
  if (!(salePrice > 0)) return 0
  return Math.round(Math.min(Math.max(salePrice * 0.005, 2000), 6000))
}

export function computeSellerProceeds(input: SellerProceedsInputs): Pick<
  SellerProceeds,
  'listingFee' | 'buyerBroker' | 'totalCosts' | 'estimatedNet'
> {
  const sale = Math.max(0, input.salePrice)
  const listingFee = Math.round(sale * (Math.max(0, input.listingFeePct) / 100))
  const buyerBroker = Math.round(sale * (Math.max(0, input.buyerBrokerPct) / 100))
  const concessions = Math.max(0, Math.round(input.concessions))
  const titleEscrow = Math.max(0, Math.round(input.titleEscrow))
  const recording = Math.max(0, Math.round(input.recording))
  const mortgagePayoff = Math.max(0, Math.round(input.mortgagePayoff))
  const totalCosts = listingFee + buyerBroker + concessions + titleEscrow + recording + mortgagePayoff
  return {
    listingFee,
    buyerBroker,
    totalCosts,
    estimatedNet: Math.round(sale - totalCosts),
  }
}

export function buildSellerProceeds(opts: {
  pricing: CmaPricing
  parcel?: ParcelRecord | null
  mortgage?: MortgageAssumption | null
  listingFeePct?: number
}): SellerProceeds {
  const salePrice = opts.pricing.recommended
  const concessions = opts.pricing.sellerNet?.expectedConcessions ?? 0
  const mortgage = opts.mortgage ?? null
  const inputs: SellerProceedsInputs = {
    salePrice,
    listingFeePct: opts.listingFeePct ?? STANDARD_LISTING_FEE_PCT,
    buyerBrokerPct: BUYER_BROKER_ASSUMPTION_PCT,
    concessions: concessions > 0 ? concessions : 0,
    titleEscrow: titleEscrowEstimate(salePrice),
    recording: RECORDING_MISC,
    mortgagePayoff: mortgage?.remainingEstimate ?? 0,
  }
  const math = computeSellerProceeds(inputs)
  const purchasePrice = opts.parcel?.acquiredAt ?? mortgage?.purchasePrice ?? null
  const purchaseDate = opts.parcel?.ownedSince ?? mortgage?.purchaseDate ?? null
  const equityBeforeLoan =
    purchasePrice != null && purchasePrice > 0 ? Math.round(salePrice - purchasePrice) : null
  const assumptions = [
    'Sale at the recommended list price unless you change it.',
    `Listing fee starts at ${inputs.listingFeePct} percent, the Enhanced plan. Commission is negotiable.`,
    `Buyer-broker compensation starts at ${inputs.buyerBrokerPct} percent. You decide that number on each offer.`,
    'Title and escrow is a typical Central Oregon band, not a quote.',
    'Deschutes County has no real estate transfer tax.',
    mortgage?.remainingEstimate != null
      ? `Mortgage payoff starts at an estimated remaining principal of ${usd(mortgage.remainingEstimate)} from an 80 percent loan on the last recorded purchase. It is not a lender payoff.`
      : 'Mortgage payoff starts at zero. Type the figure from your lender. Oregon does not publish a current loan balance.',
    `Recorded trust deeds are public at the Deschutes clerk Digital Research Room. ${CLERK_RESEARCH_ROOM}`,
    'This is not a closing statement.',
  ]
  return {
    inputs,
    ...math,
    purchasePrice,
    purchaseDate,
    equityBeforeLoan,
    mortgage,
    assumptions,
  }
}

function moneyInput(id: string, label: string, value: number, note: string): string {
  return `
  <label class="net-field">
    <span class="net-k">${esc(label)}</span>
    <input id="${esc(id)}" class="net-in" type="number" inputmode="decimal" min="0" step="100" value="${Math.round(value)}"/>
    <span class="net-hint">${esc(note)}</span>
  </label>`
}

function pctInput(id: string, label: string, value: number, note: string): string {
  return `
  <label class="net-field">
    <span class="net-k">${esc(label)}</span>
    <input id="${esc(id)}" class="net-in" type="number" inputmode="decimal" min="0" max="10" step="0.1" value="${value}"/>
    <span class="net-hint">${esc(note)}</span>
  </label>`
}

export function renderSellerProceedsPrintHtml(sheet: SellerProceeds): string {
  const i = sheet.inputs
  const rows = [
    ['Sale price', usd(i.salePrice)],
    [`Listing fee at ${i.listingFeePct}%`, usdSigned(-sheet.listingFee)],
    [`Buyer-broker compensation at ${i.buyerBrokerPct}%`, usdSigned(-sheet.buyerBroker)],
    ['Seller concessions', i.concessions > 0 ? usdSigned(-i.concessions) : '$0'],
    ['Title and escrow (estimate)', usdSigned(-i.titleEscrow)],
    ['Recording and miscellaneous', usdSigned(-i.recording)],
    ['Mortgage payoff (assumption)', i.mortgagePayoff > 0 ? usdSigned(-i.mortgagePayoff) : '$0'],
    ['Estimated net', usd(sheet.estimatedNet)],
  ]
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${esc(v)}</td></tr>`)
    .join('')
  const equity =
    sheet.equityBeforeLoan != null && sheet.purchasePrice != null
      ? sheet.equityBeforeLoan >= 0
        ? `<p>You bought this house at ${usd(sheet.purchasePrice)}. At this list the gain before loan payoff is ${usd(sheet.equityBeforeLoan)}.</p>`
        : `<p>You bought this house at ${usd(sheet.purchasePrice)}. At this list that is ${usd(Math.abs(sheet.equityBeforeLoan))} under what you paid, before loan payoff.</p>`
      : ''
  const notes = sheet.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')
  return `
  <h2 class="section">What you would net</h2>
  <p>These are estimates. On the web version of this report you can change every line.</p>
  ${equity}
  <table class="comps">
    <thead><tr><th>Line</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <ul class="note-list">${notes}</ul>`
}

export function renderSellerProceedsSceneHtml(sheet: SellerProceeds): string {
  const i = sheet.inputs
  const equity =
    sheet.equityBeforeLoan != null && sheet.purchasePrice != null
      ? sheet.equityBeforeLoan >= 0
        ? `<p class="body r">You bought this house at ${usd(sheet.purchasePrice)}. At this list the gain before loan payoff is ${usd(sheet.equityBeforeLoan)}.</p>`
        : `<p class="body r">You bought this house at ${usd(sheet.purchasePrice)}. At this list that is ${usd(Math.abs(sheet.equityBeforeLoan))} under what you paid, before loan payoff.</p>`
      : ''
  const mortgageNote =
    sheet.mortgage?.remainingEstimate != null
      ? `Estimated remaining principal from an 80 percent loan on the ${sheet.mortgage.purchaseDate} purchase${
          sheet.mortgage.ratePct != null ? `, using the ${sheet.mortgage.ratePct}% Freddie Mac 30-year rate that week` : ''
        }. Type the lender payoff if you have it.`
      : 'Oregon does not publish a current loan balance. Type the figure from your lender.'
  return `
  <section class="sc sc-cream" id="net">
    <div class="in">
      <div class="kick r">Seller net</div>
      <h2 class="h r">What you would net</h2>
      <p class="lede r">Change any line. The net updates as you type. Nothing here is a closing statement.</p>
      ${equity}
      <script type="application/json" id="proceeds-seed">${JSON.stringify(i)}</script>
      <div class="net-grid r">
        ${moneyInput('net-sale', 'Sale price', i.salePrice, 'Starts at the recommended list.')}
        ${pctInput('net-list-pct', 'Listing fee percent', i.listingFeePct, 'Enhanced plan starts at 3. Commission is negotiable.')}
        ${pctInput('net-buyer-pct', 'Buyer-broker percent', i.buyerBrokerPct, 'You decide this on each offer.')}
        ${moneyInput('net-conc', 'Seller concessions', i.concessions, 'Median of the comparable set when that field was reported.')}
        ${moneyInput('net-title', 'Title and escrow', i.titleEscrow, 'Typical Central Oregon band. Confirm with title.')}
        ${moneyInput('net-rec', 'Recording', i.recording, 'Estimate.')}
        ${moneyInput('net-mtg', 'Mortgage payoff', i.mortgagePayoff, mortgageNote)}
      </div>
      <div class="stat3 r">
        <div class="st"><div class="st-n" id="net-costs">${usd(sheet.totalCosts)}</div><div class="st-l">estimated costs</div></div>
        <div class="st"><div class="st-n" id="net-out" data-count>${usd(sheet.estimatedNet)}</div><div class="st-l">estimated net</div></div>
        <div class="st"><div class="st-n" id="net-gain">${
          sheet.equityBeforeLoan != null ? usd(sheet.equityBeforeLoan) : '—'
        }</div><div class="st-l">gain before loan payoff</div></div>
      </div>
      <p class="src r">${esc(sheet.mortgage?.source ?? 'Mortgage payoff is whatever you type. Current loan balance is not a public Oregon record.')}</p>
    </div>
  </section>`
}

export function renderSellerProceedsScript(): string {
  return `
(function(){
  var seed=document.getElementById('proceeds-seed')
  if(!seed)return
  function num(id){var el=document.getElementById(id);var n=el?parseFloat(el.value):NaN;return isFinite(n)&&n>=0?n:0}
  function usd(n){return '$'+Math.round(n).toLocaleString('en-US')}
  function run(){
    var sale=num('net-sale')
    var list=Math.round(sale*(num('net-list-pct')/100))
    var buyer=Math.round(sale*(num('net-buyer-pct')/100))
    var conc=Math.round(num('net-conc'))
    var title=Math.round(num('net-title'))
    var rec=Math.round(num('net-rec'))
    var mtg=Math.round(num('net-mtg'))
    var costs=list+buyer+conc+title+rec+mtg
    var net=Math.round(sale-costs)
    var costsEl=document.getElementById('net-costs')
    var outEl=document.getElementById('net-out')
    if(costsEl)costsEl.textContent=usd(costs)
    if(outEl)outEl.textContent=usd(net)
  }
  ;['net-sale','net-list-pct','net-buyer-pct','net-conc','net-title','net-rec','net-mtg'].forEach(function(id){
    var el=document.getElementById(id)
    if(el)el.addEventListener('input',run)
  })
})();`
}
