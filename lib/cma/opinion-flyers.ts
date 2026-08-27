/**
 * Print drill-in for the three sales. Web taps a pin; PDF gets one page
 * per sale. Same facts as the comparison strip.
 */

import { clientPlaceClause, formatClientMlsField } from '@/lib/cma/client-facing'
import {
  cleanText,
  dateLong,
  dec,
  escapeHtml,
  int,
  monthYear,
  sparkPhotoAt,
  trimRemarks,
  usd,
} from '@/lib/cma/render-blocks'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'
import type { CmaAdjustedComp } from '@/lib/cma/types'

const esc = escapeHtml

function soldVsList(c: CmaAdjustedComp): string | null {
  if (!c.listPrice || c.listPrice <= 0) return null
  return `${dec((c.closePrice / c.listPrice) * 100, 1)}% of list`
}

export function compFlyerPage(
  comps: readonly CmaAdjustedComp[],
  comp: CmaAdjustedComp,
  index: number,
  noun: string = 'house',
): CmaPageDef {
  const hero = sparkPhotoAt(comp.photoUrl, '1024x768')
  const remarks = trimRemarks(comp.publicRemarks, 800)
  const ppsf = comp.sqft > 0 ? Math.round(comp.closePrice / comp.sqft) : null
  const vsList = soldVsList(comp)
  const place = clientPlaceClause(comp.subdivision, comp.city)
  return {
    flyer: true,
    meta: `Comparable Sale ${index + 1} of ${comps.length}${place ? ` · ${esc(place)}` : ''}`,
    toc: index === 0 ? 'Comparable sale detail, one page each' : undefined,
    body: `
  <p class="flyer-kicker">Closed ${monthYear(comp.closeDate)}${comp.daysToOffer != null ? ` · ${int(comp.daysToOffer)}d to offer` : ''}${comp.selectionTier ? ` · ${esc(comp.selectionTier)} comp` : ''}</p>
  <h1 class="flyer-title">${esc(comp.address)}</h1>
  <div class="flyer-sub">${esc(comp.city)}, Oregon${cleanText(comp.subdivision) ? ` · ${esc(cleanText(comp.subdivision)!)}` : ''}${comp.mlsNumber ? ` · MLS ${esc(comp.mlsNumber)}` : ''}${comp.proximity ? ` · ${esc(comp.proximity)} from the subject` : ''}</div>
  ${hero ? `<img class="flyer-hero" src="${esc(hero)}" alt="${esc(comp.address)}" />` : '<div class="flyer-hero is-empty">Photo not retained on the closed listing</div>'}
  <div class="flyer-stats">
    <div class="s"><div class="l">Beds</div><div class="v">${int(comp.beds)}</div></div>
    <div class="s"><div class="l">Baths</div><div class="v">${dec(comp.baths, 0)}</div></div>
    <div class="s"><div class="l">Sqft</div><div class="v">${int(comp.sqft)}</div></div>
    <div class="s"><div class="l">Lot</div><div class="v">${comp.lotAcres != null ? `${dec(comp.lotAcres, 2)} ac` : '-'}</div></div>
    <div class="s"><div class="l">Year</div><div class="v">${comp.yearBuilt ?? '-'}</div></div>
    <div class="s featured"><div class="l">Sold $/sqft</div><div class="v">${ppsf != null ? usd(ppsf) : '-'}</div></div>
  </div>
  ${remarks ? `<p class="flyer-desc">${esc(remarks)}</p>` : ''}
  <div class="flyer-features">
    <div class="f"><div class="fl">List Price</div><div class="fv">${usd(comp.listPrice)}</div></div>
    <div class="f"><div class="fl">Sold Price</div><div class="fv">${usd(comp.closePrice)}</div></div>
    <div class="f"><div class="fl">Seller concessions</div><div class="fv">${comp.concessionsAmount != null ? usd(comp.concessionsAmount) : '-'}</div></div>
    <div class="f"><div class="fl">Seller net from price</div><div class="fv">${comp.sellerNet != null ? usd(comp.sellerNet) : '-'}</div></div>
    <div class="f"><div class="fl">Sold vs List</div><div class="fv">${vsList ? esc(vsList) : '-'}</div></div>
    <div class="f"><div class="fl">Close Date</div><div class="fv">${dateLong(comp.closeDate)}</div></div>
    <div class="f"><div class="fl">Days on Market</div><div class="fv">${comp.daysToOffer != null ? `${int(comp.daysToOffer)} to offer` : '-'}${comp.domTotal != null ? ` · DOM ${int(comp.domTotal)}` : ''}</div></div>
    <div class="f"><div class="fl">Distance from Subject</div><div class="fv">${comp.proximity ? esc(comp.proximity) : '-'}</div></div>
    ${formatClientMlsField(comp.viewDescription) ? `<div class="f"><div class="fl">View</div><div class="fv">${esc(formatClientMlsField(comp.viewDescription)!)}</div></div>` : ''}
    <div class="f"><div class="fl">This sale as your ${noun}</div><div class="fv">${usd(comp.adjustedPrice)}</div></div>
  </div>
  ${remarks ? '<p class="small">Description quoted from the MLS listing record.</p>' : ''}`,
  }
}

export function assembleCompFlyerPages(comps: readonly CmaAdjustedComp[], noun: string = 'house'): CmaPageDef[] {
  return comps.map((row, index) => compFlyerPage(comps, row, index, noun))
}
