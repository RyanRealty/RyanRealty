/**
 * Pure address→slug helper, dependency-free so any runtime (server, edge,
 * client bundle graph) can import it without dragging node:crypto along
 * (lib/cma-request re-exports it for back-compat; importing cma-request pulls
 * the GA4 measurement-protocol module, which broke a Turbopack prod build
 * when the outreach DAL reached it — 2026-07-11).
 *
 * Slugify an address into `cma-<short-form>`, max 40 chars, kebab-case.
 * Stable for the same address — used as the public `public.cmas.slug`.
 */
export function slugifyAddress(address: string): string {
  const base = address
    .toLowerCase()
    .replace(/[,]/g, ' ')
    .replace(/\b(road|rd|street|st|avenue|ave|drive|dr|lane|ln|court|ct|place|pl|boulevard|blvd|highway|hwy|parkway|pkwy|circle|cir|trail|trl|terrace|ter|way|loop)\b/gi, '')
    .replace(/\b(oregon|or|bend|97701|97702|97703|97703|97707|97712|97739|97759|97760|97741)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  const slug = `cma-${base}`
  return slug.length > 40 ? slug.slice(0, 40).replace(/-+$/g, '') : slug
}
