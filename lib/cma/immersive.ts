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
 * count-ups always end at the exact markup number (snapped on print/hide).
 */

import type { RenderCmaArgs } from '@/lib/cma/render'
import type { CmaBroker } from '@/lib/cma/types'
import { FAILED_ASK_BACKTEST } from '@/lib/cma/expired-audit'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ListingPlan } from '@/lib/cma/listing-plan'
import { formatDate } from '@/lib/format/date'

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
  const view = (s.viewDescription ?? '').trim()
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
  const vals = x.byMonth.map((m) => m.medianDaysToPending).filter((v): v is number => v != null)
  if (vals.length === 0) return ''
  const max = Math.max(...vals)
  const fastest = new Set(x.fastestMonths)
  const bars = x.byMonth
    .map((m) => {
      const has = m.medianDaysToPending != null
      const pct = has ? Math.max(6, (m.medianDaysToPending! / max) * 100) : 0
      const hot = fastest.has(m.monthName)
      return `<div class="szn-col">
        <div class="szn-v">${has ? Math.round(m.medianDaysToPending!) : ''}</div>
        <div class="szn-bar-wrap">${has ? `<div class="szn-bar${hot ? ' hot' : ''}" style="--h:${pct.toFixed(1)}%"></div>` : '<div class="szn-na">n/a</div>'}</div>
        <div class="szn-m">${m.monthName.slice(0, 3)}</div>
      </div>`
    })
    .join('')
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
      <div class="szn r" role="img" aria-label="Median days to pending by close month">${bars}</div>
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




function planScene(a: ImmersiveArgs): string {
  const p = a.listingPlan
  if (!p) return ''
  const cards = p.items
    .map(
      (i) => `<div class="plan r">
      <div class="plan-t">${esc(i.trigger)}</div>
      <div class="plan-a">${esc(i.action)}</div>
      <div class="plan-b">${esc(i.basis)}</div>
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
    ['Comparable sales', `Supabase listings, closed sales near ${a.subject.streetAddress}, adjusted for close date and living area`],
    ['Market conditions', a.market ? `market_stats_cache ${a.market.geoSlug}, ${a.market.periodStart} to ${a.market.periodEnd}, live inventory ${a.market.pulseUpdatedAt ?? a.market.computedAt ?? ''}` : null],
    [`${a.subdivisionStory?.facts.name ?? 'Subdivision'} sales`, a.subdivisionStory?.facts.source],
    ['When homes go pending', a.extras?.seasonality?.source],
    ['Homes for sale in your band', a.extras?.band?.source],
    ['Recent subdivision sales', a.extras?.subdivisionPulse?.source],
    ['How buyers paid', a.extras?.financing?.source],
    ['Photo counts', a.extras?.photoBench?.source],
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
      ${a.subdivisionStory?.model ? `<p class="body r">The ${esc(a.subdivisionStory.facts.name)} narrative was written by ${esc(a.subdivisionStory.model)} from those sales, their listing remarks, and the photos of the ${int(a.subdivisionStory.photoSalesReviewed)} most recent sales. Every number in it also appears in that section's chart.</p>` : ''}
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
  const cards = a.comps
    .map((c, i) => {
      const ppsf = c.sqft > 0 ? Math.round(c.closePrice / c.sqft) : null
      const img = c.photoUrl
        ? `<img class="cmp-img" src="${esc(c.photoUrl)}" alt="${esc(c.address)}" loading="lazy" referrerpolicy="no-referrer"/>`
        : `<div class="cmp-img ph" aria-hidden="true">${i + 1}</div>`
      return `<article class="cmp r">
        ${img}
        <div class="cmp-b">
          <div class="cmp-a">${esc(c.address)}</div>
          <div class="cmp-p">${usd(c.closePrice)}</div>
          <div class="cmp-m">Closed ${dateLong(c.closeDate)}${c.proximity ? ` · ${esc(c.proximity)}` : ''}</div>
          <div class="cmp-m">${int(c.sqft)} sqft${ppsf ? ` · $${ppsf}/sqft` : ''}${c.yearBuilt ? ` · built ${c.yearBuilt}` : ''}</div>
          <div class="cmp-adj">Adjusted to your home: <strong>${usd(c.adjustedPrice)}</strong></div>
        </div>
      </article>`
    })
    .join('')
  return `
  <section class="sc sc-cream" id="evidence">
    <div class="in wide">
      <div class="kick r">The evidence</div>
      <h2 class="h r">${a.comps.length} closed sales set this price</h2>
      <p class="lede r">Each one is adjusted for how long ago it closed and how its size compares to yours.</p>
      <div class="cmp-grid">${cards}</div>

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
        <div class="fine r">Prepared ${dateLong(a.generatedAtIso)} for ${esc(a.client.name ?? 'the owner')}. This is a broker price opinion. It is not an appraisal. The comparable adjustments, the methods behind the range, and the required disclosures are in the full report.</div>
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${esc(s.streetAddress)} · What your home is worth · Ryan Realty</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
@font-face{font-family:'Amboqia Boriango';src:url('${siteUrl}/fonts/Amboqia_Boriango.otf') format('opentype');font-display:swap}
:root{--navy:#102742;--cream:#faf8f4;--ink:rgba(16,39,66,1);--ink70:rgba(16,39,66,.7);--ink12:rgba(16,39,66,.12)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:Geist,system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased}
img{max-width:100%}
.sc{min-height:100svh;display:flex;align-items:center;padding:96px 24px;position:relative}
.sc.tight{min-height:72svh}
.sc-cream{background:var(--cream)}
.sc-navy{background:var(--navy);color:var(--cream)}
.in{max-width:880px;margin:0 auto;width:100%}
.in.wide{max-width:1120px}
.kick{font-size:13px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;opacity:.65;margin-bottom:18px}
.h{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:clamp(30px,5vw,54px);line-height:1.08;letter-spacing:-.01em;margin-bottom:22px}
.sub{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:clamp(22px,3vw,30px);margin:56px 0 18px}
.lede{font-size:clamp(16px,2vw,19px);color:inherit;opacity:.85;max-width:640px;margin-bottom:34px}
.body{font-size:16px;opacity:.85;max-width:640px;margin-top:28px}
.src{font-size:12px;opacity:.55;margin-top:30px;max-width:720px;font-variant-numeric:tabular-nums}
.sc-navy .src{opacity:.5}
/* hero */
.hero{overflow:hidden;background:var(--navy);color:#fff;align-items:flex-end;padding-bottom:72px}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92}
.hero-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,39,66,.28) 0%,rgba(16,39,66,.12) 40%,rgba(16,39,66,.82) 100%)}
.hero .in{position:relative;z-index:2}
.hero-kick{font-size:13px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.85);margin-bottom:14px}
.hero-h{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:clamp(40px,8vw,92px);line-height:1.0;letter-spacing:-.01em;text-shadow:0 2px 24px rgba(16,39,66,.45)}
.hero-sub{font-size:clamp(15px,2vw,19px);color:rgba(255,255,255,.9);margin-top:16px}
.hero-for{font-size:14px;color:rgba(255,255,255,.7);margin-top:8px}
.cue{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:2;width:26px;height:40px;border:2px solid rgba(255,255,255,.7);border-radius:14px}
.cue::after{content:'';position:absolute;left:50%;top:8px;width:4px;height:8px;background:rgba(255,255,255,.9);border-radius:2px;transform:translateX(-50%)}
/* answer */
.ans-n{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(64px,13vw,150px);line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin:6px 0 10px}
.ans-l{font-size:15px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;opacity:.65}
.conf{display:inline-block;margin-top:16px;padding:7px 16px;border:1px solid var(--ink12);border-radius:999px;font-size:13px;font-weight:600}
.range{margin-top:56px}
.range-track{position:relative;height:8px;background:var(--ink12);border-radius:4px}
.range-fill{position:absolute;top:0;bottom:0;left:0;background:var(--navy);border-radius:4px;width:var(--w,0%);transition:width 1.1s cubic-bezier(.2,.7,.2,1)}
.range-marks{display:flex;justify-content:space-between;margin-top:14px;gap:12px}
.rm{flex:1}
.rm-v{font-size:clamp(18px,2.6vw,26px);font-weight:700;font-variant-numeric:tabular-nums}
.rm-l{font-size:12.5px;opacity:.6;margin-top:2px}
.rm.mid .rm-v{color:var(--navy)}
/* stats */
.stat3,.stat4{display:grid;gap:28px;margin:44px 0}
.stat3{grid-template-columns:repeat(3,1fr)}
.stat4{grid-template-columns:repeat(4,1fr)}
.st-n{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(34px,5vw,58px);line-height:1;font-variant-numeric:tabular-nums}
.st-l{font-size:14px;opacity:.72;margin-top:10px;line-height:1.45}
/* timeline */
.tl{display:flex;align-items:center;gap:18px;margin:40px 0;flex-wrap:wrap}
.tl-item{min-width:120px}
.tl-lbl{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
.tl-val{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(24px,3.4vw,38px);margin-top:4px;font-variant-numeric:tabular-nums}
.tl-arrow{flex:1;min-width:40px;height:2px;background:rgba(250,248,244,.35);position:relative}
.tl-arrow::after{content:'';position:absolute;right:0;top:-4px;border-left:8px solid rgba(250,248,244,.55);border-top:5px solid transparent;border-bottom:5px solid transparent}
.story-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px}
.story-card{background:rgba(250,248,244,.06);border:1px solid rgba(250,248,244,.14);border-radius:16px;padding:22px}
.story-lens{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.65;margin-bottom:10px}
.story-fact{font-size:15.5px;font-weight:600;line-height:1.4}
.story-mean{font-size:14px;opacity:.75;margin-top:10px;line-height:1.45}
/* comps */
.cmp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:8px}
.cmp{background:#fff;border:1px solid var(--ink12);border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgb(16 39 66 / .06)}
.cmp-img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block}
.cmp-img.ph{display:flex;align-items:center;justify-content:center;background:var(--navy);color:var(--cream);font-family:'Amboqia Boriango',Georgia,serif;font-size:40px}
.cmp-b{padding:18px 20px 20px}
.cmp-a{font-size:14px;font-weight:600;opacity:.8}
.cmp-p{font-family:'Amboqia Boriango',Georgia,serif;font-size:30px;margin:6px 0 8px;font-variant-numeric:tabular-nums}
.cmp-m{font-size:13px;opacity:.65;font-variant-numeric:tabular-nums}
.cmp-adj{font-size:13.5px;margin-top:10px;padding-top:10px;border-top:1px solid var(--ink12)}
/* seasonality */
.szn{display:flex;gap:8px;align-items:flex-end;height:280px;margin:16px 0 8px}
.szn-col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%}
.szn-v{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;margin-bottom:6px}
.szn-bar-wrap{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center}
.szn-bar{width:70%;max-width:44px;height:var(--h);background:var(--navy);opacity:.32;border-radius:8px 8px 3px 3px;transform:scaleY(0);transform-origin:bottom;transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.szn-bar.hot{opacity:1}
.szn-na{font-size:11px;opacity:.4}
.szn-m{font-size:12px;opacity:.65;margin-top:8px}
.on .szn-bar{transform:scaleY(1)}
/* sources appendix */
.srcgrid{display:grid;gap:10px;margin-top:8px}
.srcrow{display:grid;grid-template-columns:220px 1fr;gap:16px;padding:12px 0;border-top:1px solid var(--ink12);font-size:13px}
.srck{font-weight:600}
.srcv{opacity:.7;font-variant-numeric:tabular-nums}
@media (max-width:700px){.srcrow{grid-template-columns:1fr;gap:4px}}
/* the plan */
.plan-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:8px}
.plan{background:rgba(250,248,244,.06);border:1px solid rgba(250,248,244,.14);border-radius:16px;padding:20px}
.plan-t{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-bottom:8px}
.plan-a{font-size:16px;font-weight:600;line-height:1.45}
.plan-b{font-size:13px;opacity:.7;margin-top:8px}
/* subdivision story */
.yr{display:flex;gap:10px;align-items:flex-end;height:300px;margin:10px 0 18px;overflow-x:auto;padding-bottom:6px}
.yr-col{flex:1;min-width:64px;display:flex;flex-direction:column;align-items:center;height:100%}
.yr-v{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;margin-bottom:6px;white-space:nowrap}
.yr-bar-wrap{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center}
.yr-bar{width:72%;max-width:52px;height:var(--h);background:var(--navy);border-radius:10px 10px 3px 3px;transform:scaleY(0);transform-origin:bottom;transition:transform 1s cubic-bezier(.2,.7,.2,1)}
.on .yr-bar{transform:scaleY(1)}
.yr-m{font-size:13px;font-weight:600;margin-top:8px}
.yr-c{font-size:11.5px;opacity:.55;margin-top:2px}
.sty-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px 44px;margin:34px 0 10px}
.sty-h{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:22px;margin-bottom:8px}
.sty-b{font-size:15.5px;opacity:.85;line-height:1.6}
.nb-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:6px}
.nb{background:#fff;border:1px solid var(--ink12);border-radius:16px;overflow:hidden}
.nb-img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
.nb-b{padding:14px 16px 16px}
.nb-a{font-size:13.5px;font-weight:600;opacity:.8}
.nb-p{font-size:13px;font-variant-numeric:tabular-nums;opacity:.65;margin-top:3px}
.nb-l{font-size:13.5px;margin-top:9px;line-height:1.5}
.pos{font-weight:600;opacity:1}
/* financing + bench */
.fin,.bench{max-width:640px;margin-top:6px}
.fin-row,.bench-row{display:flex;align-items:center;gap:14px;margin:14px 0}
.fin-l,.bench-l{width:190px;font-size:14px;opacity:.85}
.fin-track,.bench-track{flex:1;height:14px;background:rgba(250,248,244,.14);border-radius:7px;overflow:hidden}
.sc-cream .fin-track,.sc-cream .bench-track{background:var(--ink12)}
.fin-bar,.bench-bar{height:100%;width:0;background:var(--cream);border-radius:7px;transition:width 1s cubic-bezier(.2,.7,.2,1)}
.bench-bar.warm{opacity:.55}
.on .fin-bar,.on .bench-bar{width:var(--w)}
.fin-v,.bench-v{width:64px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;font-size:15px}
/* likes + cando */
.like-grid,.cando-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:10px}
.like,.cando{background:#fff;border:1px solid var(--ink12);border-radius:16px;padding:22px}
.like-h,.cando-h{font-size:16px;font-weight:600;line-height:1.4}
.like-d{font-size:13.5px;opacity:.65;margin-top:8px}
.cando-t{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-bottom:8px}
/* next */
.next-in{display:flex;gap:48px;align-items:flex-end}
.br-img{width:min(300px,32vw);height:auto;flex:0 0 auto}
.next-b{flex:1}
.cta{display:flex;gap:14px;flex-wrap:wrap;margin:30px 0 22px}
.btn{display:inline-block;padding:15px 28px;border-radius:12px;font-weight:600;font-size:15.5px;text-decoration:none;transition:transform .18s ease,box-shadow .18s ease}
.btn:hover{transform:translateY(-1px)}
.btn.pri{background:var(--navy);color:var(--cream);box-shadow:0 12px 28px rgb(16 39 66 / .22)}
.btn.sec{border:1.5px solid var(--navy);color:var(--navy)}
.btn.ter{color:var(--ink70);text-decoration:underline;text-underline-offset:4px;padding-left:8px;padding-right:8px}
.sig{font-size:14.5px;font-weight:600}
.fine{font-size:12px;opacity:.55;margin-top:14px;max-width:640px;line-height:1.5}
/* chrome */
#bar{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;gap:16px;padding:12px 20px;background:rgba(250,248,244,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--ink12);transform:translateY(-110%);transition:transform .3s ease}
#bar.on{transform:none}
#bar .bt{font-size:14px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bar a{font-size:13px;font-weight:600;color:var(--navy);text-decoration:none;border:1px solid var(--ink12);padding:6px 14px;border-radius:999px}
#prog{position:absolute;bottom:-1px;left:0;height:2px;background:var(--navy);width:0}
/* reveal */
html.anim .r{opacity:0;transform:translateY(22px)}
html.anim .on .r{opacity:1;transform:none;transition:opacity .55s ease-out,transform .55s ease-out}
html.anim .on .r:nth-child(2){transition-delay:.06s}
html.anim .on .r:nth-child(3){transition-delay:.12s}
html.anim .on .r:nth-child(4){transition-delay:.18s}
html.anim .on .r:nth-child(5){transition-delay:.24s}
@media (prefers-reduced-motion:no-preference){.hero-img{animation:kb 26s ease-in-out infinite alternate}}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.08)}}
@media (max-width:860px){
  .stat3,.stat4{grid-template-columns:1fr 1fr}
  .cmp-grid,.story-grid,.like-grid,.cando-grid,.sty-grid,.plan-grid{grid-template-columns:1fr}
  .nb-grid{grid-template-columns:1fr 1fr}
  .yr{height:220px}
  .next-in{flex-direction:column;align-items:flex-start}
  .fin-l,.bench-l{width:120px}
  .szn{height:200px;gap:4px}
  .sc{padding:72px 18px}
}
@media (max-width:560px){.stat3,.stat4{grid-template-columns:1fr}}
@media print{
  .sc{min-height:0;padding:24px}
  #bar,.cue{display:none}
  .hero{color:var(--navy)}
}
</style>
</head>
<body>
<div id="bar"><div class="bt">${esc(s.streetAddress)} · ${esc(s.city)}, OR</div><a href="?print=1">Print report</a><div id="prog"></div></div>

<section class="sc hero" id="top">
  ${heroImg}
  <div class="hero-scrim" aria-hidden="true"></div>
  <div class="in">
    <div class="hero-kick">What your home is worth · ${esc(a.generatedAtIso.slice(0, 10))}</div>
    <h1 class="hero-h">${esc(s.streetAddress)}</h1>
    <div class="hero-sub">${esc(s.city)}, ${esc(s.state)} ${esc(s.postalCode ?? '')}${s.subdivision ? ` · ${esc(s.subdivision)}` : ''}${specs ? ` · ${esc(specs)}` : ''}</div>
    <div class="hero-for">Prepared for ${esc(a.client.name ?? 'the owner')} by ${esc(a.broker.displayName)}, Ryan Realty</div>
  </div>
  <div class="cue" aria-hidden="true"></div>
</section>

<section class="sc sc-cream" id="answer">
  <div class="in">
    <div class="ans-l r">Recommended list price</div>
    <div class="ans-n r" data-count>${usd(p.recommended)}</div>
    <div class="r"><span class="conf">Confidence: ${esc(p.confidence)}</span></div>
    <div class="range r">
      <div class="range-track"><div class="range-fill" style="--w:100%"></div></div>
      <div class="range-marks">
        <div class="rm"><div class="rm-v">${usd(p.conservative)}</div><div class="rm-l">Conservative</div></div>
        <div class="rm mid"><div class="rm-v">${usd(p.recommended)}</div><div class="rm-l">Recommended</div></div>
        <div class="rm" style="text-align:right"><div class="rm-v">${usd(p.highEnd)}</div><div class="rm-l">Ceiling, condition resolved</div></div>
      </div>
    </div>
    <p class="body r">The adjusted comparable sales bracket ${usd(evLo)} to ${usd(evHi)}${p.convergenceSpreadPct != null ? `, and the pricing methods behind this number land within ${dec(p.convergenceSpreadPct, 1)}% of each other` : ''}.</p>
  </div>
</section>

${subdivisionStoryScene(a)}
${compsScene(a)}
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
      bar.classList.toggle('on',y>window.innerHeight*0.7)
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
