/**
 * /buy/leverage route, doors, and area list. Figures live in leverage-data.ts.
 * Copy templates live in leverage-copy.ts so Writing Bot can swap them.
 *
 * TODO(BUY-2): point ALERTS_HREF at /buy/alerts when that page ships
 * (sibling worktree grok/buy-alerts-20261013). Until then the existing
 * price-drop alert form is the live capture. Open note: that page uses the
 * fallback H1/meta (hourly cron, no same-day claim), no SMS, and no
 * unsupported price/beds filters.
 */
export const ROUTE_PATH = '/buy/leverage'

export const LEVERAGE_TITLE = 'Do Buyers Have Leverage in Bend? Live Numbers'

export const LEVERAGE_H1 = 'Buyers have leverage in Bend again. Here is the proof.'

export const LEVERAGE_EYEBROW = 'Bend and Central Oregon · live MLS numbers'

/** Existing listing-alert flow until /buy/alerts ships. */
export const ALERTS_HREF = '/price-drops'

export const LEVERAGE_LINKS = {
  bendMarket: '/housing-market/bend',
  bendCity: '/cities/bend',
  bendDrops: '/price-drops/bend',
  drops: '/price-drops',
  monthsOfSupply: '/months-of-supply',
  redmondMarket: '/housing-market/redmond',
  sistersMarket: '/housing-market/sisters',
  sunriverMarket: '/housing-market/sunriver',
  prinevilleMarket: '/housing-market/prineville',
  laPineMarket: '/housing-market/la-pine',
  shiftArticle: '/blog/bend-buyers-market-shift-2026',
  goodTime: '/blog/is-now-a-good-time-to-buy-in-bend',
  closingCosts: '/blog/closing-costs-buyers-bend-oregon',
  mortgage: '/tools/mortgage-calculator',
  method: '/how-we-get-our-numbers',
  book: '/book',
  homes: '/homes-for-sale',
  alerts: ALERTS_HREF,
  contactBuyer: '/contact?inquiry=Buying',
} as const

export const LEVERAGE_AREA_DEFS = [
  { slug: 'bend', name: 'Bend', href: LEVERAGE_LINKS.bendMarket, grain: 'city' as const },
  { slug: 'redmond', name: 'Redmond', href: LEVERAGE_LINKS.redmondMarket, grain: 'city' as const },
  { slug: 'sisters', name: 'Sisters', href: LEVERAGE_LINKS.sistersMarket, grain: 'city' as const },
  { slug: 'sunriver', name: 'Sunriver', href: LEVERAGE_LINKS.sunriverMarket, grain: 'city' as const },
  { slug: 'prineville', name: 'Prineville', href: LEVERAGE_LINKS.prinevilleMarket, grain: 'city' as const },
  { slug: 'la-pine', name: 'La Pine', href: LEVERAGE_LINKS.laPineMarket, grain: 'city' as const },
] as const

export type LeverageAreaSlug = (typeof LEVERAGE_AREA_DEFS)[number]['slug']

/** Flip this one constant to `buyer_question` if the weekly report becomes a consult. */
export const LEVERAGE_LEAD_TYPE = 'buyer_alerts' as const

export const LEVERAGE_FORM_ID = 'buyer_leverage_lp' as const

export const LEVERAGE_LP_VARIANT = 'buy-leverage'

export const MLS_SOURCE = 'Oregon Data Share MLS, single-family homes'

/** Printed when a MOS or pace cell is withheld. Never an em dash. */
export const CELL_UNPUBLISHED = 'not published'

export const LEVERAGE_TRAP = { name: 'company', label: 'Company' } as const

export const REGION_OVERLAY_KEY = 'region:central-oregon'
