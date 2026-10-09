/**
 * Authored FAQs for the four resort community pages (SEO & AEO Desk brief
 * 2026-10-08). Same array that buildCommunitySchemas turns into FAQPage, so
 * visible text and JSON-LD cannot drift. Bound figures come from the same
 * fields the generated FAQ already prints; a missing or zero value drops its
 * question or clause. Authored HOA questions replace "Does {place} have an HOA?".
 */
import { CONTACT } from '@/lib/brand/contact'
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'
import { formatPriceExact } from '@/lib/format/money'
import { publicCountState } from '@/lib/listing-status-public'
import { redirectsAwayFromSearch } from '@/lib/search/publish-place-browse-href'
import { measuredHoaSentence } from './place-hoa-measured'
import { isCommunityAnswerSlug } from './community-type-links'
import type { CommunityFaqItem } from './community-figures'

function money(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return formatPriceExact(n)
}

function share(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return formatPaceShare(n)
}

function count(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return n
}

export type StockRailRow = {
  price?: number | null
  standardStatus?: string | null
}

/** For-sale count and ask range from a type rail (lots, townhomes). */
export function stockRailAsk(rows: readonly StockRailRow[] | null | undefined): {
  forSale: number
  low: number | null
  high: number | null
} {
  if (!rows || rows.length === 0) return { forSale: 0, low: null, high: null }
  const forSaleRows = rows.filter((row) => publicCountState(row.standardStatus) !== 'under-contract')
  const prices = forSaleRows
    .map((row) => row.price)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  return {
    forSale: forSaleRows.length,
    low: prices.length > 0 ? Math.min(...prices) : null,
    high: prices.length > 0 ? Math.max(...prices) : null,
  }
}

export type CommunityAuthoredFaqInput = {
  slug: string
  name: string
  asOfLabel: string | null
  medianSale12: number | null
  medianList: number | null
  closedCount12: number | null
  saleToOriginal: number | null
  cashShare: number | null
  /** FAQ/Dataset single-family count (hud.active), not the type rail. */
  activeSfr: number | null
  lotsForSale: number
  lotsAskLow: number | null
  lotsAskHigh: number | null
  townhomesForSale: number
  hoaMonthly: number | null
  hoaAnnual: number | null
  hoaReported: number | null
  membershipOfficePhone: string | null
  membershipTierCount: number | null
}

function faq(question: string, answer: string, source?: string | null): CommunityFaqItem {
  return source ? { question, answer, source } : { question, answer }
}

function mlsSource(asOf: string | null): string {
  return asOf
    ? `regional MLS, single-family homes, as of ${asOf}`
    : 'regional MLS, single-family homes'
}

function brasadaFaqs(input: CommunityAuthoredFaqInput): CommunityFaqItem[] {
  const name = input.name
  const asOf = input.asOfLabel?.trim() || null
  const out: CommunityFaqItem[] = []
  const closed = count(input.closedCount12)
  const ofList = share(input.saleToOriginal)
  const phone = CONTACT.phoneDirect
  const agentBits = [
    `Work with a broker who reads ${name}'s own sales, not Powell Butte averages. Ryan Realty is a Bend brokerage (${phone}). We can show you any ${name} listing`,
  ]
  if (closed) {
    agentBits.push(
      `and if you're selling, we compare your home with the ${closed.toLocaleString('en-US')} single-family homes that closed here over the last 12 months`,
    )
  }
  let agent = `${agentBits[0]}${agentBits[1] ? `, ${agentBits[1]}` : ''}.`
  if (ofList) {
    agent += ` Those homes closed at a median ${ofList} of their first list price.`
  }
  out.push(faq(`How do I find a real estate agent for ${name}?`, agent, mlsSource(asOf)))

  const ask = money(input.medianList)
  const sale = money(input.medianSale12)
  const cash = share(input.cashShare)
  const priceBits: string[] = []
  if (ask) {
    priceBits.push(
      asOf
        ? `As of ${asOf}, single-family homes for sale in ${name} were asking a median ${ask}`
        : `Single-family homes for sale in ${name} were asking a median ${ask}`,
    )
  }
  if (sale) {
    priceBits.push(`Homes that actually sold over the last 12 months went for a median ${sale}`)
  }
  if (cash) {
    priceBits.push(`and ${cash} of those buyers paid cash`)
  }
  if (priceBits.length > 0) {
    const first = priceBits[0]
    const rest = priceBits.slice(1)
    const answer =
      rest.length === 0
        ? `${first}.`
        : rest.length === 1
          ? `${first}. ${rest[0]}.`
          : `${first}. ${rest[0]}, ${rest[1]}.`
    out.push(faq(`How much are homes for sale in ${name}?`, answer, mlsSource(asOf)))
  }

  const lots = count(input.lotsForSale)
  if (lots) {
    const low = money(input.lotsAskLow)
    const high = money(input.lotsAskHigh)
    const range = low && high ? `, asking from ${low} to ${high}` : ''
    const when = asOf ? `On ${asOf} there were` : 'There were'
    out.push(
      faq(
        `Are there lots for sale in ${name}?`,
        `Yes. ${when} ${lots.toLocaleString('en-US')} lots for sale in ${name}${range}.`,
        mlsSource(asOf),
      ),
    )
  }

  out.push(
    faq(
      `Where is ${name}?`,
      `${name} is in Powell Butte, Oregon, on 1,800 acres of high desert between Bend, Redmond, and Prineville. It's about 25 minutes from Bend, 22 minutes from Redmond and Redmond Airport, and 20 minutes from Prineville.`,
    ),
  )
  return out
}

function bbrFaqs(input: CommunityAuthoredFaqInput): CommunityFaqItem[] {
  const name = input.name
  const asOf = input.asOfLabel?.trim() || null
  const out: CommunityFaqItem[] = []
  const active = count(input.activeSfr)
  const ask = money(input.medianList)
  const closed = count(input.closedCount12)
  const sale = money(input.medianSale12)
  const ofList = share(input.saleToOriginal)

  const howMany: string[] = []
  if (active && ask) {
    howMany.push(
      asOf
        ? `On ${asOf}, ${active.toLocaleString('en-US')} single-family homes were for sale in ${name}, asking a median ${ask}`
        : `${active.toLocaleString('en-US')} single-family homes were for sale in ${name}, asking a median ${ask}`,
    )
  } else if (active) {
    howMany.push(
      asOf
        ? `On ${asOf}, ${active.toLocaleString('en-US')} single-family homes were for sale in ${name}`
        : `${active.toLocaleString('en-US')} single-family homes were for sale in ${name}`,
    )
  } else if (ask) {
    howMany.push(`Single-family homes for sale in ${name} were asking a median ${ask}`)
  }
  if (howMany.length > 0) {
    let answer = `${howMany[0]}.`
    if (closed && sale) {
      const listBit = ofList ? ` and a median ${ofList} of their first list price` : ''
      answer += ` Over the last 12 months ${closed.toLocaleString('en-US')} sold, at a median ${sale}${listBit}.`
    } else if (sale) {
      answer += ` Over the last 12 months they sold at a median ${sale}.`
    }
    out.push(faq(`How many homes are for sale in ${name}?`, answer, mlsSource(asOf)))
  }

  if (input.hoaMonthly && input.hoaAnnual && input.hoaReported) {
    out.push(
      faq(
        `What are HOA dues in ${name}?`,
        measuredHoaSentence(name, input.hoaMonthly, input.hoaAnnual, input.hoaReported).replace(
          'Dues vary by property. Confirm',
          'Dues vary by property, so confirm',
        ),
        `regional MLS, detached listings that reported dues since October 2023`,
      ),
    )
  }

  out.push(
    faq(
      `How far is ${name} from Sisters and Bend?`,
      'About 10 minutes (8 miles) from Sisters on US-20, 30 minutes from Redmond Airport, and about 45 minutes (30 miles) from Bend.',
    ),
  )
  return out
}

function tetherowFaqs(input: CommunityAuthoredFaqInput): CommunityFaqItem[] {
  const name = input.name
  const asOf = input.asOfLabel?.trim() || null
  const out: CommunityFaqItem[] = []
  const active = count(input.activeSfr)
  const ask = money(input.medianList)
  const closed = count(input.closedCount12)
  const sale = money(input.medianSale12)
  const ofList = share(input.saleToOriginal)

  const lead: string[] = []
  if (active && ask) {
    lead.push(
      asOf
        ? `On ${asOf}, ${active.toLocaleString('en-US')} single-family homes were for sale in ${name} at a median asking price of ${ask}`
        : `${active.toLocaleString('en-US')} single-family homes were for sale in ${name} at a median asking price of ${ask}`,
    )
  } else if (ask) {
    lead.push(
      asOf
        ? `On ${asOf}, single-family homes for sale in ${name} were asking a median ${ask}`
        : `Single-family homes for sale in ${name} were asking a median ${ask}`,
    )
  }
  if (lead.length > 0) {
    let answer = `${lead[0]}.`
    if (closed && sale) {
      const listBit = ofList ? ` and a median ${ofList} of their first list price` : ''
      answer += ` Over the last 12 months ${closed.toLocaleString('en-US')} sold, at a median ${sale}${listBit}.`
    } else if (sale) {
      answer += ` Over the last 12 months they sold at a median ${sale}.`
    }
    out.push(faq(`How much are ${name} homes for sale?`, answer, mlsSource(asOf)))
  }

  const phone = input.membershipOfficePhone?.trim() || '844-431-9701'
  const tiers = count(input.membershipTierCount) ?? 3
  const tierBit = `${name} offers ${tiers === 3 ? 'three' : String(tiers)} membership tiers, and golf membership is typically waitlisted.`
  out.push(
    faq(
      `How much does a ${name} membership cost?`,
      `${tierBit} We don't publish membership prices because the club sets them and they change. Call ${name}'s membership office at ${phone} for current rates.`,
    ),
  )

  if (input.hoaMonthly && input.hoaAnnual && input.hoaReported) {
    const base = measuredHoaSentence(name, input.hoaMonthly, input.hoaAnnual, input.hoaReported)
    const answer = base
      .replace(
        'Dues vary by property. Confirm the current amount with the association before you buy.',
        'Club membership is separate. Confirm the current HOA amount with the association before you buy.',
      )
    out.push(
      faq(
        `What are ${name} HOA dues?`,
        answer,
        'regional MLS, detached listings that reported dues since October 2023',
      ),
    )
  }

  out.push(
    faq(
      `Is ${name} in Bend?`,
      `Yes. ${name} is on Bend's west side, about 7 minutes from the Old Mill District, 10 minutes from Shevlin Park, and 25 minutes from Mt. Bachelor. Schools are Bend-La Pine: William E Miller Elementary, Cascade or Pacific Crest Middle, and Summit High.`,
    ),
  )
  return out
}

function brokenTopFaqs(input: CommunityAuthoredFaqInput): CommunityFaqItem[] {
  const name = input.name
  const asOf = input.asOfLabel?.trim() || null
  const out: CommunityFaqItem[] = []
  const ask = money(input.medianList)
  const closed = count(input.closedCount12)
  const sale = money(input.medianSale12)
  const ofList = share(input.saleToOriginal)

  if (ask) {
    let answer = asOf
      ? `On ${asOf}, single-family homes for sale in ${name} were asking a median ${ask}.`
      : `Single-family homes for sale in ${name} were asking a median ${ask}.`
    if (closed && sale) {
      const listBit = ofList ? ` and a median ${ofList} of their first list price` : ''
      answer += ` Over the last 12 months ${closed.toLocaleString('en-US')} sold, at a median ${sale}${listBit}.`
    } else if (sale) {
      answer += ` Over the last 12 months they sold at a median ${sale}.`
    }
    out.push(faq(`How much are ${name} homes for sale?`, answer, mlsSource(asOf)))
  }

  const towns = count(input.townhomesForSale)
  const lots = count(input.lotsForSale)
  if (towns || lots) {
    const when = asOf ? `On ${asOf} ${name} had` : `${name} had`
    const bits: string[] = []
    if (towns) {
      bits.push(
        `${towns.toLocaleString('en-US')} townhome${towns === 1 ? '' : 's'} or condo${towns === 1 ? '' : 's'}`,
      )
    }
    if (lots) {
      bits.push(`${lots.toLocaleString('en-US')} lot${lots === 1 ? '' : 's'} for sale`)
    }
    let mid: string
    if (bits.length === 2) {
      mid = `${bits[0]} and ${bits[1]}`
      // "6 townhomes or condos and 1 lot for sale"
    } else if (towns) {
      mid = `${bits[0]} for sale`
    } else {
      mid = bits[0]!
    }
    out.push(
      faq(
        `Are there townhomes or lots for sale in ${name}?`,
        `Yes. ${when} ${mid} alongside its houses.`,
        mlsSource(asOf),
      ),
    )
  }

  if (input.hoaMonthly && input.hoaAnnual && input.hoaReported) {
    const base = measuredHoaSentence(name, input.hoaMonthly, input.hoaAnnual, input.hoaReported)
    const phone = input.membershipOfficePhone?.trim() || '541.383.8200'
    const answer = base.replace(
      'Dues vary by property. Confirm the current amount with the association before you buy.',
      `Golf club membership is separate. The club's membership office is ${phone}.`,
    )
    out.push(
      faq(
        `What are ${name} HOA dues?`,
        answer,
        'regional MLS, detached listings that reported dues since October 2023',
      ),
    )
  }

  out.push(
    faq(
      `Is ${name} gated?`,
      `Yes. ${name} is a private, gated community in southwest Bend off Century Drive, about 5 minutes from the Old Mill District and 25 minutes from Mt. Bachelor.`,
    ),
  )
  return out
}

export function communityAuthoredFaqs(input: CommunityAuthoredFaqInput): CommunityFaqItem[] {
  if (!isCommunityAnswerSlug(input.slug) || !input.name.trim()) return []
  switch (input.slug) {
    case 'brasada-ranch':
      return brasadaFaqs(input)
    case 'black-butte-ranch':
      return bbrFaqs(input)
    case 'tetherow':
      return tetherowFaqs(input)
    case 'broken-top':
      return brokenTopFaqs(input)
    default:
      return []
  }
}

export function dropsGeneratedHoaQuestion(authored: readonly CommunityFaqItem[]): boolean {
  return authored.some((item) => /hoa/i.test(item.question))
}

export function isGeneratedHoaQuestion(question: string): boolean {
  return question.trim().toLowerCase().endsWith('have an hoa?')
}

/** Market-report door for the answer-block source line. */
export function communityAnswerMarketLink(input: {
  name: string
  cityName: string
  citySlug: string | null
  communityMarketHref: string
  cityReportHref: string
}): { label: string; href: string } | null {
  if (!redirectsAwayFromSearch(input.communityMarketHref)) {
    return { label: `${input.name} market report`, href: input.communityMarketHref }
  }
  if (input.cityReportHref.trim()) {
    return { label: `${input.cityName} market report`, href: input.cityReportHref }
  }
  return null
}
