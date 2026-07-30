/**
 * Shared HTML block builders + formatting helpers for every priced valuation
 * document (CMA, expired audit, BPO).
 *
 * These blocks are the ONE place a fact-section's markup lives, so the same
 * property reads identically whether it lands in the 20-page seller CMA
 * (lib/cma/render.ts) or the 2-page broker price opinion (lib/bpo/render.ts).
 *
 * Two rules govern everything here:
 *   1. §0 — a block prints only what its resolver verified. Nothing is
 *      invented to fill a slot.
 *   2. No empty shells. A block whose data is null or empty returns '' so the
 *      caller can drop the whole page. A heading with nothing under it is the
 *      defect that got ClimateRiskBlock deleted from the listing page.
 *
 * Voice: capability first, rule underneath as evidence (Matt 2026-07-30). The
 * document is a listing-strategy document, so it leads with what the property
 * can do and cites the code section that says so.
 */

import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import type { CmaSiteData } from '@/lib/cma/county'
import type { DevelopmentOpportunities } from '@/lib/cma/development'
import type { RentalPotential } from '@/lib/cma/rental-potential'

// ── formatting primitives ───────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const esc = escapeHtml

export const usd = formatPriceExact

export function usdSigned(n: number): string {
  if (n === 0) return '$0'
  const abs = usd(Math.abs(n))
  return n > 0 ? `+${abs}` : `−${abs}`
}

export function int(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

export function dec(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

export const dateLong = formatDate

export function monthYear(iso: string | null | undefined): string {
  return formatDate(iso, { month: 'short', day: undefined, year: 'numeric' })
}

/** Rewrite a Spark CDN photo URL to a specific size tier. */
export function sparkPhotoAt(url: string | null, size: string): string | null {
  if (!url) return null
  if (/cdn\.resize\.sparkplatform\.com/.test(url)) return url.replace(/\/\d+x\d+\//, `/${size}/`)
  return url
}

export function trimRemarks(remarks: string | null, max = 850): string | null {
  if (!remarks) return null
  const clean = remarks.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

/** E.164-ish number for tel:/sms: hrefs. Null when the phone cannot parse. */
export function phoneHref(phone: string | null): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `+1${d}` : null
}

/** Brand-voice display format 541.703.3095 (dotted). Broker rows store
 *  parenthesized strings, which is not the locked brand format. */
export function dottedPhone(phone: string | null): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}` : phone
}

/**
 * Split a list across as few pages as the cap allows, then even the groups out
 * so the run never ends on a page holding one item. Pages here are a fixed 11in
 * with `overflow: hidden`, so an unchunked long section is silently CLIPPED —
 * the reader never learns the content existed.
 */
export function chunk<T>(items: readonly T[], max: number): T[][] {
  if (items.length === 0) return []
  const pages = Math.ceil(items.length / max)
  const per = Math.ceil(items.length / pages)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per))
  return out
}

/**
 * MLS placeholder scrubber. Subdivision, view, and remark fields arrive carrying
 * literal 'N/A' / 'None' strings, which then print as "the N/A subdivision".
 * A placeholder is missing data, so it renders as missing.
 */
export function cleanText(v: string | null | undefined): string | null {
  if (!v) return null
  const t = v.trim()
  if (!t) return null
  return /^(n\/?a|none|null|unknown|tbd|not applicable)$/i.test(t) ? null : t
}

/** Host of a URL, for a compact printed source line. */
function host(url: string): string {
  return url.replace(/^https?:\/\//, '').split('/')[0] ?? url
}

function sourceLine(citation: string, url: string): string {
  return `<p class="src">Source: ${esc(citation)} · <a href="${esc(url)}">${esc(host(url))}</a></p>`
}

// ── verdicts ────────────────────────────────────────────────────────────────

const VERDICT_LABELS: Record<string, string> = {
  yes: 'Allowed',
  conditional: 'Conditional',
  unlikely: 'Unlikely',
  no: 'Not available',
  confirm: 'Worth exploring',
}

/** Capability first: what the parcel CAN do sorts to the top of every list. */
const VERDICT_RANK: Record<string, number> = { yes: 0, conditional: 1, confirm: 2, unlikely: 3, no: 4 }

function verdictPill(verdict: string): string {
  const label = VERDICT_LABELS[verdict] ?? verdict
  const tone = verdict === 'yes' ? ' is-yes' : verdict === 'no' || verdict === 'unlikely' ? ' is-no' : ''
  return `<span class="verdict${tone}">${esc(label)}</span>`
}

function byCapability<T extends { verdict: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (VERDICT_RANK[a.verdict] ?? 9) - (VERDICT_RANK[b.verdict] ?? 9))
}

// ── marketing highlights ────────────────────────────────────────────────────

export interface MarketingHighlight {
  headline: string
  basis: string
}

/**
 * The sellable facts a comparable-sales grid cannot price, each printed with
 * the record it came from. Empty in, nothing out. The basis line never gets
 * stripped: the citation is what separates this from an automated estimate.
 */
export function marketingHighlightsBlock(highlights: readonly MarketingHighlight[]): string {
  if (highlights.length === 0) return ''
  const cards = highlights
    .map(
      (h) => `<div class="hl"><div class="hl-head">${esc(h.headline)}</div><div class="hl-basis">${esc(h.basis)}</div></div>`,
    )
    .join('')
  return `<div class="hl-grid">${cards}</div>`
}

/** Both content resolvers emit highlights. This is the combined, de-duplicated set. */
export function collectHighlights(
  dev: DevelopmentOpportunities | null | undefined,
  rental: RentalPotential | null | undefined,
): MarketingHighlight[] {
  const all = [...(dev?.marketingHighlights ?? []), ...(rental?.marketingHighlights ?? [])]
  const seen = new Set<string>()
  return all.filter((h) => {
    const k = h.headline.trim().toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ── zoning ──────────────────────────────────────────────────────────────────

/** Zone, in plain language: what it is for, what it allows, what it measures. */
export function zoningExplainerBlock(dev: DevelopmentOpportunities | null | undefined): string {
  const z = dev?.zoningExplainer
  if (!z) return ''
  const chips = (values: readonly string[]) =>
    values.length > 0 ? `<div class="chips">${values.map((v) => `<span>${esc(v)}</span>`).join('')}</div>` : ''
  const dimensional =
    z.dimensional.length > 0
      ? `<h3 class="subhead">The numbers the code sets</h3>
  <table class="kv">${z.dimensional
    .map((d) => `<tr><th>${esc(d.label)}</th><td>${esc(d.value)}</td></tr>`)
    .join('')}</table>`
      : ''
  return `
  <p class="zone-line"><strong>${esc(z.zone)}</strong> · ${esc(z.zoneName)}</p>
  <p>${esc(z.purpose)}</p>
  <div class="two-col">
    <div>
      ${z.permittedOutright.length > 0 ? `<h3 class="subhead">Allowed outright</h3>${chips(z.permittedOutright)}` : ''}
    </div>
    <div>
      ${z.conditional.length > 0 ? `<h3 class="subhead">Allowed with a conditional use permit</h3>${chips(z.conditional)}` : ''}
    </div>
  </div>
  ${dimensional}
  ${sourceLine(z.citation, z.url)}`
}

// ── development ─────────────────────────────────────────────────────────────

/** The development answers themselves, capability first. No disclaimer, no resources. */
export function developmentItemsBlock(dev: DevelopmentOpportunities | null | undefined): string {
  if (!dev || dev.items.length === 0) return ''
  return byCapability(dev.items)
    .map(
      (it) => `
  <h3 class="subhead">${esc(it.topic)} ${verdictPill(it.verdict)}</h3>
  <p><strong>${esc(it.headline)}</strong></p>
  <p class="small">${esc(it.detail)}</p>
  ${sourceLine(it.citation, it.url)}`,
    )
    .join('')
}

/** The one-line frame that sits above the development answers. */
export function developmentLeadLine(dev: DevelopmentOpportunities): string {
  return `<p>This parcel is zoned <strong>${esc(dev.zone)}</strong> in ${esc(dev.jurisdiction)}. Each answer below is a preliminary read of the code in effect ${esc(dev.verifiedAsOf)}, with the section we relied on cited. None of it is a land-use decision.</p>`
}

/** What a buyer could actually do with the parcel, drawn from the cited facts. */
export function buyerOptionsBlock(dev: DevelopmentOpportunities | null | undefined): string {
  const options = dev?.buyerOptions ?? []
  if (options.length === 0) return ''
  return options
    .map(
      (o) => `
  <h3 class="subhead">${esc(o.headline)}</h3>
  <p class="small">${esc(o.detail)}</p>
  ${o.basedOn.length > 0 ? `<p class="src">Based on: ${o.basedOn.map((b) => esc(b)).join(' · ')}</p>` : ''}`,
    )
    .join('')
}

/** HOA of record, dues, and how to read the recorded CC&Rs. */
export function hoaBlock(dev: DevelopmentOpportunities | null | undefined): string {
  const h = dev?.hoa
  if (!h) return ''
  const rows: string[] = []
  if (h.hasAssociation === true) rows.push('<tr><th>Owners association</th><td>Yes, of record</td></tr>')
  else if (h.hasAssociation === false) rows.push('<tr><th>Owners association</th><td>None found on the record</td></tr>')
  if (h.resortAssociation) rows.push(`<tr><th>Association</th><td>${esc(h.resortAssociation)}</td></tr>`)
  if (h.feeLabel) rows.push(`<tr><th>Dues</th><td>${esc(h.feeLabel)}</td></tr>`)
  const table = rows.length > 0 ? `<table class="kv">${rows.join('')}</table>` : ''
  const guidance = h.ccrGuidance ? `<p>${esc(h.ccrGuidance)}</p>` : ''
  if (!table && !guidance) return ''
  return `${table}${guidance}`
}

// ── rental ──────────────────────────────────────────────────────────────────

/** Lead line for the rental section: jurisdiction and the code-verified date. */
export function rentalLeadLine(rental: RentalPotential): string {
  return `<p>Three ways to rent, read against the rules in force in ${esc(rental.jurisdiction)} as of ${esc(rental.verifiedAsOf)}. Each verdict cites the section it rests on.</p>`
}

/** One tenure per block: verdict, the plain answer, then what it takes. */
export function rentalTenuresBlock(tenures: RentalPotential['tenures']): string {
  if (tenures.length === 0) return ''
  return byCapability(tenures)
    .map(
      (t) => `
  <h3 class="subhead">${esc(t.tenure)} ${verdictPill(t.verdict)}</h3>
  <p><strong>${esc(t.headline)}</strong></p>
  <p>${esc(t.detail)}</p>
  ${t.requirements.length > 0 ? `<ul class="note-list">${t.requirements.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
  ${sourceLine(t.citation, t.url)}`,
    )
    .join('')
}

/** What it could rent for, with the basis for every figure printed beside it. */
export function rentalIncomeBlock(income: RentalPotential['income']): string {
  if (income.length === 0) return ''
  const rows = income
    .map((i) => `<tr><th>${esc(i.label)}</th><td class="v">${esc(i.value)}</td><td class="b">${esc(i.basis)}</td></tr>`)
    .join('')
  return `<table class="kv is-wide"><thead><tr><th>Figure</th><th class="v">Value</th><th class="b">Basis</th></tr></thead><tbody>${rows}</tbody></table>`
}

// ── verify it yourself ──────────────────────────────────────────────────────

/** Disclaimers + the hyperlinked agency directory covering land use AND rentals. */
export function verifyResourcesBlock(
  dev: DevelopmentOpportunities | null | undefined,
  rental?: RentalPotential | null,
): string {
  if (!dev) return ''
  const rows = dev.resources
    .map(
      (r) =>
        `<li><strong><a href="${esc(r.url)}">${esc(r.name)}</a></strong>${r.phone ? ` · ${esc(r.phone)}` : ''}<div class="small" style="margin-top:1px;">${esc(r.role)}</div></li>`,
    )
    .join('')
  return `
  <p>${esc(dev.disclaimer)}</p>
  ${rental?.disclaimer ? `<p>${esc(rental.disclaimer)}</p>` : ''}
  <h3 class="subhead">Who to call, and where</h3>
  <ul class="note-list">${rows}</ul>`
}

/** Back-compat name kept for the BPO import path. */
export const developmentResourcesBlock = verifyResourcesBlock

/**
 * Comprehensive property & site intelligence from the authoritative county /
 * state / federal records: zoning + overlays, water and water rights, septic +
 * permit history, flood, wildfire, entitlement, buildability constraints,
 * hunting/LOP, and field-confirm caveats. Renders only what was resolved;
 * unresolved facts read "confirm at listing".
 */
export function propertyIntelligenceBlock(site: CmaSiteData | null | undefined): string {
  if (!site || (!site.zone && site.water.source === 'unknown' && site.septic.status === 'unknown')) return ''
  const rows: string[] = []

  // Zoning + overlays + entitlement.
  if (site.zone) {
    const overlays = site.overlays?.length ? ` · overlays: ${site.overlays.map((o) => esc(o.code)).join(', ')}` : ''
    rows.push(`<li><strong>Zoning:</strong> ${esc(site.zone)}${overlays}${site.entitlement?.conditional ? '. Resource zone, so a dwelling requires a verified entitlement (confirm before relying on buildability)' : ''}</li>`)
  }
  if (site.acreage != null) rows.push(`<li><strong>Parcel:</strong> ${site.acreage} acres${site.taxlot ? ` · taxlot ${esc(site.taxlot)}` : ''}${site.trs ? ` · ${esc(site.trs)}` : ''}</li>`)

  // Water.
  const water =
    site.water.source === 'well'
      ? `Private well${site.water.wellLog?.completedDepthFt ? ` (nearest area log about ${site.water.wellLog.completedDepthFt} ft, ${esc(site.water.wellLog.completedDate ?? 'date n/a')}. Confirm the subject's OWRD log)` : ' (confirm the subject\'s OWRD well log at listing)'}`
      : site.water.source === 'municipal'
        ? esc(site.water.providerName || 'City water')
        : null
  if (water) rows.push(`<li><strong>Water:</strong> ${water}</li>`)
  if (site.water.irrigationDistrict) rows.push(`<li><strong>Irrigation district:</strong> ${esc(site.water.irrigationDistrict)} (district boundary is not a water right. Confirm the appurtenant right with the district and OWRD)</li>`)

  // OWRD water rights of record (mapped Places of Use intersecting the parcel).
  if (site.water.rights.length > 0) {
    const srcLabel = (s: string) => (s === 'surface' ? 'surface water' : s === 'ground' ? 'groundwater' : s === 'storage' ? 'stored water' : 'water')
    const rightLines = site.water.rights
      .slice(0, 8)
      .map((r) => {
        const inchoate = r.stage === 'permit' || r.stage === 'application' || r.stage === 'claim'
        const bits = [
          `${esc(r.use.toLowerCase())} (${srcLabel(r.source)})`,
          r.acres != null ? `${r.acres} ac` : null,
          r.priorityDate ? `priority ${esc(r.priorityDate)}` : null,
          r.supplemental ? 'supplemental' : null,
          inchoate ? 'not yet perfected' : null,
          r.identifier ? esc(r.identifier) : null,
          r.holder ? `held by ${esc(r.holder)}${r.holderType === 'municipal' ? ' (city/municipal supplier)' : r.holderType === 'district' ? ' (irrigation district)' : ''}` : null,
        ].filter(Boolean)
        return `<li>${bits.join(' · ')}</li>`
      })
      .join('')
    const irr = site.water.mappedIrrigationAcres
    let lead: string
    if (!site.water.hasPrivateAppurtenant) {
      // Only supplier-held (city / irrigation-district) rights map here — the
      // parcel is within a supplier's service area, not the holder of a private
      // appurtenant right. Do NOT present it as "a water right on this parcel".
      lead = 'The water rights that map onto this parcel are held by a public supplier (a city or an irrigation district), whose service area covers the parcel. This is the supplier\'s own right of record, not a private water right appurtenant to the lot. Confirm any district-delivered right and its certificated acreage with the supplier and OWRD.'
    } else if (irr != null) {
      lead = `OWRD maps a water right of record whose place-of-use covers this parcel, including ${irr} acres of mapped irrigation${site.water.primaryIrrigationPriorityDate ? ` (mapped priority ${esc(site.water.primaryIrrigationPriorityDate)})` : ''}. This is the right as recorded, not proof of current validity, appurtenance to this lot, or that the mapped acreage falls entirely within the parcel. Confirm with OWRD and the deed.`
    } else {
      lead = 'OWRD maps a water right of record whose place-of-use covers this parcel. This is the right as recorded, not proof of current validity or appurtenance to this lot. Confirm with OWRD and the deed.'
    }
    rows.push(`<li><strong>Water rights (OWRD):</strong> ${lead}<ul class="note-list" style="margin-top:4px">${rightLines}</ul></li>`)
  }

  // Septic + permit history.
  const septic =
    site.septic.status === 'installed'
      ? `Onsite septic system${site.septic.permit ? ` (permit ${esc(site.septic.permit)})` : ' of record'}`
      : site.septic.status === 'site-evaluation-only'
        ? 'Site evaluation only. No installed system of record (buyer installs)'
        : site.septic.status === 'municipal-sewer'
          ? 'City sewer'
          : site.septic.status === 'none-found'
            ? 'No onsite-wastewater permit on the county record (buyer installs)'
            : null
  if (septic) rows.push(`<li><strong>Sewer/septic:</strong> ${septic}</li>`)
  if (site.permits?.length) rows.push(`<li><strong>Permits of record:</strong> ${site.permits.length} on file (${site.permits.slice(0, 6).map((p) => esc(p.type)).filter((v, i, a) => a.indexOf(v) === i).join(', ')})</li>`)

  // Flood + wildfire.
  if (site.flood?.zone) rows.push(`<li><strong>FEMA flood:</strong> zone ${esc(site.flood.zone)}${site.flood.inSFHA === true ? ' (Special Flood Hazard Area. Flood insurance required)' : site.flood.inSFHA === false ? ' (not a Special Flood Hazard Area)' : ''}</li>`)
  if (site.wildfireHazard) rows.push('<li><strong>Wildfire hazard zone:</strong> yes (defensible-space + build standards apply)</li>')
  if (site.publicLand) rows.push('<li><strong>Public land:</strong> parcel intersects a public-lands layer. Confirm ownership/boundary</li>')

  if (rows.length === 0) return ''
  let html = `<h3 class="subhead">Property &amp; site intelligence (county / state / FEMA records)</h3><ul class="note-list">${rows.join('')}</ul>`

  // Buildability constraints (positives + limits, plainly stated).
  if (site.constraints?.length) {
    html += `<h3 class="subhead">Buildability &amp; constraints</h3><ul class="note-list">${site.constraints.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
  }

  // Hunting / recreation (qualifying acreage only).
  if (site.hunting) {
    html += `<h3 class="subhead">Hunting, recreation &amp; landowner tags</h3><ul class="note-list">` +
      `<li><strong>Game unit:</strong> ${esc(site.hunting.gameUnit)}</li>` +
      `<li><strong>Landowner preference:</strong> ${esc(site.hunting.lop)}</li>` +
      (site.hunting.noShootingDistrict != null ? `<li><strong>No Shooting District:</strong> ${site.hunting.noShootingDistrict ? 'yes (discharge restricted)' : 'no'}</li>` : '') +
      `</ul>`
  }

  // Field-confirm caveats (facts a machine source can no longer serve).
  if (site.fieldConfirm?.length) {
    html += `<h3 class="subhead">Still to confirm</h3><ul class="note-list">${site.fieldConfirm.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
  }
  return html
}
