/**
 * Immersive chapters for the price-opinion spine. Hero and the number
 * stay in immersive.ts. Same order as the print pages.
 */

import { renderBandRivalsSceneHtml } from '@/lib/cma/band-rivals'
import { renderCompStripHtml } from '@/lib/cma/comp-strip'
import { renderCompPinMapHtml } from '@/lib/cma/comp-pin-map'
import { compsPriceChartSvg } from '@/lib/cma/comps-price-chart'
import { whyThisListPrice } from '@/lib/cma/client-facing'
import { immersiveWiderMarketChapters } from '@/lib/cma/market-area-chapters'
import { renderParcelRecordScene } from '@/lib/cma/parcel-record'
import { renderOwnerNotesSceneHtml } from '@/lib/cma/owner-notes'
import { buildSellerProceeds, renderSellerProceedsSceneHtml } from '@/lib/cma/seller-proceeds'
import { renderZestimateBustSceneHtml } from '@/lib/cma/zestimate-buster'
import { dateLong, dec, escapeHtml, int, usd } from '@/lib/cma/render-blocks'
import type { CmaExtras } from '@/lib/cma/extras'
import type { SubdivisionStory } from '@/lib/cma/subdivision-story'
import type { CmaAdjustedComp, CmaBroker, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import { FAILED_ASK_BACKTEST } from '@/lib/cma/expired-audit'
import { formatDate } from '@/lib/format/date'

const esc = escapeHtml

export type OpinionSceneArgs = {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  extras?: CmaExtras | null
  subdivisionStory?: SubdivisionStory | null
  mapDataUri: string | null
  equity?: CmaEquityPosition | null
  expiredAudit?: ExpiredAuditData | null
  broker: CmaBroker
  generatedAtIso: string
  clientName?: string | null
  client?: { name?: string | null }
}

function whyScene(a: OpinionSceneArgs): string {
  const why = whyThisListPrice(a)
  const bullets = why.bullets
    .map((b) => `<div class="like r"><div class="like-h">${esc(b.label)}</div><div class="like-d">${esc(b.text)}</div></div>`)
    .join('')
  const chart = compsPriceChartSvg({ comps: a.comps, recommended: a.pricing.recommended })
  return `
  <section class="sc sc-cream" id="why-this-price">
    <div class="in">
      <div class="kick r">Why that number</div>
      <h2 class="h r">${esc(why.heading)}</h2>
      <p class="lede r">${esc(why.coverSentence)}</p>
      ${chart ? `<div class="szn r" data-anim="chart">${chart}</div>` : ''}
      ${bullets ? `<div class="like-grid">${bullets}</div>` : ''}
      ${why.market ? `<p class="body r">${esc(why.market)}</p>` : ''}
      ${why.ownership ? `<p class="body r">${esc(why.ownership)}</p>` : ''}
      ${why.strategy ? `<p class="body r">${esc(why.strategy)}</p>` : ''}
    </div>
  </section>`
}

function competitionScene(a: OpinionSceneArgs): string {
  const b = a.extras?.band
  if (!b) return ''
  return renderBandRivalsSceneHtml({
    city: a.subject.city,
    lo: b.lo,
    hi: b.hi,
    activeCount: b.activeCount,
    pendingCount: b.pendingCount,
    rivals: b.rivals ?? [],
    productLabel: b.productLabel,
  })
}

function salesScene(a: OpinionSceneArgs): string {
  const pinMap = renderCompPinMapHtml(a.subject, a.comps)
  return `
  <section class="sc sc-cream" id="evidence">
    <div class="in wide">
      <div class="kick r">The sales that set it</div>
      <h2 class="h r">The sales that set the number</h2>
      <p class="lede r">Tap a house. The pin lights up.</p>
      ${pinMap ? `<div class="pin-map-wrap r">${pinMap}</div>` : ''}
      <div class="r">${renderCompStripHtml(a.comps)}</div>
    </div>
  </section>`
}

function subdivisionScene(a: OpinionSceneArgs): string {
  const st = a.subdivisionStory
  if (!st) return ''
  const f = st.facts
  const maxMed = Math.max(...f.years.map((y) => y.medianClose), 1)
  const yearBars = f.years
    .map(
      (y) => `<div class="yr-col">
      <div class="yr-v">${usd(y.medianClose)}</div>
      <div class="yr-bar-wrap"><div class="yr-bar" style="--h:${Math.max(8, (y.medianClose / maxMed) * 100).toFixed(1)}%"></div></div>
      <div class="yr-m">${y.year}</div>
      <div class="yr-c">${y.count} sale${y.count === 1 ? '' : 's'}</div>
    </div>`,
    )
    .join('')
  const sections = st.sections
    .map((sec) => `<div class="sty r"><h3 class="sty-h">${esc(sec.heading)}</h3><p class="sty-b">${esc(sec.body)}</p></div>`)
    .join('')
  const notable = st.notableSales
    .filter((n) => n.photoUrl)
    .map(
      (n) => `<article class="nb r">
      <img class="nb-img" src="${esc(n.photoUrl!)}" alt="${esc(n.address)}" loading="lazy" referrerpolicy="no-referrer"/>
      <div class="nb-b">
        <div class="nb-a">${esc(n.address)}</div>
        <div class="nb-p">${usd(n.closePrice)} · ${dateLong(n.closeDate)}</div>
        ${n.line ? `<div class="nb-l">${esc(n.line)}</div>` : ''}
      </div>
    </article>`,
    )
    .join('')
  const position = [
    f.subjectSqftPercentile != null
      ? `Your home is as large or larger than ${f.subjectSqftPercentile}% of everything that has sold here.`
      : null,
    f.vintageSpan ? `The street was built out ${f.vintageSpan.min} to ${f.vintageSpan.max}.` : null,
    f.recordHigh ? `The record is ${usd(f.recordHigh.price)} at ${esc(f.recordHigh.address)}.` : null,
    f.medianDomRecent != null
      ? `Sales here over the last two years carried a median of ${int(f.medianDomRecent)} days on market.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')
  return `
  <section class="sc sc-cream" id="your-street">
    <div class="in wide">
      <div class="kick r">This subdivision</div>
      <h2 class="h r">${esc(f.name)}</h2>
      ${a.mapDataUri ? `<img class="map-img is-plat r" src="${a.mapDataUri}" alt="${esc(f.name)}"/>` : ''}
      <p class="lede r">${int(f.totalSales)} homes have sold on this street. This is the street, not the sales that set the number.</p>
      ${sections ? `<div class="sty-grid">${sections}</div>` : ''}
      <div class="yr r" role="img" aria-label="Median close price by year in ${esc(f.name)}">${yearBars}</div>
      ${notable ? `<h3 class="sub r">The most recent sales</h3><div class="nb-grid">${notable}</div>` : ''}
      ${position ? `<p class="body r pos">${position}</p>` : ''}
    </div>
  </section>`
}

function expiredScene(a: OpinionSceneArgs): string {
  const audit = a.expiredAudit
  if (!audit) return ''
  const s = a.subject
  const orig = s.lastListPrice != null && s.lastListPrice > 0 ? s.lastListPrice : null
  const findings = audit.findings.slice(0, 3)
  const cards = findings
    .map(
      (f) => `<div class="story-card r">
        <div class="story-lens">${esc(f.lens)}</div>
        <div class="story-fact">${esc(f.fact)}</div>
        <div class="story-mean">${esc(f.meaning)}</div>
      </div>`,
    )
    .join('')
  const b = FAILED_ASK_BACKTEST
  return `
  <section class="sc sc-navy" id="last-listing">
    <div class="in">
      <div class="kick r">Your last listing</div>
      <h2 class="h r">It asked ${usd(orig)} and did not sell.</h2>
      <div class="stat3 r">
        <div class="st"><div class="st-n" data-count>${int(b.pairs)}</div><div class="st-l">Central Oregon homes failed to sell, then sold later, 2023 to 2026</div></div>
        <div class="st"><div class="st-n" data-count>${(b.closeMedianRatio * 100).toFixed(1)}%</div><div class="st-l">of the failed ask is what the median one later sold for</div></div>
        <div class="st"><div class="st-n" data-count>${b.shareClosedAboveAskPct}%</div><div class="st-l">later sold for more than the ask that failed</div></div>
      </div>
      <div class="story-grid">${cards}</div>
    </div>
  </section>`
}

function nextScene(a: OpinionSceneArgs): string {
  const br = a.broker
  const photo = br.photoUrl ? `<img class="br-img" src="${esc(br.photoUrl)}" alt="${esc(br.displayName)}"/>` : ''
  const tel = br.phone ? br.phone.replace(/[^+\d]/g, '') : null
  return `
  <section class="sc sc-cream" id="next-step">
    <div class="in next-in">
      ${photo}
      <div class="next-b">
        <div class="kick r">Your next step</div>
        <h2 class="h r">We have not seen inside your home.</h2>
        <p class="lede r">Thirty minutes on site and this estimate gets sharper in both directions.</p>
        <div class="cta r">
          ${tel ? `<a class="btn pri" href="tel:${esc(tel)}">Call ${esc(br.phone ?? '')}</a>` : ''}
          ${br.email ? `<a class="btn sec" href="mailto:${esc(br.email)}">Email ${esc(br.displayName.split(' ')[0])}</a>` : ''}
          <a class="btn ter" href="?print=1">Read the full report</a>
        </div>
        <div class="sig r">${esc(br.displayName)} · ${esc(br.title)}${br.licenseNumber ? ` · Licensed in Oregon, ${esc(br.licenseNumber)}` : ''}</div>
        <div class="fine r">Prepared ${formatDate(a.generatedAtIso, { month: 'long', day: 'numeric', year: 'numeric' })} for ${esc(a.clientName ?? a.client?.name ?? 'the owner')}. This is a comparative market analysis. It is not an appraisal.</div>
      </div>
    </div>
  </section>`
}

export function assembleOpinionScenes(a: OpinionSceneArgs): string {
  return [
    whyScene(a),
    renderZestimateBustSceneHtml(a.extras?.zillow),
    competitionScene(a),
    salesScene(a),
    subdivisionScene(a),
    renderParcelRecordScene(a.extras?.parcel),
    renderOwnerNotesSceneHtml(a.extras?.ownerNotes ?? []),
    renderSellerProceedsSceneHtml(
      a.extras?.proceeds ?? buildSellerProceeds({ pricing: a.pricing, parcel: a.extras?.parcel }),
    ),
    immersiveWiderMarketChapters(a),
    expiredScene(a),
    nextScene(a),
  ].join('\n')
}
