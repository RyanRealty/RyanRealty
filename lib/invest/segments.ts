/**
 * The income-side segments the investor surfaces count, in door order.
 * ONE list (section 0's one-source rule): /invest's per-type doors and the
 * homepage's Investing door both read it, so the two pages cannot count
 * different populations. Detached/SFR is deliberately absent — that is the
 * buyer story.
 */
export const INVEST_SEGMENTS = ['multifamily_2_4', 'commercial_sale', 'land', 'farm', 'business'] as const

export type InvestSegment = (typeof INVEST_SEGMENTS)[number]
