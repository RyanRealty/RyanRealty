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
    <section className="w-full bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="blog-teaser-heading">
      <div className="w-full">
        <div className="flex items-center justify-between gap-4">
          <h2 id="blog-teaser-heading" className="text-2xl font-bold tracking-tight text-primary">
            Latest Insights
          </h2>
          <Link
            href="/blog"
            className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
          >
            Read More
          </Link>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {posts.slice(0, 3).map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition hover:shadow-lg hover:-translate-y-1"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                <Image
                  src={post.imageUrl ?? PLACEHOLDER_IMAGE}
                  alt={post.title || 'Blog post image'}
                  fill
                  className="object-cover transition group-hover:scale-[1.02]"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
              <div className="p-4">
                {post.category && (
                  <span className="text-xs font-medium uppercase tracking-wide text-accent-foreground">
                    {post.category}
                  </span>
                )}
                <h3 className="mt-1 line-clamp-2 font-semibold text-primary">{post.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                <p className="mt-2 text-xs text-muted-foreground">
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
