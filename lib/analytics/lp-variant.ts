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
