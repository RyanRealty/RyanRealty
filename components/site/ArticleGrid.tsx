import Image from 'next/image'
import Link from 'next/link'
import {
  Body,
  Container,
  Eyebrow,
  Grid,
  H2,
  Section,
  Stack,
  TextLink,
} from '@/components/site/primitives'
import type { BlogPostCard } from '@/lib/data'

/**
 * Site v2 article grid — a row of blog / guide cards for city + community
 * pages ("guides & insights" rail). Cards link to /blog/<slug>. Photo, category
 * eyebrow, title, excerpt. Returns null when there are no posts so the section
 * never renders an empty shell.
 *
 * Posts come from getRecentBlogPosts (published only). The hero images are the
 * post's own hero_image_url (editorial stock is acceptable on an article card,
 * unlike a place tile that must show the real place).
 */

type Props = {
  items: ReadonlyArray<BlogPostCard>
  eyebrow?: string
  heading?: string
  subtitle?: string
  /** View-all link target. Default "/blog". */
  viewAllHref?: string
  tone?: 'default' | 'muted'
}

export function ArticleGrid({
  items,
  eyebrow = 'Guides & insights',
  heading = 'From the blog',
  subtitle,
  viewAllHref = '/blog',
  tone = 'default',
}: Props) {
  if (!items || items.length === 0) return null

  return (
    <Section padding="default" tone={tone} divider>
      <Container>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <Stack gap="tight">
            <Eyebrow>{eyebrow}</Eyebrow>
            <H2>{heading}</H2>
            {subtitle ? (
              <Body size="small" tone="muted">
                {subtitle}
              </Body>
            ) : null}
          </Stack>
          <TextLink href={viewAllHref} underline="on-hover" className="whitespace-nowrap text-sm">
            Read the blog →
          </TextLink>
        </div>

        <Grid cols={3} gap="default">
          {items.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group block bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:border-primary/40 hover:shadow-md transition"
            >
              {post.heroImageUrl ? (
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <Image
                    src={post.heroImageUrl}
                    alt={post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
              ) : null}
              <div className="p-5">
                {post.category ? (
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                    {post.category}
                  </div>
                ) : null}
                <h3 className="mt-1 font-semibold text-foreground leading-snug line-clamp-2">
                  {post.title}
                </h3>
                {post.excerpt ? (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
