/**
 * /guides/[slug] — permanently redirected to /blog/[slug] (IA plan content hub).
 * next.config also 301s /guides/:slug → /blog/:slug.
 */
import { permanentRedirect } from 'next/navigation'

export default async function GuideDetailRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  permanentRedirect(`/blog/${slug}`)
}
