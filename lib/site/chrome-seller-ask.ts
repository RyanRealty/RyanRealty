/**
 * Chrome shows the filled seller ask only on Sell.
 *
 * Page Grade 2026-08-14 class wrong-job-chrome: Value my home as a visible
 * filled control on buyer, place, market, about, or listing pages is auto-fail 1.
 * Seller lives on Sell. The door stays in the Sell nav group everywhere.
 */
export function chromeShowsSellerAsk(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const path = pathname.split('?')[0] ?? ''
  return path === '/sell' || path.startsWith('/sell/')
}
