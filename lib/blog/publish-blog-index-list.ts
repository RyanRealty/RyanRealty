/**
 * Blog index ItemList lock.
 *
 * Paginated /blog JSON-LD must list each published post once. Fleet
 * b75fc748ac2130f76a109a6f045121a9: /blog?page=2 and /blog?page=3 both
 * listed Vacation Rental Rules because published_at ties made OFFSET
 * unstable, and page-local positions hid the overlap.
 *
 * Positions are collection-global (page 2 starts at 13). Duplicate slugs
 * on one page are dropped. The DAL order is published_at DESC, id ASC.
 */
export type BlogIndexListPost = {
  slug: string
  title: string
}

export type PublishedBlogIndexListItem = {
  '@type': 'ListItem'
  position: number
  url: string
  name: string
}

export type PublishedBlogIndexList = {
  '@type': 'ItemList'
  numberOfItems: number
  itemListElement: PublishedBlogIndexListItem[]
}

export function publishBlogIndexItemList(input: {
  posts: readonly BlogIndexListPost[]
  offset: number
  total: number
  siteUrl: string
}): PublishedBlogIndexList {
  const siteUrl = input.siteUrl.replace(/\/$/, '')
  const seen = new Set<string>()
  const itemListElement: PublishedBlogIndexListItem[] = []
  for (const post of input.posts) {
    const slug = post.slug?.trim()
    const title = post.title?.trim()
    if (!slug || !title || seen.has(slug)) continue
    seen.add(slug)
    itemListElement.push({
      '@type': 'ListItem',
      position: input.offset + itemListElement.length + 1,
      url: `${siteUrl}/blog/${encodeURIComponent(slug)}`,
      name: title,
    })
  }
  return {
    '@type': 'ItemList',
    numberOfItems: input.total,
    itemListElement,
  }
}
