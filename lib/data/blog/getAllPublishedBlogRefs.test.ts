/**
 * toPublishedBlogRefs — the shape rules behind the place→blog direction.
 * Pure, so no Supabase mock: the query is one filtered select, the judgment is
 * here.
 */
import { describe, expect, it } from 'vitest'
import { toPublishedBlogRefs, type PublishedBlogRow } from './getAllPublishedBlogRefs'

const row = (over: Partial<PublishedBlogRow> = {}): PublishedBlogRow => ({
  slug: 'tetherow-resort-living-real-estate',
  title: 'Tetherow resort living',
  excerpt: 'What it is like to live at Tetherow.',
  published_at: '2026-09-08T09:00:00+00:00',
  tags: ['tetherow', 'bend'],
  category: 'Communities',
  ...over,
})

describe('toPublishedBlogRefs', () => {
  it('carries slug, title, excerpt, date and tags through', () => {
    const [ref] = toPublishedBlogRefs([row()])
    expect(ref).toMatchObject({
      slug: 'tetherow-resort-living-real-estate',
      title: 'Tetherow resort living',
      excerpt: 'What it is like to live at Tetherow.',
      publishedAt: '2026-09-08T09:00:00+00:00',
      tags: ['tetherow', 'bend'],
      category: 'Communities',
    })
  })

  it('resolves a LOCAL hero for every post — never a remote URL (P0-4)', () => {
    const [ref] = toPublishedBlogRefs([row()])
    expect(ref?.heroImageUrl.startsWith('/')).toBe(true)
  })

  it('treats a blank category as absent', () => {
    expect(toPublishedBlogRefs([row({ category: '  ' })])[0]?.category).toBeNull()
  })

  it('drops a post with no slug, no title, or no publish date', () => {
    const refs = toPublishedBlogRefs([
      row({ slug: '   ' }),
      row({ slug: 'b', title: '  ' }),
      row({ slug: 'c', published_at: null }),
      row({ slug: 'keeper' }),
    ])
    expect(refs.map((r) => r.slug)).toEqual(['keeper'])
  })

  it('turns a blank excerpt into null rather than an empty line on the page', () => {
    expect(toPublishedBlogRefs([row({ excerpt: '   ' })])[0]?.excerpt).toBeNull()
    expect(toPublishedBlogRefs([row({ excerpt: null })])[0]?.excerpt).toBeNull()
  })

  it('normalizes a null tags column to an empty array so the matcher can read it', () => {
    expect(toPublishedBlogRefs([row({ tags: null })])[0]?.tags).toEqual([])
  })

  it('drops non-string tag entries rather than passing them to the matcher', () => {
    const refs = toPublishedBlogRefs([row({ tags: ['bend', null as unknown as string, 'tetherow'] })])
    expect(refs[0]?.tags).toEqual(['bend', 'tetherow'])
  })

  it('trims the slug and the title, which are a URL and an accessible name', () => {
    const refs = toPublishedBlogRefs([row({ slug: '  a-post  ', title: '  A post  ' })])
    expect(refs[0]?.slug).toBe('a-post')
    expect(refs[0]?.title).toBe('A post')
  })
})
