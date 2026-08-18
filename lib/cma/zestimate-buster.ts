/**
 * Zestimate buster — grade Zillow's printed number against closed MLS sales.
 *
 * Zillow is where most owners first see a value. This unit does not invent a
 * second price. It takes their published figure and cards, checks each card
 * against Oregon Datashare, and says whether that figure sits in our range.
 */

import { escapeHtml, usd } from '@/lib/cma/render-blocks'

const esc = escapeHtml
const STALE_MONTHS = 6
const SIZE_OFF_PCT = 0.25
const YEAR_OFF = 15
/** Compare Zillow to the recommended list, not the top of our value band. */
const LIST_BAND = 0.03

export type ZillowPublishedComp = {
  address: string
  soldPrice: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  mlsNumber: string | null
  zillowStatus: 'sold' | 'pending' | 'unknown'
}

export type ZillowSnapshot = {
  url: string
  fetchedAt: string
  zestimate: number
  rangeLow: number | null
  rangeHigh: number | null
  publishedComps: ZillowPublishedComp[]
}

export type MlsCompFact = {
  mlsNumber: string
  address: string
  closePrice: number | null
  closeDate: string | null
  status: string
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
  subdivision: string | null
}

export type CompGrade = 'usable' | 'stale' | 'pending-as-sold' | 'wrong-product' | 'unverified'

export type GradedZillowComp = {
  address: string
  grade: CompGrade
  line: string
}

export type ZestimateVerdict = 'supports' | 'high' | 'low'

export type ZestimateBust = {
  zestimate: number
  rangeLow: number | null
  rangeHigh: number | null
  ourList: number
  gapToList: number
  stickerMean: number | null
  grades: GradedZillowComp[]
  usableCount: number
  dirtyCount: number
  verdict: ZestimateVerdict
  heading: string
  lede: string
  reasons: string[]
  source: string
  url: string
  fetchedAt: string
}

export type SubjectSize = {
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
}

function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T12:00:00Z`)
  const b = new Date(`${toIso.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
}

function isClosed(status: string, closePrice: number | null, closeDate: string | null): boolean {
  if (closePrice == null || closePrice <= 0 || !closeDate) return false
  return /closed/i.test(status)
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((a, n) => a + n, 0) / values.length)
}

export function streetKey(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(
      /\b(northeast|northwest|southeast|southwest|street|court|road|avenue|drive|lane|boulevard|ne|nw|se|sw|st|ct|rd|ave|dr|ln|blvd|n|s|e|w)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchMlsFact(
  card: ZillowPublishedComp,
  facts: readonly MlsCompFact[],
): MlsCompFact | undefined {
  if (card.mlsNumber) {
    const byMls = facts.find((f) => f.mlsNumber === card.mlsNumber)
    if (byMls) return byMls
  }
  const key = streetKey(card.address)
  if (!key) return undefined
  return facts.find((f) => streetKey(f.address) === key)
}

export function mlsFactsFromPricedComps(
  comps: readonly {
    mlsNumber?: string | null
    address: string
    closePrice: number
    closeDate: string
    beds?: number | null
    baths?: number | null
    sqft: number
    yearBuilt?: number | null
    subdivision?: string | null
  }[],
): MlsCompFact[] {
  return comps
    .filter((c) => c.closePrice > 0 && Boolean(c.closeDate))
    .map((c) => ({
      mlsNumber: (c.mlsNumber ?? '').trim(),
      address: c.address,
      closePrice: c.closePrice,
      closeDate: c.closeDate.slice(0, 10),
      status: 'Closed',
      beds: c.beds ?? null,
      baths: c.baths ?? null,
      sqft: c.sqft,
      yearBuilt: c.yearBuilt ?? null,
      subdivision: c.subdivision ?? null,
    }))
}

export function mergeMlsFacts(...groups: readonly (readonly MlsCompFact[])[]): MlsCompFact[] {
  const byMls = new Map<string, MlsCompFact>()
  const noMls: MlsCompFact[] = []
  for (const group of groups) {
    for (const fact of group) {
      if (fact.mlsNumber) byMls.set(fact.mlsNumber, fact)
      else noMls.push(fact)
    }
  }
  return [...byMls.values(), ...noMls]
}

function gradeComp(
  card: ZillowPublishedComp,
  mls: MlsCompFact | undefined,
  subject: SubjectSize,
  asOf: string,
): GradedZillowComp {
  const address = card.address
  if (!mls) {
    return {
      address,
      grade: 'unverified',
      line: `Zillow printed ${card.soldPrice != null ? usd(card.soldPrice) : 'a sale'} at ${address}. We could not confirm a matching closed sale on the MLS.`,
    }
  }
  if (!isClosed(mls.status, mls.closePrice, mls.closeDate)) {
    return {
      address,
      grade: 'pending-as-sold',
      line: `${address} is ${mls.status.toLowerCase()} on the MLS. Zillow labeled it sold.`,
    }
  }
  const bedsOff = subject.beds != null && mls.beds != null && Math.abs(mls.beds - subject.beds) >= 1
  const yearOff =
    subject.yearBuilt != null && mls.yearBuilt != null && Math.abs(mls.yearBuilt - subject.yearBuilt) > YEAR_OFF
  const sizeOff =
    subject.sqft != null &&
    subject.sqft > 0 &&
    mls.sqft != null &&
    Math.abs(mls.sqft - subject.sqft) / subject.sqft > SIZE_OFF_PCT
  if (bedsOff || yearOff || sizeOff) {
    return {
      address,
      grade: 'wrong-product',
      line: `${address} is a different house: ${mls.beds ?? '?'} bedroom, ${mls.sqft ?? '?'} square feet, built ${mls.yearBuilt ?? '?'}.`,
    }
  }
  const age = monthsBetween(mls.closeDate!, asOf)
  if (age > STALE_MONTHS) {
    return {
      address,
      grade: 'stale',
      line: `${address} closed ${age} months ago${mls.closePrice != null ? ` at ${usd(mls.closePrice)}` : ''}.`,
    }
  }
  return {
    address,
    grade: 'usable',
    line: `${address} is a closed sale we can use${mls.closePrice != null ? `, ${usd(mls.closePrice)}` : ''}.`,
  }
}

export function bustZestimate(opts: {
  snapshot: ZillowSnapshot
  mls: MlsCompFact[]
  subject: SubjectSize
  recommended: number
  conservative: number
  highEnd: number
  asOf: string
  ownerNotes?: readonly string[]
}): ZestimateBust | null {
  const z = opts.snapshot.zestimate
  if (!(z > 0) || !(opts.recommended > 0)) return null
  const grades = opts.snapshot.publishedComps.map((card) =>
    gradeComp(card, matchMlsFact(card, opts.mls), opts.subject, opts.asOf),
  )
  const usableCount = grades.filter((g) => g.grade === 'usable').length
  const dirtyCount = grades.filter((g) => g.grade !== 'usable').length
  const stickerMean = mean(
    opts.snapshot.publishedComps.map((c) => c.soldPrice).filter((n): n is number => n != null && n > 0),
  )
  const gapToList = z - opts.recommended
  const band = opts.recommended * LIST_BAND
  const verdict: ZestimateVerdict =
    Math.abs(gapToList) <= band ? 'supports' : gapToList > 0 ? 'high' : 'low'
  const heading =
    verdict === 'supports'
      ? 'Zillow sits near this list'
      : verdict === 'high'
        ? `Zillow is ${usd(gapToList)} above this list`
        : `Zillow is ${usd(Math.abs(gapToList))} under this list`
  const lede = `Zillow prints ${usd(z)}. The list on this report is ${usd(opts.recommended)}.`
  const reasons: string[] = []
  if (stickerMean != null && opts.snapshot.publishedComps.length >= 3) {
    const delta = Math.abs(stickerMean - z)
    if (delta / z <= 0.02) {
      reasons.push(
        `Zillow printed ${opts.snapshot.publishedComps.length} prices. The average of those stickers, unadjusted, is ${usd(stickerMean)}.`,
      )
      if (verdict !== 'supports') {
        reasons.push(
          'They did not adjust those sales for living area, when they closed, baths, or concessions. A list at that figure treats this house as if it already sold at the printed stickers.',
        )
      }
    }
  }
  for (const g of grades) {
    if (g.grade !== 'usable') reasons.push(g.line)
  }
  if (usableCount > 0 && dirtyCount > 0) {
    reasons.push(
      `${usableCount} of the ${grades.length} houses they showed are closed sales that match this home. Those are the ones that set our number.`,
    )
  }
  if (opts.snapshot.rangeLow != null && verdict === 'high' && opts.snapshot.rangeLow >= opts.conservative) {
    reasons.push(
      `Zillow's own floor is ${usd(opts.snapshot.rangeLow)}, which is the first number that touches this list.`,
    )
  }
  const notes = (opts.ownerNotes ?? []).map((n) => n.trim()).filter(Boolean)
  if (notes.length > 0) {
    reasons.push(`The work you reported is not on the public listing Zillow is reading: ${notes.join('; ')}.`)
  }
  return {
    zestimate: z,
    rangeLow: opts.snapshot.rangeLow,
    rangeHigh: opts.snapshot.rangeHigh,
    ourList: opts.recommended,
    gapToList,
    stickerMean,
    grades,
    usableCount,
    dirtyCount,
    verdict,
    heading,
    lede,
    reasons,
    source: `Zillow home details page, ${opts.snapshot.fetchedAt}. Each printed sale checked against Oregon Datashare MLS.`,
    url: opts.snapshot.url,
    fetchedAt: opts.snapshot.fetchedAt,
  }
}

export function renderZestimateBustPrintHtml(bust: ZestimateBust | null | undefined): string {
  if (!bust) return ''
  const rows = bust.grades
    .map((g) => `<tr><td>${esc(g.address)}</td><td>${esc(g.line)}</td></tr>`)
    .join('')
  const story = bust.reasons.filter((r) => !bust.grades.some((g) => r.includes(g.address)))
  const reasons = story.map((r) => `<li>${esc(r)}</li>`).join('')
  const gapLabel =
    bust.verdict === 'supports' ? 'near this list' : bust.verdict === 'high' ? 'above this list' : 'under this list'
  return `
  <h2 class="section">${esc(bust.heading)}</h2>
  <div class="stat-strip is-3">
    <div class="stat"><div class="lbl">Zillow</div><div class="val">${usd(bust.zestimate)}</div></div>
    <div class="stat"><div class="lbl">This list</div><div class="val">${usd(bust.ourList)}</div></div>
    <div class="stat"><div class="lbl">${esc(gapLabel)}</div><div class="val">${usd(Math.abs(bust.gapToList))}</div></div>
  </div>
  <p>${esc(bust.lede)}</p>
  ${
    bust.rangeLow != null && bust.rangeHigh != null
      ? `<p>Zillow printed a range of ${usd(bust.rangeLow)} to ${usd(bust.rangeHigh)}.</p>`
      : ''
  }
  ${reasons ? `<ul class="note-list">${reasons}</ul>` : ''}
  ${
    rows
      ? `<table class="kv is-wide"><thead><tr><th>House Zillow showed</th><th>What the MLS says</th></tr></thead><tbody>${rows}</tbody></table>`
      : ''
  }
  <p class="small">${esc(bust.source)}</p>`
}

export function renderZestimateBustSceneHtml(bust: ZestimateBust | null | undefined): string {
  if (!bust) return ''
  const reasons = bust.reasons
    .map((r) => `<div class="like r"><div class="like-d">${esc(r)}</div></div>`)
    .join('')
  return `
  <section class="sc sc-cream" id="zillow">
    <div class="in">
      <div class="kick r">What Zillow printed</div>
      <h2 class="h r">${esc(bust.heading)}</h2>
      <p class="lede r">${esc(bust.lede)}</p>
      <div class="stat3 r">
        <div class="st"><div class="st-n">${usd(bust.zestimate)}</div><div class="st-l">Zillow</div></div>
        <div class="st"><div class="st-n">${usd(bust.ourList)}</div><div class="st-l">this list</div></div>
        <div class="st"><div class="st-n">${usd(Math.abs(bust.gapToList))}</div><div class="st-l">${
          bust.verdict === 'supports' ? 'inside the range' : bust.verdict === 'high' ? 'above this list' : 'under this list'
        }</div></div>
      </div>
      ${reasons ? `<div class="like-grid">${reasons}</div>` : ''}
      <p class="src r">${esc(bust.source)}</p>
    </div>
  </section>`
}
