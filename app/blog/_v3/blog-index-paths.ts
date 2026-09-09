/**
 * The blog index's URL grammar (SITE-29).
 *
 * The bare index reads no query, so it prerenders and revalidates. Category
 * and page views live on their own paths and revalidate the same way:
 *
 *   /blog                                  All, page 1
 *   /blog/category/<category>              one category, page 1
 *   /blog/page/<n>                         All, page n (n ≥ 2)
 *   /blog/category/<category>/page/<n>     one category, page n (n ≥ 2)
 *
 * The legacy `?category=` and `?page=` forms 308 to these in next.config.
 * Pure: href building and parsing only, so the three routes and the view
 * cannot drift from each other.
 */

export const BLOG_PAGE_SIZE = 12

export type BlogIndexLocator = { category: string; page: number }

export function blogIndexHref({ category, page }: BlogIndexLocator): string {
  const cat = category.trim()
  const base = !cat || cat === 'All' ? '/blog' : `/blog/category/${encodeURIComponent(cat)}`
  if (page <= 1) return base
  return `${base}/page/${page}`
}

/** A path segment back to the category label it encodes; null when empty. */
export function decodeBlogCategorySegment(segment: string | undefined): string | null {
  if (!segment) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    return null
  }
  const cat = decoded.trim()
  return cat ? cat : null
}

/**
 * A page segment as a page number, or null when it is not a page this route
 * serves: page 1 lives at the bare path (next.config sends /page/1 there),
 * so only integers ≥ 2 are valid here.
 */
export function parseBlogPageSegment(segment: string | undefined): number | null {
  if (!segment || !/^\d+$/.test(segment)) return null
  const n = Number(segment)
  return Number.isSafeInteger(n) && n >= 2 ? n : null
}

export function blogIndexTotalPages(total: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / BLOG_PAGE_SIZE))
}

export type BlogIndexCrumb = { label: string; href?: string }

/**
 * The breadcrumb for an index view: Home › Blog on the bare index, then the
 * category and the page as the path deepens. The last crumb carries no href
 * (it is the page); every earlier crumb links to the index above it.
 */
export function blogIndexTrail({ category, page }: BlogIndexLocator): BlogIndexCrumb[] {
  const cat = category.trim()
  const hasCategory = Boolean(cat) && cat !== 'All'
  const trail: BlogIndexCrumb[] = [{ label: 'Home', href: '/' }, { label: 'Blog', href: '/blog' }]
  if (hasCategory) trail.push({ label: cat, href: blogIndexHref({ category: cat, page: 1 }) })
  if (page >= 2) trail.push({ label: `Page ${page}` })
  const last = trail[trail.length - 1]
  delete last.href
  return trail
}
