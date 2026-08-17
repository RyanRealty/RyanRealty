/**
 * Shared kept-sales comparison strip + map key. Web and print tell the same
 * story. Pricing math stays in lib/cma/pricing.ts.
 */

import { whyWeKeptComp } from '@/lib/cma/client-facing'
import { dec, escapeHtml, int, sparkPhotoAt, usd } from '@/lib/cma/render-blocks'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

const esc = escapeHtml

function joinFacts(parts: Array<string | null | undefined>): string | null {
  const kept = parts.filter((p): p is string => Boolean(p && p.trim()))
  return kept.length ? kept.join(' · ') : null
}

function bedsBathsSqftYear(c: CmaAdjustedComp): string | null {
  return joinFacts([
    c.beds != null ? `${int(c.beds)} bd` : null,
    c.baths != null ? `${dec(c.baths, c.baths % 1 !== 0 ? 1 : 0)} ba` : null,
    c.sqft > 0 ? `${int(c.sqft)} sqft` : null,
    c.yearBuilt != null ? `${c.yearBuilt}` : null,
  ])
}

function marketTime(c: CmaAdjustedComp): string | null {
  return joinFacts([
    c.daysToOffer != null ? `${int(c.daysToOffer)} days to offer` : null,
    c.domTotal != null ? `${int(c.domTotal)} DOM` : null,
  ])
}

function soldPpsf(c: CmaAdjustedComp): string | null {
  if (!(c.sqft > 0) || !(c.closePrice > 0)) return null
  return `${usd(Math.round(c.closePrice / c.sqft))}/sf`
}

export function renderCompStripHtml(comps: readonly CmaAdjustedComp[]): string {
  const rows = comps
    .map((c, i) => {
      const pin = i + 1
      const why = whyWeKeptComp(c)
      const photo = sparkPhotoAt(c.photoUrl, '640x480')
      const facts = bedsBathsSqftYear(c)
      const ppsf = soldPpsf(c)
      const time = marketTime(c)
      const img = photo
        ? `<img class="comp-ph" src="${esc(photo)}" alt="${esc(c.address)}" />`
        : `<div class="comp-ph is-empty" aria-hidden="true">${pin}</div>`
      return `
    <article class="comp-row" data-comp="${pin}">
      <div class="comp-media">
        ${img}
        <span class="comp-pin">${pin}</span>
      </div>
      <div class="comp-body">
        <div class="comp-addr">${esc(c.address)}</div>
        <div class="comp-nums">
          <div class="comp-n"><span class="comp-nl">Sold</span><span class="comp-nv">${usd(c.closePrice)}</span></div>
          ${ppsf ? `<div class="comp-n"><span class="comp-nl">Sold $/sf</span><span class="comp-nv">${esc(ppsf)}</span></div>` : ''}
          <div class="comp-n"><span class="comp-nl">Adjusted to subject</span><span class="comp-nv">${usd(c.adjustedPrice)}</span></div>
        </div>
        ${facts ? `<div class="comp-facts">${esc(facts)}</div>` : ''}
        ${c.proximity ? `<div class="comp-facts">${esc(c.proximity)}</div>` : ''}
        ${time ? `<div class="comp-facts">${esc(time)}</div>` : ''}
        <p class="comp-why">${esc(why.sentence)}</p>
      </div>
    </article>`
    })
    .join('')
  return `<div class="comp-strip">${rows}</div>`
}

export function renderCompMapKeyHtml(subject: CmaSubject, comps: readonly CmaAdjustedComp[]): string {
  const subjectLine = joinFacts([
    subject.beds != null ? `${int(subject.beds)} bd` : null,
    subject.baths != null ? `${dec(subject.baths, subject.baths % 1 !== 0 ? 1 : 0)} ba` : null,
    subject.sqft != null && subject.sqft > 0 ? `${int(subject.sqft)} sqft` : null,
  ])
  const items = [
    `<div class="k"><span class="pin subject">S</span><div class="txt"><strong>${esc(subject.streetAddress)}</strong>${subjectLine ? `<br/>${esc(subjectLine)}` : ''}<br/>Subject</div></div>`,
    ...comps.map((c, i) => {
      const why = whyWeKeptComp(c)
      const facts = bedsBathsSqftYear(c)
      const ppsf = soldPpsf(c)
      const time = marketTime(c)
      const money = joinFacts([usd(c.closePrice), ppsf, `adj ${usd(c.adjustedPrice)}`])
      const meta = joinFacts([c.proximity, time])
      return `<div class="k"><span class="pin">${i + 1}</span><div class="txt"><strong>${esc(c.address)}</strong>${money ? `<br/>${esc(money)}` : ''}${facts ? `<br/>${esc(facts)}` : ''}${meta ? `<br/>${esc(meta)}` : ''}<br/>${esc(why.sentence)}</div></div>`
    }),
  ]
  return `<div class="map-key">${items.join('')}</div>`
}
