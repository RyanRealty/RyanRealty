/**
 * Blog index rows. The posts are the page. The count is a caption.
 */

import { formatDate } from '@/lib/format/date'
import { v3Text, type V3LedgerPlainRow } from '@/components/site/v3'

export function blogIndexCaption(total: number, category: string): string {
  const noun = total === 1 ? 'post' : 'posts'
  const count = total.toLocaleString('en-US')
  const label = category.trim()
  if (!label || label === 'All') return `${count} ${noun}`
  return `${count} ${noun} in ${label}`
}

export function blogIndexRow(post: {
  title?: string | null
  slug?: string | null
  excerpt?: string | null
  category?: string | null
  published_at?: string | null
  read_time_min?: number
  hero_image_url?: string | null
}): V3LedgerPlainRow | null {
  const title = post.title?.trim()
  const slug = post.slug?.trim()
  if (!title || !slug) return null
  const excerpt = post.excerpt?.trim()
  const when = post.published_at ? formatDate(post.published_at) : post.category?.trim() || 'Guide'
  const read = typeof post.read_time_min === 'number' ? `${post.read_time_min} min read` : null
  const fallback = [post.category?.trim(), read].filter(Boolean).join(' · ')
  const photo = post.hero_image_url?.trim()
  return {
    href: `/blog/${slug}`,
    when: v3Text(when),
    what: v3Text(title),
    detail: excerpt ? v3Text(excerpt) : fallback ? v3Text(fallback) : undefined,
    id: slug,
    media: photo ? { src: photo } : undefined,
  }
}
