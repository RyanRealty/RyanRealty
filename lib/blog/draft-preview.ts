/**
 * The words on the admin draft-preview banner (/admin/blog/preview/[slug]).
 * Pure, so the copy is unit-tested without rendering the route.
 */

export const REVISION_SUFFIX = '-revision'

export type DraftPreviewBanner = {
  title: string
  status: string
  /** Set when the slug is a revision of a live post. */
  revisionNote: string | null
}

/** The live slug a "-revision" row will replace, or null when it is not a revision. */
export function revisionBaseSlug(slug: string): string | null {
  if (!slug.endsWith(REVISION_SUFFIX)) return null
  const base = slug.slice(0, -REVISION_SUFFIX.length)
  return base ? base : null
}

export function draftPreviewBanner(input: { slug: string; status: string | null }): DraftPreviewBanner {
  const base = revisionBaseSlug(input.slug)
  return {
    title: 'Draft preview. Not public.',
    status: `Status: ${input.status?.trim() || 'not set'}`,
    revisionNote: base
      ? `Revision of /blog/${base}, the live post is unchanged until you approve.`
      : null,
  }
}
