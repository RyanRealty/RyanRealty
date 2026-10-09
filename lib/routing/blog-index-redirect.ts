/**
 * Retired WordPress and hollow blog-index paths that should 301 to /blog
 * rather than 404. next.config.ts also lists the prefix rules; middleware
 * runs this so a test can pin the destinations without booting Next.
 *
 * /blog/category/<valid> and /blog/page/<n>=2+ stay on their routes.
 */
import { isInvalidBlogIndexPath } from '@/lib/blog/index-path-guard'

function normalize(pathname: string): string {
  let p = pathname
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

/** Destination /blog when this path is a retired index shape, else null. */
export function resolveBlogIndexRedirect(pathname: string): string | null {
  const p = normalize(pathname)
  if (p === '/blog/category' || p === '/blog/page') return '/blog'
  if (p === '/blog/2017' || p.startsWith('/blog/2017/')) return '/blog'
  if (/^\/blog\/category\/[^/]+\/page$/.test(p)) return '/blog'
  if (isInvalidBlogIndexPath(pathname)) return '/blog'
  return null
}
