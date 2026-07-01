/**
 * Pushed-detail route detection — §23 §9c (mobile navigation model).
 *
 * FUB suppresses the bottom tab bar on pushed detail views (contact detail,
 * deal detail) — observed mob-02 "Bottom tab bar NOT RENDERED on this screen".
 * CrmMobileTabBar hides itself and ConsoleQuickAction drops to the bottom
 * corner on these routes so the mobile detail gets the full-height canvas
 * with a single FAB.
 */
export function isPushedDetailPath(pathname: string): boolean {
  return /^\/admin\/(?:console\/leads|crm|crm\/deals|deals)\/\d+(?:\/|$)/.test(pathname)
}
