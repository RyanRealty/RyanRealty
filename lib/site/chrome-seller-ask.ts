/**
 * Chrome shows the filled seller ask on Sell leaves, not on /sell itself.
 *
 * /sell already has the address-field submit. A second filled Value my home
 * in chrome is auto-fail 14 (two primaries). Buyer pages stay false (auto-fail 1).
 * The door stays in the Sell nav group everywhere.
 */
export function chromeShowsSellerAsk(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const path = pathname.split('?')[0] ?? ''
  return path.startsWith('/sell/')
}
