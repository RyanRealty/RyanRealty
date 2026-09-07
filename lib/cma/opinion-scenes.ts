/**
 * Immersive chapters for the price-opinion spine. Hero and the number
 * stay in immersive.ts. Same order as the print pages.
 */

import { renderBandRivalsSceneHtml } from '@/lib/cma/band-rivals'
import { daysOnMarketFrom } from '@/lib/cma/listing-history-line'
import { seasonalityChartSvg } from '@/lib/cma/seasonality-chart'
import { clientSourceLine } from '@/lib/cma/client-facing'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import {
  renderBandOutcomesHtml,
  renderDaysToOfferHtml,
  renderExpiredPeersHtml,
  widerMarketBodyHtml,
} from '@/lib/cma/market-area-chapters'
import type { OpinionPageArgs } from '@/lib/cma/opinion-pages'
import {
  OPINION_CHAPTER_ORDER,
  bandChapterShowsRuler,
  cmaDisclosureProseHtml,
  permitsPage,
  sellerNetPage,
  snapshotPage,
  type OpinionChapterId,
} from '@/lib/cma/opinion-pages'
import { cleanText, dateLong, dec, escapeHtml, int, usd } from '@/lib/cma/render-blocks'
import type { CmaExtras } from '@/lib/cma/extras'
import type { SubdivisionStory } from '@/lib/cma/subdivision-story'
import type { CmaAdjustedComp, CmaBroker, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import { FAILED_ASK_BACKTEST, sellerFacingFindingMeaning } from '@/lib/cma/expired-audit'
import { formatDate } from '@/lib/format/date'
import type { CmaParcelSet } from '@/lib/cma/parcel-shapes'
import { TAXLOT_DISCLAIMER } from '@/lib/data/geo/getTaxlots'
import { lotsDifferMaterially, renderParcelSilhouettesHtml } from '@/lib/cma/parcel-silhouettes'

const esc = escapeHtml

/**
 * The immersive builds from the SAME args object the letter does (P10), plus
 * the broker and client the closing chapters print. Sharing the type is what
 * lets a scene reuse a letter chapter body without a cast.
 */
export type OpinionSceneArgs = OpinionPageArgs & {
  broker: CmaBroker
  clientName?: string | null
  client?: { name?: string | null }
}

function priceScene(a: OpinionSceneArgs): string {
  const page = pricingPage({
    subject: a.subject,
    comps: a.comps,
    market: a.market,
    pricing: a.pricing,
    mapDataUri: a.mapDataUri,
    // Immersive hero already carries recommend + range once on the photo.
    omitLeadPrices: true,
  })
  return `
  <section class="sc sc-cream pack" id="how-we-got-the-price">
    <div class="in wide">
      <h2 class="h r">Our Recommended List Price for your home.</h2>
      <div class="r">${page.body}</div>
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
      listingHistoryLine: a.subject.listingHistoryLine,
      daysOnMarket: daysOnMarketFrom({ onMarketDate: a.subject.lastListDate }),
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
      <p class="lede r">Median days from list to under contract, by the month a sale closed, across ${esc(String(x.yearsCovered))} years and ${esc(int(x.totalClosed))} closed sales in ${esc(city)}.${
        fastest ? ` The shortest waits land in ${esc(fastest)}.` : ''
      }</p>
      <div class="r">${svg}</div>
      <p class="src r">${esc(clientSourceLine(x.source, `Closed single-family sales in ${a.subject.city}, grouped by close month.`, {
      city: a.subject.city,
    }))}</p>
    </div>
  </section>`
}

function outcomesScene(a: OpinionSceneArgs): string {
  const chart = bandChapterShowsRuler(a)
    ? renderBandOutcomesHtml(a.extras?.marketArea?.outcomes, a.comps, a.subject.city)
    : ''
  const peers = renderExpiredPeersHtml(a.subject, a.extras?.marketArea?.expiredPeers)
  if (!chart && !peers) return ''
  return `
  <section class="sc sc-cream pack" id="sold-unsold">
    <div class="in wide">
      <div class="kick r">Your price range</div>
      <h2 class="h r">Sold and unsold in your price range</h2>
      <div class="r">${chart || ''}${peers}</div>
    </div>
  </section>`
}

/**
 * The land, drawn to one scale. The web mirror of lotLinesPage — same strip,
 * same disclaimer, so the document a client reads on screen and the one they
 * print say the same thing about the lot.
 */
function lotLinesScene(a: OpinionSceneArgs): string {
  // Same gate as lotLinesPage (P6) — the chapter exists on both paths or on
  // neither.
  if (!lotsDifferMaterially(a.parcels ?? null)) return ''
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
  // Same gate as subdivisionChapterPage: never a chapter headed "N/A".
  const name = cleanText(f.name)
  if (!name) return ''
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
      <h2 class="h r">${esc(name)}</h2>
      <p class="lede r">${int(f.totalSales)} homes have sold in ${esc(name)}.</p>
      ${sections ? `<div class="sty-grid">${sections}</div>` : ''}
      ${notable ? `<h3 class="sub r">The most recent sales</h3><div class="nb-grid">${notable}</div>` : ''}
      ${position ? `<p class="body r pos">${position}</p>` : ''}
    </div>
  </section>`
}

/**
 * Your last listing. For an expired owner this is the WHY, so it sits directly
 * after the number and carries the price ruler with their own failed ask on it
 * (P2). The three backtest figures print as themselves — the count-up that used
 * to animate them shipped 184 / 5.1% / 0.7% into a screenshot of 3,394 / 94.2%
 * / 12.3% (F4). A §0 figure never passes through a false value.
 */
function expiredScene(a: OpinionSceneArgs): string {
  const audit = a.expiredAudit
  if (!audit || audit.findings.length === 0) return ''
  const s = a.subject
  const orig = s.lastListPrice != null && s.lastListPrice > 0 ? s.lastListPrice : null
  const ruler = renderBandOutcomesHtml(a.extras?.marketArea?.outcomes, a.comps, a.subject.city)
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
  <section class="sc sc-navy pack" id="your-last-listing">
    <div class="in wide">
      <div class="kick r">Your last listing</div>
      <h2 class="h r">It asked ${usd(orig)} and did not sell.</h2>
      ${ruler ? `<div class="r chart-on-navy">${ruler}</div>` : ''}
      <div class="stat3 r">
        <div class="st"><div class="st-n">${int(b.pairs)}</div><div class="st-l">Central Oregon homes failed to sell, then sold later, 2023 to 2026</div></div>
        <div class="st"><div class="st-n">${(b.closeMedianRatio * 100).toFixed(1)}%</div><div class="st-l">of the failed ask is what the median one later sold for</div></div>
        <div class="st"><div class="st-n">${b.shareClosedAboveAskPct}%</div><div class="st-l">later sold for more than the ask that failed</div></div>
      </div>
      <div class="story-grid">${cards}</div>
    </div>
  </section>`
}

/** How fast homes like yours went (P4). Web twin of daysToOfferPage. */
function daysToOfferScene(a: OpinionSceneArgs): string {
  const html = renderDaysToOfferHtml({ subject: a.subject, comps: a.comps, market: a.market })
  if (!html) return ''
  return `
  <section class="sc sc-cream pack" id="how-fast">
    <div class="in wide">
      <div class="kick r">Time on market</div>
      <h2 class="h r">How fast homes like yours went</h2>
      <div class="r">${html}</div>
    </div>
  </section>`
}

/** This market. Web twin of thisMarketPage, same 90-day band gate (P3). */
function thisMarketScene(a: OpinionSceneArgs): string {
  const body = widerMarketBodyHtml(
    { subject: a.subject, comps: a.comps, market: a.market, extras: a.extras, pricing: a.pricing },
    'sub',
  )
  if (!body) return ''
  return `
  <section class="sc sc-navy" id="this-market">
    <div class="in">
      <div class="kick r">${esc(a.market?.geoLabel ?? a.subject.city)}</div>
      <h2 class="h r">This market</h2>
      <div class="r">${body}</div>
    </div>
  </section>`
}

/**
 * Chapters whose letter body is already the right thing to read on screen:
 * the facts table, the permit list, the net strip, the disclosure. They are
 * wrapped rather than rewritten so the two documents cannot drift a fact
 * apart (P10).
 */
function wrapLetterBody(id: string, kick: string, body: string, navy = false): string {
  if (!body.trim()) return ''
  // The letter body opens with its own <h2 class="section"> heading; the
  // immersive prints that heading in its own register instead.
  const heading = /<h2 class="section">([\s\S]*?)<\/h2>/.exec(body)?.[1] ?? ''
  const rest = body.replace(/<h2 class="section">[\s\S]*?<\/h2>/, '')
  return `
  <section class="sc ${navy ? 'sc-navy' : 'sc-cream'} pack" id="${id}">
    <div class="in wide">
      <div class="kick r">${esc(kick)}</div>
      <h2 class="h r">${heading}</h2>
      <div class="r letter-body">${rest}</div>
    </div>
  </section>`
}

function homeLocationScene(a: OpinionSceneArgs): string {
  return wrapLetterBody('home-location', 'The house', snapshotPage(a).body)
}

function permitsScene(a: OpinionSceneArgs): string {
  const page = permitsPage(a)
  return page ? wrapLetterBody('permits', 'Record', page.body) : ''
}

function sellerNetScene(a: OpinionSceneArgs): string {
  const page = sellerNetPage(a)
  return page ? wrapLetterBody('seller-net', 'What you keep', page.body) : ''
}

function disclosureScene(a: OpinionSceneArgs): string {
  if (!a.broker) return ''
  return `
  <section class="sc sc-cream pack" id="disclosure">
    <div class="in wide">
      <div class="kick r">Disclosure</div>
      <h2 class="h r">Disclosure</h2>
      <div class="r letter-body">${cmaDisclosureProseHtml(a)}</div>
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
        <h2 class="h r">${a.expiredAudit ? 'Sorry this listing did not sell.' : 'Call or text.'}</h2>
        <p class="lede r">${a.expiredAudit ? 'If you want a second look at the number, call or text.' : 'Call or text if you want to walk the sales.'}</p>
        <div class="cta r">
          ${tel ? `<a class="btn pri" href="tel:${esc(tel)}" data-rr-track="cma-call">Call ${esc(br.phone ?? '')}</a>` : ''}
          ${br.email ? `<a class="btn sec" href="mailto:${esc(br.email)}" data-rr-track="cma-email">Email ${esc(br.displayName.split(' ')[0])}</a>` : ''}
          <a class="btn ter" href="?print=1" data-rr-track="cma-print">Read the full report</a>
        </div>
        <div class="sig r">${esc(br.displayName)} · ${esc(br.title)}${br.licenseNumber ? ` · Licensed in Oregon, ${esc(br.licenseNumber)}` : ''}</div>
        <div class="fine r">Prepared ${formatDate(a.generatedAtIso, { month: 'long', day: 'numeric', year: 'numeric' })} for ${esc(a.clientName ?? a.client?.name ?? 'the owner')}. This is a pricing report. It is not an appraisal.</div>
      </div>
    </div>
  </section>`
}

export function assembleOpinionScenes(a: OpinionSceneArgs): string {
  // P10: the SAME order the letter walks (OPINION_CHAPTER_ORDER), built from
  // the same helpers under the same gates. A chapter that renders here and not
  // there is a defect the doc-punchlist test fails on.
  const build: Record<OpinionChapterId, () => string> = {
    'how-we-got-the-price': () => priceScene(a),
    'your-last-listing': () => expiredScene(a),
    'sold-and-unsold': () => outcomesScene(a),
    competition: () => competitionScene(a),
    'how-fast': () => daysToOfferScene(a),
    'this-market': () => thisMarketScene(a),
    'home-location': () => homeLocationScene(a),
    'the-land': () => lotLinesScene(a),
    'your-street': () => subdivisionScene(a),
    permits: () => permitsScene(a),
    'seller-net': () => sellerNetScene(a),
    disclosure: () => disclosureScene(a),
    'next-step': () => nextScene(a),
  }
  return OPINION_CHAPTER_ORDER.map((id) => build[id]())
    .filter((html) => html.trim().length > 0)
    .join('\n')
}
