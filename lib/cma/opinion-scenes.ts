/**
 * Immersive chapters for the price-opinion spine. Hero and the number
 * stay in immersive.ts. Same order as the print pages.
 */

import { renderBandRivalsSceneHtml } from '@/lib/cma/band-rivals'
import { daysOnMarketFrom } from '@/lib/cma/listing-history-line'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import { widerMarketBodyHtml } from '@/lib/cma/market-area-chapters'
import type { OpinionPageArgs } from '@/lib/cma/opinion-pages'
import {
  OPINION_CHAPTER_ORDER,
  PRICED_RIGHT_HEADING,
  cmaDisclosureProseHtml,
  pricedRightBodyHtml,
  sellerNetPage,
  whatHappenedGraphicHtml,
  whatHappenedHeading,
  type OpinionChapterId,
} from '@/lib/cma/opinion-pages'
import { escapeHtml, int } from '@/lib/cma/render-blocks'
import type { CmaBroker } from '@/lib/cma/types'
import { FAILED_ASK_BACKTEST } from '@/lib/cma/expired-audit'
import { formatDate } from '@/lib/format/date'

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
  <section class="sc sc-cream pack" id="what-its-worth">
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





/**
 * Chapter 1. What happened. Web twin of whatHappenedPage.
 *
 * CREAM, not navy. ONE register (blueprint § The register): the alternating
 * navy scenes were the "does not flow" Matt named — a reader scrolled through
 * four inversions in eight screens. Navy is the cover and the closing.
 *
 * The three backtest figures print as themselves — the count-up that used to
 * animate them shipped 184 / 5.1% / 0.7% into a screenshot of 3,394 / 94.2% /
 * 12.3% (F4). A §0 figure never passes through a false value.
 */
function whatHappenedScene(a: OpinionSceneArgs): string {
  const audit = a.expiredAudit
  if (!audit || audit.findings.length === 0) return ''
  const b = FAILED_ASK_BACKTEST
  return `
  <section class="sc sc-cream pack" id="what-happened">
    <div class="in wide">
      <div class="kick r">What happened</div>
      <h2 class="h r">${esc(whatHappenedHeading(a.subject))}</h2>
      <div class="r">${whatHappenedGraphicHtml(a)}</div>
      <div class="stat3 r">
        <div class="st"><div class="st-n">${int(b.pairs)}</div><div class="st-l">Central Oregon homes came off unsold and then sold, 2023 to 2026</div></div>
        <div class="st"><div class="st-n">${(b.closeMedianRatio * 100).toFixed(1)}%</div><div class="st-l">of the ask that failed is what the median one sold for</div></div>
        <div class="st"><div class="st-n">${b.shareClosedAboveAskPct}%</div><div class="st-l">sold for more than that ask</div></div>
      </div>
    </div>
  </section>`
}

/** Chapter 2. Priced right sells. Priced high sits. Web twin of pricedRightPage. */
function pricedRightScene(a: OpinionSceneArgs): string {
  const body = pricedRightBodyHtml(a)
  if (!body.trim()) return ''
  return `
  <section class="sc sc-cream pack" id="priced-right">
    <div class="in wide">
      <div class="kick r">Time on market</div>
      <h2 class="h r">${esc(PRICED_RIGHT_HEADING)}</h2>
      <div class="r">${body}</div>
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
  <section class="sc sc-cream" id="this-market">
    <div class="in">
      <div class="kick r">${esc(a.market?.geoLabel ?? a.subject.city)}</div>
      <h2 class="h r">This market</h2>
      <div class="r">${body}</div>
    </div>
  </section>`
}

/**
 * A chapter whose letter body is already the right thing to read on screen.
 * Wrapped rather than rewritten so the two documents cannot drift a fact
 * apart.
 */
function wrapLetterBody(id: string, kick: string, body: string): string {
  if (!body.trim()) return ''
  // The letter body opens with its own <h2 class="section"> heading; the
  // immersive prints that heading in its own register instead.
  const heading = /<h2 class="section">([\s\S]*?)<\/h2>/.exec(body)?.[1] ?? ''
  const rest = body.replace(/<h2 class="section">[\s\S]*?<\/h2>/, '')
  return `
  <section class="sc sc-cream pack" id="${id}">
    <div class="in wide">
      <div class="kick r">${esc(kick)}</div>
      <h2 class="h r">${heading}</h2>
      <div class="r letter-body">${rest}</div>
    </div>
  </section>`
}

function sellerNetScene(a: OpinionSceneArgs): string {
  const page = sellerNetPage(a)
  return page ? wrapLetterBody('net-at-list', 'What you keep', page.body) : ''
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
  <section class="sc sc-navy" id="next-step">
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
  // The SAME order the letter walks (OPINION_CHAPTER_ORDER), built from the
  // same helpers under the same gates. A chapter that renders here and not
  // there is a defect the doc-punchlist test fails on.
  const build: Record<OpinionChapterId, () => string> = {
    'what-happened': () => whatHappenedScene(a),
    'priced-right': () => pricedRightScene(a),
    'what-its-worth': () => priceScene(a),
    competition: () => competitionScene(a),
    'this-market': () => thisMarketScene(a),
    'net-at-list': () => sellerNetScene(a),
    disclosure: () => disclosureScene(a),
    'next-step': () => nextScene(a),
  }
  return OPINION_CHAPTER_ORDER.map((id) => build[id]())
    .filter((html) => html.trim().length > 0)
    .join('\n')
}
