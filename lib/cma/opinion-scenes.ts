/**
 * Immersive chapters for the price-opinion spine. Hero and the number
 * stay in immersive.ts. Same order as the print pages.
 */

import { renderBandRivalsSceneHtml } from '@/lib/cma/band-rivals'
import { renderCompStripHtml } from '@/lib/cma/comp-strip'
import { renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
import { renderCompPinMapHtml } from '@/lib/cma/comp-pin-map'
import { compsPriceChartSvg } from '@/lib/cma/comps-price-chart'
import { seasonalityChartSvg } from '@/lib/cma/seasonality-chart'
import { clientSourceLine, whyThisListPrice } from '@/lib/cma/client-facing'
import { immersiveWiderMarketChapters, renderBandOutcomesHtml } from '@/lib/cma/market-area-chapters'
import { dateLong, dec, escapeHtml, int, usd } from '@/lib/cma/render-blocks'
import type { CmaExtras } from '@/lib/cma/extras'
import type { SubdivisionStory } from '@/lib/cma/subdivision-story'
import type { CmaAdjustedComp, CmaBroker, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import { FAILED_ASK_BACKTEST, sellerFacingFindingMeaning } from '@/lib/cma/expired-audit'
import { formatDate } from '@/lib/format/date'
import { subjectPossessive } from '@/lib/cma/land-pricing'
import type { CmaParcelSet } from '@/lib/cma/parcel-shapes'
import { TAXLOT_DISCLAIMER } from '@/lib/data/geo/getTaxlots'
import { renderParcelSilhouettesHtml } from '@/lib/cma/parcel-silhouettes'

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
  /** Recorded lot polygons for the subject and its comps; drives "The land". */
  parcels?: CmaParcelSet | null
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
    subject: {
      beds: a.subject.beds,
      baths: a.subject.baths,
      sqft: a.subject.sqft,
      yearBuilt: a.subject.yearBuilt,
      lotAcres: a.subject.lotAcres,
      recommendedList: a.pricing.recommended,
      latitude: a.subject.latitude,
      longitude: a.subject.longitude,
      photoUrl: a.subject.photoUrl,
    },
  })
}

/** Web twin of seasonalityPage. Same gate, same numbers, same source line. */
function seasonalityScene(a: OpinionSceneArgs): string {
  const x = a.extras?.seasonality
  if (!x || x.byMonth.filter((m) => m.medianDaysToPending != null).length < 6) return ''
  const svg = seasonalityChartSvg(x)
  if (!svg) return ''
  const fastest = x.fastestMonths.length ? x.fastestMonths.join(' and ') : null
  const city = a.subject.city.trim() || 'this city'
  return `
  <section class="sc sc-cream" id="seasonality">
    <div class="in wide">
      <div class="kick r">When to list</div>
      <h2 class="h r">When homes in ${esc(city)} sell fastest</h2>
      <p class="lede r">Median days from list to pending, by the month a sale closed, across ${esc(String(x.yearsCovered))} years and ${esc(int(x.totalClosed))} closed sales in ${esc(city)}.${
        fastest ? ` The shortest waits land in ${esc(fastest)}.` : ''
      }</p>
      <div class="r">${svg}</div>
      <p class="src r">${esc(clientSourceLine(x.source, `Closed single-family sales in ${a.subject.city}, grouped by close month.`))}</p>
    </div>
  </section>`
}

function outcomesScene(a: OpinionSceneArgs): string {
  const html = renderBandOutcomesHtml(a.extras?.marketArea?.outcomes)
  if (!html) return ''
  return `
  <section class="sc sc-cream" id="sold-unsold">
    <div class="in wide">
      <div class="kick r">This price band</div>
      <h2 class="h r">Sold and unsold in this band</h2>
      <div class="r">${html}</div>
    </div>
  </section>`
}

function salesScene(a: OpinionSceneArgs): string {
  const pinMap = renderCompPinMapHtml(a.subject, a.comps, a.mapDataUri)
  return `
  <section class="sc sc-cream" id="evidence">
    <div class="in wide">
      <div class="kick r">The sales that set it</div>
      <h2 class="h r">The sales that set the number</h2>
      <div class="r">${renderCompMatrixHtml(a.subject, a.comps)}</div>
      ${pinMap ? `<div class="pin-map-wrap r">${pinMap}</div>` : ''}
      <div class="r">${renderCompStripHtml(a.comps, subjectPossessive(a.subject))}</div>
    </div>
  </section>`
}

/**
 * The land, drawn to one scale. The web mirror of lotLinesPage — same strip,
 * same disclaimer, so the document a client reads on screen and the one they
 * print say the same thing about the lot.
 */
function lotLinesScene(a: OpinionSceneArgs): string {
  const strip = renderParcelSilhouettesHtml(a.parcels ?? null)
  if (!strip) return ''
  const taxlot = a.parcels?.subject.taxlot?.trim()
  return `
  <section class="sc sc-cream" id="land">
    <div class="in wide">
      <div class="kick r">The land</div>
      <h2 class="h r">What each sale actually sat on</h2>
      <div class="r">${strip}</div>
      <p class="src r">${taxlot ? `Subject tax lot ${esc(taxlot)}. ` : ''}${esc(TAXLOT_DISCLAIMER)}</p>
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
      <p class="lede r">${int(f.totalSales)} homes have sold in ${esc(f.name)}.</p>
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
    .map((f) => {
      const meaning = sellerFacingFindingMeaning(f.meaning)
      return `<div class="story-card r">
        <div class="story-lens">${esc(f.lens)}</div>
        <div class="story-fact">${esc(f.fact)}</div>
        ${meaning ? `<div class="story-mean">${esc(meaning)}</div>` : ''}
      </div>`
    })
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
        <h2 class="h r">Call or text.</h2>
        <div class="cta r">
          ${tel ? `<a class="btn pri" href="tel:${esc(tel)}">Call ${esc(br.phone ?? '')}</a>` : ''}
          ${br.email ? `<a class="btn sec" href="mailto:${esc(br.email)}">Email ${esc(br.displayName.split(' ')[0])}</a>` : ''}
          <a class="btn ter" href="?print=1">Read the full report</a>
        </div>
        <div class="sig r">${esc(br.displayName)} · ${esc(br.title)}${br.licenseNumber ? ` · Licensed in Oregon, ${esc(br.licenseNumber)}` : ''}</div>
        <div class="fine r">Prepared ${formatDate(a.generatedAtIso, { month: 'long', day: 'numeric', year: 'numeric' })} for ${esc(a.clientName ?? a.client?.name ?? 'the owner')}. This is a pricing report. It is not an appraisal.</div>
      </div>
    </div>
  </section>`
}

export function assembleOpinionScenes(a: OpinionSceneArgs): string {
  return [
    whyScene(a),
    competitionScene(a),
    outcomesScene(a),
    salesScene(a),
    lotLinesScene(a),
    subdivisionScene(a),
    seasonalityScene(a),
    immersiveWiderMarketChapters(a),
    expiredScene(a),
    nextScene(a),
  ].join('\n')
}
