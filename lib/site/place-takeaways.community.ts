/**
 * The /communities/{slug} answer block for the four resort pages (SEO & AEO
 * Desk brief 2026-10-08). Identity sentences are authored registry facts
 * (acres, course, drive times). Sale, ask, cash, and type clauses bind to the
 * same fields the page already prints; a null drops its sentence, never $0.
 */
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'
import { formatPriceExact } from '@/lib/format/money'
import type { PlaceTakeawaysInput } from './place-takeaways'

function money(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return formatPriceExact(n)
}

function share(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return formatPaceShare(n)
}

function yoyFromPrior(yoy: number | null | undefined): string {
  if (yoy == null || !Number.isFinite(yoy)) return ''
  const pct = Math.round(yoy * 1000) / 10
  if (pct === 0) return ', about even with the 12 months before'
  return `, ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% from the 12 months before`
}

function identity(slug: string): string | null {
  switch (slug) {
    case 'brasada-ranch':
      return 'Brasada Ranch is a 1,800-acre resort community in Powell Butte, Oregon, about 25 minutes from Bend, built around the Brasada Canyons golf course.'
    case 'black-butte-ranch':
      return 'Black Butte Ranch is an 1,800-acre resort community 8 miles from Sisters, Oregon, with two 18-hole golf courses, Big Meadow and Glaze Meadow.'
    case 'tetherow':
      return "Tetherow is a 700-acre golf community on Bend's west side, built around a David McLay Kidd course that opened in 2008."
    case 'broken-top':
      return "Broken Top is a gated golf community on Bend's west side, established in 1992 around a private Tom Weiskopf and Jay Morrish course."
    default:
      return null
  }
}

function saleAskSentence(input: PlaceTakeawaysInput, withYoy: boolean): string | null {
  const sale = money(input.saleMedian?.value)
  const ask = money(input.medianList)
  const asOf = input.asOfLabel?.trim() || null
  const yoy = withYoy ? yoyFromPrior(input.yoyMedian) : ''
  if (sale && ask && asOf) {
    return `Single-family homes there sold for a median ${sale} over the last 12 months${yoy}, and the homes for sale on ${asOf} were asking a median ${ask}.`
  }
  if (sale) {
    return `Single-family homes there sold for a median ${sale} over the last 12 months${yoy}.`
  }
  if (ask && asOf) {
    return `The homes for sale on ${asOf} were asking a median ${ask}.`
  }
  if (ask) {
    return `The homes for sale were asking a median ${ask}.`
  }
  return null
}

function closeSentence(slug: string, input: PlaceTakeawaysInput): string | null {
  const cash = share(input.cashShare)
  const cityCash = share(input.cityCashShare)
  if (slug === 'brasada-ranch') {
    return "Ryan Realty's brokers can show you any Brasada Ranch listing or, if you're selling, read the recent sales against your home."
  }
  if (slug === 'black-butte-ranch') {
    return cash ? `${cash} of last year's buyers paid cash.` : null
  }
  if (slug === 'tetherow') {
    if (!cash) return null
    return cityCash
      ? `${cash} of last year's buyers paid cash, against ${cityCash} across Bend.`
      : `${cash} of last year's buyers paid cash.`
  }
  if (slug === 'broken-top') {
    if (input.hasTownhomes && input.hasLots) {
      return 'Townhomes and lots also come up for sale inside the gates.'
    }
    if (input.hasTownhomes) return 'Townhomes also come up for sale inside the gates.'
    if (input.hasLots) return 'Lots also come up for sale inside the gates.'
    return null
  }
  return null
}

/** Up to three standalone sentences for the four resort community pages. */
export function communityTakeaways(input: PlaceTakeawaysInput): string[] {
  const slug = input.communitySlug?.trim().toLowerCase() ?? ''
  const lead = identity(slug)
  if (!lead) return []
  const out = [lead]
  const sale = saleAskSentence(input, slug === 'black-butte-ranch')
  if (sale) out.push(sale)
  const close = closeSentence(slug, input)
  if (close) out.push(close)
  return out
}
