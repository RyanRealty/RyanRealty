/**
 * Immersive chapters for the price-opinion spine. Hero and the number
 * stay in immersive.ts. Same order as the print pages.
 */

import { renderBandRivalsSceneHtml } from '@/lib/cma/band-rivals'
import { pricingPage, whatItsWorthHeading } from '@/lib/cma/render-pricing-page'
import type { OpinionPageArgs } from '@/lib/cma/opinion-pages'
import {
  BASIS_AND_LIMITS_HEADING,
  OPINION_CHAPTER_ORDER,
  PRICED_RIGHT_HEADING,
  competitionArgs,
  didNotSellArgs,
  nextStepButtonsHtml,
  nextStepHeading,
  thisMarketBodyHtml,
  thisMarketHeading,
  cmaDisclosureProseHtml,
  pricedRightBodyHtml,
  sellerNetPage,
  whatHappenedGraphicHtml,
  whatHappenedHeading,
  type OpinionChapterId,
} from '@/lib/cma/opinion-pages'
import { DID_NOT_SELL_HEADING, didNotSellBodyHtml } from '@/lib/cma/did-not-sell'
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
    tiersUsed: a.tiersUsed,
    mapDataUri: a.mapDataUri,
    docLinks: a.docLinks,
    // The immersive prints the number as the chapter title, so the letter's
    // own heading block is suppressed and the lead line reprinted below it.
    omitLeadPrices: true,
  })
  return `
  <section class="sc sc-cream pack" id="what-its-worth">
    <div class="in wide">
      <div class="kick r">The number</div>
      <h2 class="h r">${esc(whatItsWorthHeading(a.pricing))}</h2>
      <div class="r">${page.body}</div>
    </div>
  </section>`
}

function competitionScene(a: OpinionSceneArgs): string {
  if (!a.extras?.band) return ''
  return renderBandRivalsSceneHtml(competitionArgs(a))
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

/** Chapter 2. The listings near you that did not sell. Web twin of didNotSellPage. */
function didNotSellScene(a: OpinionSceneArgs): string {
  const body = didNotSellBodyHtml(didNotSellArgs(a))
  if (!body.trim()) return ''
  return `
  <section class="sc sc-cream pack" id="did-not-sell">
    <div class="in wide">
      <div class="kick r">Near you</div>
      <h2 class="h r">${esc(DID_NOT_SELL_HEADING)}</h2>
      <div class="r">${body}</div>
    </div>
  </section>`
}

/** Chapter 2b. What overpricing costs. Web twin of pricedRightPage. */
function pricedRightScene(a: OpinionSceneArgs): string {
  const body = pricedRightBodyHtml(a)
  if (!body.trim()) return ''
  return `
  <section class="sc sc-cream pack" id="priced-right">
    <div class="in wide">
      <div class="kick r">What it costs</div>
      <h2 class="h r">${esc(PRICED_RIGHT_HEADING)}</h2>
      <div class="r">${body}</div>
    </div>
  </section>`
}

/** Chapter 5. Web twin of thisMarketPage. */
function thisMarketScene(a: OpinionSceneArgs): string {
  const body = thisMarketBodyHtml(a, 'sub')
  if (!body.trim()) return ''
  return `
  <section class="sc sc-cream pack" id="this-market">
    <div class="in wide">
      <div class="kick r">The market</div>
      <h2 class="h r">${esc(thisMarketHeading(a))}</h2>
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
  const heading = /<h2 class="section[^"]*">([\s\S]*?)<\/h2>/.exec(body)?.[1] ?? ''
  const rest = body.replace(/<h2 class="section[^"]*">[\s\S]*?<\/h2>/, '')
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
      <div class="kick r">Where this came from</div>
      <h2 class="h r">${esc(BASIS_AND_LIMITS_HEADING)}</h2>
      <div class="r letter-body">${cmaDisclosureProseHtml(a)}</div>
    </div>
  </section>`
}

/** Chapter 7. The closing, and the only navy scene. Web twin of nextStepPage. */
function nextScene(a: OpinionSceneArgs): string {
  const br = a.broker
  const site = 'https://ryan-realty.com'
  const photo = br.photoUrl
    ? `<img class="br-img" src="${esc(br.photoUrl.startsWith('http') ? br.photoUrl : `${site}${br.photoUrl}`)}" alt="${esc(br.displayName)}"/>`
    : ''
  return `
  <section class="sc sc-navy" id="next-step">
    <div class="in next-in">
      ${photo}
      <div class="next-b">
        <div class="kick r">Your next step</div>
        <h2 class="h r">${esc(nextStepHeading(a))}</h2>
        <div class="cta r">${nextStepButtonsHtml(a)}</div>
        <div class="sig r">${esc(br.displayName)} · ${esc(br.title)}${br.licenseNumber ? ` · Oregon Real Estate License # ${esc(br.licenseNumber)}` : ''}</div>
        <div class="fine r">${esc(
          `Prepared ${formatDate(a.generatedAtIso, { month: 'long', day: 'numeric', year: 'numeric' })} for ${
            a.clientName ?? a.client?.name ?? 'the owner'
          }. This is a pricing report. It is not an appraisal.`,
        )}</div>
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
    'did-not-sell': () => didNotSellScene(a),
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
