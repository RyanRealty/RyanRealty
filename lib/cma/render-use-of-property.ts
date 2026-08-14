/**
 * CMA "what you can do" section. Zoning and rental answers in a two-board
 * layout. Uses the verified development + rental resolvers. No invented
 * income, no land-use decision.
 */

import {
  escapeHtml,
  hoaBlock,
  rentalIncomeBlock,
  zoningExplainerBlock,
} from '@/lib/cma/render-blocks'
import type { DevelopmentOpportunities, DevItem, DevVerdict } from '@/lib/cma/development'
import type { RentalPotential, RentalTenure } from '@/lib/cma/rental-potential'

const esc = escapeHtml

export type CmaPageDef = { meta: string; body: string; toc?: string }

const BUILD_TOPICS = new Set<DevItem['topic']>([
  'Subdivide or partition',
  'ADU',
  'Second dwelling',
  'Middle housing',
])

const VERDICT_LABELS: Record<string, string> = {
  yes: 'Allowed',
  conditional: 'Conditional',
  unlikely: 'Unlikely',
  no: 'Not available',
  confirm: 'Worth exploring',
}

const VERDICT_RANK: Record<string, number> = { yes: 0, conditional: 1, confirm: 2, unlikely: 3, no: 4 }

function pill(verdict: DevVerdict | string): string {
  const label = VERDICT_LABELS[verdict] ?? verdict
  const tone = verdict === 'yes' ? ' is-yes' : verdict === 'no' || verdict === 'unlikely' ? ' is-no' : ''
  return `<span class="verdict${tone}">${esc(label)}</span>`
}

function byCapability<T extends { verdict: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (VERDICT_RANK[a.verdict] ?? 9) - (VERDICT_RANK[b.verdict] ?? 9))
}

function sourceLine(citation: string, url: string): string {
  let host = ''
  try {
    host = new URL(url).host.replace(/^www\./, '')
  } catch {
    host = ''
  }
  return host
    ? `<p class="src">Source: ${esc(citation)} · <a href="${esc(url)}">${esc(host)}</a></p>`
    : `<p class="src">Source: ${esc(citation)}</p>`
}

function zoneMast(dev: DevelopmentOpportunities): string {
  const name = dev.zoningExplainer?.zoneName ?? ''
  return `
  <div class="zone-mast">
    <div class="zm-kicker">Zone</div>
    <div class="zm-code">${esc(dev.zone)}</div>
    ${name ? `<div class="zm-name">${esc(name)}</div>` : ''}
    <div class="zm-meta">${esc(dev.jurisdiction)} · verified ${esc(dev.verifiedAsOf)}</div>
  </div>`
}

function glanceRow(dev: DevelopmentOpportunities | null, rental: RentalPotential | null): string {
  const cells: Array<{ q: string; verdict: string }> = []
  const adu =
    dev?.items.find((i) => i.topic === 'ADU') ?? dev?.items.find((i) => i.topic === 'Second dwelling')
  const split = dev?.items.find((i) => i.topic === 'Subdivide or partition')
  if (adu) cells.push({ q: 'Add a unit', verdict: adu.verdict })
  if (split) cells.push({ q: 'Split the lot', verdict: split.verdict })
  for (const t of rental?.tenures ?? []) {
    cells.push({ q: `${t.tenure} rent`, verdict: t.verdict })
  }
  if (cells.length === 0) return ''
  return `<div class="glance-row">
    ${cells
      .map(
        (c) => `<div class="glance">
      <div class="g-q">${esc(c.q)}</div>
      <div class="g-a">${pill(c.verdict)}</div>
    </div>`,
      )
      .join('')}
  </div>`
}

function buildCard(item: DevItem): string {
  return `
  <article class="use-card" data-verdict="${esc(item.verdict)}">
    <div class="use-card-top">
      <span class="use-topic">${esc(item.topic)}</span>
      ${pill(item.verdict)}
    </div>
    <p class="use-head">${esc(item.headline)}</p>
    <p class="use-detail">${esc(item.detail)}</p>
    ${sourceLine(item.citation, item.url)}
  </article>`
}

function rentCard(t: RentalTenure): string {
  const req = t.requirements.slice(0, 3)
  const reqList =
    req.length > 0 ? `<ul class="note-list">${req.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''
  return `
  <article class="use-card" data-verdict="${esc(t.verdict)}">
    <div class="use-card-top">
      <span class="use-topic">${esc(t.tenure)} rental</span>
      ${pill(t.verdict)}
    </div>
    <p class="use-head">${esc(t.headline)}</p>
    <p class="use-detail">${esc(t.detail)}</p>
    ${reqList}
    ${sourceLine(t.citation, t.url)}
  </article>`
}

export function useOfPropertyPage(input: {
  streetAddress: string
  development?: DevelopmentOpportunities | null
  rental?: RentalPotential | null
}): CmaPageDef | null {
  const dev = input.development ?? null
  const rental = input.rental ?? null
  const buildItems = byCapability((dev?.items ?? []).filter((i) => BUILD_TOPICS.has(i.topic)))
  const rentItems = byCapability(rental?.tenures ?? [])
  if (buildItems.length === 0 && rentItems.length === 0) return null

  const lead = dev
    ? `<p>The zone decides whether you can add a unit, split the lot, or rent the house. The answers below are a first read of published code, not a permit.</p>`
    : `<p>Here is what the rental rules allow at this address, and what they do not.</p>`

  const buildCol =
    buildItems.length > 0
      ? `<div class="use-col">
    <h3 class="use-col-title">Build</h3>
    ${buildItems.map(buildCard).join('')}
  </div>`
      : ''
  const rentCol =
    rentItems.length > 0
      ? `<div class="use-col">
    <h3 class="use-col-title">Rent</h3>
    ${rentItems.map(rentCard).join('')}
  </div>`
      : ''

  const income =
    rental && rental.income.length > 0
      ? `<h3 class="subhead">Cited income figures</h3>
  <p class="small">Only figures we can name a source for. There is no nightly rate or occupancy model in this report.</p>
  ${rentalIncomeBlock(rental.income)}
  ${rental.economicsNote ? `<p class="small">${esc(rental.economicsNote)}</p>` : ''}`
      : ''

  const verified = [
    dev ? `${dev.jurisdiction} code, verified ${dev.verifiedAsOf}` : null,
    rental ? `rental rules for ${rental.jurisdiction}, verified ${rental.verifiedAsOf}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const disclaimer = dev?.disclaimer ?? rental?.disclaimer ?? ''

  return {
    meta: `${esc(input.streetAddress)} · What this property can do`,
    toc: 'What you can do with this property',
    body: `
  <h2 class="section">What this property can do</h2>
  ${dev ? zoneMast(dev) : ''}
  ${lead}
  ${glanceRow(dev, rental)}
  ${zoningExplainerBlock(dev)}
  <div class="use-board">
    ${buildCol}
    ${rentCol}
  </div>
  ${hoaBlock(dev)}
  ${income}
  ${verified ? `<p class="small">Sources: ${esc(verified)}.</p>` : ''}
  ${disclaimer ? `<p class="small">${esc(disclaimer)}</p>` : ''}`,
  }
}
