/**
 * Chrome shows the filled seller ask on Sell leaves that do not already own
 * a filled Value my home on the page.
 *
 * /sell — address-field submit is the ask; chrome stays empty (auto-fail 14).
 * /sell/valuation — form submit is the ask; chrome fill XOR form (PAGE_INVENTORY).
 * Other /sell/* leaves (FSBO, expired) — chrome fills; Stage action is ghost.
 * Buyer pages stay false (auto-fail 1). The door stays in the Sell nav group.
 */
export function chromeShowsSellerAsk(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const path = pathname.split('?')[0] ?? ''
  if (path === '/sell/valuation' || path.startsWith('/sell/valuation/')) return false
  return path.startsWith('/sell/')
}
