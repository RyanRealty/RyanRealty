'use server'

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

export type BlogPostRow = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string | null
  hero_image_url: string | null
  published_at: string | null
  author_broker_id: string | null
  seo_title: string | null
  seo_description: string | null
}

export type BlogPostWithAuthor = BlogPostRow & {
  author_name: string | null
  author_slug: string | null
  author_photo_url: string | null
}

const PAGE_SIZE = 12
const CATEGORIES = ['All', 'Market Reports', 'Community Guides', 'Buying Tips', 'Selling Tips', 'Lifestyle'] as const

export async function getPublishedBlogPosts(options: {
  category?: string | null
  limit?: number
  offset?: number
}): Promise<{ posts: BlogPostWithAuthor[]; total: number }> {
  const supabase = getSupabase()
  if (!supabase) return { posts: [], total: 0 }
  const limit = options.limit ?? PAGE_SIZE
  const offset = options.offset ?? 0
  let query = supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, category, hero_image_url, published_at, author_broker_id, seo_title, seo_description', { count: 'exact' })
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
  if (options.category && options.category !== 'All') {
    query = query.eq('category', options.category)
  }
  const { data: rows, count, error } = await query.range(offset, offset + limit - 1)
  if (error) return { posts: [], total: 0 }
  const posts = (rows ?? []) as BlogPostRow[]
  const brokerIds = [...new Set(posts.map((p) => p.author_broker_id).filter(Boolean))] as string[]
  const brokers = brokerIds.length
    ? await supabase.from('brokers').select('id, display_name, slug, photo_url').in('id', brokerIds)
    : { data: [] }
  const brokerMap = new Map((brokers.data ?? []).map((b) => [b.id, b]))
  const withAuthor: BlogPostWithAuthor[] = posts.map((p) => {
    const author = p.author_broker_id ? brokerMap.get(p.author_broker_id) : null
    return {
      ...p,
      author_name: author?.display_name ?? null,
      author_slug: author?.slug ?? null,
      author_photo_url: author?.photo_url ?? null,
    }
  })
  return { posts: withAuthor, total: count ?? 0 }
}

export async function getBlogCategories(): Promise<readonly string[]> {
  return CATEGORIES
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPostWithAuthor | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data: row } = await supabase
    .from('blog_posts')
    .select('id, title, slug, content, excerpt, category, tags, hero_image_url, published_at, author_broker_id, seo_title, seo_description')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  if (!row) return null
  const post = row as BlogPostRow & { content: string | null; tags: string[] | null }
  let author_name: string | null = null
  let author_slug: string | null = null
  let author_photo_url: string | null = null
  if (post.author_broker_id) {
    const { data: broker } = await supabase.from('brokers').select('display_name, slug, photo_url').eq('id', post.author_broker_id).single()
    if (broker) {
      author_name = (broker as { display_name?: string }).display_name ?? null
      author_slug = (broker as { slug?: string }).slug ?? null
      author_photo_url = (broker as { photo_url?: string }).photo_url ?? null
    }
  }
  return {
    ...post,
    author_name,
    author_slug,
    author_photo_url,
  }
}

export async function getPopularBlogSlugs(limit: number = 5): Promise<string[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((r: { slug: string }) => r.slug)
}

