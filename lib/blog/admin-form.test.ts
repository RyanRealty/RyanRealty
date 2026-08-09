/**
 * The regression these lock is a live publish, not a rendering nit: the form
 * used to read `published_at` where it meant `status`, so opening any of the 32
 * non-published posts and saving pushed it to the public blog.
 */
import { describe, expect, it } from 'vitest'
import { blogFormFromPost, statusOptions, type BlogPostForForm } from './admin-form'

const ROW: BlogPostForForm = {
  id: 'a1',
  slug: 'bend-market-report',
  title: 'Bend market report',
  content: 'body',
  excerpt: 'excerpt',
  category: 'market',
  tags: ['bend', 'market'],
  hero_image_url: null,
  seo_title: null,
  seo_description: null,
  status: 'draft',
  // The whole defect in one field: every real row has one of these.
  published_at: '2026-04-01T00:00:00Z',
}

describe('blogFormFromPost', () => {
  it('takes the status from the status column, not from published_at', () => {
    const form = blogFormFromPost({ ...ROW, status: 'draft' })
    expect(form.status).toBe('draft')
    expect(form.publishedAt).toBe('2026-04-01T00:00:00Z')
  })

  it('does not publish an archived post that carries a publish date', () => {
    const form = blogFormFromPost({ ...ROW, status: 'archived_stats_unverified' })
    expect(form.status).toBe('archived_stats_unverified')
  })

  it('preserves pending_pilot_review rather than collapsing it', () => {
    const form = blogFormFromPost({ ...ROW, status: 'pending_pilot_review' })
    expect(form.status).toBe('pending_pilot_review')
  })

  it('falls back to draft, never published, when the read omitted the column', () => {
    const form = blogFormFromPost({ ...ROW, status: undefined })
    expect(form.status).toBe('draft')
  })

  it('keeps a published post published', () => {
    expect(blogFormFromPost({ ...ROW, status: 'published' }).status).toBe('published')
  })

  it('carries the rest of the row across unchanged', () => {
    const form = blogFormFromPost(ROW)
    expect(form.tags).toBe('bend, market')
    expect(form.title).toBe('Bend market report')
    expect(form.heroImageUrl).toBe('')
  })
})

describe('statusOptions', () => {
  it('offers the two editorial states for an ordinary post', () => {
    expect(statusOptions('draft')).toEqual(['draft', 'published'])
  })

  it('keeps a non-editorial state selectable so a save cannot drop it', () => {
    expect(statusOptions('archived_stats_unverified')).toEqual([
      'draft',
      'published',
      'archived_stats_unverified',
    ])
  })
})
