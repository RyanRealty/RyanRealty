/**
 * Blog MOS verdict lock.
 *
 * A months-of-supply figure may sit next to only the verdict marketVerdict()
 * assigns (≤4 seller's, above 4 and under 6 balanced, ≥6 buyer's). Fleet
 * f865ead5d3569de3da1b49d9d5fff190: the July regional report called 5.4
 * "the middle" for Prineville and "buyer's territory" for Madras in the
 * same paragraph.
 *
 * Historical June snapshots keep their numbers. This rewriter only moves
 * the narrative bucket so the same value cannot be two markets.
 */
import { marketVerdict } from '@/lib/market/classify'

export type PlaceMos = {
  place: string
  mos: number
  display: string
}

const PLACE_AT_RE = /([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+)*) at (\d+(?:\.\d+)?)/g

const TERRITORY_RE =
  /((?:[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+)* at \d+(?:\.\d+)?(?:,(?: and)?| and)?\s*)+)are firmly in buyer's territory/gi

const INLINE_VERDICT_RE =
  /(\d+(?:\.\d+)?)(\s*months(?: of supply)?)((?:<\/[^>]+>|,|\s)+a\s+)(buyer's market|seller's market|balanced market)/gi

export function publishBlogMosKind(mos: number): ReturnType<typeof marketVerdict> {
  return marketVerdict(mos)
}

export function parsePlaceMosPairs(text: string): PlaceMos[] {
  const pairs: PlaceMos[] = []
  const re = new RegExp(PLACE_AT_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const place = match[1]?.trim()
    const display = match[2]
    const mos = Number(display)
    if (!place || !Number.isFinite(mos)) continue
    pairs.push({ place, mos, display })
  }
  return pairs
}

function joinPlaceAt(items: PlaceMos[]): string {
  if (items.length === 1) {
    const only = items[0]
    return `${only.place} at ${only.display}`
  }
  if (items.length === 2) {
    return `${items[0].place} at ${items[0].display} and ${items[1].place} at ${items[1].display}`
  }
  const head = items
    .slice(0, -1)
    .map((item) => `${item.place} at ${item.display}`)
    .join(', ')
  const last = items[items.length - 1]
  return `${head}, and ${last.place} at ${last.display}`
}

function extraVerdictSentences(items: PlaceMos[]): string {
  return items
    .map((item) => {
      const verdict = publishBlogMosKind(item.mos)
      return `${item.place} at ${item.display} is a ${verdict.label}`
    })
    .join('. ')
}

export function rewriteBlogMosTerritoryClaims(html: string): string {
  return html.replace(TERRITORY_RE, (full, list: string) => {
    const pairs = parsePlaceMosPairs(list)
    if (pairs.length === 0) return full
    const buyers = pairs.filter((row) => publishBlogMosKind(row.mos).kind === 'buyers')
    const others = pairs.filter((row) => publishBlogMosKind(row.mos).kind !== 'buyers')
    if (others.length === 0) return full
    if (buyers.length === 0) return extraVerdictSentences(others)
    return `${joinPlaceAt(buyers)} are firmly in buyer's territory. ${extraVerdictSentences(others)}`
  })
}

export function rewriteBlogMosInlineVerdicts(html: string): string {
  return html.replace(INLINE_VERDICT_RE, (full, num: string, months: string, mid: string) => {
    const mos = Number(num)
    if (!Number.isFinite(mos)) return full
    const want = publishBlogMosKind(mos)
    if (want.kind === 'unknown') return full
    return `${num}${months}${mid}${want.label}`
  })
}

export function rewriteBlogMosVerdicts(html: string): string {
  if (!html.trim()) return html
  return rewriteBlogMosInlineVerdicts(rewriteBlogMosTerritoryClaims(html))
}
