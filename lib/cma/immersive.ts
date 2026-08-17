/**
 * Immersive CMA — the full-screen scrollytelling web experience (Matt
 * 2026-08-05: "this must be immersive").
 *
 * ONE DATA SOURCE, TWO PRESENTATIONS. This renderer consumes the SAME
 * persisted render_args the print artifact was built from, so every figure on
 * screen is byte-identical to the print/PDF document (§0). The print artifact
 * stays canonical for PDF and for `?print=1`; this view is how the document
 * FEELS in a browser: full-viewport scenes, the answer first, the failed-ask
 * story, animated evidence.
 *
 * Self-contained: inline CSS + inline JS (site CSP allows both), photos from
 * the MLS CDN, Amboqia from /fonts on the serving origin. Every motion
 * respects prefers-reduced-motion, content is never hidden without JS, and
 * secondary counts may animate. The recommended list never tweens.
 */

import type { RenderCmaArgs } from '@/lib/cma/render'
import type { CmaBroker } from '@/lib/cma/types'
import { displayConfidence, pricingRangeDisplay } from '@/lib/cma/pricing'
import { FAILED_ASK_BACKTEST } from '@/lib/cma/expired-audit'
import { inboundImmersiveHeroKick, inboundImmersiveTitle, resolveThisHomePlan } from '@/lib/cma/inbound-packet'
import { seasonalityChartSvg } from '@/lib/cma/seasonality-chart'
import { formatDate } from '@/lib/format/date'
import { cleanText } from '@/lib/cma/render-blocks'
import { clientFacingListingPlan, clientSourceLine, formatClientMlsField, whyThisListPrice } from '@/lib/cma/client-facing'
import { compsPriceChartSvg } from '@/lib/cma/comps-price-chart'
import { renderCompStripHtml } from '@/lib/cma/comp-strip'
import { immersiveStylesheet } from '@/lib/cma/immersive-css'
import { immersiveMarketChapters } from '@/lib/cma/market-area-chapters'

type ImmersiveArgs = RenderCmaArgs & { broker: CmaBroker }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `$${Math.round(n).toLocaleString('en-US')}`
}
function int(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}
function dec(n: number | null | undefined, places = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(places)
}
function dateLong(iso: string | null | undefined): string {
  return formatDate(iso, { month: 'long', day: 'numeric', year: 'numeric' })
}

/** The same warm-read facts the print page shows (subject attributes only). */
function likeItems(a: ImmersiveArgs): Array<{ headline: string; detail: string | null }> {
  const s = a.subject
  const items: Array<{ headline: string; detail: string | null }> = []
  const view = formatClientMlsField(s.viewDescription)
  if (view) items.push({ headline: `The view: ${view.replace(/\s*,\s*/g, ', ')}`, detail: 'From the MLS record for this parcel.' })
  if (s.lotAcres != null && s.lotAcres >= 0.5) items.push({ headline: `${dec(s.lotAcres, 2)} acres of ground`, detail: 'Lot size from the county record.' })
  if (s.garageSpaces != null && s.garageSpaces >= 3) items.push({ headline: `${s.garageSpaces}-car garage`, detail: null })
  if (s.yearBuilt != null && s.yearBuilt >= 2018) items.push({ headline: `Built in ${s.yearBuilt}`, detail: null })
  if (s.sqft != null && s.sqft >= 3000) items.push({ headline: `${int(s.sqft)} square feet of living space`, detail: null })
  if (s.beds != null && s.beds >= 4) items.push({ headline: `${s.beds} bedrooms`, detail: null })
  return items.slice(0, 6)
}

const LENS_LABELS: Record<string, string> = {
  pricing: 'Price against the comparable sales',
  'time-on-market': 'Time on market',
  'price-cuts': 'The price path',
  attempts: 'Listing attempts',
  presentation: 'Presentation',
}

function seasonalityScene(a: ImmersiveArgs): string {
  const x = a.extras?.seasonality
  if (!x) return ''
  const svg = seasonalityChartSvg(x)
  if (!svg) return ''
  const byName = new Map(x.byMonth.map((m) => [m.monthName, m]))
  const line = (names: string[]) =>
    names
      .map((n) => byName.get(n))
      .filter(Boolean)
      .map((m) => `${m!.monthName} (${Math.round(m!.medianDaysToPending!)} days)`)
      .join(' and ')
  const fastLine = line(x.fastestMonths)
  const slowLine = line(x.slowestMonths)
  return `
  <section class="sc sc-cream" id="when-to-list">
    <div class="in">
      <div class="kick r">Timing</div>
      <h2 class="h r">When ${esc(a.subject.city)} homes go pending</h2>
      <p class="lede r">Each bar is the median days to pending for the ${int(x.totalClosed)} single-family sales that closed in ${esc(a.subject.city)} over the last ${dec(x.yearsCovered, 1)} years, grouped by the month they closed.</p>
      <div class="szn r">${svg}</div>
      <p class="body r">Fastest: ${esc(fastLine)}. Slowest: ${esc(slowLine)}. A month with fewer than 12 measured sales shows no bar.</p>
      
    </div>
  </section>`
}

function storyScene(a: ImmersiveArgs): string {
  const audit = a.expiredAudit
  if (!audit) return ''
  const s = a.subject
  const orig = s.lastListPrice != null && s.lastListPrice > 0 ? s.lastListPrice : null
  const findings = audit.findings.slice(0, 3)
  const cards = findings
    .map(
      (f) => `<div class="story-card r">
        <div class="story-lens">${esc(LENS_LABELS[f.lens] ?? f.lens)}</div>
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
      ${
        orig
          ? `<div class="tl r" aria-label="Last listing timeline">
        <div class="tl-item"><div class="tl-lbl">Listed</div><div class="tl-val">${dateLong(s.lastListDate)}</div></div>
        <div class="tl-arrow" aria-hidden="true"></div>
        <div class="tl-item"><div class="tl-lbl">Asked</div><div class="tl-val">${usd(orig)}</div></div>
        <div class="tl-arrow" aria-hidden="true"></div>
        <div class="tl-item"><div class="tl-lbl">Off market</div><div class="tl-val">${esc(s.standardStatus ?? 'Ended')}</div></div>
      </div>`
          : ''
      }
      <div class="stat3 r">
        <div class="st"><div class="st-n" data-count>${int(b.pairs)}</div><div class="st-l">Central Oregon homes failed to sell, then sold later, 2023 to 2026</div></div>
        <div class="st"><div class="st-n" data-count>${(b.closeMedianRatio * 100).toFixed(1)}%</div><div class="st-l">of the failed ask is what the median one later sold for</div></div>
        <div class="st"><div class="st-n" data-count>${b.shareClosedAboveAskPct}%</div><div class="st-l">later sold for more than the ask that failed</div></div>
      </div>
      <div class="story-grid">${cards}</div>
    </div>
  </section>`
}

function thisHomeScene(a: ImmersiveArgs): string {
  const lines = resolveThisHomePlan({ thisHomePlan: a.thisHomePlan, streetAddress: a.subject.streetAddress })
  if (lines.length === 0) return ''
  const address = a.subject.streetAddress.trim()
  const title = address ? `How we would market ${address}` : 'How we would market this home'
  const hero = lines.slice(0, 3)
  const secondary = lines.slice(3)
  const cards = hero
    .map((s) => `<div class="plan r"><div class="plan-a">${esc(s)}</div></div>`)
    .join('')
  const rest = secondary.length
    ? `<p class="body r">${secondary.map((s) => esc(s)).join(' ')}</p>`
    : ''
  return `
  <section class="sc sc-cream" id="how-we-would-market">
    <div class="in wide">
      <div class="kick r">This home</div>
      <h2 class="h r">${esc(title)}</h2>
      <p class="lede r">The plan below is for ${esc(address || 'this home')}, not a generic listing package.</p>
      <div class="plan-grid">${cards}</div>
      ${rest}
    </div>
  </section>`
}

function planScene(a: ImmersiveArgs): string {
  const p = clientFacingListingPlan(a.listingPlan)
  if (!p) return ''
  const cards = p.items
    .map(
      (i) => `<div class="plan r">
      <div class="plan-t">${esc(i.trigger)}</div>
      <div class="plan-a">${esc(i.action)}</div>
      ${i.basis ? `<div class="plan-b">${esc(i.basis)}</div>` : ''}
    </div>`,
    )
    .join('')
  return `
  <section class="sc sc-navy" id="what-we-would-do">
    <div class="in wide">
      <div class="kick r">The plan</div>
      <h2 class="h r">${int(p.items.length)} things we would do about it</h2>
      <p class="lede r">Each one is triggered by a figure measured on your home.</p>
      <div class="plan-grid">${cards}</div>

    </div>
  </section>`
}


function sourcesScene(a: ImmersiveArgs): string {
  const rows: Array<[string, string | null | undefined]> = [
    ['Comparable sales', `Closed MLS sales near ${a.subject.streetAddress}, each adjusted for when it sold and living area`],
    ['Market conditions', a.market ? `Oregon Data Share MLS market statistics for ${a.market.geoLabel}` : null],
    [
      `${a.subdivisionStory?.facts.name ?? 'Subdivision'} sales`,
      a.subdivisionStory
        ? clientSourceLine(a.subdivisionStory.facts.source, `Closed single-family sales in ${a.subdivisionStory.facts.name}.`)
        : null,
    ],
    [
      'When homes go pending',
      a.extras?.seasonality
        ? clientSourceLine(a.extras.seasonality.source, `Closed single-family sales in ${a.subject.city}, grouped by close month.`)
        : null,
    ],
    [
      'Homes for sale in your band',
      a.extras?.band
        ? clientSourceLine(a.extras.band.source, `Active and pending listings in ${a.subject.city} in this price band.`)
        : null,
    ],
    [
      'Recent subdivision sales',
      a.extras?.subdivisionPulse
        ? clientSourceLine(a.extras.subdivisionPulse.source, `Closed sales in ${a.extras.subdivisionPulse.name}.`)
        : null,
    ],
    [
      'How buyers paid',
      a.extras?.financing
        ? clientSourceLine(a.extras.financing.source, `${a.subject.city} sales in the last 12 months that reported financing.`)
        : null,
    ],
    [
      'Photo counts',
      a.extras?.photoBench
        ? clientSourceLine(a.extras.photoBench.source, 'Photo counts on the subject listing and the sold comps in this report.')
        : null,
    ],
    ['Land use and rental rules', a.development || a.rental ? 'County and city code as published, read for this parcel' : null],
  ]
  const items = rows
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `<div class="srcrow"><div class="srck">${esc(k)}</div><div class="srcv">${esc(String(v))}</div></div>`)
    .join('')
  if (!items) return ''
  return `
  <section class="sc sc-cream tight" id="sources">
    <div class="in">
      <div class="kick r">Sources</div>
      <h2 class="h r">Where these numbers come from</h2>
      <div class="srcgrid r">${items}</div>
    </div>
  </section>`
}

function whyScene(a: ImmersiveArgs): string {
  const why = whyThisListPrice(a)
  const bullets = why.bullets
    .map((b) => `<div class="like r"><div class="like-h">${esc(b.label)}</div><div class="like-d">${esc(b.text)}</div></div>`)
    .join('')
  const chart = compsPriceChartSvg({ comps: a.comps, recommended: a.pricing.recommended })
  return `
  <section class="sc sc-cream" id="why-this-price">
    <div class="in">
      <div class="kick r">The number</div>
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

function subdivisionStoryScene(a: ImmersiveArgs): string {
  const st = a.subdivisionStory
  if (!st) return ''
  const f = st.facts
  const maxMed = Math.max(...f.years.map((y) => y.medianClose))
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
    f.saleToListRecentPct != null ? `Sellers here have collected a median of ${dec(f.saleToListRecentPct, 1)}% of their final asking price over the last two years.` : null,
  ]
    .filter(Boolean)
    .join(' ')
  const lede =
    f.medianDomRecent != null
      ? `Sales here over the last two years carried a median of ${int(f.medianDomRecent)} days on market.`
      : `Every closed sale on record in ${esc(f.name)}, by the year it closed.`
  return `
  <section class="sc sc-cream" id="your-street">
    <div class="in wide">
      <div class="kick r">The story of ${esc(f.name)}</div>
      <h2 class="h r">${int(f.totalSales)} homes have sold in ${esc(f.name)}</h2>
      <p class="lede r">${lede}</p>
      <div class="yr r" role="img" aria-label="Median close price by year in ${esc(f.name)}">${yearBars}</div>
      ${sections ? `<div class="sty-grid">${sections}</div>` : ''}
      ${notable ? `<h3 class="sub r">The most recent sales</h3><div class="nb-grid">${notable}</div>` : ''}
      ${position ? `<p class="body r pos">${position}</p>` : ''}

    </div>
  </section>`
}

function compsScene(a: ImmersiveArgs): string {
  return `
  <section class="sc sc-cream" id="evidence">
    <div class="in wide">
      <div class="kick r">The evidence</div>
      <h2 class="h r">${a.comps.length} closed sales set this price</h2>
      <p class="lede r">Each kept sale is adjusted to your home.</p>
      <div class="r">${renderCompStripHtml(a.comps)}</div>
    </div>
  </section>`
}

function marketScene(a: ImmersiveArgs): string {
  const m = a.market
  if (!m) return ''
  const verdict =
    m.marketVerdict === 'seller' ? "a seller's market" : m.marketVerdict === 'buyer' ? "a buyer's market" : m.marketVerdict === 'balanced' ? 'a balanced market' : null
  return `
  <section class="sc sc-cream tight" id="market">
    <div class="in">
      <div class="kick r">The wider market</div>
      <h2 class="h r">${verdict ? `${esc(m.geoLabel)} is ${esc(verdict)}` : `${esc(m.geoLabel)} right now`}</h2>
      <div class="stat4 r">
        <div class="st"><div class="st-n">${m.monthsOfSupply != null ? dec(m.monthsOfSupply, 1) : '—'}</div><div class="st-l">months of supply</div></div>
        <div class="st"><div class="st-n">${usd(m.medianSalePrice)}</div><div class="st-l">median sale price, last 12 months</div></div>
        <div class="st"><div class="st-n">${m.medianDom != null ? `${int(m.medianDom)}` : '—'}</div><div class="st-l">median days on market for a closed sale</div></div>
        <div class="st"><div class="st-n">${m.saleToListRatio != null ? `${dec(m.saleToListRatio * 100, 1)}%` : '—'}</div><div class="st-l">of the asking price is what sellers collected</div></div>
      </div>

    </div>
  </section>`
}

function competitionScene(a: ImmersiveArgs): string {
  const b = a.extras?.band
  const sub = a.extras?.subdivisionPulse
  const fin = a.extras?.financing
  const bench = a.extras?.photoBench
  if (!b && !sub && !fin && !bench) return ''
  const finBars = fin
    ? `<div class="fin r">
        <div class="fin-row"><div class="fin-l">Cash</div><div class="fin-track"><div class="fin-bar" style="--w:${fin.cashPct}%"></div></div><div class="fin-v">${dec(fin.cashPct, 1)}%</div></div>
        <div class="fin-row"><div class="fin-l">Conventional</div><div class="fin-track"><div class="fin-bar" style="--w:${fin.conventionalPct}%"></div></div><div class="fin-v">${dec(fin.conventionalPct, 1)}%</div></div>
        <div class="fin-row"><div class="fin-l">FHA / VA</div><div class="fin-track"><div class="fin-bar" style="--w:${fin.fhaVaPct}%"></div></div><div class="fin-v">${dec(fin.fhaVaPct, 1)}%</div></div>
      </div>
      <p class="body r">${int(fin.sampleCount)} ${esc(a.subject.city)} sales in the last 12 months reported how the buyer paid.</p>`
    : ''
  const benchBlock = bench
    ? `<div class="bench r">
        <div class="bench-row"><div class="bench-l">Sold comps, median photos</div><div class="bench-track"><div class="bench-bar" style="--w:${Math.min(100, (bench.compMedianPhotos / Math.max(bench.compMedianPhotos, bench.subjectPhotos)) * 100)}%"></div></div><div class="bench-v">${dec(bench.compMedianPhotos, bench.compMedianPhotos % 1 === 0 ? 0 : 1)}</div></div>
        <div class="bench-row"><div class="bench-l">Your last listing</div><div class="bench-track"><div class="bench-bar warm" style="--w:${Math.min(100, (bench.subjectPhotos / Math.max(bench.compMedianPhotos, bench.subjectPhotos)) * 100)}%"></div></div><div class="bench-v">${int(bench.subjectPhotos)}</div></div>
      </div>
      `
    : ''
  const headline = b
    ? `${int(b.activeCount)} home${b.activeCount === 1 ? ' is' : 's are'} for sale in ${esc(a.subject.city)} between ${usd(b.lo)} and ${usd(b.hi)}`
    : sub
      ? `${int(sub.closedCount)} home${sub.closedCount === 1 ? ' has' : 's have'} sold in ${esc(sub.name)} in the last ${int(sub.months)} months`
      : fin
        ? `${dec(fin.cashPct, 1)}% of the last ${int(fin.sampleCount)} ${esc(a.subject.city)} sales closed in cash`
        : `The comps that sold carried a median of ${int(bench!.compMedianPhotos)} photos`
  return `
  <section class="sc sc-navy" id="competition">
    <div class="in">
      <div class="kick r">Your competition</div>
      <h2 class="h r">${headline}</h2>
      ${
        b
          ? `<div class="stat3 r">
        <div class="st"><div class="st-n" data-count>${int(b.activeCount)}</div><div class="st-l">for sale in that band${b.activeMedianDom != null ? `, listed a median of ${int(b.activeMedianDom)} days` : ''}</div></div>
        <div class="st"><div class="st-n" data-count>${int(b.pendingCount)}</div><div class="st-l">under contract in the same band</div></div>
        ${sub ? `<div class="st"><div class="st-n" data-count>${int(sub.closedCount)}</div><div class="st-l">${esc(sub.name)} sales in the last ${int(sub.months)} months, ${usd(sub.low)} to ${usd(sub.high)}, median ${usd(sub.medianClose != null ? Math.round(sub.medianClose) : null)}</div></div>` : ''}
      </div>`
          : ''
      }
      ${fin ? `<h3 class="sub r">How ${esc(a.subject.city)} buyers paid</h3>${finBars}` : ''}
      ${bench ? `<h3 class="sub r">Photos, yours against the comps</h3>${benchBlock}` : ''}
    </div>
  </section>`
}

function likesScene(a: ImmersiveArgs): string {
  const items = likeItems(a)
  if (items.length < 2) return ''
  const cards = items
    .map((i) => `<div class="like r"><div class="like-h">${esc(i.headline)}</div>${i.detail ? `<div class="like-d">${esc(i.detail)}</div>` : ''}</div>`)
    .join('')
  return `
  <section class="sc sc-cream tight" id="what-we-like">
    <div class="in">
      <div class="kick r">On the record</div>
      <h2 class="h r">What this home has</h2>
      <div class="like-grid">${cards}</div>
    </div>
  </section>`
}

function canDoScene(a: ImmersiveArgs): string {
  const dev = a.development
  const rental = a.rental
  const devItems = (dev?.items ?? []).slice(0, 3)
  const tenures = rental?.tenures ?? []
  if (devItems.length === 0 && tenures.length === 0) return ''
  const devRows = devItems
    .map((d) => `<div class="cando r"><div class="cando-t">${esc((d as { topic?: string }).topic ?? '')}</div><div class="cando-h">${esc((d as { headline?: string }).headline ?? '')}</div></div>`)
    .join('')
  const rentRows = tenures
    .map((t) => `<div class="cando r"><div class="cando-t">${esc((t as { tenure?: string }).tenure ?? '')} rental</div><div class="cando-h">${esc((t as { headline?: string }).headline ?? '')}</div></div>`)
    .join('')
  return `
  <section class="sc sc-cream tight" id="can-do">
    <div class="in">
      <div class="kick r">What you can do with it</div>
      <h2 class="h r">${dev ? `Zoned ${esc(dev.zone)} in ${esc(dev.jurisdiction)}` : 'What the rules allow on this parcel'}</h2>
      <div class="cando-grid">${devRows}${rentRows}</div>
    </div>
  </section>`
}

function nextScene(a: ImmersiveArgs): string {
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
        <div class="fine r">Prepared ${dateLong(a.generatedAtIso)} for ${esc(a.client.name ?? 'the owner')}. This is a comparative market analysis. It is not an appraisal. The comparable adjustments, the methods behind the range, and the required disclosures are in the full report.</div>
      </div>
    </div>
  </section>`
}

export function renderImmersiveCmaHtml(a: ImmersiveArgs, siteUrl: string): string {
  const s = a.subject
  const p = a.pricing
  const heroImg = s.photoUrl ? `<img class="hero-img" src="${esc(s.photoUrl)}" alt="" aria-hidden="true"/>` : ''
  const specs = [
    s.beds != null ? `${s.beds} bed` : null,
    s.baths != null ? `${s.baths} bath` : null,
    s.sqft != null ? `${int(s.sqft)} sqft` : null,
    s.yearBuilt != null ? `built ${s.yearBuilt}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const evLo = p.valueLow
  const evHi = p.valueHigh
  const span = Math.max(1, evHi - evLo)
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - evLo) / span) * 100))
  const conf = displayConfidence(p)
  const range = pricingRangeDisplay(p)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${esc(inboundImmersiveTitle(s.streetAddress))}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
@font-face{font-family:'Amboqia Boriango';src:url('${siteUrl}/fonts/Amboqia_Boriango.otf') format('opentype');font-display:swap}
${immersiveStylesheet()}
</style>
</head>
<body>
<div id="bar"><div class="bt">${esc(s.streetAddress)} · ${esc(s.city)}, OR</div><a href="?print=1">Print report</a><div id="prog"></div></div>

<section class="sc hero" id="top">
  ${heroImg}
  <div class="hero-scrim" aria-hidden="true"></div>
  <div class="in">
    <div class="hero-kick">${esc(inboundImmersiveHeroKick(s.streetAddress, a.generatedAtIso))}</div>
    <h1 class="hero-h">${esc(s.streetAddress)}</h1>
    <div class="hero-sub">${esc(s.city)}, ${esc(s.state)} ${esc(s.postalCode ?? '')}${cleanText(s.subdivision) ? ` · ${esc(cleanText(s.subdivision)!)}` : ''}${specs ? ` · ${esc(specs)}` : ''}</div>
    <div class="hero-for">Prepared for ${esc(a.client.name ?? 'the owner')} by ${esc(a.broker.displayName)}, Ryan Realty</div>
  </div>
  <div class="cue" aria-hidden="true"></div>
</section>

<section class="sc sc-cream" id="answer">
  <div class="in">
    <div class="ans-l r">Recommended list price</div>
    <div class="ans-n r">${usd(p.recommended)}</div>
    <div class="r"><span class="conf">Confidence: ${esc(conf)}</span></div>
    <div class="range r">
      <div class="range-track"><div class="range-fill" style="--w:100%"></div></div>
      <div class="range-marks">
        <div class="rm"><div class="rm-v">${usd(p.conservative)}</div><div class="rm-l">Conservative</div></div>
        <div class="rm mid"><div class="rm-v">${usd(p.recommended)}</div><div class="rm-l">Recommended</div></div>
        <div class="rm" style="text-align:right"><div class="rm-v">${usd(p.highEnd)}</div><div class="rm-l">Ceiling, condition resolved</div></div>
      </div>
    </div>
    <p class="body r">${esc(whyThisListPrice(a).coverSentence)} ${range.outOfRange ? 'The comp-supported range is' : 'The adjusted comparable sales bracket'} ${usd(evLo)} to ${usd(evHi)}${p.convergenceSpreadPct != null ? `, and the pricing methods behind this number land within ${dec(p.convergenceSpreadPct, 1)}% of each other` : ''}.${range.note ? ` ${esc(range.note)}` : ''}</p>
  </div>
</section>

${whyScene(a)}
${immersiveMarketChapters(a)}
${thisHomeScene(a)}
${compsScene(a)}
${subdivisionStoryScene(a)}
${storyScene(a)}
${competitionScene(a)}
${seasonalityScene(a)}
${marketScene(a)}
${likesScene(a)}
${canDoScene(a)}
${planScene(a)}
${nextScene(a)}
${sourcesScene(a)}

<script>
(function(){
  try{
    var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches
    var bar=document.getElementById('bar'),prog=document.getElementById('prog')
    function onScroll(){
      var max=document.documentElement.scrollHeight-window.innerHeight
      var y=window.scrollY||0
      var show=y>window.innerHeight*0.7
      bar.classList.toggle('on',show)
      document.documentElement.classList.toggle('bar-on',show)
      prog.style.width=(max>0?Math.min(100,y/max*100):0)+'%'
    }
    window.addEventListener('scroll',onScroll,{passive:true});onScroll()
    if(reduced||!('IntersectionObserver'in window))return
    document.documentElement.classList.add('anim')
    var scenes=[].slice.call(document.querySelectorAll('.sc'))
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}})},{rootMargin:'0px 0px -12% 0px'})
    scenes.forEach(function(s){io.observe(s)})
    setTimeout(function(){scenes.forEach(function(s){s.classList.add('on')})},4500)
    var live=[]
    function snap(){live.forEach(function(a){a.done=true;a.el.textContent=a.f});live=[]}
    window.addEventListener('beforeprint',snap)
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')snap()})
    var cio=new IntersectionObserver(function(es){es.forEach(function(e){
      if(!e.isIntersecting)return;cio.unobserve(e.target)
      var el=e.target,f=el.textContent
      if(el.classList&&el.classList.contains('ans-n'))return
      var m=/^([^0-9]*)([\\d,]+(?:\\.\\d+)?)(.*)$/.exec(f.trim());if(!m)return
      var t=parseFloat(m[2].replace(/,/g,''));if(!isFinite(t)||t===0)return
      var dcs=(m[2].split('.')[1]||'').length,a={el:el,f:f,done:false};live.push(a)
      var t0=null
      function fr(ts){if(a.done)return;if(t0==null)t0=ts
        var pp=Math.min(1,(ts-t0)/900),ea=1-Math.pow(1-pp,3),v=t*ea
        el.textContent=m[1]+(dcs>0?v.toFixed(dcs):Math.round(v).toLocaleString('en-US'))+m[3]
        if(pp<1)requestAnimationFrame(fr);else{a.done=true;el.textContent=a.f;live=live.filter(function(x){return x!==a})}}
      requestAnimationFrame(fr)
    })},{rootMargin:'0px 0px -10% 0px'})
    ;[].slice.call(document.querySelectorAll('[data-count]')).forEach(function(el){cio.observe(el)})
  }catch(e){}
})()
</script>
</body>
</html>`
}
