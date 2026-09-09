/**
 * Edge guard for the blog index's path family (SITE-29).
 *
 * /blog/category/<category>, /blog/page/<n> and /blog/category/<category>/page/<n>
 * are on-demand ISR routes with an empty generateStaticParams, so an unknown
 * segment would otherwise render the page, hit notFound() under
 * app/loading.tsx's Suspense boundary, and ship a hollow 200 (the soft-404
 * class middleware.ts already kills for /communities). This decides what the
 * edge can know without a database: the category is one of the fixed list
 * (never 'All', which next.config folds back to /blog) and the page segment
 * is an integer of two or more (page 1 folds back too). A page past the last
 * needs the post count and stays the route's own concern.
 */
import { BLOG_CATEGORIES } from './categories'

const CATEGORY_PATHS: ReadonlySet<string> = new Set(
  (BLOG_CATEGORIES as readonly string[]).filter((c) => c !== 'All'),
)

function decodeSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment).trim()
    return decoded || null
  } catch {
    return null
  }
}

function isPageSegment(segment: string): boolean {
  return /^\d+$/.test(segment) && Number(segment) >= 2 && Number.isSafeInteger(Number(segment))
}

/** True when the path is a blog index path the edge can already call a 404. */
export function isInvalidBlogIndexPath(pathname: string): boolean {
  const withCategory = pathname.match(/^\/blog\/category\/([^/]+)(?:\/page\/([^/]+))?\/?$/)
  if (withCategory) {
    const category = decodeSegment(withCategory[1])
    if (!category || !CATEGORY_PATHS.has(category)) return true
    if (withCategory[2] != null && !isPageSegment(withCategory[2])) return true
    return false
  }
  const pageOnly = pathname.match(/^\/blog\/page\/([^/]+)\/?$/)
  if (pageOnly) return !isPageSegment(pageOnly[1])
  return false
}
