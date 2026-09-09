/**
 * The blog's category vocabulary, one list. Read by the index routes
 * (/blog/category/<category>, SITE-29) to validate a path segment, by the
 * admin editor through getBlogCategories(), and by the index view for its
 * category links. 'All' is the bare index, never a category path.
 */
export const BLOG_CATEGORIES = [
  'All',
  'Market Reports',
  'Market Updates',
  'Market Analysis',
  'Buying Guides',
  'Selling Guides',
  'Community Spotlights',
  'Lifestyle & Living',
  'Investment & Finance',
  'First-Time Buyers',
  'Relocation Guides',
  'Home Improvement',
  'Local Housing News',
] as const

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]

/** A real category path segment: in the list and not the 'All' pseudo-category. */
export function isBlogCategoryPath(value: string | null | undefined): value is Exclude<BlogCategory, 'All'> {
  return !!value && value !== 'All' && (BLOG_CATEGORIES as readonly string[]).includes(value)
}
