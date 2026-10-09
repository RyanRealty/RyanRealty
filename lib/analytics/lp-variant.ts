/**
 * The landing-page variant a visit's landing path belongs to, or null when the
 * path is not a landing page. One reading for the LP leaderboard
 * (lib/data/analytics/getLpLeaderboard.ts), the action-required queue and the
 * daily analytics digest, which each carried a copy that knew only /lp/<slug>
 * and /home-valuation, so all three went empty when those pages 308'd on
 * 2026-09-06 (next.config.ts).
 *
 * Each live page keeps the variant its /lp page reported, so a series runs
 * across the move: /sell and /sell/valuation are seller-home-value (as
 * /home-valuation was), /sell/expired-listings is expired-listing,
 * /sell/for-sale-by-owner is fsbo. The buyer landing pages are buy-<intent>.
 * A /lp/<slug> landing from before the move still reads as <slug>. Pure.
 *
 * These are PAGE variants, one per landing page, for session reports. The
 * lp_variant a form sends GA4 is a FORM variant, and several pages share one:
 * every /sell page sends seller-home-value and every /buy page sends
 * lead-landing-buyer. No report joins the two; the lead-flow report keys its
 * GA4 column on the form variant and its sessions on paths.
 */
export function lpVariantFromPath(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  let p = pathOrUrl
  try {
    p = new URL(pathOrUrl).pathname
  } catch {
    /* already a path */
  }
  p = (p.split(/[?#]/)[0] ?? '').toLowerCase().replace(/\/+$/, '')
  if (p === '/sell' || p === '/sell/valuation' || p === '/home-valuation') return 'seller-home-value'
  if (p === '/sell/expired-listings') return 'expired-listing'
  if (p === '/sell/for-sale-by-owner') return 'fsbo'
  const buy = p.match(/^\/buy\/([a-z0-9-]+)$/)
  if (buy) return `buy-${buy[1]}`
  const lp = p.match(/^\/lp\/([a-z0-9-]+)/)
  return lp ? lp[1] : null
}

/** Live pages for the variants whose /lp page 308s or never existed. */
const LIVE_PATH_BY_VARIANT: Record<string, string> = {
  'seller-home-value': '/sell',
  'sell-your-home': '/sell',
  'expired-listing': '/sell/expired-listings',
  fsbo: '/sell/for-sale-by-owner',
  'buyer-listing-alerts': '/homes-for-sale',
}

/**
 * The page to open for a variant from lpVariantFromPath: its live page, never a
 * /lp path that 308s (two hops with the trailing slash) or 404s (buy-<intent>
 * has no /lp page). Any other history slug keeps its /lp path, which the
 * 2026-09-06 redirects resolve. Pure.
 */
export function lpPathForVariant(variant: string): string {
  if (variant.startsWith('buy-')) return `/buy/${variant.slice('buy-'.length)}`
  return LIVE_PATH_BY_VARIANT[variant] ?? `/lp/${variant}`
}
