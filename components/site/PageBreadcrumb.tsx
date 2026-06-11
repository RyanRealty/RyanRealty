import { BreadcrumbNav, type BreadcrumbNavItem } from '@/components/site/BreadcrumbNav'
import { Container } from '@/components/site/primitives'

/**
 * PageBreadcrumb — THE canonical breadcrumb chrome for every public page.
 * Site-polish audit 2026-06-10 P1-1: the site had four breadcrumb chromes
 * (floating Container, a border-b band, a navy band, and detail-shell offsets
 * at y=113/y=125) plus label drift ("Ryan Realty" root on /about, three names
 * for the search surface). This wrapper is the fix-the-class consolidation:
 *
 *   - ONE placement: `Container pt-3 pb-1`, rendered as the first element of
 *     the page (above any hero), so the crumb sits at the same y on every page.
 *   - ONE root: "Home" -> "/" is baked in. Pages pass only the trail AFTER
 *     Home, so a brokerage-name or "Search" root cannot drift back in.
 *   - ONE tone: on-light. The on-navy variant is reserved for the full-bleed
 *     search map band (`app/search/[...slug]`), which renders BreadcrumbNav
 *     directly and is allowlisted in scripts/check-breadcrumb.mjs.
 *   - JSON-LD once: BreadcrumbList is emitted here by default. Pass
 *     `includeJsonLd={false}` ONLY when the page already emits a
 *     BreadcrumbList through MetadataBlock or a hand-written script.
 *
 * Label canon (enforced by scripts/check-breadcrumb.mjs, gate `ci:breadcrumb`):
 * sentence case ("Homes for sale", not "Homes for Sale"), real page names
 * ("About", never "Ryan Realty"), the search surface is always
 * "Homes for sale" -> /homes-for-sale.
 *
 * Do NOT render BreadcrumbNav directly from a page — the gate fails new
 * direct usages.
 */

type Props = {
  /** Crumbs AFTER the Home root. Last item is the current page (no href). */
  trail: ReadonlyArray<BreadcrumbNavItem>
  /**
   * Emit the schema.org BreadcrumbList JSON-LD (default true). Set false only
   * when the page already emits a BreadcrumbList elsewhere (MetadataBlock or
   * a JSON-LD script) so the trail is never emitted twice.
   */
  includeJsonLd?: boolean
}

export const BREADCRUMB_HOME: BreadcrumbNavItem = { label: 'Home', href: '/' }

export function PageBreadcrumb({ trail, includeJsonLd = true }: Props) {
  if (trail.length === 0) return null
  return (
    <Container className="pt-3 pb-1">
      <BreadcrumbNav items={[BREADCRUMB_HOME, ...trail]} includeJsonLd={includeJsonLd} />
    </Container>
  )
}
