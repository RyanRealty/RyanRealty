'use client'

import Link from 'next/link'
import Image from 'next/image'

export type BlogPost = {
  id: string
  title: string
  excerpt: string
  slug: string
  imageUrl?: string | null
  publishedAt: string
  readTimeMinutes?: number
  category?: string | null
}

type Props = {
  posts: BlogPost[]
}

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&q=80'

export default function BlogTeaser({ posts }: Props) {
  if (posts.length === 0) return null

  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="blog-teaser-heading">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="blog-teaser-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            Latest Insights
          </h2>
          <Link
            href="/blog"
            className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            Read More
          </Link>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {posts.slice(0, 3).map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-xl border border-[var(--gray-border)] bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-[var(--gray-bg)]">
                <Image
                  src={post.imageUrl ?? PLACEHOLDER_IMAGE}
                  alt=""
                  fill
                  className="object-cover transition group-hover:scale-[1.02]"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
              <div className="p-4">
                {post.category && (
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                    {post.category}
                  </span>
                )}
                <h3 className="mt-1 line-clamp-2 font-semibold text-[var(--brand-navy)]">{post.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{post.excerpt}</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {new Date(post.publishedAt).toLocaleDateString('en-US')}
                  {post.readTimeMinutes != null && post.readTimeMinutes > 0 && ` · ${post.readTimeMinutes} min read`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
