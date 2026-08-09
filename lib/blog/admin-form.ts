/**
 * The /admin/blog edit form's prefill, as a pure function.
 *
 * WHY THIS IS NOT INSIDE THE PAGE. It used to be, and it carried a defect no
 * reviewer caught for months: the form derived its Status field from
 * `published_at` rather than from `status`.
 *
 *     status: post.published_at ? 'published' : 'draft'   // the bug
 *
 * Every one of the 87 posts carries a publish date, so that expression returned
 * 'published' for all of them — including the 32 that are not published
 * (archived_stats_unverified 28, draft 3, pending_pilot_review 1, measured
 * 2026-08-08). Opening any of those to fix a typo and pressing Save wrote
 * status:'published' and put it on the public blog. The public reader filters
 * on `status`, so the damage would have been immediate and invisible from this
 * screen, which showed only the publish date.
 *
 * It survived because it was unreachable by test: the logic lived in a
 * `'use client'` page component alongside DOM effects and a server action. Out
 * here it is a plain function over plain data, and admin-form.test.ts holds it
 * to the one behaviour that matters — the form shows the status the row
 * actually has, and preserves it.
 *
 * `blog_posts.status` is free text with a 'draft' default, not an enum, so the
 * unknown case is a real case and is passed through rather than normalised.
 */

/** The columns the prefill reads. Structural on purpose: this file must not
 *  import from the `'use server'` module that owns BlogPostWithAuthor. */
export type BlogPostForForm = {
  id: string
  slug: string
  title: string
  content?: string | null
  excerpt: string | null
  category: string | null
  tags?: string[] | null
  hero_image_url: string | null
  seo_title: string | null
  seo_description: string | null
  status?: string | null
  published_at: string | null
}

export type BlogFormState = {
  id?: string
  slug: string
  title: string
  content: string
  excerpt: string
  category: string
  tags: string
  heroImageUrl: string
  seoTitle: string
  seoDescription: string
  status: string
  publishedAt: string
}

/** The two states the editor offers. Anything else a row carries is kept. */
export const EDITORIAL_STATUSES = ['draft', 'published'] as const

export const EMPTY_BLOG_FORM: BlogFormState = {
  id: undefined,
  slug: '',
  title: '',
  content: '',
  excerpt: '',
  category: '',
  tags: '',
  heroImageUrl: '',
  seoTitle: '',
  seoDescription: '',
  status: 'draft',
  publishedAt: '',
}

/**
 * Prefill the edit form from a row.
 *
 * The status falls back to 'draft' only when the column was genuinely absent —
 * matching the table's own default — never to 'published'. A read that forgot
 * to select the column must not be able to publish anything.
 */
export function blogFormFromPost(post: BlogPostForForm): BlogFormState {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    content: post.content ?? '',
    excerpt: post.excerpt ?? '',
    category: post.category ?? '',
    tags: (post.tags ?? []).join(', '),
    heroImageUrl: post.hero_image_url ?? '',
    seoTitle: post.seo_title ?? '',
    seoDescription: post.seo_description ?? '',
    status: post.status ?? 'draft',
    publishedAt: post.published_at ?? '',
  }
}

/**
 * The options the Status control renders for a given form state.
 *
 * A row sitting in a non-editorial state still has to be editable, so its own
 * value is offered alongside the two editorial ones and stays selected unless
 * the editor deliberately picks another. Dropping it from the list would make
 * the control silently re-point the row on the next save.
 */
export function statusOptions(current: string): string[] {
  return (EDITORIAL_STATUSES as readonly string[]).includes(current)
    ? [...EDITORIAL_STATUSES]
    : [...EDITORIAL_STATUSES, current]
}
