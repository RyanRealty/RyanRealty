/**
 * FSBO / expired CMA first-touch templates (research lock).
 *
 * Template IDs:
 * - fsbo_cma_first_touch_v1 - email with PDF attached
 * - cma_cover_intro_v1 - PDF/web cover intro
 * - cma_bottom_why_list_v1 - bottom "why list with a realtor" block
 *
 * Source: docs/research/fsbo-cma-first-touch-templates.md
 *
 * Rules:
 * - Never bare "CMA" in email subject.
 * - Missing fact → omit the clause. Never invent prices or stats.
 * - National share/% only (NAR 2025 + Zillow CHTR 2024). No national $ gap.
 * - Zero mannered prose. Not "net more."
 * - Navy #102742 / cream #faf8f4 on surfaces that take brand color.
 */

export const FSBO_CMA_FIRST_TOUCH_V1 = 'fsbo_cma_first_touch_v1' as const
export const CMA_COVER_INTRO_V1 = 'cma_cover_intro_v1' as const
export const CMA_BOTTOM_WHY_LIST_V1 = 'cma_bottom_why_list_v1' as const

export type FsboCmaTemplateId =
 | typeof FSBO_CMA_FIRST_TOUCH_V1
 | typeof CMA_COVER_INTRO_V1
 | typeof CMA_BOTTOM_WHY_LIST_V1

/** Locked national shares - config until NAR/Zillow refresh. */
export const FSBO_CMA_STATS = {
 fsboShare: '5%',
 sellerAgentShare: '91%',
 buyerAgentShare: '88%',
 fsboKnewBuyerShare: '60%',
 tryThenHireShare: '21%',
 narSourceYear: 2025,
 zillowSourceYear: 2024,
 narFootnote:
 'National Association of REALTORS®, 2025 Profile of Home Buyers and Sellers.',
 zillowFootnote:
 "Zillow Group Consumer Housing Trends Report 2024 (as reported in Zillow's FSBO seller guide).",
 retrievedOn: '2026-09-03',
 narSourceUrl:
 'https://www.nar.realtor/news/economists-outlook/top-10-takeaways-from-nars-2025-profile-of-home-buyers-and-sellers',
 zillowSourceUrl:
 'https://www.zillow.com/learn/how-to-sell-your-house-for-sale-by-owner/',
} as const

export const FSBO_CMA_BRAND = {
 navy: '#102742',
 cream: '#faf8f4',
} as const

export type FsboCmaMergeFacts = {
 ownerFirstName: string | null
 ownerFullName: string | null
 propertyAddress: string | null
 propertyStreet: string | null
 propertyCity: string | null
 priceRangeLow: string | null
 priceRangeHigh: string | null
 suggestedListPrice: string | null
 currentAskPrice: string | null
 reportDate: string | null
 calendarLink: string | null
 agentName: string | null
 agentPhone: string | null
 agentEmail: string | null
 brokerageDisclosureLine: string | null
 cmaPdfUrl: string | null
 leadType: 'fsbo' | 'expired' | null
 /** Optional overrides; defaults come from FSBO_CMA_STATS. */
 statFsboShare?: string | null
 statSellerAgentShare?: string | null
 statBuyerAgentShare?: string | null
 statFsboKnewBuyerShare?: string | null
 statTryThenHireShare?: string | null
}

export type FsboCmaEmailSubjectOption = 1 | 2 | 3

function trim(v: string | null | undefined): string | null {
 const s = (v ?? '').trim()
 return s || null
}

function moneyOrNull(v: string | null | undefined): string | null {
 return trim(v)
}

/** Subject options - never bare CMA. */
export function fsboCmaFirstTouchSubjects(facts: Pick<FsboCmaMergeFacts, 'propertyAddress' | 'propertyStreet'>): {
 option1: string
 option2: string
 option3: string
} {
 const address = trim(facts.propertyAddress) ?? 'your home'
 const street = trim(facts.propertyStreet) ?? address
 return {
 option1: `Pricing report for ${address}`,
 option2: `Nearby sales vs your ask - ${street}`,
 option3: `Market snapshot: ${address}`,
 }
}

export function pickFsboCmaFirstTouchSubject(
 facts: Pick<FsboCmaMergeFacts, 'propertyAddress' | 'propertyStreet'>,
 option: FsboCmaEmailSubjectOption = 1,
): string {
 const s = fsboCmaFirstTouchSubjects(facts)
 if (option === 2) return s.option2
 if (option === 3) return s.option3
 return s.option1
}

/**
 * Email body for fsbo_cma_first_touch_v1.
 * Omits suggested-list fragment when missing. Requires PDF attachment at send.
 */
export function composeFsboCmaFirstTouchEmail(facts: FsboCmaMergeFacts): {
 templateId: typeof FSBO_CMA_FIRST_TOUCH_V1
 subject: string
 body: string
 requiresPdfAttachment: true
} {
 const first = trim(facts.ownerFirstName) ?? 'there'
 const address = trim(facts.propertyAddress) ?? 'your home'
 const city = trim(facts.propertyCity) ?? 'the area'
 const lo = moneyOrNull(facts.priceRangeLow)
 const hi = moneyOrNull(facts.priceRangeHigh)
 const suggested = moneyOrNull(facts.suggestedListPrice)
 const calendar = trim(facts.calendarLink)
 const phone = trim(facts.agentPhone)
 const email = trim(facts.agentEmail)
 const agent = trim(facts.agentName) ?? 'Ryan Realty'
 const disclosure = trim(facts.brokerageDisclosureLine)

 const rangeLine =
 lo && hi
 ? suggested
 ? `Attached PDF. Short version: based on those comps, a realistic list range looks like ${lo}-${hi}. Suggested list: ${suggested}.`
 : `Attached PDF. Short version: based on those comps, a realistic list range looks like ${lo}-${hi}.`
 : 'Attached PDF - recent nearby sales and current competition, with a suggested asking range.'

 const contactBits = [phone, email].filter(Boolean).join(' · ')
 const bookLine = calendar
 ? `Book here: ${calendar}`
 : 'Reply with a time that works.'
 const orReply =
 calendar && contactBits
 ? `Or reply with a time that works. ${contactBits}`
 : calendar
 ? 'Or reply with a time that works.'
 : contactBits
 ? contactBits
 : null

 const lines = [
 `Hi ${first},`,
 '',
 `I put together a pricing report for ${address} - a side-by-side of recent nearby sales and current competition, with a suggested asking range.`,
 '',
 rangeLine,
 '',
 `Most buyers shopping ${city} work with an agent and compare every listing against recent solds. If your ask sits outside what those solds support, showings and offers usually stall.`,
 '',
 `If you want, I can walk you through the comps on a short call and talk through what a Ryan Realty listing would look like for this address - MLS exposure, buyer outreach, and the Oregon disclosure/paperwork side.`,
 '',
 bookLine,
 orReply,
 '',
 agent,
 'Ryan Realty',
 phone,
 email,
 disclosure,
 ]
 .filter((l) => l !== null)
 .join('\n')
 .replace(/\n{3,}/g, '\n\n')
 .trim()

 return {
 templateId: FSBO_CMA_FIRST_TOUCH_V1,
 subject: pickFsboCmaFirstTouchSubject(facts, 1),
 body: lines,
 requiresPdfAttachment: true,
 }
}

/** Cover / intro blurb - PDF top, web hero, or email preamble. */
export function composeCmaCoverIntro(facts: FsboCmaMergeFacts): {
 templateId: typeof CMA_COVER_INTRO_V1
 title: string
 preparedLine: string | null
 placeLine: string | null
 body: string
 suggestedLine: string | null
 rangeLine: string | null
 askLine: string | null
 questionsLine: string | null
 fullText: string
} {
 const address = trim(facts.propertyAddress) ?? 'this home'
 const owner = trim(facts.ownerFullName)
 const reportDate = trim(facts.reportDate)
 const city = trim(facts.propertyCity)
 const suggested = moneyOrNull(facts.suggestedListPrice)
 const lo = moneyOrNull(facts.priceRangeLow)
 const hi = moneyOrNull(facts.priceRangeHigh)
 const ask = moneyOrNull(facts.currentAskPrice)
 const agent = trim(facts.agentName)
 const phone = trim(facts.agentPhone)
 const calendar = trim(facts.calendarLink)

 const title = `Pricing report for ${address}`
 const preparedLine =
 owner && reportDate
 ? `Prepared for ${owner} · ${reportDate}`
 : owner
 ? `Prepared for ${owner}`
 : reportDate
 ? reportDate
 : null
 const placeLine = city ? `${city}, Oregon` : null

 const body = city
 ? `This is a comparative market analysis - a pricing report based on recent nearby sales and active listings similar to your home. It is not an appraisal. Lenders order appraisals after an offer. This report is for setting an asking price that matches what buyers in ${city} are actually paying.`
 : `This is a comparative market analysis - a pricing report based on recent nearby sales and active listings similar to your home. It is not an appraisal. Lenders order appraisals after an offer. This report is for setting an asking price that matches what buyers are actually paying.`

 const suggestedLine = suggested ? `Suggested list price: ${suggested}` : null
 const rangeLine = lo && hi ? `Suggested range: ${lo} - ${hi}` : null
 const askLine = ask
 ? `Inside: sold comps, active competition, adjustments for differences, and how your current ask (${ask}) sits against the set.`
 : `Inside: sold comps, active competition, adjustments for differences, and how your ask sits against the set.`

 const qBits = [agent, phone, calendar].filter(Boolean)
 const questionsLine = qBits.length
 ? `Questions on any line? ${qBits.join(' · ')}`
 : null

 const fullText = [title, preparedLine, placeLine, '', body, '', suggestedLine, rangeLine, '', askLine, '', questionsLine]
 .filter((l) => l !== null)
 .join('\n')
 .replace(/\n{3,}/g, '\n\n')
 .trim()

 return {
 templateId: CMA_COVER_INTRO_V1,
 title,
 preparedLine,
 placeLine,
 body,
 suggestedLine,
 rangeLine,
 askLine,
 questionsLine,
 fullText,
 }
}

function statsFromFacts(facts: FsboCmaMergeFacts) {
 return {
 fsbo: trim(facts.statFsboShare) ?? FSBO_CMA_STATS.fsboShare,
 seller: trim(facts.statSellerAgentShare) ?? FSBO_CMA_STATS.sellerAgentShare,
 buyer: trim(facts.statBuyerAgentShare) ?? FSBO_CMA_STATS.buyerAgentShare,
 knew: trim(facts.statFsboKnewBuyerShare) ?? FSBO_CMA_STATS.fsboKnewBuyerShare,
 tryHire: trim(facts.statTryThenHireShare) ?? FSBO_CMA_STATS.tryThenHireShare,
 }
}

/** Bottom why-list block - share/% only; OR disclosure; CTA listing conversation. */
export function composeCmaBottomWhyList(facts: FsboCmaMergeFacts): {
 templateId: typeof CMA_BOTTOM_WHY_LIST_V1
 heading: string
 bodyHtml: string
 bodyText: string
 footnotes: string
} {
 const s = statsFromFacts(facts)
 const address = trim(facts.propertyAddress) ?? 'this address'
 const calendar = trim(facts.calendarLink)
 const phone = trim(facts.agentPhone)
 const email = trim(facts.agentEmail)
 const agent = trim(facts.agentName)
 const ctaBits = [calendar, phone, email].filter(Boolean).join(' · ')

 const heading = 'Why most sellers list with a realtor'

 const bodyText = [
 heading,
 '',
 'Pricing is one job. Getting the home in front of the buyers who can close - and managing offers, inspections, and Oregon disclosures - is the rest.',
 '',
 'National picture (shares only):',
 `• ${s.fsbo} of recent sellers sold FSBO - an all-time low.¹`,
 `• ${s.seller} of sellers used a real estate agent or broker.¹`,
 `• ${s.buyer} of buyers purchased through an agent or broker.¹`,
 `• ${s.knew} of FSBO sellers already knew their buyer (friend, relative, neighbor, tenant).¹ If you don't already have that buyer, you are competing for the other group.`,
 `• ${s.tryHire} of sellers who start on their own later hire an agent.²`,
 '',
 "Oregon note: selling FSBO does not remove the Seller's Property Disclosure Statement requirement for most 1-4 unit residential sales. You still complete and deliver it to each buyer who makes a written offer (ORS 105.464, 105.465).",
 '',
 `What a Ryan Realty listing adds for ${address}:`,
 '• MLS + portal distribution so agent-represented buyers can find the home',
 '• Pricing and repositioning against live comps (not a one-time PDF)',
 '• Showing coordination and offer management',
 '• Contract, disclosure, and closing coordination with your escrow/title team',
 '',
 'Next step: walk these comps together and decide if listing with Ryan Realty is the better path for this sale.',
 ctaBits || null,
 agent ? `${agent}, Ryan Realty` : 'Ryan Realty',
 ]
 .filter((l) => l !== null)
 .join('\n')

 const footnotes = `¹ ${FSBO_CMA_STATS.narFootnote}\n² ${FSBO_CMA_STATS.zillowFootnote}`

 const esc = (t: string) =>
 t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

 const bodyHtml = `
 <section class="cma-why-list" data-template="${CMA_BOTTOM_WHY_LIST_V1}" style="background:${FSBO_CMA_BRAND.cream};color:${FSBO_CMA_BRAND.navy}">
 <h2 class="section">${esc(heading)}</h2>
 <p>Pricing is one job. Getting the home in front of the buyers who can close - and managing offers, inspections, and Oregon disclosures - is the rest.</p>
 <h3 class="subhead">National picture (shares only)</h3>
 <ul class="note-list">
 <li>${esc(s.fsbo)} of recent sellers sold FSBO - an all-time low.<sup>1</sup></li>
 <li>${esc(s.seller)} of sellers used a real estate agent or broker.<sup>1</sup></li>
 <li>${esc(s.buyer)} of buyers purchased through an agent or broker.<sup>1</sup></li>
 <li>${esc(s.knew)} of FSBO sellers already knew their buyer (friend, relative, neighbor, tenant).<sup>1</sup> If you don't already have that buyer, you are competing for the other group.</li>
 <li>${esc(s.tryHire)} of sellers who start on their own later hire an agent.<sup>2</sup></li>
 </ul>
 <p><strong>Oregon note:</strong> selling FSBO does not remove the Seller's Property Disclosure Statement requirement for most 1-4 unit residential sales. You still complete and deliver it to each buyer who makes a written offer (ORS 105.464, 105.465).</p>
 <h3 class="subhead">What a Ryan Realty listing adds for ${esc(address)}</h3>
 <ul class="note-list">
 <li>MLS + portal distribution so agent-represented buyers can find the home</li>
 <li>Pricing and repositioning against live comps (not a one-time PDF)</li>
 <li>Showing coordination and offer management</li>
 <li>Contract, disclosure, and closing coordination with your escrow/title team</li>
 </ul>
 <p class="cta-lead">Next step: walk these comps together and decide if listing with Ryan Realty is the better path for this sale.</p>
 ${ctaBits ? `<p>${esc(ctaBits)}</p>` : ''}
 <p>${esc(agent ? `${agent}, Ryan Realty` : 'Ryan Realty')}</p>
 <div class="trace"><div class="t-hd">Sources</div>${esc(footnotes).replace(/\n/g, '<br/>')}</div>
 </section>`.trim()

 return {
 templateId: CMA_BOTTOM_WHY_LIST_V1,
 heading,
 bodyHtml,
 bodyText,
 footnotes,
 }
}

/** CRM seed body uses %tokens% so Settings merge still works. */
export const FSBO_CMA_FIRST_TOUCH_EMAIL_SEED = {
 key: FSBO_CMA_FIRST_TOUCH_V1,
 channel: 'email' as const,
 name: 'FSBO CMA first touch - pricing report + PDF',
 category: 'fsbo-seller',
 subject: 'Pricing report for %address%',
 body: [
 'Hi %contact_first_name%,',
 '',
 'I put together a pricing report for %address% - a side-by-side of recent nearby sales and current competition, with a suggested asking range.',
 '',
 'Attached PDF. Short version: based on those comps, a realistic list range looks like %customPriceRangeLow%-%customPriceRangeHigh%. Suggested list: %customSuggestedListPrice%.',
 '',
 'Most buyers shopping %contact_address_city% work with an agent and compare every listing against recent solds. If your ask sits outside what those solds support, showings and offers usually stall.',
 '',
 'If you want, I can walk you through the comps on a short call and talk through what a Ryan Realty listing would look like for this address - MLS exposure, buyer outreach, and the Oregon disclosure/paperwork side.',
 '',
 'Book here: %calendar_link%',
 'Or reply with a time that works. %agent_phone% · %agent_email%',
 '',
 '%agent_name%',
 'Ryan Realty',
 '%agent_phone%',
 '%agent_email%',
 ].join('\n'),
}

export function emptyFsboCmaMergeFacts(): FsboCmaMergeFacts {
 return {
 ownerFirstName: null,
 ownerFullName: null,
 propertyAddress: null,
 propertyStreet: null,
 propertyCity: null,
 priceRangeLow: null,
 priceRangeHigh: null,
 suggestedListPrice: null,
 currentAskPrice: null,
 reportDate: null,
 calendarLink: null,
 agentName: null,
 agentPhone: null,
 agentEmail: null,
 brokerageDisclosureLine: null,
 cmaPdfUrl: null,
 leadType: null,
 }
}

/** Format a USD number for merge display; null stays null (omit). */
export function formatFsboCmaUsd(n: number | null | undefined): string | null {
 if (n == null || !Number.isFinite(n) || n <= 0) return null
 return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * CMA product bar - required surfaces when data exists; miss → omit, never invent.
 * Callers attach these into opinion/cover pages.
 */
export type CmaSaleClusterBand = {
  loLabel: string
  hiLabel: string
  saleCount: number
}

export type CmaProductBar = {
  marketDataLine: string | null
  placeLinks: Array<{ label: string; href: string }>
  competitionSummary: string | null
  priceBandSummary: string | null
  /** Grouped closed-sale clusters (omit when empty). */
  saleClusterBands: CmaSaleClusterBand[]
}

/**
 * Bucket closed sale prices into $50k bands and keep clusters with 2+ sales
 * (or the single densest band). Miss / empty → []. Never invents prices.
 */
export function clusterSalePriceBands(
  prices: readonly number[],
  width = 50_000,
): CmaSaleClusterBand[] {
  const clean = prices.filter((n) => Number.isFinite(n) && n > 0)
  if (clean.length === 0) return []
  const buckets = new Map<number, number>()
  for (const p of clean) {
    const lo = Math.floor(p / width) * width
    buckets.set(lo, (buckets.get(lo) ?? 0) + 1)
  }
  const ranked = [...buckets.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  const kept = ranked.filter(([, c]) => c >= 2)
  const use = kept.length > 0 ? kept.slice(0, 4) : ranked.slice(0, 1)
  return use
    .sort((a, b) => a[0] - b[0])
    .map(([lo, saleCount]) => ({
      loLabel: formatFsboCmaUsd(lo) ?? `$${lo}`,
      hiLabel: formatFsboCmaUsd(lo + width - 1) ?? `$${lo + width - 1}`,
      saleCount,
    }))
}

export function buildCmaProductBar(input: {
  marketGeoLabel?: string | null
  marketSource?: string | null
  /** True only when MarketPulse / Oregon Data Share row actually loaded. */
  marketDataPresent: boolean
  placeLinks?: Array<{ label: string; href: string }> | null
  neighborhood?: { label: string; href: string } | null
  community?: { label: string; href: string } | null
  subdivision?: { label: string; href: string } | null
  /** Nearby ACTIVE listings in the subject band (not city-wide Active Now). */
  nearbyActiveCount?: number | null
  /** Optional named nearby actives for the competition line. */
  nearbyActiveLabels?: readonly string[] | null
  recentSoldCount?: number | null
  priceBandLo?: string | null
  priceBandHi?: string | null
  priceBandActiveCount?: number | null
  saleClusterBands?: CmaSaleClusterBand[] | null
  /** Closed sale prices used to build clusters when saleClusterBands omitted. */
  closedSalePrices?: readonly number[] | null
}): CmaProductBar {
  const marketDataLine = input.marketDataPresent
    ? [
        input.marketGeoLabel ? `Market read: ${input.marketGeoLabel.trim()}` : null,
        input.marketSource?.trim() || 'Oregon Data Share / MarketPulse',
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  const placeLinks: Array<{ label: string; href: string }> = []
  for (const p of input.placeLinks ?? []) {
    const label = p.label.trim()
    const href = p.href.trim()
    if (!label || !href) continue
    if (placeLinks.some((x) => x.href === href)) continue
    placeLinks.push({ label, href })
  }
  for (const p of [input.subdivision, input.community, input.neighborhood]) {
    if (!p) continue
    const label = p.label.trim()
    const href = p.href.trim()
    if (!label || !href) continue
    if (placeLinks.some((x) => x.href === href)) continue
    placeLinks.push({ label, href })
  }

  const nearby =
    input.nearbyActiveCount != null && Number.isFinite(input.nearbyActiveCount)
      ? Math.round(input.nearbyActiveCount)
      : null
  const sold =
    input.recentSoldCount != null && Number.isFinite(input.recentSoldCount)
      ? Math.round(input.recentSoldCount)
      : null
  const names = (input.nearbyActiveLabels ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
  let competitionSummary: string | null = null
  if (nearby != null) {
    const named = names.length ? ` (incl. ${names.join(', ')})` : ''
    competitionSummary =
      sold != null
        ? `${nearby} nearby active${nearby === 1 ? '' : 's'}${named} · ${sold} recent solds in this report`
        : `${nearby} nearby active${nearby === 1 ? '' : 's'}${named}`
  } else if (sold != null) {
    competitionSummary = `${sold} recent solds in this report`
  }

  const lo = trim(input.priceBandLo)
  const hi = trim(input.priceBandHi)
  const bandActive =
    input.priceBandActiveCount != null && Number.isFinite(input.priceBandActiveCount)
      ? Math.round(input.priceBandActiveCount)
      : null
  let priceBandSummary: string | null = null
  if (lo && hi) {
    priceBandSummary =
      bandActive != null
        ? `List competition in the ${lo}–${hi} ask band (${bandActive} active)`
        : `List competition in the ${lo}–${hi} ask band`
  }

  const saleClusterBands =
    input.saleClusterBands && input.saleClusterBands.length > 0
      ? input.saleClusterBands
      : clusterSalePriceBands(input.closedSalePrices ?? [])

  return { marketDataLine, placeLinks, competitionSummary, priceBandSummary, saleClusterBands }
}

export function cmaProductBarHtml(bar: CmaProductBar): string {
  const parts: string[] = []
  if (bar.placeLinks.length) {
    const links = bar.placeLinks
      .map((l) => `<a href="${escapeAttr(l.href)}">${escapeMinimal(l.label)}</a>`)
      .join(' · ')
    parts.push(`<div class="product-bar-item"><span class="product-bar-k">Place</span> ${links}</div>`)
  }
  if (bar.competitionSummary) {
    parts.push(
      `<div class="product-bar-item"><span class="product-bar-k">Competition</span> ${escapeMinimal(bar.competitionSummary)}</div>`,
    )
  }
  if (bar.saleClusterBands.length) {
    const clusters = bar.saleClusterBands
      .map((b) => `${escapeMinimal(b.loLabel)}–${escapeMinimal(b.hiLabel)} (${b.saleCount})`)
      .join(' · ')
    parts.push(
      `<div class="product-bar-item"><span class="product-bar-k">Price bands</span> Closed sales cluster: ${clusters}</div>`,
    )
  } else if (bar.priceBandSummary) {
    parts.push(
      `<div class="product-bar-item"><span class="product-bar-k">Price bands</span> ${escapeMinimal(bar.priceBandSummary)}</div>`,
    )
  }
  if (bar.marketDataLine) {
    parts.push(
      `<div class="product-bar-item"><span class="product-bar-k">Market data</span> ${escapeMinimal(bar.marketDataLine)}</div>`,
    )
  }
  if (!parts.length) return ''
  return `<aside class="cma-product-bar" data-cma-product-bar="1" style="background:${FSBO_CMA_BRAND.cream};color:${FSBO_CMA_BRAND.navy};border-top:2px solid ${FSBO_CMA_BRAND.navy}">${parts.join('')}</aside>`
}

function escapeMinimal(t: string): string {
 return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeAttr(t: string): string {
 return escapeMinimal(t).replace(/'/g, '&#39;')
}

/** Guard: subjects must never contain bare CMA acronym as the lead. */
export function subjectHasBareCma(subject: string): boolean {
  return /^\s*CMA\b/i.test(subject) || /\bCMA\s*[-\u2013\u2014]/.test(subject)
}
