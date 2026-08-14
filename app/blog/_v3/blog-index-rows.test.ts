import { describe, expect, it } from 'vitest'
import { blogIndexCaption, blogIndexRow } from './blog-index-rows'

describe('blog index rows', () => {
  it('prints the count as a caption, never a table name', () => {
    expect(blogIndexCaption(55, 'All')).toBe('55 posts')
    expect(blogIndexCaption(1, 'All')).toBe('1 post')
    expect(blogIndexCaption(12, 'Inventory')).toBe('12 posts in Inventory')
    expect(blogIndexCaption(55, 'All')).not.toMatch(/blog_posts/)
  })

  it('drops a post with no title or slug', () => {
    expect(blogIndexRow({ title: '', slug: 'x', read_time_min: 4 })).toBeNull()
    expect(blogIndexRow({ title: 'A post', slug: '  ', read_time_min: 4 })).toBeNull()
  })

  it('makes the newest post a door', () => {
    const row = blogIndexRow({
      title: 'Bend inventory in July',
      slug: 'bend-inventory-july',
      excerpt: 'What sold.',
      published_at: '2026-07-02',
      read_time_min: 6,
      hero_image_url: '/images/blog/july.jpg',
    })
    expect(row?.href).toBe('/blog/bend-inventory-july')
    expect(String(row?.what)).toBe('Bend inventory in July')
    expect(row?.media?.src).toBe('/images/blog/july.jpg')
  })
})
